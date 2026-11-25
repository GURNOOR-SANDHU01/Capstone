"""
SentiMed local model service (FastAPI).

Wraps the ML team's pipeline in "Sentic Med AI_ML/" WITHOUT modifying it:
  - wavlm_attentive_emotion_pipeline.py  (audio: WavLM-large, 7 MELD emotions)
  - fusion_pipeline.py                   (Whisper -> SoulScribe text model + audio fusion)

Their scripts hard-code /workspace/... (the training box). This file re-points those
paths to local files before loading anything.

Implements the contract the Express backend's HttpModelAdapter already calls
(backend/docs/INTEGRATION_HANDOFF.md):
  GET  /health
  POST /api/analysis/emotions      (text; needs the SoulScribe text model)
plus one new endpoint for voice journals:
  POST /api/analysis/audio         (multipart "file"; any format ffmpeg can read)

plus, from a local LLM (llm_backend.py, default Qwen2.5-1.5B-Instruct; LOAD_LLM=false to disable):
  POST /api/analysis/intent        {content}
  POST /api/analysis/reflection    {content, primary_emotion?, ...}
  POST /api/analysis/memories      {content, primary_emotion?}
Safety is deliberately NOT a route here: crisis detection stays rule-based in the backend.
Any route that cannot answer returns 503, so the backend uses its built-in rules for that call.

Run:  .venv\\Scripts\\python -m uvicorn server:app --port 8000
"""

import os
import re
import sys
import uuid
import shutil
import logging
import subprocess
from pathlib import Path

import numpy as np
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile, Header
from pydantic import BaseModel, Field

log = logging.getLogger("sentimed.model")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# --------------------------------------------------------------------------- config
HERE = Path(__file__).resolve().parent
MODEL_DIR = Path(os.getenv("SENTIMED_MODEL_DIR", HERE.parent / "Sentic Med AI_ML")).resolve()
# Folder holding soulscribe_v8.pt + label_list.json (+ thresholds.json). Not shipped yet.
TEXT_MODEL_DIR = Path(os.getenv("SENTIMED_TEXT_MODEL_DIR", MODEL_DIR / "text_model")).resolve()
WAVLM_BASE = os.getenv("WAVLM_BASE", "microsoft/wavlm-large")      # config + feature extractor only
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "openai/whisper-small")
LOAD_WHISPER = os.getenv("LOAD_WHISPER", "true").lower() == "true"
# Used only while SoulScribe V8 weights are absent; set TEXT_FALLBACK_MODEL="" to disable
TEXT_FALLBACK = os.getenv("TEXT_FALLBACK_MODEL", "SamLowe/roberta-base-go_emotions")
API_KEY = os.getenv("MODEL_API_KEY", "")                           # optional shared secret
LOAD_LLM = os.getenv("LOAD_LLM", "true").lower() == "true"
LLM_MODEL = os.getenv("LLM_MODEL", "Qwen/Qwen2.5-1.5B-Instruct")
LLM_DEVICE = os.getenv("LLM_DEVICE") or None                       # default: cuda > mps > cpu
FFMPEG = os.getenv("FFMPEG_PATH") or shutil.which("ffmpeg")
if FFMPEG:  # the Whisper pipeline also calls "ffmpeg" by name when given a file path
    os.environ["PATH"] = str(Path(FFMPEG).parent) + os.pathsep + os.environ.get("PATH", "")
TMP_DIR = HERE / "tmp"
TMP_DIR.mkdir(exist_ok=True)
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

sys.path.insert(0, str(MODEL_DIR))
import wavlm_attentive_emotion_pipeline as audio_mod  # noqa: E402
from transformers import WavLMConfig, WavLMModel      # noqa: E402

# The fine-tuned checkpoint already contains every WavLM encoder weight, so only the
# architecture config is needed. Building from config skips a 1.2 GB base-weight download.
class _WavLMFromConfig(WavLMModel):
    @classmethod
    def from_pretrained(cls, path, **kwargs):
        return WavLMModel(WavLMConfig.from_pretrained(path, **kwargs))

