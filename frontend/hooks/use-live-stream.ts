"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { WS_BASE } from "@/lib/api";
import type { Incident, LogEntry, SyntheticTest } from "@/lib/types";

type Event =
  | { type: "snapshot"; payload: Array<{ type: string; payload: unknown }> }
  | { type: "log"; payload: LogEntry }
  | { type: "incident"; payload: Incident }
  | { type: "alert"; payload: { title: string; severity: string; api: string } }
  | { type: "test"; payload: SyntheticTest };

export function useLiveStream() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [tests, setTests] = useState<SyntheticTest[]>([]);
  const [connected, setConnected] = useState(false);
  const reconnects = useRef(0);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let closed = false;

    const applyEvent = (event: Event) => {
      if (event.type === "snapshot") {
        event.payload.forEach((item) => applyEvent(item as Event));
        return;
      }
      if (event.type === "log") {
        setLogs((current) => [event.payload, ...current].slice(0, 80));
      }
      if (event.type === "incident") {
        setIncidents((current) => {
          const without = current.filter((incident) => incident.id !== event.payload.id);
          return [event.payload, ...without].slice(0, 50);
        });
      }
      if (event.type === "test") {
        setTests((current) => [event.payload, ...current].slice(0, 50));
      }
      if (event.type === "alert") {
        const message = `${event.payload.api}: ${event.payload.title}`;
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

  return useMemo(() => ({ logs, incidents, tests, connected }), [logs, incidents, tests, connected]);
}
