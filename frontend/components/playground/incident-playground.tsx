"use client";

import type { ElementType, ReactNode } from "react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  CirclePlus,
  CreditCard,
  DatabaseZap,
  Edit3,
  LineChart as LineChartIcon,
  Loader2,
  Pause,
  Play,
  Power,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Trash2,
  TrendingUp,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  SimulationState,
  Summary,
} from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";

const scenarios = [
  {
    id: "deployment_failure",
    title: "Payment Failure",
    description: "High latency in payments",
    icon: CreditCard,
    apiName: "Payment API",
  },
  {
    id: "database_crash",
    title: "Database Crash",
    description: "Database connection down",
    icon: DatabaseZap,
    apiName: undefined,
  },
  {
    id: "traffic_spike",
    title: "Traffic Spike",
    description: "Sudden traffic increase",
    icon: TrendingUp,
    apiName: undefined,
  },
  {
    id: "timeout_storm",
    title: "Timeout Storm",
    description: "APIs timing out",
    icon: TimerReset,
    apiName: undefined,
  },
] as const;

const scenarioOptions = [
  { value: "deployment_failure", label: "Payment or release failure" },
  { value: "database_crash", label: "Database crash" },
  { value: "traffic_spike", label: "Traffic spike" },
  { value: "timeout_storm", label: "Timeout storm" },
];

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
    return { label: "Degraded", dot: "bg-orange-500", text: "text-orange-600", badge: "bg-orange-50 text-orange-700 border-orange-200" };
  }
  return { label: "Healthy", dot: "bg-emerald-500", text: "text-emerald-600", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

function isIssue(log?: LogEntry) {
  return Boolean(log && (log.status_code >= 500 || log.status_code === 408 || log.status_code === 0 || log.latency_ms > 900));
}

function simplifyText(text?: string) {
  if (!text) return "";
  return text
    .replace(/\bSLO\b/g, "target")
    .replace(/\banomaly\b/gi, "issue")
    .replace(/\blatency\b/gi, "response time")
    .replace("No AI inference was executed because the Groq API key is not set.", "AI is preparing a fresh investigation.")
    .replace("PulseRoot did not call any non-Groq AI provider.", "");
}

function friendlyIncidentTitle(title?: string) {
  if (!title) return "No active incident";
  return title
    .replace(" Latency Spike", " Failure")
    .replace(" Error Surge", " Failure")
    .replace(" API Downtime", " Offline")
    .replace(" Traffic Burst", " Traffic Spike")
    .replace(" Performance Degradation", " Degradation");
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
  return ["Inspect recent changes", "Compare healthy and failing requests", "Check downstream services", "Apply a safe rollback if needed"];
}

function latestLogForApi(logs: LogEntry[], apiName: string) {
  return logs.find((log) => log.api_name === apiName);
}

export function IncidentPlayground() {
  const stream = useLiveStream();
  const { environment, search } = useAppState();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [apis, setApis] = useState<ApiService[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [simulation, setSimulation] = useState<SimulationState | null>(null);
  const [loadingAction, setLoadingAction] = useState("");
  const [mounted, setMounted] = useState(false);
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [editingApi, setEditingApi] = useState<ApiService | null>(null);
  const [apiForm, setApiForm] = useState<ApiServicePayload>(emptyApiForm);
  const [customScenarioOpen, setCustomScenarioOpen] = useState(false);
  const [customScenario, setCustomScenario] = useState({ scenario: "traffic_spike", apiName: "" });
  const [severityFilter, setSeverityFilter] = useState("all");
  const [apiFilter, setApiFilter] = useState("all");
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  const refresh = useCallback(async () => {
    const [summaryData, apiData, logData, incidentData, chartData, simulationData] = await Promise.all([
      api.summary(),
      api.apis(environment),
      api.logs("?limit=120"),
      api.incidents(),
      api.chart(),
      api.simulationStatus(),
    ]);
    setSummary(summaryData);
    setApis(apiData);
    setLogs(logData);
    setIncidents(incidentData);
    setChart(chartData);
    setSimulation(simulationData);
  }, [environment]);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => {
      refresh().catch(() => toast.error("Unable to load PulseRoot data"));
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
  const simulationState = stream.simulation ?? simulation;
  const activeIncident = visibleIncidents[0];
  const activeLog = visibleLogs.find((log) => isIssue(log)) ?? visibleLogs[0];
  const openIncidentCount = visibleIncidents.filter((incident) => incident.status === "open").length;
  const systemHealthy = openIncidentCount === 0 && (summary?.active_incidents ?? 0) === 0 && apis.every((item) => statusForApi(item).label === "Healthy");
  const investigationTimeline = [
    ["Incident detected", activeIncident?.first_seen ?? activeLog?.timestamp],
    ["Collecting logs", activeIncident?.first_seen ?? activeLog?.timestamp],
    ["Analyzing patterns", activeIncident?.last_seen ?? activeLog?.timestamp],
    ["Root cause identified", activeIncident?.last_seen ?? activeLog?.timestamp],
    ["Generating recommendations", activeIncident?.last_seen ?? activeLog?.timestamp],
  ] satisfies Array<[string, string | null | undefined]>;

  const filteredApis = useMemo(() => {
    return apis.filter((item) => {
      const query = search.toLowerCase();
      return !query || `${item.name} ${item.endpoint_url} ${item.category}`.toLowerCase().includes(query);
    });
  }, [apis, search]);

  const filteredIncidents = useMemo(() => {
    return visibleIncidents.filter((incident) => {
      const matchesSearch = !search || `${incident.title} ${incident.summary}`.toLowerCase().includes(search.toLowerCase());
      const matchesSeverity = severityFilter === "all" || incident.severity === severityFilter;
      const matchesApi = apiFilter === "all" || incident.affected_apis.includes(apiFilter);
      return matchesSearch && matchesSeverity && matchesApi;
    });
  }, [apiFilter, search, severityFilter, visibleIncidents]);

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
          ? `${log.api_name} returned ${log.status_code}`
          : log.latency_ms > 900
            ? `${log.api_name} response time increased`
            : `${log.api_name} health check completed`,
      level: log.status_code >= 500 ? "error" : log.latency_ms > 900 ? "warning" : "success",
    }));
    return stream.activities.length ? stream.activities : fallback;
  }, [stream.activities, visibleLogs]);

  const runAction = async (key: string, action: () => Promise<SimulationState | unknown>) => {
    setLoadingAction(key);
    try {
      const result = await action();
      if (result && typeof result === "object" && "running" in result) {
        setSimulation(result as SimulationState);
      }
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setLoadingAction("");
    }
  };

  const runScenario = async (scenario: (typeof scenarios)[number]) => {
    await runAction(scenario.id, async () => {
      await api.startSimulation();
      await api.trigger(scenario.id, scenario.apiName);
      toast.success(`${scenario.title} simulation started`);
      return api.simulationStatus();
    });
  };

  const openAddApi = () => {
    setEditingApi(null);
    setApiForm({ ...emptyApiForm, environment });
    setApiModalOpen(true);
  };

  const openEditApi = (apiService: ApiService) => {
    setEditingApi(apiService);
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
    setLoadingAction("save-api");
    try {
      if (editingApi) {
        await api.updateApi(editingApi.id, apiForm);
        toast.success(`${apiForm.name} updated`);
      } else {
        await api.createApi(apiForm);
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
    await api.updateApi(apiService.id, { monitoring_enabled: !apiService.monitoring_enabled });
    await refresh();
  };

  const deleteApi = async (apiService: ApiService) => {
    await api.deleteApi(apiService.id);
    toast.success(`${apiService.name} deleted`);
    await refresh();
  };

  const submitCustomScenario = async (event: FormEvent) => {
    event.preventDefault();
    setCustomScenarioOpen(false);
    await runAction("custom-scenario", async () => {
      await api.startSimulation();
      await api.trigger(customScenario.scenario, customScenario.apiName || undefined);
      toast.success("Custom simulation started");
      return api.simulationStatus();
    });
  };

  const rootCause = simplifyText(activeIncident?.root_cause || activeIncident?.summary || (activeLog ? `${activeLog.api_name} is being analyzed from live telemetry.` : "Start Demo APIs to begin investigation."));
  const recommendations = activeIncident?.recommendations?.length ? activeIncident.recommendations : fallbackFixes(activeLog);

  return (
    <AppShell connected={stream.connected}>
      <div className="space-y-5">
        <section className="relative overflow-hidden rounded-[22px] border border-zinc-200 bg-white px-5 py-8 shadow-sm sm:px-8 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-center">
            <div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
                AI Reliability Engineer
              </h1>
              <p className="mt-4 text-lg text-zinc-600">Detect. Explain. Resolve API failures instantly.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm">
                  <span className={cn("h-2 w-2 rounded-full", systemHealthy ? "bg-emerald-500" : "bg-orange-500")} />
                  System Status: {systemHealthy ? "Healthy" : "Investigating"}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm">
                  <span className={cn("h-2 w-2 rounded-full", stream.connected ? "bg-emerald-500" : "bg-orange-500")} />
                  Realtime Monitoring
                </span>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button onClick={() => runAction("start", () => api.startSimulation())} disabled={loadingAction === "start"}>
                  {loadingAction === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Start Demo APIs
                </Button>
                <Button variant="secondary" onClick={() => runAction("pause", () => simulationState?.paused ? api.resumeSimulation() : api.pauseSimulation())}>
                  <Pause className="h-4 w-4" />
                  {simulationState?.paused ? "Resume" : "Pause"}
                </Button>
                <Button variant="secondary" onClick={() => runAction("stop", () => api.stopSimulation())}>
                  <Power className="h-4 w-4" />
                  Stop Simulation
                </Button>
                <Button variant="secondary" onClick={() => runAction("reset", () => api.resetSimulation())}>
                  <RefreshCcw className="h-4 w-4" />
                  Reset
                </Button>
                <Button variant="secondary" onClick={openAddApi}>
                  <CirclePlus className="h-4 w-4" />
                  Add Custom API
                </Button>
              </div>
            </div>
            <div className="hidden min-h-52 items-center justify-center lg:flex">
              <div className="relative h-56 w-full">
                <div className="absolute inset-x-0 top-1/2 h-px bg-zinc-200" />
                <div className="absolute left-8 right-8 top-16 h-px rotate-[-22deg] bg-zinc-200" />
                <div className="absolute left-10 right-10 bottom-16 h-px rotate-[22deg] bg-zinc-200" />
                {[12, 34, 66, 86].map((left, index) => (
                  <span key={left} className="absolute top-[48%] h-2 w-2 rounded-full bg-zinc-300" style={{ left: `${left}%`, transform: `translateY(${index % 2 ? -22 : 18}px)` }} />
                ))}
                <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-100 shadow-2xl shadow-zinc-300/70">
                  <div className="absolute inset-5 flex items-center justify-center">
                    <LineChartIcon className="h-14 w-14 text-zinc-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-zinc-950">Simulate an Incident</h2>
            <span className="text-sm text-zinc-500">{simulationState?.running ? simulationState.paused ? "Paused" : "Running" : "Stopped"}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {scenarios.map((scenario) => {
              const Icon = scenario.icon;
              return (
                <button
                  key={scenario.id}
                  className="group flex min-h-20 items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
                  onClick={() => runScenario(scenario)}
                  disabled={Boolean(loadingAction)}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-50 text-zinc-950 ring-1 ring-zinc-100">
                    {loadingAction === scenario.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                  </span>
                  <span>
                    <span className="block font-semibold text-zinc-950">{scenario.title}</span>
                    <span className="mt-1 block text-sm text-zinc-500">{scenario.description}</span>
                  </span>
                </button>
              );
            })}
            <button
              className="group flex min-h-20 items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
              onClick={() => setCustomScenarioOpen(true)}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-50 text-zinc-950 ring-1 ring-zinc-100">
                <CirclePlus className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold text-zinc-950">Custom Scenario</span>
                <span className="mt-1 block text-sm text-zinc-500">Create your own scenario</span>
              </span>
            </button>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[390px_1fr_560px]">
          <div className="space-y-4">
            <CardShell title="Active Incident" action={activeIncident ? <Badge severity={activeIncident.severity}>{activeIncident.severity}</Badge> : null}>
              {activeIncident ? (
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                      <AlertTriangle className="h-8 w-8" />
                    </span>
                    <div>
                      <h3 className="text-xl font-semibold text-zinc-950">{friendlyIncidentTitle(activeIncident.title)}</h3>
                      <p className="mt-1 text-sm text-zinc-500">Detected {timeLabel(activeIncident.first_seen)}</p>
                    </div>
                  </div>
                  <KeyValue label="Affected API" value={activeIncident.affected_apis.join(", ")} />
                  <KeyValue label="Last Seen" value={timeLabel(activeIncident.last_seen)} />
                  <KeyValue label="Confidence" value={`${confidence(activeIncident)}%`} />
                  <Button variant="secondary" className="w-full justify-between">
                    View Incident Details <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <EmptyState icon={ShieldCheck} title="No active incident" description="Start Demo APIs or run a simulation." />
              )}
            </CardShell>

            <CardShell title="API Health Overview">
              <div className="space-y-3">
                {apis.slice(0, 6).map((apiService) => {
                  const status = statusForApi(apiService);
                  return (
                    <div key={apiService.id} className="flex items-center justify-between gap-3 rounded-xl p-2 transition hover:bg-zinc-50">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-50 text-zinc-700 ring-1 ring-zinc-100">
                          <Bell className="h-4 w-4" />
                        </span>
                        <span className="truncate text-sm font-medium text-zinc-950">{apiService.name}</span>
                      </div>
                      <span className={cn("flex shrink-0 items-center gap-2 text-sm font-medium", status.text)}>
                        {status.label}
                        <span className={cn("h-2 w-2 rounded-full", status.dot)} />
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardShell>
          </div>

          <CardShell
            title="AI Investigation Console"
            action={<span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Live Analysis</span>}
            className="min-h-[560px]"
          >
            <div className="space-y-6">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-zinc-900 ring-1 ring-zinc-200">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-950">
                      {activeIncident ? `${activeIncident.affected_apis[0]} is under investigation.` : "AI investigation is ready."}
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-700">{rootCause}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-zinc-950">Root Cause</h4>
                  <p className="text-sm leading-7 text-zinc-700">{rootCause}</p>
                </div>
                <div className="rounded-xl border-l border-zinc-200 pl-0 lg:pl-6">
                  <h4 className="mb-3 text-sm font-semibold text-zinc-950">Impact</h4>
                  <div className="space-y-3">
                    {impactItems(activeIncident, activeLog).map((item) => (
                      <div key={item} className="flex items-center gap-3 text-sm text-zinc-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 border-t border-zinc-200 pt-6 lg:grid-cols-[1fr_300px]">
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-zinc-800" />
                    <h4 className="text-sm font-semibold text-zinc-950">Suggested Fixes</h4>
                  </div>
                  <div className="grid gap-3">
                    {recommendations.slice(0, 4).map((item) => (
                      <div key={item} className="flex items-center gap-3 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-800 ring-1 ring-zinc-100">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        {simplifyText(item)}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="mb-4 text-sm font-semibold text-zinc-950">Investigation Timeline</h4>
                  <div className="space-y-0">
                    {investigationTimeline.map(([label, timestamp], index) => (
                      <div key={label} className="relative flex gap-3 pb-5 last:pb-0">
                        {index !== investigationTimeline.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-zinc-200" />}
                        <span className={cn("relative mt-1 h-4 w-4 rounded-full border-2 border-white", index < 4 ? "bg-emerald-600" : "bg-white ring-2 ring-emerald-600")} />
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
            <CardShell title="Response Time (ms)" action={<span className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600">Last 5 min</span>}>
              <div ref={chartContainerRef} className="h-72 min-h-72 min-w-0 w-full overflow-hidden">
                {mounted && chartWidth > 0 ? (
                  <AreaChart data={chartData} width={chartWidth} height={288}>
                    <defs>
                      <linearGradient id="latency-red" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.04} />
                      </linearGradient>
                      <linearGradient id="latency-green" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="time" stroke="#71717a" tickLine={false} axisLine={false} />
                    <YAxis stroke="#71717a" tickLine={false} axisLine={false} width={42} />
                    <Tooltip contentStyle={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12 }} />
                    <Area dataKey="latency" type="monotone" stroke="#10b981" fill="url(#latency-green)" strokeWidth={2} />
                    <Area dataKey="errors" type="monotone" stroke="#ef4444" fill="url(#latency-red)" strokeWidth={2} />
                  </AreaChart>
                ) : (
                  <div className="h-full rounded-xl bg-zinc-50" />
                )}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Metric label="Avg. Response Time" value={`${formatNumber((summary?.average_latency ?? 0) / 1000)} s`} tone="red" />
                <Metric label="Error Rate" value={`${formatNumber(summary?.error_rate ?? 0)}%`} tone="red" />
                <Metric label="Throughput" value={`${formatNumber(summary?.requests_per_minute ?? 0)} req/s`} tone="green" />
              </div>
            </CardShell>

            <CardShell title="Live Activity Feed" action={<Button variant="secondary" size="sm">View All</Button>}>
              <div className="space-y-3">
                {activities.slice(0, 8).map((item) => (
                  <div key={item.id} className="grid grid-cols-[72px_12px_1fr] items-center gap-3 text-sm">
                    <span className="font-mono text-xs text-zinc-500">{timeLabel(item.timestamp)}</span>
                    <span className={cn("h-2.5 w-2.5 rounded-full", item.level === "error" ? "bg-red-500" : item.level === "warning" ? "bg-orange-500" : item.level === "success" ? "bg-emerald-600" : "bg-zinc-400")} />
                    <span className="text-zinc-700">{item.message}</span>
                  </div>
                ))}
                {!activities.length && <EmptyState icon={ShieldCheck} title="No activity yet" description="Start the demo APIs to stream live events." />}
              </div>
            </CardShell>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_480px]">
          <CardShell title="API Health Overview Table" action={<Button variant="secondary" size="sm" onClick={openAddApi}><CirclePlus className="h-4 w-4" /> Add API</Button>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                    <th className="py-3 pr-4 font-semibold">API name</th>
                    <th className="py-3 pr-4 font-semibold">Status</th>
                    <th className="py-3 pr-4 font-semibold">Uptime</th>
                    <th className="py-3 pr-4 font-semibold">Latency</th>
                    <th className="py-3 pr-4 font-semibold">Requests/min</th>
                    <th className="py-3 pr-4 font-semibold">Last incident</th>
                    <th className="py-3 pr-4 font-semibold">Environment</th>
                    <th className="py-3 pr-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredApis.map((apiService) => {
                    const status = statusForApi(apiService);
                    const lastIncident = visibleIncidents.find((incident) => incident.affected_apis.includes(apiService.name));
                    const latestLog = latestLogForApi(visibleLogs, apiService.name);
                    return (
                      <tr key={apiService.id} className="align-middle">
                        <td className="py-4 pr-4">
                          <div>
                            <p className="font-semibold text-zinc-950">{apiService.name}</p>
                            <p className="mt-1 max-w-xs truncate text-xs text-zinc-500">{apiService.endpoint_url}</p>
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <span className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold", status.badge)}>
                            <span className={cn("h-2 w-2 rounded-full", status.dot)} />
                            {status.label}
                          </span>
                        </td>
                        <td className="py-4 pr-4 text-zinc-700">{formatNumber(apiService.uptime)}%</td>
                        <td className="py-4 pr-4 text-zinc-700">{formatNumber(latestLog?.latency_ms ?? apiService.expected_latency_ms)} ms</td>
                        <td className="py-4 pr-4 text-zinc-700">{formatNumber(apiService.requests_per_minute)}</td>
                        <td className="py-4 pr-4 text-zinc-700">{lastIncident ? friendlyIncidentTitle(lastIncident.title) : "None"}</td>
                        <td className="py-4 pr-4 capitalize text-zinc-700">{apiService.environment}</td>
                        <td className="py-4 pr-4">
                          <div className="flex gap-2">
                            <button className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950" onClick={() => openEditApi(apiService)}><Edit3 className="h-4 w-4" /></button>
                            <button className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950" onClick={() => toggleMonitoring(apiService)}>{apiService.monitoring_enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
                            <button className="rounded-md p-2 text-red-500 hover:bg-red-50" onClick={() => deleteApi(apiService)}><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardShell>

          <CardShell title="Incident History">
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <label className="relative sm:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input className="pl-9" placeholder="Global search in nav" disabled />
              </label>
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
            <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
              {filteredIncidents.map((incident) => (
                <div key={incident.id} className="rounded-xl border border-zinc-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge severity={incident.severity}>{incident.severity}</Badge>
                      <h3 className="mt-3 font-semibold text-zinc-950">{friendlyIncidentTitle(incident.title)}</h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">{simplifyText(incident.summary)}</p>
                    </div>
                    <span className="shrink-0 text-xs text-zinc-500">{timeLabel(incident.last_seen)}</span>
                  </div>
                </div>
              ))}
              {!filteredIncidents.length && <EmptyState icon={ShieldCheck} title="No incidents found" description="Try a different filter or run a simulation." />}
            </div>
          </CardShell>
        </section>
      </div>

      <AnimatePresence>
        {apiModalOpen && (
          <Modal title={editingApi ? "Edit API" : "Add Custom API"} onClose={() => setApiModalOpen(false)}>
            <form className="grid gap-4" onSubmit={submitApi}>
              <FormField label="API name"><Input required value={apiForm.name} onChange={(event) => setApiForm({ ...apiForm, name: event.target.value })} placeholder="Payments API" /></FormField>
              <FormField label="Endpoint URL"><Input required value={apiForm.endpoint_url} onChange={(event) => setApiForm({ ...apiForm, endpoint_url: event.target.value })} placeholder="https://api.company.com/v1/payments" /></FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Expected latency"><Input type="number" value={apiForm.expected_latency_ms} onChange={(event) => setApiForm({ ...apiForm, expected_latency_ms: Number(event.target.value) })} /></FormField>
                <FormField label="Timeout threshold"><Input type="number" value={apiForm.timeout_threshold_ms} onChange={(event) => setApiForm({ ...apiForm, timeout_threshold_ms: Number(event.target.value) })} /></FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Category"><Input value={apiForm.category} onChange={(event) => setApiForm({ ...apiForm, category: event.target.value })} /></FormField>
                <FormField label="Environment">
                  <select className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm" value={apiForm.environment} onChange={(event) => setApiForm({ ...apiForm, environment: event.target.value })}>
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </FormField>
                <FormField label="Check interval"><Input type="number" value={apiForm.health_check_interval_seconds} onChange={(event) => setApiForm({ ...apiForm, health_check_interval_seconds: Number(event.target.value) })} /></FormField>
              </div>
              <label className="flex items-center gap-3 text-sm font-medium text-zinc-700">
                <input type="checkbox" checked={apiForm.monitoring_enabled} onChange={(event) => setApiForm({ ...apiForm, monitoring_enabled: event.target.checked })} />
                Enable monitoring
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setApiModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={loadingAction === "save-api"}>{loadingAction === "save-api" && <Loader2 className="h-4 w-4 animate-spin" />} Save API</Button>
              </div>
            </form>
          </Modal>
        )}

        {customScenarioOpen && (
          <Modal title="Custom Scenario" onClose={() => setCustomScenarioOpen(false)}>
            <form className="grid gap-4" onSubmit={submitCustomScenario}>
              <FormField label="Scenario type">
                <select className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm" value={customScenario.scenario} onChange={(event) => setCustomScenario({ ...customScenario, scenario: event.target.value })}>
                  {scenarioOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </FormField>
              <FormField label="Target API">
                <select className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm" value={customScenario.apiName} onChange={(event) => setCustomScenario({ ...customScenario, apiName: event.target.value })}>
                  <option value="">Auto-select</option>
                  {apis.map((apiService) => <option key={apiService.id} value={apiService.name}>{apiService.name}</option>)}
                </select>
              </FormField>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setCustomScenarioOpen(false)}>Cancel</Button>
                <Button type="submit">Run Simulation</Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function CardShell({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm", className)}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
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
      <span className="font-semibold text-zinc-950">{value}</span>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "red" | "green" }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-100">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={cn("mt-2 text-xl font-semibold", tone === "red" ? "text-red-600" : "text-emerald-700")}>{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: ElementType; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-200 p-5 text-center">
      <Icon className="mx-auto h-7 w-7 text-zinc-400" />
      <p className="mt-3 font-semibold text-zinc-950">{title}</p>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/25 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl shadow-zinc-900/15"
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 12 }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
