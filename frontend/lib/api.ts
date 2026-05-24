import type { ApiService, ApiServicePayload, ChartPoint, Incident, LogEntry, MonitoringState, Summary } from "@/lib/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
export const WS_BASE = API_BASE.replace("http://", "ws://").replace("https://", "wss://");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with ${response.status}`);
  }

  return response.json();
}

export const api = {
  summary: () => request<Summary>("/api/summary"),
  apis: (environment?: string) => request<ApiService[]>(`/api/apis${environment ? `?environment=${environment}` : ""}`),
  createApi: (payload: ApiServicePayload) =>
    request<ApiService>("/api/apis", { method: "POST", body: JSON.stringify(payload) }),
  updateApi: (id: number, payload: Partial<ApiServicePayload>) =>
    request<ApiService>(`/api/apis/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteApi: (id: number) => request<{ status: string }>(`/api/apis/${id}`, { method: "DELETE" }),
  logs: (query = "") => request<LogEntry[]>(`/api/logs${query}`),
  incidents: (query = "") => request<Incident[]>(`/api/incidents${query}`),
  incident: (id: string) => request<Incident>(`/api/incidents/${id}`),
  chart: () => request<ChartPoint[]>("/api/charts/traffic"),
  monitoringStatus: () => request<MonitoringState>("/api/simulation/status"),
  startMonitoring: () => request<MonitoringState>("/api/simulation/start", { method: "POST" }),
  pauseMonitoring: () => request<MonitoringState>("/api/simulation/pause", { method: "POST" }),
  resumeMonitoring: () => request<MonitoringState>("/api/simulation/resume", { method: "POST" }),
  stopMonitoring: () => request<MonitoringState>("/api/simulation/stop", { method: "POST" }),
  clearState: () => request<MonitoringState>("/api/simulation/reset", { method: "POST" }),
  chat: (message: string, incident_id?: number) =>
    request<{ answer: string }>("/api/assistant/chat", {
      method: "POST",
      body: JSON.stringify({ message, incident_id }),
    }),
};
