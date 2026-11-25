# SentiMed model service

A local FastAPI wrapper around the ML team's models in `../Sentic Med AI_ML/`. Their files are used
unchanged; `server.py` only re-points their hard-coded `/workspace/...` paths.

| Model | File | Output | Status |
|---|---|---|---|
| WavLM-large + attentive pooling (voice emotion, MELD) | `wavlm_best_weights.pt` + `label_encoder_classes.npy` | 7 emotions: anger, disgust, fear, joy, neutral, sadness, surprise | ✅ shipped |
| SoulScribe V8 (RoBERTa-large + BiGRU, GoEmotions) | `text_model/soulscribe_v8.pt` + `text_model/label_list.json` | 27 fine-grained emotions (multi-label) | ❌ **not shipped yet**; `thresholds.json` is its threshold file |
| Whisper small (speech-to-text) | downloaded from Hugging Face on first run | transcript | ✅ auto |
| Fusion rule (`fusion_pipeline.py`) | n/a | 6 shared emotions; text 70% / voice 30%; text alone if the voice is neutral | ✅ runs once the text model is present |
| Local LLM (`llm_backend.py`), default `Qwen/Qwen2.5-1.5B-Instruct` (Apache-2.0) | downloaded from Hugging Face on first run (~3 GB) | intent + triggers + coping, one CBT reflection question, up to 2 memories | ✅ auto (`LOAD_LLM=false` to disable) |

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

macOS / Linux (Python 3.12; 3.14 is too new for some ML wheels):

```bash
cd model_service
uv venv --python 3.12 .venv-mac            # or: python3.12 -m venv .venv-mac
uv pip install --python .venv-mac/bin/python torch -r requirements.txt
.venv-mac/bin/python -m uvicorn server:app --port 8000     # or ../start-all.sh for the whole stack
```

Windows:

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
- `POST /api/analysis/audio` multipart `file`: `{transcript, emotion, decision, text_says, voice_says, voice_raw, voice_scores, fused_scores, fine_grained_emotions, voice_seconds_analysed, voice_windows, detected_emotions}`
- `POST /api/analysis/intent` `{content}`: `{intent, clarified_to, triggers, coping_attempts}` (local LLM)
- `POST /api/analysis/reflection` `{content, primary_emotion?}`: `{prompt_text, prompt_type, cbt_technique_used}` (local LLM)
- `POST /api/analysis/memories` `{content}`: `[{text, type, score}]` (local LLM)

The three LLM routes share one generation per text (cached), so a journal entry costs a single
LLM call. The model must answer with JSON whose labels are on fixed lists (`llm_backend.py`); an
unusable answer returns 503 and the backend uses its built-in rules for that call.
**Safety is not an LLM task here:** crisis detection stays rule-based in the backend, and that
crisis-language floor always applies.

## Environment variables

| Var | Default |
|---|---|
| `SENTIMED_MODEL_DIR` | `../Sentic Med AI_ML` |
| `SENTIMED_TEXT_MODEL_DIR` | `<model dir>/text_model` |
| `WHISPER_MODEL` | `openai/whisper-small` |
| `LOAD_WHISPER` | `true` |
| `MODEL_API_KEY` | empty (if set, requires `Authorization: Bearer <key>`; set the same in backend `.env`) |
| `FFMPEG_PATH` | from PATH |
| `LOAD_LLM` | `true` |
| `LLM_MODEL` | `Qwen/Qwen2.5-1.5B-Instruct` (any Hugging Face chat model; larger = better prompts, slower) |
| `LLM_DEVICE` | auto: `cuda` > `mps` (Apple GPU) > `cpu` |
| `VOICE_MAX_WINDOWS` | `15` (12 s windows scored per recording, i.e. up to 3 min) |

## Known model limits

- The voice model was trained on 12 s clips. `server.py` scores long recordings in consecutive 12 s
  windows (a last piece under 3 s is dropped) and averages them, so the whole recording counts;
  `voice_seconds_analysed` reports how much was used. Clips of 12 s or less behave exactly as in training.
- Voice model was trained on MELD (acted TV dialogue, English); real journal speech differs.
- Fusion temperatures are 1.0 until `python fusion_pipeline.py evaluate` is run on MELD dev.
