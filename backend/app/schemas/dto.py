from datetime import datetime
from typing import Any

from pydantic import BaseModel


class LogOut(BaseModel):
    id: int
    timestamp: datetime
    api_name: str
    method: str
    path: str
    status_code: int
    latency_ms: float
    level: str
    message: str
    error_type: str | None
    trace_id: str
    cpu: float
    memory: float
    deployment_version: str

    model_config = {"from_attributes": True}


class IncidentOut(BaseModel):
    id: int
    fingerprint: str
    title: str
    severity: str
    status: str
    affected_apis: list[str]
    frequency: int
    anomaly_score: float
    first_seen: datetime
    last_seen: datetime
    summary: str
    root_cause: str
    recommendations: list[str]
    timeline: list[dict[str, Any]]
    metrics: dict[str, Any]

    model_config = {"from_attributes": True}


class PlaygroundRequest(BaseModel):
    scenario: str


class ChatRequest(BaseModel):
    message: str
    incident_id: int | None = None


class ChatResponse(BaseModel):
    answer: str


class DashboardSummary(BaseModel):
    total_apis: int
    active_incidents: int
    error_rate: float
    average_latency: float
    uptime: float
    health_score: float
    requests_per_minute: int
