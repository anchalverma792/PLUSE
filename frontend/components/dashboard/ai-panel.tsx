import { BrainCircuit } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Incident } from "@/lib/types";

export function AiPanel({ incident }: { incident?: Incident }) {
  return (
    <Card className="border-cyan-300/20 bg-cyan-300/[0.06]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-cyan-200" />
          AI Root Cause Analysis
        </CardTitle>
        {incident && <Badge severity={incident.severity}>{incident.severity}</Badge>}
      </CardHeader>
      <CardContent>
        {incident ? (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-zinc-200">{incident.root_cause || incident.summary}</p>
            <div className="space-y-2">
              {incident.recommendations.slice(0, 4).map((item) => (
                <div key={item} className="rounded-md border border-white/10 bg-black/20 p-3 text-xs text-zinc-300">
                  {item}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Trigger a scenario or wait for the simulator to generate an incident.</p>
        )}
      </CardContent>
    </Card>
  );
}
