# Starts the SentiMed model service on http://localhost:8000
Set-Location $PSScriptRoot
& "$PSScriptRoot\.venv\Scripts\python.exe" -m uvicorn server:app --host 127.0.0.1 --port 8000
