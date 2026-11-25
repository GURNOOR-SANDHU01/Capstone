# SentiMed model service

A local FastAPI wrapper around the ML team's models in `../Sentic Med AI_ML/`. Their files are used
unchanged; `server.py` only re-points their hard-coded `/workspace/...` paths.

| Model | File | Output | Status |
|---|---|---|---|
| WavLM-large + attentive pooling (voice emotion, MELD) | `wavlm_best_weights.pt` + `label_encoder_classes.npy` | 7 emotions: anger, disgust, fear, joy, neutral, sadness, surprise | ✅ shipped |
| SoulScribe V8 (RoBERTa-large + BiGRU, GoEmotions) | `text_model/soulscribe_v8.pt` + `text_model/label_list.json` | 27 fine-grained emotions (multi-label) | ❌ **not shipped yet**; `thresholds.json` is its threshold file |
| Whisper small (speech-to-text) | downloaded from Hugging Face on first run | transcript | ✅ auto |
| Fusion rule (`fusion_pipeline.py`) | n/a | 6 shared emotions; text 70% / voice 30%; text alone if the voice is neutral | ✅ runs once the text model is present |

**Interim text model:** until `soulscribe_v8.pt` is installed, the service uses
`SamLowe/roberta-base-go_emotions` (MIT; RoBERTa-base trained on GoEmotions) through
`text_backend.py`, which gives it SoulScribe's exact interface (27 sigmoid outputs, neutral removed),
so the fusion rule runs unchanged. Per-label thresholds were tuned on GoEmotions dev
(`calibrate_text_model.py`); held-out GoEmotions test results (`text_model_pretrained/metrics.json`):

| Metric | Value |
|---|---|
| 27-label macro-F1 (tuned thresholds / at 0.5) | 0.514 / 0.443 |
| 27-label micro-F1 | 0.564 |
| Top shared emotion correct (6 Ekman groups used by fusion) | 82.8% |
| Weakest labels (F1) | realization 0.23, relief 0.23, grief 0.33, disappointment 0.34, annoyance 0.34 |

Known miss: anxious statements with physical arousal ("my heart keeps racing") can rank
`excitement` above `nervousness`. Once SoulScribe's files are present they are loaded instead,
automatically. Set `TEXT_FALLBACK_MODEL=""` to disable the interim model.

## Run

```powershell
cd model_service
python -m venv .venv
.venv\Scripts\pip install torch --index-url https://download.pytorch.org/whl/cu124   # or plain `torch` for CPU
.venv\Scripts\pip install -r requirements.txt
.\start.ps1            # = .venv\Scripts\python -m uvicorn server:app --port 8000
```

Needs `ffmpeg` on PATH (or `FFMPEG_PATH`). The first start downloads Whisper-small (~1 GB) and
the WavLM config. The WavLM *weights* come from the fine-tuned checkpoint, so the 1.2 GB base
model is never downloaded.

To enable the text model, put `soulscribe_v8.pt` and `label_list.json` (and its `thresholds.json`)
in `Sentic Med AI_ML/text_model/` and restart. RoBERTa-large (~1.4 GB) is downloaded on first load.

Backend `.env`: `USE_MOCK_MODELS=false`, `MODEL_API_BASE_URL=http://localhost:8000`.

## Endpoints

- `GET /health`: which models are loaded, device
- `POST /api/analysis/emotions` `{content}`: text emotion (backend contract; 503 without the text model)
- `POST /api/analysis/audio` multipart `file`: `{transcript, emotion, decision, text_says, voice_says, voice_raw, fused_scores, fine_grained_emotions, detected_emotions}`

Intent, safety, reflection and memories are not provided by these models; the backend's built-in
analysis handles them (the safety crisis-language floor always applies).

## Environment variables

| Var | Default |
|---|---|
| `SENTIMED_MODEL_DIR` | `../Sentic Med AI_ML` |
| `SENTIMED_TEXT_MODEL_DIR` | `<model dir>/text_model` |
| `WHISPER_MODEL` | `openai/whisper-small` |
| `LOAD_WHISPER` | `true` |
| `MODEL_API_KEY` | empty (if set, requires `Authorization: Bearer <key>`; set the same in backend `.env`) |
| `FFMPEG_PATH` | from PATH |

## Known model limits

- Voice model hears only the **first 12 s** of a recording (training setting); Whisper transcribes all of it.
- Voice model was trained on MELD (acted TV dialogue, English); real journal speech differs.
- Fusion temperatures are 1.0 until `python fusion_pipeline.py evaluate` is run on MELD dev.
