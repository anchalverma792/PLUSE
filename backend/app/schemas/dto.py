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


class ApiServiceOut(BaseModel):
    id: int
    name: str
    path: str
    owner: str
    endpoint_url: str
    expected_latency_ms: float
    timeout_threshold_ms: float
    category: str
    environment: str
    health_check_interval_seconds: int
    monitoring_enabled: bool
    requests_per_minute: float
    last_checked_at: datetime | None
    health_score: float
    uptime: float
    is_online: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ApiServiceCreate(BaseModel):
    name: str
    endpoint_url: str
    expected_latency_ms: float = 250
    timeout_threshold_ms: float = 2000
    category: str = "Core"
    environment: str = "production"
    health_check_interval_seconds: int = 30
    monitoring_enabled: bool = True


class ApiServiceUpdate(BaseModel):
    name: str | None = None
    endpoint_url: str | None = None
    expected_latency_ms: float | None = None
    timeout_threshold_ms: float | None = None
    category: str | None = None
    environment: str | None = None
    health_check_interval_seconds: int | None = None
    monitoring_enabled: bool | None = None


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
    api_name: str | None = None


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


class SimulationState(BaseModel):
    running: bool
    paused: bool
    active_scenarios: int
    request_count: int
    tick_seconds: float
