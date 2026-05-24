import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StatCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="group overflow-hidden transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:shadow-cyan-500/10">
      <CardHeader>
        <CardTitle className="text-zinc-400">{title}</CardTitle>
        <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100">
          <Icon className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold text-white">{value}</div>
        <p className="mt-2 text-xs text-zinc-500">{detail}</p>
      </CardContent>
    </Card>
  );
}
