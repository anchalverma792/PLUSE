"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Filter, Search } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Incident } from "@/lib/types";
import { useLiveStream } from "@/hooks/use-live-stream";

export default function IncidentsPage() {
  const stream = useLiveStream();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");

  useEffect(() => {
    api.incidents().then(setIncidents).catch(() => undefined);
  }, []);

  const merged = stream.incidents.length ? stream.incidents : incidents;
  const filtered = useMemo(
    () =>
      merged.filter((incident) => {
        const matchesSearch = !search || incident.title.toLowerCase().includes(search.toLowerCase());
        const matchesSeverity = !severity || incident.severity === severity;
        return matchesSearch && matchesSeverity;
      }),
    [merged, search, severity],
  );

  return (
    <AppShell connected={stream.connected}>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-cyan-200">Grouped recurring failures</p>
          <h1 className="mt-1 text-3xl font-semibold text-white">Incidents</h1>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input className="w-64 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search incidents" />
          </div>
          <Button variant={severity ? "default" : "secondary"} onClick={() => setSeverity(severity ? "" : "critical")}>
            <Filter className="h-4 w-4" />
            {severity || "Severity"}
          </Button>
        </div>
      </div>
      <div className="grid gap-4">
        {filtered.map((incident) => (
          <Link key={incident.id} href={`/incidents/${incident.id}`}>
            <Card className="transition hover:border-cyan-300/30 hover:bg-white/[0.08]">
              <CardHeader>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge severity={incident.severity}>{incident.severity}</Badge>
                    <Badge>{incident.status}</Badge>
                    <span className="text-xs text-zinc-500">Frequency {incident.frequency}</span>
                  </div>
                  <CardTitle className="mt-3 text-lg">{incident.title}</CardTitle>
                </div>
                <span className="text-sm text-zinc-500">Score {incident.anomaly_score}</span>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-300">{incident.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {incident.affected_apis.map((apiName) => (
                    <span key={apiName} className="rounded-md bg-white/8 px-2 py-1 text-xs text-cyan-100">
                      {apiName}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
