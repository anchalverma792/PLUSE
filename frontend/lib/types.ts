export type Severity = "info" | "warning" | "high" | "critical";

export type Summary = {
  total_apis: number;
  active_incidents: number;
  error_rate: number;
  average_latency: number;
  uptime: number;
  health_score: number;
  requests_per_minute: number;
};

export type ApiService = {
  id: number;
  name: string;
  path: string;
  owner: string;
  health_score: number;
  uptime: number;
  is_online: boolean;
};

export type LogEntry = {
  id: number;
  timestamp: string;
  api_name: string;
  method: string;
  path: string;
  status_code: number;
  latency_ms: number;
  level: string;
  message: string;
  error_type: string | null;
  trace_id: string;
  cpu: number;
  memory: number;
  deployment_version: string;
  anomaly?: {
    is_anomaly: boolean;
    score: number;
    reasons: string[];
    baseline_latency: number;
    error_rate: number;
  };
};

export type Incident = {
  id: number;
  fingerprint: string;
  title: string;
  severity: Severity;
  status: string;
  affected_apis: string[];
  frequency: number;
  anomaly_score: number;
  first_seen: string;
  last_seen: string;
  summary: string;
  root_cause: string;
  recommendations: string[];
  timeline: Array<Record<string, string | number>>;
  metrics: Record<string, string | number | string[] | null>;
};

export type SyntheticTest = {
  id: number;
  timestamp: string;
  name: string;
  target: string;
  status: "passed" | "failed";
  latency_ms: number;
  details: string;
  incident_id?: number;
};

export type ChartPoint = {
  time: string;
  requests: number;
  latency: number;
  errors: number;
};