audio_mod.WavLMModel = _WavLMFromConfig
audio_mod.MODEL_PATH = WAVLM_BASE
audio_mod.PROCESSOR_PATH = WAVLM_BASE
audio_mod.BEST_MODEL_PATH = str(MODEL_DIR / "wavlm_best_weights.pt")
audio_mod.LABEL_ENCODER_PATH = str(MODEL_DIR / "label_encoder_classes.npy")

import fusion_pipeline as fusion  # noqa: E402  (imports audio_mod; paths patched above)

fusion.AUDIO_WEIGHTS_PATH = audio_mod.BEST_MODEL_PATH
fusion.AUDIO_CLASSES_PATH = audio_mod.LABEL_ENCODER_PATH
fusion.WHISPER_MODEL = WHISPER_MODEL
fusion.TEXT_WEIGHTS_PATH = str(TEXT_MODEL_DIR / "soulscribe_v8.pt")
fusion.TEXT_LABELS_PATH = str(TEXT_MODEL_DIR / "label_list.json")
# thresholds.json shipped next to the audio weights has 27 values = the TEXT model's thresholds
_thr = TEXT_MODEL_DIR / "thresholds.json"
fusion.TEXT_THRESHOLDS_PATH = str(_thr if _thr.exists() else MODEL_DIR / "thresholds.json")
fusion.PARAMS_PATH = str(MODEL_DIR / "fusion_params.json")  # absent -> temperatures 1.0

NEGATIVE = ("anger", "disgust", "fear", "sadness")

# analyse_recording() computes the voice model's 7-class output but returns only the fused result.
# Keep the last raw audio logits so the API can also report the voice model's own probabilities.
# (Requests run one at a time: the audio endpoint is a blocking call on the event loop.)
_last_audio = {"logits": None, "windows": 0, "seconds": 0.0}
_orig_audio_predict = fusion.audio_predict

# ---- Full-length voice analysis ---------------------------------------------------------------
# The voice model was trained on 12 s clips, and the team's load_audio() cuts every recording at
# 12 s. Here the whole recording is kept and scored in consecutive 12 s windows (same input shape
# as training); the windows' logits are averaged. Clips of 12 s or less behave exactly as before.
WINDOW = audio_mod.MAX_AUDIO_SAMPLES
MIN_TAIL = int(audio_mod.TARGET_SAMPLE_RATE * 3)          # a last window shorter than 3 s is dropped
MAX_WINDOWS = int(os.getenv("VOICE_MAX_WINDOWS", "15"))   # 15 x 12 s = 3 min


def _load_audio_full(path: str):
    """Like audio_mod.load_audio, but long recordings are NOT truncated (short ones are padded)."""
    import soundfile as sf
    import torch.nn.functional as F
    try:
        data, sr = sf.read(path, dtype="float32")
        if data.ndim > 1:
            data = data.mean(axis=1)
        wav = torch.from_numpy(data)
        if sr != audio_mod.TARGET_SAMPLE_RATE:
            wav = F.interpolate(wav.view(1, 1, -1), size=int(len(wav) * audio_mod.TARGET_SAMPLE_RATE / sr),
                                mode="linear", align_corners=False).squeeze()
        if wav.shape[0] < int(audio_mod.TARGET_SAMPLE_RATE * audio_mod.MIN_AUDIO_DURATION):
            return None
        _last_audio["raw_seconds"] = wav.shape[0] / audio_mod.TARGET_SAMPLE_RATE
        if wav.shape[0] < WINDOW:
            wav = F.pad(wav, (0, WINDOW - wav.shape[0]))
        return wav.float()
    except Exception as e:  # same contract as the original: None on unreadable audio
        log.warning("Audio load error %s: %s", path, e)
        return None


