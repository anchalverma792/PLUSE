from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import Incident, LogEntry
from app.services.ai_service import ai_service
from app.services.websocket_manager import manager


def severity_from_score(score: float, status_code: int, latency_ms: float) -> str:
    if status_code == 0 or score >= 80 or latency_ms >= 1800:
        return "critical"
    if score >= 55 or status_code >= 500:
        return "high"
    if score >= 35:
        return "warning"
    return "info"


class IncidentManager:
    async def ingest_anomaly(self, db: Session, log: LogEntry, anomaly: dict[str, Any]) -> Incident:
        primary_reason = anomaly["reasons"][0] if anomaly["reasons"] else "performance_degradation"
        fingerprint = f"{log.api_name}:{primary_reason}:{log.error_type or log.status_code}"
        incident = db.query(Incident).filter(Incident.fingerprint == fingerprint, Incident.status == "open").first()

        title = self._title(log.api_name, primary_reason)
        severity = severity_from_score(anomaly["score"], log.status_code, log.latency_ms)
        timeline_event = {
            "timestamp": log.timestamp.isoformat(),
            "message": log.message,
            "latency_ms": log.latency_ms,
            "status_code": log.status_code,
            "trace_id": log.trace_id,
        }

        if incident:
            incident.frequency += 1
            incident.last_seen = datetime.utcnow()
            incident.anomaly_score = max(incident.anomaly_score, anomaly["score"])
            incident.severity = self._max_severity(incident.severity, severity)
            incident.affected_apis = sorted(set(incident.affected_apis + [log.api_name]))
            incident.timeline = (incident.timeline + [timeline_event])[-30:]
            incident.metrics = self._metrics(log, anomaly)
        else:
            incident = Incident(
                fingerprint=fingerprint,
                title=title,
                severity=severity,
                affected_apis=[log.api_name],
                anomaly_score=anomaly["score"],
                summary=f"{log.api_name} triggered {primary_reason.replace('_', ' ')} with status {log.status_code} and {log.latency_ms:.0f}ms latency.",
                timeline=[timeline_event],
                metrics=self._metrics(log, anomaly),
                recommendations=[
                    "Inspect recent deploys and configuration changes.",
                    "Check downstream database and queue latency.",
                    "Compare failing traces against healthy baseline requests.",
                ],
            )
            db.add(incident)

        db.commit()
        db.refresh(incident)

        # Run Groq analysis on first sighting and every fifth recurrence to keep demos lively without hammering the API.
        if incident.frequency == 1 or incident.frequency % 5 == 0:
            analysis = await ai_service.analyze_incident(
                {
                    "title": incident.title,
                    "severity": incident.severity,
                    "frequency": incident.frequency,
                    "affected_apis": incident.affected_apis,
                    "latest_log": timeline_event,
                    "metrics": incident.metrics,
                }
            )
            incident.summary = analysis.get("summary", incident.summary)
            incident.root_cause = analysis.get("root_cause", incident.root_cause)
            incident.recommendations = analysis.get("recommendations", incident.recommendations)
            if analysis.get("severity") in {"info", "warning", "high", "critical"}:
                incident.severity = analysis["severity"]
            incident.metrics = {**incident.metrics, "ai_response_time_ms": analysis.get("ai_response_time_ms")}
            db.commit()
            db.refresh(incident)

        await manager.broadcast("incident", self.serialize_incident(incident))
        await manager.broadcast("alert", {"title": incident.title, "severity": incident.severity, "api": log.api_name})
        return incident

    def serialize_incident(self, incident: Incident) -> dict[str, Any]:
        return {
            "id": incident.id,
            "fingerprint": incident.fingerprint,
            "title": incident.title,
            "severity": incident.severity,
            "status": incident.status,
            "affected_apis": incident.affected_apis,
            "frequency": incident.frequency,
            "anomaly_score": incident.anomaly_score,
            "first_seen": incident.first_seen.isoformat(),
            "last_seen": incident.last_seen.isoformat(),
            "summary": incident.summary,
            "root_cause": incident.root_cause,
            "recommendations": incident.recommendations,
            "timeline": incident.timeline,
            "metrics": incident.metrics,
        }

    def _metrics(self, log: LogEntry, anomaly: dict[str, Any]) -> dict[str, Any]:
        return {
            "latency_ms": log.latency_ms,
            "status_code": log.status_code,
            "cpu": log.cpu,
            "memory": log.memory,
            "baseline_latency": anomaly["baseline_latency"],
            "error_rate": anomaly["error_rate"],
            "anomaly_reasons": anomaly["reasons"],
        }

    def _title(self, api_name: str, reason: str) -> str:
        labels = {
            "latency_spike": "Latency Spike",
            "error_spike": "Error Surge",
            "downtime": "API Downtime",
            "traffic_burst": "Traffic Burst",
            "performance_degradation": "Performance Degradation",
        }
        return f"{api_name} {labels.get(reason, 'Reliability Incident')}"

    def _max_severity(self, left: str, right: str) -> str:
        order = {"info": 0, "warning": 1, "high": 2, "critical": 3}
        return left if order.get(left, 0) >= order.get(right, 0) else right


incident_manager = IncidentManager()
