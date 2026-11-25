#!/usr/bin/env bash
# macOS/Linux version of start-all.ps1. Starts the whole SentiMed stack locally:
#   1. AI model service  http://localhost:8000   (Whisper + WavLM voice + text emotion)
#   2. Backend API       http://localhost:$PORT  (PORT from backend/.env; 5001 on macOS, AirPlay owns 5000)
#   3. Frontend          http://localhost:5173   (Vite; /api is proxied to the backend)
# Services already running are left alone. Logs go to ./logs/. Ctrl+C stops what this script started.
#
# Usage (from the project folder):   ./start-all.sh
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
LOGS="$ROOT/logs"; mkdir -p "$LOGS"
PIDS=()

PORT=$(grep -E '^PORT=' "$ROOT/backend/.env" 2>/dev/null | tail -1 | cut -d= -f2); PORT=${PORT:-5000}
VENV_PY="$ROOT/model_service/.venv-mac/bin/python"

up() { curl -fs -m 3 "$1" >/dev/null 2>&1; }
listening() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
wait_healthy() { # name url timeout
  printf '  waiting for %s' "$1"
  for ((i = 0; i < $3; i += 3)); do
    if up "$2"; then echo ' ready'; return 0; fi
    printf '.'; sleep 3
  done
  echo " not ready after $3 s (see logs/)"; return 1
}
cleanup() { [ ${#PIDS[@]} -gt 0 ] && kill "${PIDS[@]}" 2>/dev/null; exit 0; }
trap cleanup INT TERM

echo -e "\nSentiMed local stack\n"

# 1. Model service
if up http://localhost:8000/health; then
  echo '[1/3] Model service already running on :8000'
elif [ ! -x "$VENV_PY" ]; then
  echo '[1/3] Model service SKIPPED: model_service/.venv-mac missing (see model_service/README.md). Text analysis uses built-in rules; voice is off.'
else
  echo '[1/3] Starting model service (first start downloads Whisper + text model; later starts ~10-60 s)'
  mkdir -p "$ROOT/model_service/tmp"
  (cd "$ROOT/model_service" && exec "$VENV_PY" -m uvicorn server:app --host 127.0.0.1 --port 8000) >"$LOGS/model.log" 2>&1 &
  PIDS+=($!)
  wait_healthy 'model service' http://localhost:8000/health 900
fi

# 2. Backend
if listening "$PORT"; then
  if up "http://localhost:$PORT/api/health"; then echo "[2/3] Backend already running on :$PORT"
  else echo "[2/3] Port $PORT is used by another program (on macOS 5000 = AirPlay Receiver). Set PORT in backend/.env."; fi
else
  [ -d "$ROOT/backend/node_modules" ] || (cd "$ROOT/backend" && npm ci)
  echo "[2/3] Starting backend on :$PORT"
  (cd "$ROOT/backend" && exec npm start) >"$LOGS/backend.log" 2>&1 &
  PIDS+=($!)
  wait_healthy backend "http://localhost:$PORT/api/health" 60
fi

# 3. Frontend
if listening 5173; then
  echo '[3/3] Frontend already running on :5173'
else
  [ -d "$ROOT/frontend/node_modules" ] || (cd "$ROOT/frontend" && npm ci)
  echo '[3/3] Starting frontend'
  (cd "$ROOT/frontend" && exec npm run dev -- --port 5173 --strictPort) >"$LOGS/frontend.log" 2>&1 &
  PIDS+=($!)
  wait_healthy frontend http://localhost:5173 60
fi

echo
curl -fs -m 5 "http://localhost:$PORT/api/health/model" 2>/dev/null | python3 -c '
import json, sys
m = json.load(sys.stdin)["data"]
if m.get("adapter") == "mock": print("AI: backend uses BUILT-IN rules (set USE_MOCK_MODELS=false and MODEL_API_BASE_URL in backend/.env)")
elif m.get("status") == "healthy":
    u = m["upstream"]; ms = u["models"]
    print(f"AI: live on {u[\"device\"]} - voice:{ms[\"audio_wavlm\"]} text:{ms[\"text_soulscribe\"]} ({ms[\"text_model\"]}) whisper:{ms[\"whisper\"]}")
else: print("AI: model service unreachable - backend falls back to built-in rules")
' 2>/dev/null || echo 'AI: could not query the backend'

echo -e "\nOpen http://localhost:5173   (logs in ./logs, Ctrl+C to stop)\n"
[ ${#PIDS[@]} -gt 0 ] && wait
