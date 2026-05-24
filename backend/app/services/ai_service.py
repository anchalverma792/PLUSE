import json
import os
import time
from typing import Any

from groq import Groq

from app.core.config import get_settings


class GroqAIService:
    def __init__(self) -> None:
        self.settings = get_settings()
        api_key = self.settings.groq_api_key or os.getenv("GROQ_API_KEY")
        self.client = Groq(api_key=api_key) if api_key else None

    def _offline_notice(self, task: str) -> dict[str, Any]:
        return {
            "summary": f"Groq analysis for {task} is ready to run once GROQ_API_KEY is configured.",
            "root_cause": "No AI inference was executed because the Groq API key is not set. APY did not call any non-Groq AI provider.",
            "recommendations": [
                "Set GROQ_API_KEY in backend/.env.",
                "Restart uvicorn so the Groq client can authenticate.",
                "Review the next live incident to generate a fresh root-cause report.",
            ],
        }

    async def analyze_incident(self, incident_context: dict[str, Any]) -> dict[str, Any]:
        if not self.client:
            return self._offline_notice("incident root cause")

        prompt = f"""
You are APY, an AI Reliability Engineer. Analyze this API incident.
Return strict JSON with keys: summary, root_cause, recommendations, severity.
Recommendations must be an array of concrete debugging steps.

Incident context:
{json.dumps(incident_context, default=str, indent=2)}
"""
        started = time.perf_counter()
        completion = self.client.chat.completions.create(
            model=self.settings.groq_model,
            messages=[
                {"role": "system", "content": "You analyze API reliability incidents and respond with valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        content = completion.choices[0].message.content or "{}"
        parsed = json.loads(content)
        parsed["ai_response_time_ms"] = round((time.perf_counter() - started) * 1000, 2)
        return parsed

    async def chat(self, message: str, context: dict[str, Any]) -> str:
        if not self.client:
            return (
                "Groq is not configured yet. Set GROQ_API_KEY in backend/.env and restart the backend. "
                "No OpenAI or other AI provider has been used."
            )

        completion = self.client.chat.completions.create(
            model=self.settings.groq_model,
            messages=[
                {
                    "role": "system",
                    "content": "You are APY. Be concise, technical, and action-oriented. Use only the provided incident/log context.",
                },
                {"role": "user", "content": f"Context:\n{json.dumps(context, default=str)}\n\nQuestion: {message}"},
            ],
            temperature=0.25,
        )
        return completion.choices[0].message.content or "Groq returned an empty response."


ai_service = GroqAIService()
