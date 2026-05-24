import asyncio
import random
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import ApiService, LogEntry
from app.services.anomaly_detection import anomaly_detector
from app.services.incident_manager import incident_manager
from app.services.websocket_manager import manager


@dataclass(frozen=True)
class SimulatedApi:
    name: str
    path: str
    owner: str
    base_latency: int
    endpoint_url: str = ""


APIS = [
    SimulatedApi("Payment API", "/v1/payments/charge", "Revenue Platform", 240),
    SimulatedApi("Login API", "/v1/auth/session", "Identity", 120),
    SimulatedApi("Order API", "/v1/orders", "Commerce", 180),
    SimulatedApi("Notification API", "/v1/notifications/send", "Messaging", 160),
    SimulatedApi("Analytics API", "/v1/events/ingest", "Data Platform", 280),
]


SCENARIOS: dict[str, dict[str, Any]] = {
    "deployment_failure": {"error_type": "DeployRegression", "status": 500, "latency": 850, "cpu": 78, "memory": 72},
    "database_crash": {"error_type": "DatabaseUnavailable", "status": 500, "latency": 1900, "cpu": 88, "memory": 91},
    "traffic_spike": {"error_type": "TrafficBurst", "status": 200, "latency": 780, "cpu": 84, "memory": 70},
    "timeout_storm": {"error_type": "Timeout", "status": 408, "latency": 2400, "cpu": 73, "memory": 78},
    "api_downtime": {"error_type": "Downtime", "status": 0, "latency": 0, "cpu": 15, "memory": 38},
    "memory_leak": {"error_type": "MemoryLeak", "status": 500, "latency": 1450, "cpu": 76, "memory": 97},
}


