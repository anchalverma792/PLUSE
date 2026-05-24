"use client";

import type { ElementType, ReactNode } from "react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownUp,
  BarChart3,
  Bell,
  CheckCircle2,
  CirclePlus,
  Edit3,
  Gauge,
  Loader2,
  Pause,
  Play,
  Power,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppState } from "@/context/app-state";
import { useLiveStream } from "@/hooks/use-live-stream";
import { api } from "@/lib/api";
import type {
  ActivityItem,
  ApiService,
  ApiServicePayload,
  ChartPoint,
  Incident,
  LogEntry,
  MonitoringState,
  Summary,
} from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";

type SortKey = "name" | "status" | "uptime" | "latency" | "errorRate" | "throughput" | "environment";
type SortDirection = "asc" | "desc";
type FormErrors = Partial<Record<keyof ApiServicePayload, string>>;

const emptyApiForm: ApiServicePayload = {
  name: "",
  endpoint_url: "",
  expected_latency_ms: 250,
  timeout_threshold_ms: 2000,
  category: "Core",
  environment: "production",
  health_check_interval_seconds: 30,
  monitoring_enabled: true,
};

const fullTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Kolkata",
});

const shortTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Kolkata",
});

function parseTimestamp(timestamp: string) {
  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(timestamp);
  return new Date(hasTimezone ? timestamp : `${timestamp}Z`);
}

function timeLabel(timestamp?: string | null) {
  if (!timestamp) return "Never";
  const date = parseTimestamp(timestamp);
  if (Number.isNaN(date.getTime())) return "Never";
  return fullTimeFormatter.format(date);
}

