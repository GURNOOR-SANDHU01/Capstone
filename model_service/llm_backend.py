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
You are not a therapist and never diagnose. Reply with ONE JSON object and nothing else:
{{
  "intent": one of {INTENTS},
  "clarified_to": "a short snake_case description of what the writer is really dealing with",
  "triggers": ["up to 3 short snake_case triggers named in the text"],
  "coping_attempts": ["up to 3 short snake_case things the writer did to cope, only if mentioned"],
  "reflection_prompt": "ONE warm, open, non-judgemental question (max 30 words) that helps the writer explore this entry, in second person",
  "cbt_technique": one of {CBT_TECHNIQUES},
  "memories": [{{"text": "one short third-person fact about the user worth remembering, e.g. 'Exams are a recurring source of anxiety.'", "type": one of {MEMORY_TYPES}, "score": importance 0.0-1.0}}]
}}
Rules: use only what the entry says; empty lists are fine; at most 2 memories, none for trivial entries;
never include names, places, phone numbers or emails in memories; placeholders like <EMAIL> stay as they are."""


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
        messages = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_text}]
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
                    result = validate(_first_json_object(text))
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
