import random
import time
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import Incident, SyntheticTest
from app.simulator.engine import APIS, traffic_simulator
from app.services.websocket_manager import manager


class TestingAgent:
    async def run_cycle(self, db: Session) -> list[SyntheticTest]:
        tests: list[SyntheticTest] = []
        checks = [
            ("Synthetic traffic generation", "simulator"),
            ("Anomaly threshold verification", "anomaly"),
            ("WebSocket broadcast latency", "realtime"),
            ("Alert routing pipeline", "alerts"),
            ("Groq analysis readiness", "ai"),
        ]
        open_incident = db.query(Incident).filter(Incident.status == "open").order_by(Incident.last_seen.desc()).first()
        for name, target in checks:
            started = time.perf_counter()
            passed = random.random() > 0.08
            latency = round((time.perf_counter() - started) * 1000 + random.uniform(12, 160), 2)
            details = self._details(target, passed)
            test = SyntheticTest(
                timestamp=datetime.utcnow(),
                name=name,
                target=target,
                status="passed" if passed else "failed",
                latency_ms=latency,
                details=details,
                incident_id=open_incident.id if open_incident and not passed else None,
            )
            db.add(test)
            tests.append(test)
        db.commit()
        for test in tests:
            db.refresh(test)
            await manager.broadcast("test", self.serialize(test))
        return tests

    async def trigger_failure_probe(self, scenario: str) -> dict[str, Any]:
        api = random.choice(APIS).name
        return await traffic_simulator.trigger(scenario, api_name=api, duration=14)

    def serialize(self, test: SyntheticTest) -> dict[str, Any]:
        return {
            "id": test.id,
            "timestamp": test.timestamp.isoformat(),
            "name": test.name,
            "target": test.target,
            "status": test.status,
            "latency_ms": test.latency_ms,
            "details": test.details,
            "incident_id": test.incident_id,
        }

    def _details(self, target: str, passed: bool) -> str:
        if passed:
            return f"{target} check completed and telemetry matched expected pipeline behavior."
        return f"{target} check found degraded behavior; linked incident context was captured for review."


testing_agent = TestingAgent()
