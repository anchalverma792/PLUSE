from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ApiService(Base):
    __tablename__ = "api_services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    path: Mapped[str] = mapped_column(String(160))
    owner: Mapped[str] = mapped_column(String(120))
    health_score: Mapped[float] = mapped_column(Float, default=99.0)
    uptime: Mapped[float] = mapped_column(Float, default=99.9)
    is_online: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class LogEntry(Base):
    __tablename__ = "log_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    api_name: Mapped[str] = mapped_column(String(120), index=True)
    method: Mapped[str] = mapped_column(String(12))
    path: Mapped[str] = mapped_column(String(180))
    status_code: Mapped[int] = mapped_column(Integer, index=True)
    latency_ms: Mapped[float] = mapped_column(Float)
    level: Mapped[str] = mapped_column(String(24), index=True)
    message: Mapped[str] = mapped_column(Text)
    error_type: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    trace_id: Mapped[str] = mapped_column(String(64), index=True)
    cpu: Mapped[float] = mapped_column(Float, default=0.0)
    memory: Mapped[float] = mapped_column(Float, default=0.0)
    deployment_version: Mapped[str] = mapped_column(String(40), default="2026.05.24")


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(180))
    severity: Mapped[str] = mapped_column(String(24), index=True)
    status: Mapped[str] = mapped_column(String(24), default="open", index=True)
    affected_apis: Mapped[list[str]] = mapped_column(JSON, default=list)
    frequency: Mapped[int] = mapped_column(Integer, default=1)
    anomaly_score: Mapped[float] = mapped_column(Float, default=0.0)
    first_seen: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    summary: Mapped[str] = mapped_column(Text)
    root_cause: Mapped[str] = mapped_column(Text, default="")
    recommendations: Mapped[list[str]] = mapped_column(JSON, default=list)
    timeline: Mapped[list[dict]] = mapped_column(JSON, default=list)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)


class SyntheticTest(Base):
    __tablename__ = "synthetic_tests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    name: Mapped[str] = mapped_column(String(160))
    target: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20))
    latency_ms: Mapped[float] = mapped_column(Float)
    details: Mapped[str] = mapped_column(Text)
    incident_id: Mapped[int | None] = mapped_column(ForeignKey("incidents.id"), nullable=True)
    incident: Mapped[Incident | None] = relationship()
