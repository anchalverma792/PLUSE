# PulseRoot AI Frontend

This frontend is a minimal Next.js incident playground for PulseRoot AI.

It is built around one interaction:

```text
Press a simulation button -> AI explains the incident
```

## Main Experience

The main screen keeps only the demo-critical pieces:

- Incident simulation buttons
- Live API status
- AI Incident Analysis card
- Suggested fixes
- Simple realtime graph
- Human-readable logs
- Active incident card

The previous secondary routes now all render the same simplified experience so the product story stays focused.

## Run Locally

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On Windows, if PowerShell blocks `npm.ps1`, run the commands through `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run dev
```

## Backend

The frontend expects the FastAPI backend at:

```text
http://localhost:8000
```

Set `NEXT_PUBLIC_API_BASE` only if the backend is running somewhere else.

## Checks

```powershell
npm.cmd run lint
npm.cmd run build
```