def _windows(wav):
    """Splits one waveform into 12 s training-shaped windows."""
    import torch.nn.functional as F
    if wav.shape[0] <= WINDOW:
        return [wav]
    out = []
    for start in range(0, wav.shape[0], WINDOW):
        chunk = wav[start:start + WINDOW]
        if chunk.shape[0] < WINDOW:
            if out and chunk.shape[0] < MIN_TAIL:
                break
            chunk = F.pad(chunk, (0, WINDOW - chunk.shape[0]))
        out.append(chunk)
        if len(out) >= MAX_WINDOWS:
            break
    return out


def _audio_predict_windowed(model, processor, waveforms):
    """Per recording: score every 12 s window, average the logits -> shape (N, 7) like the original."""
    rows, n_windows = [], 0
    for wav in waveforms:
        wins = _windows(wav)
        n_windows += len(wins)
        rows.append(_orig_audio_predict(model, processor, wins).mean(axis=0))
    logits = np.stack(rows)
    max_seconds = n_windows * WINDOW / audio_mod.TARGET_SAMPLE_RATE
    _last_audio.update(logits=logits, windows=n_windows,
                       seconds=round(min(_last_audio.get("raw_seconds") or max_seconds, max_seconds), 1))
    return logits


audio_mod.load_audio = _load_audio_full
fusion.audio_predict = _audio_predict_windowed


def voice_scores_from_last() -> dict | None:
    logits = _last_audio["logits"]
    if logits is None:
        return None
    p7 = fusion.softmax(logits / B["params"]["audio_temperature"])[0]
    return {c: round(float(p), 4) for c, p in zip(B["audio_classes"], p7)}

# --------------------------------------------------------------------------- loading
B: dict = {"text_model": None, "asr": None, "audio_model": None, "text_model_name": None, "llm": None}


def load_models():
    log.info("Device: %s | model dir: %s", fusion.DEVICE, MODEL_DIR)
    B["audio_model"], B["processor"], B["audio_classes"] = fusion.load_audio_model()
    B["params"] = fusion.load_params()
    log.info("Audio model loaded: %s", B["audio_classes"])

    if Path(fusion.TEXT_WEIGHTS_PATH).exists() and Path(fusion.TEXT_LABELS_PATH).exists():
        (B["text_model"], B["tokenizer"], B["text_labels"], B["thresholds"]) = fusion.load_text_model()
        B["text_model_name"] = "soulscribe-v8"
        log.info("Text model (SoulScribe V8) loaded")
    elif TEXT_FALLBACK:
        # Interim: published GoEmotions RoBERTa with the same 27-label interface (text_backend.py)
        import text_backend
        (B["text_model"], B["tokenizer"], B["text_labels"], B["thresholds"]) = \
            text_backend.load_pretrained_text_model(fusion.DEVICE, TEXT_FALLBACK)
        # That checkpoint was trained on raw text; SoulScribe's lower-case/strip cleaning would hurt it
        fusion.clean_text = text_backend.raw_text
        B["text_model_name"] = TEXT_FALLBACK.split("/")[-1]
        log.info("SoulScribe weights not found in %s -> using interim text model %s", TEXT_MODEL_DIR, TEXT_FALLBACK)
    else:
        log.warning("Text model NOT found in %s -> text analysis disabled, audio runs voice-only",
                    TEXT_MODEL_DIR)

    if LOAD_WHISPER:
        from transformers import pipeline
        B["asr"] = pipeline("automatic-speech-recognition", model=WHISPER_MODEL, chunk_length_s=30,
                            device=0 if fusion.DEVICE == "cuda" else -1)
        log.info("Whisper loaded: %s", WHISPER_MODEL)

    if LOAD_LLM:
        try:
            import llm_backend
            B["llm"] = llm_backend.LocalLLM(LLM_MODEL, device=LLM_DEVICE)
        except Exception as e:  # the service still runs; intent/reflection/memories fall back to rules
            log.error("Local LLM not loaded (%s): %s", LLM_MODEL, e)


# --------------------------------------------------------------------------- helpers
def sentiment_from(scores: dict) -> float:
    """-1..1: joy pulls up, anger/disgust/fear/sadness pull down, surprise/neutral are neutral."""
    s = scores.get("joy", 0.0) - sum(scores.get(k, 0.0) for k in NEGATIVE)
    return round(float(max(-1.0, min(1.0, s))), 4)


