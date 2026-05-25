from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.api.routes import router
from app.core.config import get_settings
from app.db.session import Base, SessionLocal, engine
from app.simulator.engine import traffic_simulator


settings = get_settings()


def ensure_api_service_schema() -> None:
    inspector = inspect(engine)
    if "api_services" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("api_services")}
    additions = {
        "endpoint_url": "VARCHAR(240) DEFAULT ''",
        "expected_latency_ms": "FLOAT DEFAULT 250.0",
        "timeout_threshold_ms": "FLOAT DEFAULT 2000.0",
        "category": "VARCHAR(80) DEFAULT 'Core'",
        "environment": "VARCHAR(32) DEFAULT 'production'",
        "health_check_interval_seconds": "INTEGER DEFAULT 30",
        "monitoring_enabled": "BOOLEAN DEFAULT 1",
        "requests_per_minute": "FLOAT DEFAULT 0.0",
        "last_checked_at": "DATETIME",
    }
    with engine.begin() as connection:
        for column, definition in additions.items():
            if column not in existing:
                connection.execute(text(f"ALTER TABLE api_services ADD COLUMN {column} {definition}"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_api_service_schema()
    db = SessionLocal()
    try:
        traffic_simulator.seed_apis(db)
    finally:
        db.close()

    yield
    traffic_simulator.stop()


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name, "ai_provider": "Groq only"}
