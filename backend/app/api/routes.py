from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import case, desc, func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import ApiService, Incident, LogEntry, SyntheticTest
from app.schemas.dto import ChatRequest, ChatResponse, DashboardSummary, IncidentOut, LogOut, PlaygroundRequest
from app.services.ai_service import ai_service
from app.services.testing_agent import testing_agent
from app.services.websocket_manager import manager
from app.simulator.engine import SCENARIOS, traffic_simulator

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Session = Depends(get_db)) -> DashboardSummary:
    since = datetime.utcnow() - timedelta(minutes=10)
    logs = db.query(LogEntry).filter(LogEntry.timestamp >= since).all()
    total = len(logs)
    errors = len([log for log in logs if log.status_code >= 500 or log.status_code in {0, 408}])
    average_latency = sum(log.latency_ms for log in logs) / total if total else 0
    apis = db.query(ApiService).all()
    active_incidents = db.query(Incident).filter(Incident.status == "open").count()
    return DashboardSummary(
        total_apis=len(apis),
        active_incidents=active_incidents,
        error_rate=round((errors / total) * 100, 2) if total else 0,
        average_latency=round(average_latency, 2),
        uptime=round(sum(api.uptime for api in apis) / len(apis), 2) if apis else 100,
        health_score=round(sum(api.health_score for api in apis) / len(apis), 2) if apis else 100,
        requests_per_minute=total,
    )


@router.get("/apis")
def api_services(db: Session = Depends(get_db)):
    return db.query(ApiService).order_by(ApiService.name).all()


@router.get("/logs", response_model=list[LogOut])
def logs(
    severity: str | None = None,
    api_name: str | None = None,
    search: str | None = None,
    limit: int = 120,
    db: Session = Depends(get_db),
) -> list[LogEntry]:
    query = db.query(LogEntry)
    if severity:
        query = query.filter(LogEntry.level == severity)
    if api_name:
        query = query.filter(LogEntry.api_name == api_name)
    if search:
        query = query.filter(LogEntry.message.contains(search))
    return query.order_by(desc(LogEntry.timestamp)).limit(min(limit, 500)).all()


@router.get("/incidents", response_model=list[IncidentOut])
def incidents(
    severity: str | None = None,
    api_name: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
) -> list[Incident]:
    query = db.query(Incident)
    if severity:
        query = query.filter(Incident.severity == severity)
    if api_name:
        query = query.filter(Incident.affected_apis.contains([api_name]))
    if search:
        query = query.filter(Incident.title.contains(search))
    return query.order_by(desc(Incident.last_seen)).limit(100).all()


@router.get("/incidents/{incident_id}", response_model=IncidentOut)
def incident_detail(incident_id: int, db: Session = Depends(get_db)) -> Incident:
    incident = db.get(Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.post("/playground/trigger")
async def trigger_playground(request: PlaygroundRequest):
    if request.scenario not in SCENARIOS:
        raise HTTPException(status_code=400, detail=f"Unknown scenario. Use one of: {', '.join(SCENARIOS)}")
    return await traffic_simulator.trigger(request.scenario)


@router.post("/testing/run")
async def run_testing_agent(db: Session = Depends(get_db)):
    tests = await testing_agent.run_cycle(db)
    return [testing_agent.serialize(test) for test in tests]


@router.post("/testing/failure-probe")
async def failure_probe(request: PlaygroundRequest):
    return await testing_agent.trigger_failure_probe(request.scenario)


@router.get("/testing/results")
def testing_results(db: Session = Depends(get_db)):
    tests = db.query(SyntheticTest).order_by(desc(SyntheticTest.timestamp)).limit(80).all()
    return [testing_agent.serialize(test) for test in tests]


@router.post("/assistant/chat", response_model=ChatResponse)
async def assistant_chat(request: ChatRequest, db: Session = Depends(get_db)):
    context = {}
    if request.incident_id:
        incident = db.get(Incident, request.incident_id)
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")
        context["incident"] = {
            "title": incident.title,
            "severity": incident.severity,
            "summary": incident.summary,
            "root_cause": incident.root_cause,
            "recommendations": incident.recommendations,
            "timeline": incident.timeline[-8:],
            "metrics": incident.metrics,
        }
    context["recent_logs"] = [
        {
            "api_name": log.api_name,
            "status_code": log.status_code,
            "latency_ms": log.latency_ms,
            "message": log.message,
        }
        for log in db.query(LogEntry).order_by(desc(LogEntry.timestamp)).limit(18).all()
    ]
    return ChatResponse(answer=await ai_service.chat(request.message, context))


@router.get("/charts/traffic")
def traffic_chart(db: Session = Depends(get_db)):
    since = datetime.utcnow() - timedelta(minutes=15)
    rows = (
        db.query(
            func.strftime("%H:%M", LogEntry.timestamp).label("minute"),
            func.count(LogEntry.id).label("requests"),
            func.avg(LogEntry.latency_ms).label("latency"),
            func.sum(case((LogEntry.status_code >= 500, 1), else_=0)).label("errors"),
        )
        .filter(LogEntry.timestamp >= since)
        .group_by("minute")
        .order_by("minute")
        .all()
    )
    return [
        {"time": row.minute, "requests": row.requests, "latency": round(row.latency or 0, 2), "errors": row.errors or 0}
        for row in rows
    ]
