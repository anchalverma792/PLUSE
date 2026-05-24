import type { ApiService, ApiServicePayload, ChartPoint, Incident, LogEntry, SimulationState, Summary, SyntheticTest } from "@/lib/types";

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
    throw new Error(await response.text());
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
  trigger: (scenario: string, api_name?: string) =>
    request("/api/playground/trigger", { method: "POST", body: JSON.stringify({ scenario, api_name }) }),
  simulationStatus: () => request<SimulationState>("/api/simulation/status"),
  startSimulation: () => request<SimulationState>("/api/simulation/start", { method: "POST" }),
  pauseSimulation: () => request<SimulationState>("/api/simulation/pause", { method: "POST" }),
  resumeSimulation: () => request<SimulationState>("/api/simulation/resume", { method: "POST" }),
  stopSimulation: () => request<SimulationState>("/api/simulation/stop", { method: "POST" }),
  resetSimulation: () => request<SimulationState>("/api/simulation/reset", { method: "POST" }),
  runTests: () => request<SyntheticTest[]>("/api/testing/run", { method: "POST" }),
  testingResults: () => request<SyntheticTest[]>("/api/testing/results"),
  failureProbe: (scenario: string) =>
    request("/api/testing/failure-probe", { method: "POST", body: JSON.stringify({ scenario }) }),
  chat: (message: string, incident_id?: number) =>
    request<{ answer: string }>("/api/assistant/chat", {
      method: "POST",
      body: JSON.stringify({ message, incident_id }),
    }),
};
