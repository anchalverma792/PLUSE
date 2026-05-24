$ErrorActionPreference = "Stop"
if (!(Test-Path ".env.local")) {
  Copy-Item ".env.example" ".env.local"
}
npm run dev
