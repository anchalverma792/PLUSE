# PulseRoot AI

PulseRoot AI is a simple AI incident playground.

The core demo is intentionally small:

```text
Press a simulation button -> API issue appears -> AI explains what happened -> suggested fixes appear
```

It runs locally with a FastAPI backend, SQLite, WebSockets, a live traffic simulator, Groq-powered explanations, and a minimal Next.js frontend.

AI functionality uses Groq only through `from groq import Groq` with `llama-3.3-70b-versatile`.

## What The Demo Shows

- Four incident simulation buttons:
  - Simulate Payment Failure
  - Simulate Traffic Spike
  - Simulate Database Crash
  - Simulate Timeout Storm
- Live API status in plain language
- A large AI Incident Analysis card
- Suggested fixes
- A simple realtime response-time graph
- Human-readable logs
- One active incident card

The UI is designed to be understandable in about 10 seconds.

## Backend Setup

```powershell
cd backend
Copy-Item .env.example .env
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Set `GROQ_API_KEY` in `backend/.env` for AI incident explanations. Without a key, the app still runs locally, but fresh AI diagnosis text will not be generated.

## Frontend Setup

```powershell
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

PowerShell may block `npm.ps1` on some Windows machines. If that happens, use `npm.cmd` instead:

```powershell
npm.cmd install
npm.cmd run dev
```

## Demo Flow

1. Start the backend on port `8000`.
2. Start the frontend on port `3000`.
3. Open [http://localhost:3000](http://localhost:3000).
4. Click one of the simulation buttons.
5. Watch the live status, graph, logs, active incident, AI explanation, and suggested fixes update.

The primary story is:

```text
Simulate issue -> detect issue -> explain issue -> suggest next steps
```

## Project Structure

```text
backend/
  app/api/routes.py
  app/services/
  app/simulator/
  app/models/

frontend/
  app/
  components/playground/incident-playground.tsx
  hooks/
  lib/
```

## Useful Commands

```powershell
# Frontend checks
cd frontend
npm.cmd run lint
npm.cmd run build

# Stop local servers on the default ports
Get-NetTCPConnection -LocalPort 3000,8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess }
```
