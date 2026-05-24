# PulseRoot AI

AI-powered API failure detection and debugging agent. PulseRoot AI runs locally with a FastAPI backend, SQLite, WebSockets, a synthetic traffic simulator, anomaly detection, incident grouping, and a Next.js dashboard.

AI functionality uses Groq only through `from groq import Groq` with `llama-3.3-70b-versatile`.

## Backend Setup

```powershell
cd backend
Copy-Item .env.example .env
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Set `GROQ_API_KEY` in `backend/.env` for AI root-cause analysis and chat. Without a key, the app still runs locally and reports that Groq is not configured; it does not call OpenAI or any other AI provider.

## Frontend Setup

```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

## Demo Flow

1. Start the backend and frontend.
2. Open the dashboard and watch live logs, charts, alerts, and grouped incidents.
3. Go to Playground and trigger deployment failure, database crash, traffic spike, timeout storm, downtime, or memory leak.
4. Open an incident detail page to review timeline, metrics, Groq analysis, and debugging suggestions.
5. Use Testing Agent to run synthetic QA checks.
6. Use AI Assistant to ask incident questions such as “Which API is unstable?” or “Suggest debugging steps.”

## Project Structure

```text
backend/
  app/api/routes.py
  app/services/
  app/simulator/
  app/models/
frontend/
  app/
  components/
  hooks/
  lib/
```
