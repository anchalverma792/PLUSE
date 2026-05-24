"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Gauge, Server, Timer, Zap } from "lucide-react";

import { AiPanel } from "@/components/dashboard/ai-panel";
import { TrafficCharts } from "@/components/dashboard/charts";
import { IncidentFeed } from "@/components/dashboard/incident-feed";
import { LiveLog } from "@/components/dashboard/live-log";
import { StatCard } from "@/components/dashboard/stat-card";
import { AppShell } from "@/components/layout/app-shell";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import type { ChartPoint, Incident, LogEntry, Summary } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { useLiveStream } from "@/hooks/use-live-stream";

export default function Home() {
  const stream = useLiveStream();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [initialLogs, setInitialLogs] = useState<LogEntry[]>([]);
  const [initialIncidents, setInitialIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    const load = async () => {
      const [summaryData, chartData, logsData, incidentsData] = await Promise.all([
        api.summary(),
        api.chart(),
        api.logs(),
        api.incidents(),
      ]);
      setSummary(summaryData);
      setChart(chartData);
      setInitialLogs(logsData);
      setInitialIncidents(incidentsData);
    };
    load();
    const timer = setInterval(() => api.summary().then(setSummary).catch(() => undefined), 4000);
    return () => clearInterval(timer);
  }, []);

  const logs = stream.logs.length ? stream.logs : initialLogs;
  const incidents = stream.incidents.length ? stream.incidents : initialIncidents;
  const latestIncident = incidents[0];

  return (
    <AppShell connected={stream.connected}>
      <section className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-cyan-200">AI Reliability Engineer</p>
          <h1 className="mt-1 text-3xl font-semibold text-white">PulseRoot AI Command Center</h1>
        </div>
        <div className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100">
          Groq only: llama-3.3-70b-versatile
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title="APIs Monitored" value={String(summary?.total_apis ?? 5)} detail="Production mocks online" icon={Server} />
        <StatCard title="Active Incidents" value={String(summary?.active_incidents ?? incidents.length)} detail="Grouped anomalies" icon={AlertTriangle} />
        <StatCard title="Error Rate" value={formatNumber(summary?.error_rate ?? 0, "%")} detail="Last 10 minutes" icon={Zap} />
        <StatCard title="Avg Latency" value={formatNumber(summary?.average_latency ?? 0, "ms")} detail="Rolling live sample" icon={Timer} />
        <StatCard title="Uptime" value={formatNumber(summary?.uptime ?? 100, "%")} detail="Synthetic probes" icon={Activity} />
        <StatCard title="Health Score" value={formatNumber(summary?.health_score ?? 100)} detail="Weighted SLO score" icon={Gauge} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <TrafficCharts data={chart} logs={logs} />
          <LiveLog logs={logs} />
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">API Health Score</span>
              <span className="text-sm text-cyan-100">{formatNumber(summary?.health_score ?? 100)}</span>
            </div>
            <Progress className="mt-3" value={summary?.health_score ?? 100} />
          </div>
          <AiPanel incident={latestIncident} />
          <IncidentFeed incidents={incidents} />
        </div>
      </div>
    </AppShell>
  );
}
