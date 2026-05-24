"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Play, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { SyntheticTest } from "@/lib/types";
import { useLiveStream } from "@/hooks/use-live-stream";

export default function TestingPage() {
  const stream = useLiveStream();
  const [tests, setTests] = useState<SyntheticTest[]>([]);

  useEffect(() => {
    api.testingResults().then(setTests).catch(() => undefined);
  }, []);

  const visible = stream.tests.length ? stream.tests : tests;
  const passed = visible.filter((test) => test.status === "passed").length;

  const run = async () => {
    const result = await api.runTests();
    setTests(result);
    toast.success("QA cycle executed", { description: `${result.length} synthetic checks completed` });
  };

  return (
    <AppShell connected={stream.connected}>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-cyan-200">Continuous synthetic reliability checks</p>
          <h1 className="mt-1 text-3xl font-semibold text-white">Testing Agent</h1>
        </div>
        <Button onClick={run}>
          <Play className="h-4 w-4" />
          Run QA Cycle
        </Button>
      </div>
      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-5"><p className="text-sm text-zinc-500">Tests Executed</p><p className="mt-1 text-3xl font-semibold">{visible.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-sm text-zinc-500">Passed</p><p className="mt-1 text-3xl font-semibold text-emerald-200">{passed}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-sm text-zinc-500">Failed</p><p className="mt-1 text-3xl font-semibold text-rose-200">{visible.length - passed}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-sm text-zinc-500">WebSocket</p><p className="mt-1 text-3xl font-semibold text-cyan-200">{stream.connected ? "Live" : "Retry"}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>QA Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {visible.map((test) => (
            <div key={test.id} className="flex flex-col gap-3 rounded-md border border-white/8 bg-white/[0.04] p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {test.status === "passed" ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <XCircle className="h-4 w-4 text-rose-300" />}
                  <h3 className="font-semibold text-white">{test.name}</h3>
                  <Badge severity={test.status === "passed" ? "info" : "high"}>{test.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-zinc-400">{test.details}</p>
              </div>
              <span className="text-sm text-zinc-500">{test.latency_ms}ms</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