class TrafficSimulator:
    def __init__(self) -> None:
        self.running = False
        self.paused = False
        self.task: asyncio.Task | None = None
        self.tick_seconds = 1.0
        self.active_scenarios: list[tuple[str, int, str | None]] = []
        self.request_count = 0

    def seed_apis(self, db: Session) -> None:
        for api in APIS:
            existing = db.query(ApiService).filter(ApiService.name == api.name).first()
            if not existing:
                db.add(
                    ApiService(
                        name=api.name,
                        path=api.path,
                        owner=api.owner,
                        endpoint_url=f"https://api.pulseroot.local{api.path}",
                        expected_latency_ms=float(api.base_latency),
                        timeout_threshold_ms=float(api.base_latency * 6),
                        category=api.owner,
                        environment="production",
                        health_check_interval_seconds=30,
                        monitoring_enabled=True,
                    )
                )
        db.commit()

    async def start_background(self, tick_seconds: float) -> dict[str, Any]:
        self.tick_seconds = tick_seconds
        self.paused = False
        if self.task and not self.task.done():
            self.running = True
            await manager.broadcast("simulation", self.status())
            return self.status()
        self.running = True
        self.task = asyncio.create_task(self.start(tick_seconds))
        await manager.broadcast("simulation", self.status())
        await manager.broadcast("activity", {"message": "Monitoring started", "level": "success"})
        return self.status()

    async def start(self, tick_seconds: float) -> None:
        self.running = True
        while self.running:
            if self.paused:
                await asyncio.sleep(tick_seconds)
                continue
            db = SessionLocal()
            try:
                self.seed_apis(db)
                burst = random.randint(2, 7)
                for _ in range(burst):
                    await self.generate_request(db)
            finally:
                db.close()
            await asyncio.sleep(tick_seconds)

    def stop(self) -> None:
        self.running = False
        self.paused = False
        if self.task and not self.task.done():
            self.task.cancel()
        self.task = None

    async def pause(self) -> dict[str, Any]:
        self.paused = True
        await manager.broadcast("simulation", self.status())
        await manager.broadcast("activity", {"message": "Monitoring paused", "level": "warning"})
        return self.status()

    async def resume(self) -> dict[str, Any]:
        self.paused = False
        await manager.broadcast("simulation", self.status())
        await manager.broadcast("activity", {"message": "Monitoring resumed", "level": "success"})
        return self.status()

    async def stop_background(self) -> dict[str, Any]:
        self.stop()
        await manager.broadcast("simulation", self.status())
        await manager.broadcast("activity", {"message": "Monitoring stopped", "level": "info"})
        return self.status()

    def reset_runtime(self) -> None:
        self.active_scenarios = []
        self.request_count = 0
        self.paused = False

    def status(self) -> dict[str, Any]:
        return {
            "running": self.running,
            "paused": self.paused,
            "active_scenarios": len(self.active_scenarios),
            "request_count": self.request_count,
            "tick_seconds": self.tick_seconds,
        }

    async def trigger(self, scenario: str, api_name: str | None = None, duration: int = 18) -> dict[str, Any]:
        if scenario not in SCENARIOS:
            raise ValueError(f"Unknown scenario: {scenario}")
        self.active_scenarios.append((scenario, duration, api_name))
        await manager.broadcast(
            "alert",
            {"title": scenario.replace("_", " ").title(), "severity": "high", "api": api_name or "multiple APIs"},
        )
        return {"scenario": scenario, "duration_ticks": duration, "target": api_name or "auto"}

    async def generate_request(self, db: Session) -> LogEntry | None:
        apis = self._monitored_apis(db)
        if not apis:
            return None
        api = random.choice(apis)
        scenario = self._consume_scenario(api.name)
        log = self._build_log(api, scenario)
        db.add(log)
        self._update_api_health(db, api.name, log)
        db.commit()
        db.refresh(log)

        anomaly = anomaly_detector.evaluate(log.api_name, log.status_code, log.latency_ms)
        serialized = self.serialize_log(log)
        serialized["anomaly"] = anomaly
        await manager.broadcast("log", serialized)

        if anomaly["is_anomaly"]:
            await incident_manager.ingest_anomaly(db, log, anomaly)
        return log

    def _monitored_apis(self, db: Session) -> list[SimulatedApi]:
        rows = db.query(ApiService).filter(ApiService.monitoring_enabled == True).all()  # noqa: E712
        return [
            SimulatedApi(
                name=row.name,
                path=row.path,
                owner=row.owner,
                base_latency=max(40, int(row.expected_latency_ms or 250)),
                endpoint_url=row.endpoint_url,
            )
            for row in rows
        ]

    def _consume_scenario(self, api_name: str) -> dict[str, Any] | None:
        if not self.active_scenarios:
            return None
        remaining: list[tuple[str, int, str | None]] = []
        selected: dict[str, Any] | None = None
        for scenario, ticks, target in self.active_scenarios:
            applies = target in {None, api_name}
            if applies and selected is None:
                selected = SCENARIOS[scenario]
            if ticks > 1:
                remaining.append((scenario, ticks - 1, target))
        self.active_scenarios = remaining
        return selected

    def _build_log(self, api: SimulatedApi, scenario: dict[str, Any] | None) -> LogEntry:
        self.request_count += 1
        deployment = "2026.05.24-canary" if random.random() < 0.18 else "2026.05.24"
        if scenario:
            status = scenario["status"]
            latency = scenario["latency"] + random.randint(-90, 180) if scenario["latency"] else 0
            error_type = scenario["error_type"]
            cpu = min(99, scenario["cpu"] + random.random() * 8)
            memory = min(99, scenario["memory"] + random.random() * 6)
        else:
            failed = random.random() < 0.055
            status = random.choice([500, 502, 503, 408]) if failed else random.choice([200, 200, 200, 201, 204])
            latency = max(35, random.gauss(api.base_latency, api.base_latency * 0.22))
            if random.random() < 0.035:
                latency *= random.uniform(2.5, 5.8)
            error_type = self._error_type(status)
            cpu = random.uniform(18, 66) + (18 if latency > 800 else 0)
            memory = random.uniform(30, 72) + (12 if status >= 500 else 0)

        level = "error" if status >= 500 or status in {0, 408} else "info"
        message = self._message(api.name, status, latency, error_type)
        return LogEntry(
            timestamp=datetime.utcnow(),
            api_name=api.name,
            method=random.choice(["GET", "POST", "POST", "PUT"]),
            path=api.path,
            status_code=status,
            latency_ms=round(float(latency), 2),
            level=level,
            message=message,
            error_type=error_type,
            trace_id=f"trace_{uuid.uuid4().hex[:16]}",
            cpu=round(cpu, 2),
            memory=round(memory, 2),
            deployment_version=deployment,
        )

    def _error_type(self, status: int) -> str | None:
        if status == 408:
            return "Timeout"
        if status >= 500:
            return random.choice(["DatabaseTimeout", "UpstreamFailure", "UnhandledException", "QueueBackpressure"])
        if status == 0:
            return "Downtime"
        return None

    def _message(self, api_name: str, status: int, latency: float, error_type: str | None) -> str:
        if status == 0:
            return f"{api_name} is unreachable from health probe"
        if error_type:
            return f"{api_name} returned {status} due to {error_type} after {latency:.0f}ms"
        if latency > 900:
            return f"{api_name} completed successfully but exceeded latency SLO at {latency:.0f}ms"
        return f"{api_name} request completed with status {status} in {latency:.0f}ms"

    def _update_api_health(self, db: Session, api_name: str, log: LogEntry) -> None:
        api = db.query(ApiService).filter(ApiService.name == api_name).first()
        if not api:
            return
        penalty = 0
        if log.status_code >= 500 or log.status_code == 0:
            penalty += 2.7
        if log.latency_ms > 900:
            penalty += 1.4
        api.health_score = max(22, min(100, api.health_score * 0.985 + (100 - penalty * 12) * 0.015))
        api.uptime = max(70, min(100, api.uptime - (0.04 if log.status_code >= 500 or log.status_code == 0 else -0.003)))
        api.is_online = log.status_code != 0
        api.requests_per_minute = max(0, min(1200, api.requests_per_minute * 0.72 + random.uniform(6, 42)))
        api.last_checked_at = datetime.utcnow()

    def serialize_log(self, log: LogEntry) -> dict[str, Any]:
        return {
            "id": log.id,
            "timestamp": log.timestamp.isoformat(),
            "api_name": log.api_name,
            "method": log.method,
            "path": log.path,
            "status_code": log.status_code,
            "latency_ms": log.latency_ms,
            "level": log.level,
            "message": log.message,
            "error_type": log.error_type,
            "trace_id": log.trace_id,
            "cpu": log.cpu,
            "memory": log.memory,
            "deployment_version": log.deployment_version,
        }


traffic_simulator = TrafficSimulator()
