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
  endpoint_url: string;
  expected_latency_ms: number;
  timeout_threshold_ms: number;
  category: string;
  environment: "production" | "staging" | "development" | string;
  health_check_interval_seconds: number;
  monitoring_enabled: boolean;
  requests_per_minute: number;
  last_checked_at: string | null;
  health_score: number;
  uptime: number;
  is_online: boolean;
  created_at: string;
};

export type ApiServicePayload = {
  name: string;
  endpoint_url: string;
  expected_latency_ms: number;
  timeout_threshold_ms: number;
  category: string;
  environment: string;
  health_check_interval_seconds: number;
  monitoring_enabled: boolean;
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

export type SyntheticCheck = {
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

export type MonitoringState = {
  running: boolean;
  paused: boolean;
  active_scenarios: number;
  request_count: number;
  tick_seconds: number;
};

export type ActivityItem = {
  id: string;
  timestamp: string;
  message: string;
  level: "success" | "warning" | "error" | "info";
};
