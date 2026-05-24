import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Incident } from "@/lib/types";

export function IncidentFeed({ incidents }: { incidents: Incident[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Incident Feed</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {incidents.map((incident) => (
          <Link
            key={incident.id}
            href={`/incidents/${incident.id}`}
            className="block rounded-md border border-white/8 bg-white/[0.04] p-3 transition hover:border-cyan-300/30 hover:bg-white/[0.08]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge severity={incident.severity}>{incident.severity}</Badge>
                  <span className="text-xs text-zinc-500">x{incident.frequency}</span>
                </div>
                <h4 className="mt-2 text-sm font-semibold text-white">{incident.title}</h4>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{incident.summary}</p>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-500" />
            </div>
          </Link>
        ))}
        {!incidents.length && <p className="text-sm text-zinc-500">Incidents will appear as anomalies are detected.</p>}
      </CardContent>
    </Card>
  );
}
