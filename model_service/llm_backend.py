"""
Local LLM for the parts of journal analysis the emotion models do not cover:
  - intent      (what the entry is about, triggers, coping attempts)
  - reflection  (one CBT-aligned follow-up question)
  - memories    (short, durable facts worth remembering about the user)

Runs fully on this machine (default Qwen/Qwen2.5-1.5B-Instruct, Apache-2.0), so journal text never
leaves it. One generation produces all three parts as JSON; the result is cached per text, so the
backend's three separate calls for one journal entry cost a single generation.

Anything unusable (invalid JSON, labels outside the allowed lists, empty fields) raises
LLMUnavailable -> HTTP 503 -> the backend uses its built-in rules for that call. Safety/crisis
detection is deliberately NOT done here: it stays rule-based in the backend.
"""
import hashlib
import json
import logging
import re
import threading
from collections import OrderedDict

import torch

log = logging.getLogger("sentimed.llm")

INTENTS = [
    "work_stress", "academic_anxiety", "interpersonal_conflict", "family_concerns", "health_worry",
    "loneliness", "grief_loss", "self_esteem", "sleep_issues", "financial_stress",
    "positive_experience", "general_reflection",
]
CBT_TECHNIQUES = [
    "cognitive_reappraisal", "behavioral_activation", "strength_amplification", "cognitive_exploration",
    "self_compassion", "problem_solving", "grounding",
]
MEMORY_TYPES = ["trigger", "coping_pattern", "relationship", "goal", "preference", "life_event", "health"]

SYSTEM_PROMPT = f"""You analyse private wellbeing journal entries for a CBT-informed reflection app.
You are not a therapist and never diagnose. Reply with ONE JSON object and nothing else, with keys:
- "intent": the main topic, one of {INTENTS}.
  Work, job, manager, deadlines -> work_stress. Exams, study, grades -> academic_anxiety.
  Arguments with friends/partner/roommate -> interpersonal_conflict. A death -> grief_loss.
  A clearly good day -> positive_experience. Use general_reflection only if nothing else fits.
- "clarified_to": short snake_case summary of what the writer is dealing with.
- "triggers": up to 3 snake_case CAUSES of difficult feelings named in the text (not feelings, not good things). [] if none.
- "coping_attempts": up to 3 snake_case things the writer DID to feel better (e.g. exercise, talking_to_friend, breathing). [] if none.
- "reflection_prompt": ONE warm, open, non-judgemental question (max 30 words), second person, about this entry.
- "cbt_technique": one of {CBT_TECHNIQUES}. Good day -> strength_amplification; loss or self-criticism ->
  self_compassion; overload -> problem_solving; harsh or catastrophic thoughts -> cognitive_reappraisal;
  low energy or withdrawal -> behavioral_activation; panic or racing thoughts -> grounding.
- "memories": 0-2 lasting PATTERNS about the writer, third person starting with "The user", factual, never advice
  or judgement, each {{"text", "type": one of {MEMORY_TYPES}, "score": 0.0-1.0 importance}}. [] for trivial entries.
Use only what the entry says. Never put names, places, phone numbers or emails in memories."""

FEW_SHOT_USER = 'Journal entry:\n"""\nI have my chemistry final on Friday and I keep thinking I will fail. Called my sister and did some breathing which helped a bit.\n"""\n(The emotion model detected: nervousness.)'
FEW_SHOT_ASSISTANT = json.dumps({
    "intent": "academic_anxiety", "clarified_to": "fear_of_failing_upcoming_exam",
    "triggers": ["upcoming_final_exam"], "coping_attempts": ["talking_to_family", "breathing"],
    "reflection_prompt": "When the thought 'I will fail' shows up, what evidence do you have for and against it?",
    "cbt_technique": "cognitive_reappraisal",
    "memories": [{"text": "The user feels strong anxiety before exams.", "type": "trigger", "score": 0.8},
                 {"text": "The user finds talking to family and breathing exercises helpful.", "type": "coping_pattern", "score": 0.7}],
})


# Small LLMs are good at writing but weak at picking a category. When the LLM falls back to
# "general_reflection", clear keyword cues decide the topic instead; the topic then fixes a
# consistent CBT technique. The question, triggers, coping and memories stay the LLM's.
INTENT_CUES = [
    ("work_stress", r"\b(work|job|boss|manager|deadlines?|office|shift|colleague|coworker|client)\b"),
    ("academic_anxiety", r"\b(exams?|study|studying|test|grades?|assignment|semester|class|college|university)\b"),
    ("grief_loss", r"\b(passed away|passed|died|death|funeral|grief|miss (him|her|them))\b"),
    ("interpersonal_conflict", r"\b(argued|argument|fight|fought|snapped at|conflict|yelled)\b"),
    ("family_concerns", r"\b(mom|mum|dad|parents?|family|brother|sister)\b"),
    ("loneliness", r"\b(lonely|alone|isolated|no one|nobody)\b"),
    ("sleep_issues", r"\b(insomnia|can'?t sleep|couldn'?t sleep|no sleep|sleepless)\b"),
    ("health_worry", r"\b(sick|ill|pain|doctor|hospital|symptoms?)\b"),
    ("financial_stress", r"\b(money|rent|bills?|debt|loan|salary)\b"),
]
TECHNIQUE_FOR_INTENT = {
    "positive_experience": "strength_amplification",
    "grief_loss": "self_compassion",
    "self_esteem": "self_compassion",
    "work_stress": "problem_solving",
    "financial_stress": "problem_solving",
    "academic_anxiety": "cognitive_reappraisal",
    "interpersonal_conflict": "cognitive_reappraisal",
    "loneliness": "behavioral_activation",
    "sleep_issues": "grounding",
    "health_worry": "grounding",
}