def text_emotions(content: str) -> dict:
    sentences = fusion.split_sentences(content)
    probs = fusion.text_predict(B["text_model"], B["tokenizer"], sentences).mean(axis=0)
    labels = B["text_labels"]
    fine = fusion.pick_fine_grained(probs, labels, B["thresholds"])
    groups = fusion.build_group_index(labels, fusion.shared_classes_from_audio(B["audio_classes"]))
    shared = fusion.shared_classes_from_audio(B["audio_classes"])
    six = fusion.text27_to_shared(probs[None, :], groups)[0]
    six_scores = {c: float(p) for c, p in zip(shared, six)}
    return {
        "primary_state": fine[0][0],
        "confidence": round(float(fine[0][1]), 4),
        "sentiment_score": sentiment_from(six_scores),
        "all_28_states": {**{l: round(float(p), 4) for l, p in zip(labels, probs)}, "neutral": 0.0},
        "ekman_scores": {k: round(v, 4) for k, v in six_scores.items()},
        "fine_grained_emotions": [{"label": l, "score": round(s, 4)} for l, s in fine],
        "provenance": {"adapter": "sentimed-local", "model": B.get("text_model_name"), "is_mock": False},
    }


def to_wav16k(src: Path) -> Path:
    if not FFMPEG:
        raise HTTPException(500, "ffmpeg not found; set FFMPEG_PATH")
    dst = src.with_suffix(".16k.wav")
    r = subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", "16000",
                        str(dst)], capture_output=True, text=True)
    if r.returncode != 0:
        raise HTTPException(400, f"Could not decode audio: {r.stderr.strip()[:200]}")
    return dst


def audio_only(wav_path: Path, transcript: str) -> dict:
    wav = audio_mod.load_audio(str(wav_path))
    if wav is None:
        raise HTTPException(422, "Recording is too short to analyse.")
    logits = fusion.audio_predict(B["audio_model"], B["processor"], [wav])
    p7 = fusion.softmax(logits / B["params"]["audio_temperature"])[0]
    classes = B["audio_classes"]
    scores = {c: round(float(p), 4) for c, p in zip(classes, p7)}
    top = int(p7.argmax())
    return {
        "transcript": transcript,
        "emotion": classes[top],
        "decision": "voice_only_no_text_model",
        "text_says": None,
        "voice_says": classes[top],
        "voice_raw": classes[top],
        "voice_scores": scores,
        "fused_scores": {},
        "fine_grained_emotions": [],
        "_confidence": float(p7[top]),
        "_sentiment": sentiment_from(scores),
    }


def check_key(authorization: str | None):
    if API_KEY and authorization != f"Bearer {API_KEY}":
        raise HTTPException(401, "invalid model api key")


# --------------------------------------------------------------------------- API
app = FastAPI(title="SentiMed model service")


@app.on_event("startup")
def _startup():
    load_models()


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "device": fusion.DEVICE,
        "models": {
            "audio_wavlm": B["audio_model"] is not None,
            "text_soulscribe": B["text_model"] is not None,  # true for SoulScribe or the interim model
            "text_model": B.get("text_model_name"),
            "whisper": B["asr"] is not None,
            "llm": B["llm"] is not None,
            "llm_model": B["llm"].model_id if B["llm"] else None,
            "llm_device": B["llm"].device if B["llm"] else None,
        },
        "audio_classes": B.get("audio_classes"),
    }


class EmotionReq(BaseModel):
    content: str = Field(min_length=1, max_length=10000)
    input_source: str = "text"
    vocal_prosody: dict | None = None


@app.post("/api/analysis/emotions")
def emotions(req: EmotionReq, authorization: str | None = Header(None)):
    check_key(authorization)
    if B["text_model"] is None:
        # 503 makes the backend use its built-in fallback for text entries
        raise HTTPException(503, "Text model (soulscribe_v8.pt) not installed")
    return text_emotions(req.content)


