import { Terminal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LogEntry } from "@/lib/types";

export function LiveLog({ logs }: { logs: LogEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-cyan-200" />
          Realtime Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[430px] space-y-2 overflow-auto pr-1 font-mono text-xs">
          {logs.map((log) => (
            <div key={`${log.id}-${log.trace_id}`} className="rounded-md border border-white/8 bg-black/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge severity={log.level === "error" ? "high" : "info"}>{log.status_code || "DOWN"}</Badge>
                <span className="text-cyan-100">{log.api_name}</span>
                <span className="text-zinc-500">{log.latency_ms.toFixed(0)}ms</span>
                <span className="text-zinc-600">{log.trace_id}</span>
              </div>
              <p className="mt-2 text-zinc-300">{log.message}</p>
            </div>
          ))}
          {!logs.length && <p className="text-zinc-500">Waiting for backend stream...</p>}
        </div>
      </CardContent>
    </Card>
  );
}
