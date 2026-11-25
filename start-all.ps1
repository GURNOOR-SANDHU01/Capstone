# Starts the whole SentiMed stack locally, each service in its own window:
#   1. AI model service  http://localhost:8000   (Whisper + WavLM voice + text emotion, GPU if available)
#   2. Backend API       http://localhost:5000   (uses the model service; backend/.env)
#   3. Frontend          http://localhost:5173   (Vite; /api is proxied to the backend)
# A service that is already running is left alone. Close a window (or Ctrl+C in it) to stop that service.
#
# Usage (from the project folder):   powershell -ExecutionPolicy Bypass -File .\start-all.ps1

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

function Test-Url($url) {
  try { Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 | Out-Null; return $true } catch { return $false }
}

function Test-Port($port) {
  return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Start-ServiceWindow($title, $dir, $command) {
  $script = "`$Host.UI.RawUI.WindowTitle = '$title'; Set-Location '$dir'; $command"
  Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $script | Out-Null
}

function Wait-Healthy($name, $url, $timeoutSec) {
  Write-Host "  waiting for $name" -NoNewline
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-Url $url) { Write-Host " ready" -ForegroundColor Green; return $true }
    Write-Host '.' -NoNewline
    Start-Sleep -Seconds 3
  }
  Write-Host " not ready after ${timeoutSec}s (check its window)" -ForegroundColor Yellow
  return $false
}

Write-Host "`nSentiMed local stack`n" -ForegroundColor Cyan

# --- 1. Model service ---------------------------------------------------------
$modelDir = Join-Path $root 'model_service'
if (Test-Url 'http://localhost:8000/health') {
  Write-Host '[1/3] Model service already running on :8000'
} elseif (-not (Test-Path (Join-Path $modelDir '.venv\Scripts\python.exe'))) {
  Write-Host '[1/3] Model service SKIPPED: model_service\.venv not found (see model_service\README.md). Text/voice analysis will use the built-in rules.' -ForegroundColor Yellow
} else {
  Write-Host '[1/3] Starting model service (first start downloads models; later starts take ~10-60 s)'
  New-Item -ItemType Directory -Force (Join-Path $modelDir 'tmp') | Out-Null
  Start-ServiceWindow 'SentiMed - AI models :8000' $modelDir '.\.venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8000'
  Wait-Healthy 'model service' 'http://localhost:8000/health' 600 | Out-Null
}

# --- 2. Backend -----------------------------------------------------------------
$backendDir = Join-Path $root 'backend'
if (Test-Port 5000) {
  $fresh = $false
  try { $fresh = [bool]((Invoke-WebRequest -Uri 'http://localhost:5000/api/health' -UseBasicParsing -TimeoutSec 3).Headers['Content-Security-Policy']) } catch {}
  if ($fresh) { Write-Host '[2/3] Backend already running on :5000' }
  else { Write-Host '[2/3] Port 5000 is used by an OLD backend process. Stop it (close its window / Ctrl+C) and run this script again.' -ForegroundColor Red }
} else {
  if (-not (Test-Path (Join-Path $backendDir 'node_modules'))) { Write-Host '      installing backend packages...'; Push-Location $backendDir; npm install; Pop-Location }
  Write-Host '[2/3] Starting backend'
  Start-ServiceWindow 'SentiMed - Backend :5000' $backendDir 'npm start'
  Wait-Healthy 'backend' 'http://localhost:5000/api/health' 60 | Out-Null
}

# --- 3. Frontend ----------------------------------------------------------------
$frontendDir = Join-Path $root 'frontend'
if (Test-Port 5173) {
  Write-Host '[3/3] Frontend already running on :5173'
} else {
  if (-not (Test-Path (Join-Path $frontendDir 'node_modules'))) { Write-Host '      installing frontend packages...'; Push-Location $frontendDir; npm install; Pop-Location }
  Write-Host '[3/3] Starting frontend'
  Start-ServiceWindow 'SentiMed - Frontend :5173' $frontendDir 'npm run dev'
  Wait-Healthy 'frontend' 'http://localhost:5173' 60 | Out-Null
}

# --- Summary --------------------------------------------------------------------
Write-Host ''
try {
  $m = (Invoke-RestMethod -Uri 'http://localhost:5000/api/health/model' -TimeoutSec 5).data
  if ($m.adapter -eq 'mock') { Write-Host 'AI: backend uses BUILT-IN rules (set USE_MOCK_MODELS=false and MODEL_API_BASE_URL in backend\.env)' -ForegroundColor Yellow }
  elseif ($m.status -eq 'healthy') { Write-Host ("AI: live on {0} - voice:{1} text:{2} ({3}) whisper:{4}" -f $m.upstream.device, $m.upstream.models.audio_wavlm, $m.upstream.models.text_soulscribe, $m.upstream.models.text_model, $m.upstream.models.whisper) -ForegroundColor Green }
  else { Write-Host 'AI: model service unreachable - backend falls back to built-in rules' -ForegroundColor Yellow }
} catch { Write-Host 'AI: could not query the backend' -ForegroundColor Yellow }

Write-Host "`nOpen http://localhost:5173`n" -ForegroundColor Cyan