class ContentReq(BaseModel):
    content: str = Field(min_length=1, max_length=10000)
    primary_emotion: str | None = None
    sentiment_score: float | None = None
    intent: str | None = None
    extracted_themes: list[str] | None = None


def _llm_analysis(req: ContentReq) -> dict:
    """Shared, cached LLM analysis of one text; 503 when the LLM is missing or its answer is unusable."""
    import llm_backend
    if B["llm"] is None:
        raise HTTPException(503, "Local LLM not loaded")
    hint = req.primary_emotion
    if not hint and B["text_model"] is not None:
        try:
            hint = text_emotions(req.content)["primary_state"]
        except Exception:
            hint = None
    try:
        return B["llm"].analyse(req.content, hint)
    except llm_backend.LLMUnavailable as e:
        raise HTTPException(503, str(e))


def _llm_provenance():
    return {"adapter": "sentimed-local", "model": B["llm"].model_id, "is_mock": False}


# Plain `def` routes run in FastAPI's thread pool, so a generation never blocks the event loop.
@app.post("/api/analysis/intent")
def intent(req: ContentReq, authorization: str | None = Header(None)):
    check_key(authorization)
    a = _llm_analysis(req)
    return {"intent": a["intent"], "clarified_to": a["clarified_to"], "triggers": a["triggers"],
            "coping_attempts": a["coping_attempts"], "provenance": _llm_provenance()}


@app.post("/api/analysis/reflection")
def reflection(req: ContentReq, authorization: str | None = Header(None)):
    check_key(authorization)
    a = _llm_analysis(req)
    return {"prompt_text": a["reflection_prompt"],
            "prompt_type": "cbt_positive_reinforcement" if a["cbt_technique"] == "strength_amplification" else "cbt_clarification",
            "cbt_technique_used": a["cbt_technique"], "provenance": _llm_provenance()}


@app.post("/api/analysis/memories")
def memories(req: ContentReq, authorization: str | None = Header(None)):
    check_key(authorization)
    return _llm_analysis(req)["memories"]


@app.post("/api/analysis/audio")
async def analyse_audio(file: UploadFile = File(...), authorization: str | None = Header(None)):
    check_key(authorization)
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Audio file too large")
    raw = TMP_DIR / f"{uuid.uuid4().hex}{Path(file.filename or 'clip').suffix or '.bin'}"
    raw.write_bytes(data)
    wav = None
    try:
        wav = to_wav16k(raw)
        _last_audio.update(logits=None, windows=0, seconds=0.0, raw_seconds=None)

        if B["text_model"] is not None and B["asr"] is not None:
            # the team's exact fusion rule; it runs Whisper itself, so it is not transcribed twice
            r = fusion.analyse_recording(B, str(wav))
            r["voice_scores"] = voice_scores_from_last()
            scores = r["fused_scores"] or r["voice_scores"] or {}
            conf = max(scores.values()) if scores else None
            sentiment = sentiment_from(scores)
        else:
            transcript = B["asr"](str(wav))["text"].strip() if B["asr"] else ""
            r = audio_only(wav, transcript)
            conf, sentiment = r.pop("_confidence"), r.pop("_sentiment")

        primary = r["emotion"]
        return {
            **r,
            "voice_seconds_analysed": _last_audio["seconds"],
            "voice_windows": _last_audio["windows"],
            # same shape the backend stores as journal_entry.detected_emotions
            "detected_emotions": {
                "primary_state": primary,
                "confidence": round(float(conf if conf is not None else 0.0), 4),
                "sentiment_score": sentiment,
                "all_28_states": {e["label"]: e["score"] for e in r["fine_grained_emotions"]},
                "fusion": {k: r[k] for k in ("decision", "text_says", "voice_says", "voice_raw")},
                "provenance": {"adapter": "sentimed-local",
                               "model": f"wavlm-large+{B.get('text_model_name')}" if B["text_model"] else "wavlm-large",
                               "is_mock": False},
            },
        }
    finally:
        for p in (raw, wav):
            if p is not None and p.exists():
                p.unlink()