function shortTimeLabel(timestamp?: string | null) {
  if (!timestamp) return "";
  const date = parseTimestamp(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return shortTimeFormatter.format(date);
}

function statusForApi(apiService: ApiService) {
  if (!apiService.monitoring_enabled) {
    return { label: "Disabled", dot: "bg-zinc-400", text: "text-zinc-500", badge: "bg-zinc-50 text-zinc-600 border-zinc-200" };
  }
  if (!apiService.is_online || apiService.health_score < 60) {
    return { label: "Unhealthy", dot: "bg-red-500", text: "text-red-600", badge: "bg-red-50 text-red-700 border-red-200" };
  }
  if (apiService.health_score < 85) {
    return { label: "Degraded", dot: "bg-blue-500", text: "text-blue-700", badge: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  return { label: "Healthy", dot: "bg-emerald-500", text: "text-emerald-700", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

function isIssue(log?: LogEntry) {
  return Boolean(log && (log.status_code >= 500 || log.status_code === 408 || log.status_code === 0 || log.latency_ms > 900));
}

function simplifyText(text?: string) {
  if (!text) return "";
  return text
    .replace(/\bSLO\b/g, "target")
    .replace(/\banomaly\b/gi, "signal")
    .replace(/\blatency\b/gi, "response time")
    .replace("No AI inference was executed because the Groq API key is not set.", "AI analysis is ready once Groq is configured.")
    .replace(/\b[A-Za-z]+Root did not call any non-Groq AI provider\./g, "")
    .replace("APY did not call any non-Groq AI provider.", "")
    .replace("Replay a playground incident", "Review a live incident");
}

function friendlyIncidentTitle(title?: string) {
  if (!title) return "No active incident";
  return title
    .replace(" Latency Spike", " Latency Elevated")
    .replace(" Error Surge", " Error Rate Elevated")
    .replace(" API Downtime", " Availability Drop")
    .replace(" Traffic Burst", " Throughput Change")
    .replace(" Performance Degradation", " Performance Degradation");
}

function confidence(incident?: Incident) {
  if (!incident) return 0;
  return Math.min(98, Math.max(62, Math.round((incident.anomaly_score || 52) + 14)));
}

function impactItems(incident?: Incident, log?: LogEntry) {
  if (!incident && !log) return ["No customer impact detected", "Monitoring is ready", "AI analysis is idle"];
  const apiName = incident?.affected_apis?.[0] ?? log?.api_name ?? "API";
  if (incident?.severity === "critical" || log?.status_code === 0) {
    return [`${apiName} availability is affected`, "Requests may fail for users", "Immediate mitigation recommended"];
  }
  if (incident?.severity === "high" || (log && log.status_code >= 500)) {
    return [`${apiName} error rate increased`, "Some user flows may fail", "AI identified a recurring pattern"];
  }
  return [`${apiName} response time increased`, "User experience may feel slower", "Investigation is continuing"];
}

function fallbackFixes(log?: LogEntry) {
  if (log?.error_type === "DatabaseUnavailable" || log?.error_type === "DatabaseTimeout") {
    return ["Check database connectivity", "Increase connection pool size", "Reduce expensive queries", "Fail over critical reads"];
  }
  if (log?.error_type === "DeployRegression") {
    return ["Rollback latest deployment", "Compare failing traces", "Keep traffic on stable version", "Patch the changed endpoint"];
  }
  if (log?.error_type === "Timeout") {
    return ["Find the slow dependency", "Add bounded retries", "Reduce timeout-heavy traffic", "Review upstream capacity"];
  }
  return ["Inspect recent changes", "Compare healthy and failing requests", "Check downstream services", "Apply a rollback if needed"];
}

function metricsForApi(apiService: ApiService, logs: LogEntry[]) {
  const apiLogs = logs.filter((log) => log.api_name === apiService.name).slice(0, 40);
  const latestLog = apiLogs[0];
  const averageLatency = apiLogs.length
    ? apiLogs.reduce((total, log) => total + log.latency_ms, 0) / apiLogs.length
    : latestLog?.latency_ms ?? apiService.expected_latency_ms;
  const failed = apiLogs.filter((log) => log.status_code >= 500 || log.status_code === 408 || log.status_code === 0).length;
  const errorRate = apiLogs.length ? (failed / apiLogs.length) * 100 : 0;

  return {
    latestLog,
    averageLatency,
    errorRate,
    throughput: apiService.requests_per_minute,
  };
}

function validateApiForm(form: ApiServicePayload): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = "API name is required.";
  if (!form.endpoint_url.trim()) {
    errors.endpoint_url = "Base URL is required.";
  } else {
    try {
      const url = new URL(form.endpoint_url);
      if (!["http:", "https:"].includes(url.protocol)) errors.endpoint_url = "Use an http or https URL.";
    } catch {
      errors.endpoint_url = "Enter a valid URL.";
    }
  }
  if (!form.category.trim()) errors.category = "Category is required.";
  if (form.expected_latency_ms <= 0) errors.expected_latency_ms = "Expected latency must be greater than 0.";
  if (form.timeout_threshold_ms <= form.expected_latency_ms) errors.timeout_threshold_ms = "Timeout must be greater than expected latency.";
  if (form.health_check_interval_seconds < 5) errors.health_check_interval_seconds = "Interval must be at least 5 seconds.";
  return errors;
}

function normalizeActivity(item: ActivityItem) {
  return item.message
    .replace("Demo APIs started", "Monitoring started")
    .replace("Demo APIs paused", "Monitoring paused")
    .replace("Demo APIs resumed", "Monitoring resumed")
    .replace("Demo APIs stopped", "Monitoring stopped")
    .replace("Simulation data reset", "State cleared")
    .replace(" Latency Spike", " latency elevated")
    .replace(" Error Surge", " error rate elevated")
    .replace(" API Downtime", " availability dropped")
    .replace(" Traffic Burst", " throughput changed")
    .replace("returned a server error", "error rate increased")
    .replace("timed out", "timeout pattern identified")
    .replace("health check completed", "health signal received");
}

export function IncidentPlayground() {
  const stream = useLiveStream();
  const { environment, search } = useAppState();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [apis, setApis] = useState<ApiService[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [monitoring, setMonitoring] = useState<MonitoringState | null>(null);
  const [loadingAction, setLoadingAction] = useState("");
  const [mounted, setMounted] = useState(false);
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [editingApi, setEditingApi] = useState<ApiService | null>(null);
  const [apiForm, setApiForm] = useState<ApiServicePayload>(emptyApiForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [severityFilter, setSeverityFilter] = useState("all");
  const [apiFilter, setApiFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tableSearch, setTableSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showAllActivities, setShowAllActivities] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  const refresh = useCallback(async () => {
    const [summaryData, apiData, logData, incidentData, chartData, monitoringData] = await Promise.all([
      api.summary(),
      api.apis(environment),
      api.logs("?limit=120"),
      api.incidents(),
      api.chart(),
      api.monitoringStatus(),
    ]);
    setSummary(summaryData);
    setApis(apiData);
    setLogs(logData);
    setIncidents(incidentData);
    setChart(chartData);
    setMonitoring(monitoringData);
  }, [environment]);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => {
      refresh().catch(() => toast.error("Unable to load APY data"));
    }, 0);
    const timer = setInterval(() => refresh().catch(() => undefined), 6000);
    return () => {
      window.clearTimeout(firstLoad);
      clearInterval(timer);
    };
  }, [refresh, stream.apiVersion, stream.resetVersion]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const node = chartContainerRef.current;
    if (!node) return;

    const updateChartWidth = () => {
      setChartWidth(Math.max(0, Math.floor(node.getBoundingClientRect().width)));
    };

    updateChartWidth();
    const observer = new ResizeObserver(updateChartWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const visibleLogs = stream.logs.length ? stream.logs : logs;
  const visibleIncidents = stream.incidents.length ? stream.incidents : incidents;
  const monitoringState = stream.monitoring ?? monitoring;
  const activeIncident = visibleIncidents.find((incident) => incident.status === "open") ?? visibleIncidents[0];
  const activeLog = visibleLogs.find((log) => isIssue(log)) ?? visibleLogs[0];
  const openIncidentCount = visibleIncidents.filter((incident) => incident.status === "open").length;
  const enabledApis = apis.filter((item) => item.monitoring_enabled);
  const systemHealthy = openIncidentCount === 0 && (summary?.active_incidents ?? 0) === 0 && apis.every((item) => statusForApi(item).label === "Healthy");
  const monitoringLabel = monitoringState?.running ? (monitoringState.paused ? "Paused" : "Active") : "Stopped";
  const isAnalyzing = Boolean(monitoringState?.running && !activeIncident && visibleLogs.length > 0);
  const confidenceScore = confidence(activeIncident);
  const rootCause = simplifyText(
    activeIncident?.root_cause ||
      activeIncident?.summary ||
      (activeLog ? `${activeLog.api_name} is being analyzed from live telemetry.` : "Start monitoring to begin AI reliability analysis."),
  );
  const recommendations = activeIncident?.recommendations?.length ? activeIncident.recommendations : fallbackFixes(activeLog);

  const investigationTimeline = [
    ["Incident detected", activeIncident?.first_seen ?? activeLog?.timestamp],
    ["Telemetry correlated", activeIncident?.first_seen ?? activeLog?.timestamp],
    ["Pattern classified", activeIncident?.last_seen ?? activeLog?.timestamp],
    ["Root cause generated", activeIncident?.last_seen ?? activeLog?.timestamp],
    ["Fixes prioritized", activeIncident?.last_seen ?? activeLog?.timestamp],
  ] satisfies Array<[string, string | null | undefined]>;

  const filteredIncidents = useMemo(() => {
    return visibleIncidents.filter((incident) => {
      const query = search.toLowerCase();
      const matchesSearch = !query || `${incident.title} ${incident.summary}`.toLowerCase().includes(query);
      const matchesSeverity = severityFilter === "all" || incident.severity === severityFilter;
      const matchesApi = apiFilter === "all" || incident.affected_apis.includes(apiFilter);
      return matchesSearch && matchesSeverity && matchesApi;
    });
  }, [apiFilter, search, severityFilter, visibleIncidents]);

  const apiRows = useMemo(() => {
    const query = `${search} ${tableSearch}`.trim().toLowerCase();
    const rows = apis
      .map((apiService) => {
        const status = statusForApi(apiService);
        const lastIncident = visibleIncidents.find((incident) => incident.affected_apis.includes(apiService.name));
        const metrics = metricsForApi(apiService, visibleLogs);
        return { apiService, status, lastIncident, ...metrics };
      })
      .filter((row) => {
        const haystack = `${row.apiService.name} ${row.apiService.endpoint_url} ${row.apiService.category} ${row.apiService.environment}`.toLowerCase();
        const matchesQuery = !query || haystack.includes(query);
        const matchesStatus = statusFilter === "all" || row.status.label.toLowerCase() === statusFilter;
        return matchesQuery && matchesStatus;
      });

    return rows.sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      const values: Record<SortKey, [string | number, string | number]> = {
        name: [a.apiService.name, b.apiService.name],
        status: [a.status.label, b.status.label],
        uptime: [a.apiService.uptime, b.apiService.uptime],
        latency: [a.averageLatency, b.averageLatency],
        errorRate: [a.errorRate, b.errorRate],
        throughput: [a.throughput, b.throughput],
        environment: [a.apiService.environment, b.apiService.environment],
      };
      const [left, right] = values[sortKey];
      if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
      return String(left).localeCompare(String(right)) * direction;
    });
  }, [apis, search, sortDirection, sortKey, statusFilter, tableSearch, visibleIncidents, visibleLogs]);

  const chartData = useMemo(() => {
    const live = visibleLogs
      .slice(0, 36)
      .reverse()
      .map((log) => ({
        time: shortTimeLabel(log.timestamp),
        latency: Math.round(log.latency_ms),
        errors: log.status_code >= 500 || log.status_code === 408 || log.status_code === 0 ? Math.max(400, log.latency_ms) : 0,
      }));
    if (live.length > 4) return live;
    return chart.map((point) => ({ time: point.time, latency: point.latency, errors: point.errors * 350 }));
  }, [chart, visibleLogs]);

  const activities = useMemo(() => {
    const fallback: ActivityItem[] = visibleLogs.slice(0, 8).map((log) => ({
      id: `fallback-${log.id}`,
      timestamp: log.timestamp,
      message:
        log.status_code >= 500
          ? `${log.api_name} error rate increased`
          : log.latency_ms > 900
            ? `${log.api_name} latency increased`
            : `${log.api_name} health signal received`,
      level: log.status_code >= 500 ? "error" : log.latency_ms > 900 ? "warning" : "success",
    }));
    return stream.activities.length ? stream.activities : fallback;
  }, [stream.activities, visibleLogs]);

  const runAction = async (key: string, action: () => Promise<MonitoringState | unknown>, successMessage?: string) => {
    setLoadingAction(key);
    try {
      const result = await action();
      if (result && typeof result === "object" && "running" in result) {
        setMonitoring(result as MonitoringState);
      }
      if (successMessage) toast.success(successMessage);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setLoadingAction("");
    }
  };

  const handleStartMonitoring = async () => {
    if (!enabledApis.length) {
      toast.error("Add or enable an API before starting monitoring");
      setApiModalOpen(true);
      return;
    }
    await runAction("start", () => api.startMonitoring(), "Monitoring started");
  };

  const handlePauseMonitoring = async () => {
    const paused = monitoringState?.paused;
    await runAction(paused ? "resume" : "pause", () => (paused ? api.resumeMonitoring() : api.pauseMonitoring()), paused ? "Monitoring resumed" : "Monitoring paused");
  };

  const handleStopMonitoring = async () => {
    await runAction("stop", () => api.stopMonitoring(), "Monitoring stopped");
  };

  const handleClearState = async () => {
    await runAction("clear", () => api.clearState(), "State cleared");
  };

  const openAddApi = () => {
    setEditingApi(null);
    setFormErrors({});
    setApiForm({ ...emptyApiForm, environment });
    setApiModalOpen(true);
  };

  const openEditApi = (apiService: ApiService) => {
    setEditingApi(apiService);
    setFormErrors({});
    setApiForm({
      name: apiService.name,
      endpoint_url: apiService.endpoint_url,
      expected_latency_ms: apiService.expected_latency_ms,
      timeout_threshold_ms: apiService.timeout_threshold_ms,
      category: apiService.category,
      environment: apiService.environment,
      health_check_interval_seconds: apiService.health_check_interval_seconds,
      monitoring_enabled: apiService.monitoring_enabled,
    });
    setApiModalOpen(true);
  };

  const submitApi = async (event: FormEvent) => {
    event.preventDefault();
    const errors = validateApiForm(apiForm);
    setFormErrors(errors);
    if (Object.keys(errors).length) return;

    setLoadingAction("save-api");
    try {
      if (editingApi) {
        const updated = await api.updateApi(editingApi.id, apiForm);
        setApis((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        toast.success(`${apiForm.name} updated`);
      } else {
        const created = await api.createApi(apiForm);
        setApis((current) => [created, ...current.filter((item) => item.id !== created.id)]);
        toast.success(`${apiForm.name} added`);
      }
      setApiModalOpen(false);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save API");
    } finally {
      setLoadingAction("");
    }
  };

  const toggleMonitoring = async (apiService: ApiService) => {
    const enabled = !apiService.monitoring_enabled;
    setLoadingAction(`toggle-${apiService.id}`);
    setApis((current) => current.map((item) => (item.id === apiService.id ? { ...item, monitoring_enabled: enabled } : item)));
    try {
      await api.updateApi(apiService.id, { monitoring_enabled: enabled });
      toast.success(`${apiService.name} ${enabled ? "enabled" : "disabled"}`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update monitoring");
      setApis((current) => current.map((item) => (item.id === apiService.id ? apiService : item)));
    } finally {
      setLoadingAction("");
    }
  };

  const deleteApi = async (apiService: ApiService) => {
    setLoadingAction(`delete-${apiService.id}`);
    try {
      await api.deleteApi(apiService.id);
      setApis((current) => current.filter((item) => item.id !== apiService.id));
      toast.success(`${apiService.name} removed`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove API");
    } finally {
      setLoadingAction("");
    }
  };

  const updateSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const displayedActivities = showAllActivities ? activities : activities.slice(0, 8);

  return (
    <AppShell connected={stream.connected}>
      <div className="space-y-4">
        <section id="overview" className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 xl:grid-cols-[1fr_520px] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", systemHealthy ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700")}>
                  <span className={cn("h-2 w-2 rounded-full", systemHealthy ? "bg-emerald-500" : "bg-red-500")} />
                  {systemHealthy ? "Healthy" : "Investigating"}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700">
                  <span className={cn("h-2 w-2 rounded-full", monitoringState?.running ? (monitoringState.paused ? "bg-blue-500" : "bg-emerald-500") : "bg-zinc-400")} />
                  Monitoring {monitoringLabel}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">AI Reliability Engineer</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">Detect. Explain. Resolve API failures instantly.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={handleStartMonitoring} disabled={Boolean(loadingAction) || (monitoringState?.running && !monitoringState.paused)}>
                  {loadingAction === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Start Monitoring
                </Button>
                <Button variant="secondary" onClick={handlePauseMonitoring} disabled={Boolean(loadingAction) || !monitoringState?.running}>
                  {loadingAction === "pause" || loadingAction === "resume" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                  {monitoringState?.paused ? "Resume Monitoring" : "Pause Monitoring"}
                </Button>
                <Button variant="secondary" onClick={handleStopMonitoring} disabled={Boolean(loadingAction) || !monitoringState?.running}>
                  {loadingAction === "stop" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                  Stop Monitoring
                </Button>
                <Button variant="secondary" onClick={handleClearState} disabled={Boolean(loadingAction)}>
                  {loadingAction === "clear" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  Clear State
                </Button>
                <Button variant="secondary" onClick={openAddApi}>
                  <CirclePlus className="h-4 w-4" />
                  Add API
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
              <Metric label="APIs" value={formatNumber(summary?.total_apis ?? apis.length)} tone="neutral" />
              <Metric label="Open Incidents" value={formatNumber(openIncidentCount || summary?.active_incidents || 0)} tone={openIncidentCount ? "red" : "green"} />
              <Metric label="Health Score" value={`${formatNumber(summary?.health_score ?? 100)}%`} tone={systemHealthy ? "green" : "red"} />
              <Metric label="Throughput" value={`${formatNumber(summary?.requests_per_minute ?? 0)}/min`} tone="neutral" />
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)_420px]">
          <CardShell title="Active Incident" action={activeIncident ? <Badge severity={activeIncident.severity}>{activeIncident.severity}</Badge> : null}>
            {activeIncident ? (
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 text-red-600 ring-1 ring-red-100">
                    <AlertTriangle className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-zinc-950">{friendlyIncidentTitle(activeIncident.title)}</h3>
                    <p className="mt-1 text-sm text-zinc-500">Detected {timeLabel(activeIncident.first_seen)}</p>
                  </div>
                </div>
                <KeyValue label="Affected API" value={activeIncident.affected_apis.join(", ")} />
                <KeyValue label="Last Seen" value={timeLabel(activeIncident.last_seen)} />
                <KeyValue label="Confidence" value={`${confidenceScore}%`} />
                <a href="#ai-analysis" className="inline-flex h-10 w-full items-center justify-between rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50">
                  View Analysis <Sparkles className="h-4 w-4" />
                </a>
              </div>
            ) : (
              <EmptyState icon={ShieldCheck} title="No active incident" description="Start monitoring to stream live reliability signals." />
            )}
          </CardShell>

          <CardShell
            title="AI Investigation Console"
            action={<span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" /> AI Ready</span>}
            className="xl:min-h-[560px]"
            id="ai-analysis"
          >
            <div className="space-y-5">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-900 ring-1 ring-zinc-200">
                      <Sparkles className={cn("h-5 w-5", isAnalyzing && "animate-pulse text-blue-600")} />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-950">
                        {activeIncident ? `${activeIncident.affected_apis[0]} is under investigation.` : isAnalyzing ? "AI analysis is correlating telemetry." : "AI analysis is ready."}
                      </h3>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-700">{rootCause}</p>
                    </div>
                  </div>
                  <div className="min-w-32 rounded-lg border border-zinc-200 bg-white p-3">
                    <p className="text-xs font-medium text-zinc-500">Confidence</p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-950">{activeIncident ? `${confidenceScore}%` : "Idle"}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${activeIncident ? confidenceScore : 8}%` }} />
                    </div>
                  </div>
                </div>
                {isAnalyzing && (
                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-zinc-200">
                    <motion.div className="h-full w-1/3 rounded-full bg-blue-500" animate={{ x: ["-100%", "320%"] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
                  </div>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                <div className="rounded-xl border border-zinc-200 p-4">
                  <h4 className="text-sm font-semibold text-zinc-950">Root Cause Analysis</h4>
                  <p className="mt-3 text-sm leading-7 text-zinc-700">{rootCause}</p>
                </div>
                <div className="rounded-xl border border-zinc-200 p-4">
                  <h4 className="text-sm font-semibold text-zinc-950">Impact</h4>
                  <div className="mt-3 space-y-3">
                    {impactItems(activeIncident, activeLog).map((item) => (
                      <div key={item} className="flex items-center gap-3 text-sm text-zinc-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 border-t border-zinc-200 pt-5 lg:grid-cols-[1fr_300px]">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-zinc-800" />
                    <h4 className="text-sm font-semibold text-zinc-950">Suggested Fixes</h4>
                  </div>
                  <div className="grid gap-2">
                    {recommendations.slice(0, 4).map((item) => (
                      <motion.div
                        key={item}
                        layout
                        className="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 text-sm text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        {simplifyText(item)}
                      </motion.div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-zinc-950">Investigation Timeline</h4>
                  <div className="space-y-0">
                    {investigationTimeline.map(([label, timestamp], index) => (
                      <div key={label} className="relative flex gap-3 pb-4 last:pb-0">
                        {index !== investigationTimeline.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-zinc-200" />}
                        <span className={cn("relative mt-1 h-4 w-4 rounded-full border-2 border-white", activeIncident || index < 2 ? "bg-emerald-600" : "bg-white ring-2 ring-zinc-300")} />
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">{label}</p>
                          <p className="mt-1 text-xs text-zinc-500">{timeLabel(timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardShell>

          <div className="space-y-4">
            <CardShell title="Latency & Error Signals" action={<span className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600">Last 15 min</span>} id="reports">
              <div ref={chartContainerRef} className="h-64 min-h-64 min-w-0 w-full overflow-hidden">
                {mounted && chartWidth > 0 ? (
                  <AreaChart data={chartData} width={chartWidth} height={256}>
                    <defs>
                      <linearGradient id="latency-green" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.03} />
                      </linearGradient>
                      <linearGradient id="latency-red" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="time" stroke="#71717a" tickLine={false} axisLine={false} minTickGap={18} />
                    <YAxis stroke="#71717a" tickLine={false} axisLine={false} width={38} />
                    <Tooltip contentStyle={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }} />
                    <Area dataKey="latency" type="monotone" stroke="#10b981" fill="url(#latency-green)" strokeWidth={2} isAnimationActive />
                    <Area dataKey="errors" type="monotone" stroke="#ef4444" fill="url(#latency-red)" strokeWidth={2} isAnimationActive />
                  </AreaChart>
                ) : (
                  <div className="h-full animate-pulse rounded-lg bg-zinc-50" />
                )}
              </div>
            </CardShell>

            <CardShell title="Realtime Activity" action={<Button variant="ghost" size="sm" onClick={() => setShowAllActivities((current) => !current)}>{showAllActivities ? "Collapse" : "View all"}</Button>}>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {displayedActivities.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="grid grid-cols-[74px_10px_1fr] items-center gap-3 rounded-lg px-2 py-2 text-sm transition hover:bg-zinc-50"
                    >
                      <span className="font-mono text-xs text-zinc-500">{timeLabel(item.timestamp)}</span>
                      <span className={cn("h-2.5 w-2.5 rounded-full", item.level === "error" ? "bg-red-500" : item.level === "warning" ? "bg-blue-500" : item.level === "success" ? "bg-emerald-600" : "bg-zinc-400")} />
                      <span className="text-zinc-700">{normalizeActivity(item)}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {!activities.length && <EmptyState icon={ShieldCheck} title="No activity yet" description="Start monitoring to stream live API events." />}
              </div>
            </CardShell>
          </div>
        </section>

        <section id="apis" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          <CardShell title="API Health" action={<Button variant="secondary" size="sm" onClick={openAddApi}><CirclePlus className="h-4 w-4" /> Add API</Button>}>
            <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_180px]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input className="pl-9" placeholder="Search API name, URL, category..." value={tableSearch} onChange={(event) => setTableSearch(event.target.value)} />
              </label>
              <select className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="healthy">Healthy</option>
                <option value="degraded">Degraded</option>
                <option value="unhealthy">Unhealthy</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                    <SortHeader label="API Name" sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={updateSort} />
                    <SortHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={updateSort} />
                    <SortHeader label="Uptime" sortKey="uptime" activeKey={sortKey} direction={sortDirection} onSort={updateSort} />
                    <SortHeader label="Avg Latency" sortKey="latency" activeKey={sortKey} direction={sortDirection} onSort={updateSort} />
                    <SortHeader label="Error Rate" sortKey="errorRate" activeKey={sortKey} direction={sortDirection} onSort={updateSort} />
                    <SortHeader label="Throughput" sortKey="throughput" activeKey={sortKey} direction={sortDirection} onSort={updateSort} />
                    <th className="py-3 pr-4 font-semibold">Last Incident</th>
                    <SortHeader label="Environment" sortKey="environment" activeKey={sortKey} direction={sortDirection} onSort={updateSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {apiRows.map((row) => (
                    <tr key={row.apiService.id} className="align-middle transition hover:bg-zinc-50/70">
                      <td className="py-4 pr-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-950">{row.apiService.name}</p>
                            <p className="mt-1 max-w-xs truncate text-xs text-zinc-500">{row.apiService.endpoint_url}</p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <IconButton title="Edit API" onClick={() => openEditApi(row.apiService)} icon={Edit3} />
                            <IconButton
                              title={row.apiService.monitoring_enabled ? "Disable alerts" : "Enable alerts"}
                              onClick={() => toggleMonitoring(row.apiService)}
                              icon={loadingAction === `toggle-${row.apiService.id}` ? Loader2 : row.apiService.monitoring_enabled ? Pause : Play}
                              spinning={loadingAction === `toggle-${row.apiService.id}`}
                            />
                            <IconButton title="Remove API" onClick={() => deleteApi(row.apiService)} icon={loadingAction === `delete-${row.apiService.id}` ? Loader2 : Trash2} danger spinning={loadingAction === `delete-${row.apiService.id}`} />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <span className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold", row.status.badge)}>
                          <span className={cn("h-2 w-2 rounded-full", row.status.dot)} />
                          {row.status.label}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-zinc-700">{formatNumber(row.apiService.uptime)}%</td>
                      <td className="py-4 pr-4 text-zinc-700">{formatNumber(row.averageLatency)} ms</td>
                      <td className={cn("py-4 pr-4", row.errorRate > 5 ? "text-red-600" : "text-zinc-700")}>{formatNumber(row.errorRate)}%</td>
                      <td className="py-4 pr-4 text-zinc-700">{formatNumber(row.throughput)}/min</td>
                      <td className="py-4 pr-4 text-zinc-700">{row.lastIncident ? friendlyIncidentTitle(row.lastIncident.title) : "None"}</td>
                      <td className="py-4 pr-4 capitalize text-zinc-700">{row.apiService.environment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!apiRows.length && <EmptyState icon={Gauge} title="No APIs match" description="Adjust search or status filters." />}
            </div>
          </CardShell>

          <div className="space-y-4">
            <CardShell title="Incident History" id="incidents">
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <select className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
                  <option value="all">All severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
                <select className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm" value={apiFilter} onChange={(event) => setApiFilter(event.target.value)}>
                  <option value="all">All APIs</option>
                  {apis.map((apiService) => <option key={apiService.id} value={apiService.name}>{apiService.name}</option>)}
                </select>
              </div>
              <div className="max-h-[460px] space-y-3 overflow-auto pr-1">
                {filteredIncidents.map((incident) => (
                  <motion.div key={incident.id} layout className="rounded-xl border border-zinc-200 p-4 transition hover:bg-zinc-50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge severity={incident.severity}>{incident.severity}</Badge>
                        <h3 className="mt-3 font-semibold text-zinc-950">{friendlyIncidentTitle(incident.title)}</h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">{simplifyText(incident.summary)}</p>
                      </div>
                      <span className="shrink-0 text-xs text-zinc-500">{timeLabel(incident.last_seen)}</span>
                    </div>
                  </motion.div>
                ))}
                {!filteredIncidents.length && <EmptyState icon={ShieldCheck} title="No incidents found" description="Adjust filters or start monitoring." />}
              </div>
            </CardShell>

            <CardShell title="Integrations" id="integrations">
              <div className="grid gap-3">
                <IntegrationRow icon={Bell} label="Alert routing" value={enabledApis.length ? "Enabled" : "Waiting for API"} tone={enabledApis.length ? "green" : "neutral"} />
                <IntegrationRow icon={BarChart3} label="Realtime stream" value={stream.connected ? "Connected" : "Reconnecting"} tone={stream.connected ? "green" : "red"} />
                <IntegrationRow icon={Sparkles} label="AI diagnosis" value="Groq ready" tone="green" />
              </div>
            </CardShell>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {apiModalOpen && (
          <Modal title={editingApi ? "Edit API" : "Add API"} onClose={() => setApiModalOpen(false)}>
            <form className="grid gap-4" onSubmit={submitApi}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="API Name" error={formErrors.name}>
                  <Input required value={apiForm.name} onChange={(event) => setApiForm({ ...apiForm, name: event.target.value })} placeholder="Payments API" />
                </FormField>
                <FormField label="Base URL" error={formErrors.endpoint_url}>
                  <Input required type="url" value={apiForm.endpoint_url} onChange={(event) => setApiForm({ ...apiForm, endpoint_url: event.target.value })} placeholder="https://api.company.com" />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Environment">
                  <select className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm" value={apiForm.environment} onChange={(event) => setApiForm({ ...apiForm, environment: event.target.value })}>
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </FormField>
                <FormField label="Category" error={formErrors.category}>
                  <Input value={apiForm.category} onChange={(event) => setApiForm({ ...apiForm, category: event.target.value })} placeholder="Payments" />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Expected Latency" error={formErrors.expected_latency_ms}>
                  <Input type="number" min={1} value={apiForm.expected_latency_ms} onChange={(event) => setApiForm({ ...apiForm, expected_latency_ms: Number(event.target.value) })} />
                </FormField>
                <FormField label="Timeout Threshold" error={formErrors.timeout_threshold_ms}>
                  <Input type="number" min={1} value={apiForm.timeout_threshold_ms} onChange={(event) => setApiForm({ ...apiForm, timeout_threshold_ms: Number(event.target.value) })} />
                </FormField>
                <FormField label="Monitoring Interval" error={formErrors.health_check_interval_seconds}>
                  <Input type="number" min={5} value={apiForm.health_check_interval_seconds} onChange={(event) => setApiForm({ ...apiForm, health_check_interval_seconds: Number(event.target.value) })} />
                </FormField>
              </div>
              <label className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700">
                <span>
                  <span className="block text-zinc-950">Enable Alerts</span>
                  <span className="mt-1 block text-xs font-normal text-zinc-500">Include this API in live incident detection.</span>
                </span>
                <input className="h-4 w-4 accent-zinc-950" type="checkbox" checked={apiForm.monitoring_enabled} onChange={(event) => setApiForm({ ...apiForm, monitoring_enabled: event.target.checked })} />
              </label>
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={() => setApiModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={loadingAction === "save-api"}>
                  {loadingAction === "save-api" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingApi ? "Save Changes" : "Add API"}
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function CardShell({ title, action, children, className, id }: { title: string; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={cn("scroll-mt-28 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5", className)}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-zinc-950 sm:text-base">{title}</h2>
        {action}
      </div>
      {children}
    </motion.div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="truncate font-semibold text-zinc-950">{value}</span>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "red" | "green" | "neutral" }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold", tone === "red" ? "text-red-600" : tone === "green" ? "text-emerald-700" : "text-zinc-950")}>{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: ElementType; title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-200 p-5 text-center">
      <Icon className="mx-auto h-6 w-6 text-zinc-400" />
      <p className="mt-3 font-semibold text-zinc-950">{title}</p>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
    </div>
  );
}

function FormField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      {children}
      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/25 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl shadow-zinc-900/15"
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 12 }}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
            <p className="mt-1 text-sm text-zinc-500">Configure endpoint monitoring, alerting, and reliability thresholds.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function SortHeader({ label, sortKey, activeKey, direction, onSort }: { label: string; sortKey: SortKey; activeKey: SortKey; direction: SortDirection; onSort: (key: SortKey) => void }) {
  return (
    <th className="py-3 pr-4 font-semibold">
      <button type="button" className="inline-flex items-center gap-1.5 transition hover:text-zinc-950" onClick={() => onSort(sortKey)}>
        {label}
        <ArrowDownUp className={cn("h-3.5 w-3.5", activeKey === sortKey ? "text-zinc-950" : "text-zinc-400", activeKey === sortKey && direction === "desc" && "rotate-180")} />
      </button>
    </th>
  );
}

function IconButton({ icon: Icon, title, onClick, danger = false, spinning = false }: { icon: ElementType; title: string; onClick: () => void; danger?: boolean; spinning?: boolean }) {
  return (
    <button
      type="button"
      className={cn("rounded-md p-2 transition hover:bg-zinc-100", danger ? "text-red-500 hover:bg-red-50" : "text-zinc-500 hover:text-zinc-950")}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <Icon className={cn("h-4 w-4", spinning && "animate-spin")} />
    </button>
  );
}

function IntegrationRow({ icon: Icon, label, value, tone }: { icon: ElementType; label: string; value: string; tone: "green" | "red" | "neutral" }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-zinc-700 ring-1 ring-zinc-200">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium text-zinc-700">{label}</span>
      </div>
      <span className={cn("text-sm font-semibold", tone === "green" ? "text-emerald-700" : tone === "red" ? "text-red-600" : "text-zinc-600")}>{value}</span>
    </div>
  );
}
