"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Cpu, Database, MemoryStick, Timer } from "lucide-react";

import { TrafficCharts } from "@/components/dashboard/charts";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { ChartPoint, Incident } from "@/lib/types";
import { useLiveStream } from "@/hooks/use-live-stream";

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const stream = useLiveStream();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);

  useEffect(() => {
    Promise.all([api.incident(params.id), api.chart()]).then(([incidentData, chartData]) => {
      setIncident(incidentData);
      setChart(chartData);
    });
  }, [params.id]);

  const liveIncident = stream.incidents.find((item) => String(item.id) === params.id) ?? incident;

  return (
    <AppShell connected={stream.connected}>
      {liveIncident && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge severity={liveIncident.severity}>{liveIncident.severity}</Badge>
                <Badge>{liveIncident.status}</Badge>
              </div>
              <h1 className="mt-3 text-3xl font-semibold text-white">{liveIncident.title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{liveIncident.summary}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.06] p-4 text-right">
              <div className="text-3xl font-semibold text-white">{liveIncident.anomaly_score}</div>
              <div className="text-xs text-zinc-500">Severity score</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {[
              ["Latency", `${liveIncident.metrics.latency_ms ?? 0}ms`, Timer],
              ["Status", String(liveIncident.metrics.status_code ?? "n/a"), AlertTriangle],
              ["CPU", `${liveIncident.metrics.cpu ?? 0}%`, Cpu],
              ["Memory", `${liveIncident.metrics.memory ?? 0}%`, MemoryStick],
            ].map(([label, value, Icon]) => (
              <Card key={label as string}>
                <CardContent className="flex items-center justify-between pt-5">
                  <div>
                    <p className="text-xs text-zinc-500">{label as string}</p>
                    <p className="mt-1 text-xl font-semibold text-white">{value as string}</p>
                  </div>
                  <Icon className="h-5 w-5 text-cyan-200" />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_390px]">
            <div className="space-y-4">
              <TrafficCharts data={chart} logs={stream.logs} />
              <Card>
                <CardHeader>
                  <CardTitle>Incident Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {liveIncident.timeline.map((event, index) => (
                    <div key={`${event.trace_id}-${index}`} className="rounded-md border border-white/8 bg-black/25 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <Database className="h-4 w-4 text-cyan-200" />
                        <span>{String(event.timestamp)}</span>
                        <span>{String(event.status_code)}</span>
                        <span>{String(event.latency_ms)}ms</span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-300">{String(event.message)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            <Card className="border-cyan-300/20">
              <CardHeader>
                <CardTitle>Groq Root Cause</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-zinc-300">{liveIncident.root_cause || liveIncident.summary}</p>
                <div className="space-y-2">
                  {liveIncident.recommendations.map((item) => (
                    <div key={item} className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm text-zinc-300">
                      {item}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