def refine(result: dict, content: str) -> dict:
    lowered = content.lower()
    if result["intent"] == "general_reflection":
        for intent, pattern in INTENT_CUES:
            if re.search(pattern, lowered):
                result = {**result, "intent": intent}
                break
    technique = TECHNIQUE_FOR_INTENT.get(result["intent"])
    if technique:
        result = {**result, "cbt_technique": technique}
    return result


class LLMUnavailable(Exception):
    pass


def _snake(s, max_len=60):
    s = re.sub(r"[^a-z0-9]+", "_", str(s).lower()).strip("_")
    return s[:max_len]


def _str_list(v, limit=3):
    if not isinstance(v, list):
        return []
    out = []
    for x in v:
        x = _snake(x)
        if x and x not in out:
            out.append(x)
    return out[:limit]


def _first_json_object(text):
    start = text.find("{")
    if start < 0:
        raise ValueError("no JSON object")
    depth, in_str, esc = 0, False, False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
        elif ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return json.loads(text[start:i + 1])
    raise ValueError("unterminated JSON object")


def validate(raw: dict) -> dict:
    """Normalises the model's JSON; raises ValueError if the essentials are missing or invalid."""
    intent = _snake(raw.get("intent", ""))
    if intent not in INTENTS:
        raise ValueError(f"intent '{intent}' not allowed")
    prompt = str(raw.get("reflection_prompt", "")).strip().strip('"')
    if len(prompt) < 10 or "?" not in prompt:
        raise ValueError("reflection_prompt missing or not a question")
    prompt = prompt[: prompt.rfind("?") + 1]  # cut anything after the question
    technique = _snake(raw.get("cbt_technique", ""))
    if technique not in CBT_TECHNIQUES:
        technique = "cognitive_exploration"
    memories = []
    for m in raw.get("memories", []) if isinstance(raw.get("memories"), list) else []:
        if not isinstance(m, dict):
            continue
        text = str(m.get("text", "")).strip()
        mtype = _snake(m.get("type", ""))
        try:
            score = float(m.get("score", 0.5))
        except (TypeError, ValueError):
            score = 0.5
        # memories are third-person facts; drop first-person text, advice and judgements
        lowered = text.lower()
        if re.match(r"^(i|i'm|i am|my|you|your)\b", lowered) or re.search(r"\b(should|unproductive|need to)\b", lowered):
            continue
        # never store anything about masked personal data (placeholders like <EMAIL>, contact details)
        if "<" in text or re.search(r"\b(e-?mail|phone|number|address|aadhaar|ssn)\b", lowered):
            continue
        if 8 <= len(text) <= 240 and mtype in MEMORY_TYPES:
            memories.append({"text": text, "type": mtype, "score": round(min(1.0, max(0.0, score)), 2)})
    return {
        "intent": intent,
        "clarified_to": _snake(raw.get("clarified_to", "")) or intent,
        "triggers": _str_list(raw.get("triggers")),
        "coping_attempts": _str_list(raw.get("coping_attempts")),
        "reflection_prompt": prompt,
        "cbt_technique": technique,
        "memories": memories[:2],
    }


class LocalLLM:
    def __init__(self, model_id: str, device: str | None = None, max_new_tokens: int = 320, cache_size: int = 256):
        from transformers import AutoModelForCausalLM, AutoTokenizer

        if device is None:
            device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
        dtype = torch.float16 if device in ("cuda", "mps") else torch.float32
        self.model_id = model_id
        self.device = device
        self.max_new_tokens = max_new_tokens
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        self.model = AutoModelForCausalLM.from_pretrained(model_id, torch_dtype=dtype).to(device).eval()
        self._lock = threading.Lock()          # one generation at a time (GPU memory, MPS stability)
        self._cache: OrderedDict[str, dict] = OrderedDict()
        self._cache_size = cache_size
        log.info("Local LLM loaded: %s on %s (%s)", model_id, device, dtype)

    def _generate(self, user_text: str) -> str:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": FEW_SHOT_USER},
            {"role": "assistant", "content": FEW_SHOT_ASSISTANT},
            {"role": "user", "content": user_text},
        ]
        prompt = self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)
        with torch.no_grad():
            out = self.model.generate(
                **inputs, max_new_tokens=self.max_new_tokens, do_sample=False,
                repetition_penalty=1.05, pad_token_id=self.tokenizer.eos_token_id,
            )
        return self.tokenizer.decode(out[0, inputs["input_ids"].shape[1]:], skip_special_tokens=True)

    def analyse(self, content: str, emotion_hint: str | None = None) -> dict:
        """Intent + reflection + memories for one text. Cached by text; raises LLMUnavailable."""
        content = content.strip()[:4000]
        key = hashlib.sha256(content.encode()).hexdigest()
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                return self._cache[key]
            user = f"Journal entry:\n\"\"\"\n{content}\n\"\"\""
            if emotion_hint:
                user += f"\n(The emotion model detected: {emotion_hint}.)"
            last_err = None
            for attempt in range(2):  # one retry with a nudge if the first answer is unusable
                text = self._generate(user if attempt == 0 else user + "\nReturn only valid JSON.")
                try:
                    result = refine(validate(_first_json_object(text)), content)
                    break
                except (ValueError, json.JSONDecodeError) as e:
                    last_err = e
                    log.warning("LLM output rejected (attempt %d): %s", attempt + 1, e)
            else:
                raise LLMUnavailable(f"LLM output unusable: {last_err}")
            self._cache[key] = result
            if len(self._cache) > self._cache_size:
                self._cache.popitem(last=False)
            return result
