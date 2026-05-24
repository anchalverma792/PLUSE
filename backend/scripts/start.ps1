$ErrorActionPreference = "Stop"
if (!(Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
}
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
