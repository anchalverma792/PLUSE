"use client";

import { useState } from "react";
import { Activity, CloudOff, DatabaseZap, Flame, MemoryStick, Rocket, Waves } from "lucide-react";
import { toast } from "sonner";

import { IncidentFeed } from "@/components/dashboard/incident-feed";
import { LiveLog } from "@/components/dashboard/live-log";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useLiveStream } from "@/hooks/use-live-stream";

const scenarios = [
  { id: "deployment_failure", label: "Deployment Failure", icon: Rocket, variant: "danger" as const },
  { id: "database_crash", label: "Database Crash", icon: DatabaseZap, variant: "danger" as const },
  { id: "traffic_spike", label: "Traffic Spike", icon: Waves, variant: "default" as const },
  { id: "timeout_storm", label: "Timeout Storm", icon: Flame, variant: "danger" as const },
  { id: "api_downtime", label: "API Downtime", icon: CloudOff, variant: "danger" as const },
  { id: "memory_leak", label: "Memory Leak", icon: MemoryStick, variant: "secondary" as const },
];

export default function PlaygroundPage() {
  const stream = useLiveStream();
  const [loading, setLoading] = useState("");

  const trigger = async (scenario: string) => {
    setLoading(scenario);
    await api.trigger(scenario);
    toast.success("Scenario injected", { description: scenario.replaceAll("_", " ") });
    setLoading("");
  };

  return (
    <AppShell connected={stream.connected}>
      <div className="mb-5">
        <p className="text-sm text-cyan-200">Demo-ready failure simulation</p>
        <h1 className="mt-1 text-3xl font-semibold text-white">Incident Playground</h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_390px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-200" />
                Failure Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {scenarios.map((scenario) => {
                const Icon = scenario.icon;
                return (
                  <Button
                    key={scenario.id}
                    variant={scenario.variant}
                    className="h-20 justify-start"
                    disabled={loading === scenario.id}
                    onClick={() => trigger(scenario.id)}
                  >
                    <Icon className="h-5 w-5" />
                    {loading === scenario.id ? "Injecting..." : scenario.label}
                  </Button>
                );
              })}
            </CardContent>
          </Card>
          <LiveLog logs={stream.logs} />
        </div>
        <IncidentFeed incidents={stream.incidents} />
      </div>
    </AppShell>
  );
}
