"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { WS_BASE } from "@/lib/api";
import type { ActivityItem, ApiService, Incident, LogEntry, SimulationState, SyntheticTest } from "@/lib/types";

type Event =
  | { type: "snapshot"; payload: Array<{ type: string; payload: unknown }> }
  | { type: "log"; payload: LogEntry }
  | { type: "incident"; payload: Incident }
  | { type: "alert"; payload: { title: string; severity: string; api: string } }
  | { type: "test"; payload: SyntheticTest }
  | { type: "activity"; payload: { message: string; level?: ActivityItem["level"] } }
  | { type: "simulation"; payload: SimulationState }
  | { type: "api"; payload: ApiService }
  | { type: "api_deleted"; payload: { id: number; name: string } }
  | { type: "reset"; payload: { status: string } };

function friendlyAlertTitle(title: string) {
  return title
    .replace(" Latency Spike", " is slow")
    .replace(" Error Surge", " is failing")
    .replace(" API Downtime", " is offline")
    .replace(" Traffic Burst", " has heavy traffic")
    .replace(" Performance Degradation", " needs attention");
}

function activity(id: string, message: string, level: ActivityItem["level"]): ActivityItem {
  return { id, message, level, timestamp: new Date().toISOString() };
}

function logActivity(log: LogEntry): ActivityItem | null {
  if (log.status_code >= 500) return activity(`log-${log.id}`, `${log.api_name} returned a server error`, "error");
  if (log.status_code === 408) return activity(`log-${log.id}`, `${log.api_name} timed out`, "warning");
  if (log.status_code === 0) return activity(`log-${log.id}`, `${log.api_name} is unreachable`, "error");
  if (log.latency_ms > 900) return activity(`log-${log.id}`, `${log.api_name} response time increased`, "warning");
  return null;
}

export function useLiveStream() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [tests, setTests] = useState<SyntheticTest[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [simulation, setSimulation] = useState<SimulationState | null>(null);
  const [apiVersion, setApiVersion] = useState(0);
  const [resetVersion, setResetVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  const reconnects = useRef(0);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let closed = false;

    const pushActivity = (item: ActivityItem | null) => {
      if (!item) return;
      setActivities((current) => [item, ...current].slice(0, 80));
    };

    const applyEvent = (event: Event) => {
      if (event.type === "snapshot") {
        event.payload.forEach((item) => applyEvent(item as Event));
        return;
      }
      if (event.type === "log") {
        setLogs((current) => [event.payload, ...current].slice(0, 120));
        pushActivity(logActivity(event.payload));
      }
      if (event.type === "incident") {
        setIncidents((current) => {
          const without = current.filter((incident) => incident.id !== event.payload.id);
          return [event.payload, ...without].slice(0, 80);
        });
        pushActivity(activity(`incident-${event.payload.id}-${event.payload.frequency}`, `AI investigation updated for ${event.payload.title}`, "success"));
      }
      if (event.type === "test") {
        setTests((current) => [event.payload, ...current].slice(0, 50));
      }
      if (event.type === "activity") {
        pushActivity(activity(`activity-${Date.now()}`, event.payload.message, event.payload.level ?? "info"));
      }
      if (event.type === "simulation") {
        setSimulation(event.payload);
      }
      if (event.type === "api" || event.type === "api_deleted") {
        setApiVersion((current) => current + 1);
      }
      if (event.type === "reset") {
        setLogs([]);
        setIncidents([]);
        setTests([]);
        setActivities([]);
        setResetVersion((current) => current + 1);
      }
      if (event.type === "alert") {
        const message = `${event.payload.api}: ${friendlyAlertTitle(event.payload.title)}`;
        toast(message, { description: event.payload.severity.toUpperCase() });
      }
    };

    const connect = () => {
      socket = new WebSocket(`${WS_BASE}/api/ws`);
      socket.onopen = () => {
        reconnects.current = 0;
        setConnected(true);
      };
      socket.onclose = () => {
        setConnected(false);
        if (!closed) {
          reconnects.current += 1;
          setTimeout(connect, Math.min(4000, reconnects.current * 650));
        }
      };
      socket.onmessage = (message) => applyEvent(JSON.parse(message.data));
    };

    connect();
    return () => {
      closed = true;
      socket?.close();
    };
  }, []);

  return useMemo(
    () => ({ logs, incidents, tests, activities, simulation, apiVersion, resetVersion, connected }),
    [logs, incidents, tests, activities, simulation, apiVersion, resetVersion, connected],
  );
}
