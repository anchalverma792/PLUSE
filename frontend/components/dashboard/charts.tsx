"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartPoint, LogEntry } from "@/lib/types";

export function TrafficCharts({ data, logs }: { data: ChartPoint[]; logs: LogEntry[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const liveData = logs.slice(0, 25).reverse().map((log, index) => ({
    time: new Date(log.timestamp).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
    latency: log.latency_ms,
    errors: log.status_code >= 500 || log.status_code === 408 || log.status_code === 0 ? 1 : 0,
    requests: index + 1,
  }));
  const traffic = liveData.length > 4 ? liveData : data;
  const chartFallback = <div className="h-full min-h-0 rounded-md bg-white/[0.04]" />;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Live Traffic</CardTitle>
        </CardHeader>
        <CardContent className="h-72 min-w-0">
          {!mounted ? chartFallback : <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={traffic}>
              <defs>
                <linearGradient id="latency" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#67e8f9" stopOpacity={0.55} />
                  <stop offset="95%" stopColor="#67e8f9" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
              <XAxis dataKey="time" stroke="#71717a" tickLine={false} axisLine={false} />
              <YAxis stroke="#71717a" tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#09090b", border: "1px solid rgba(255,255,255,.12)" }} />
              <Area type="monotone" dataKey="latency" stroke="#67e8f9" fill="url(#latency)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Error Trend</CardTitle>
        </CardHeader>
        <CardContent className="h-72 min-w-0">
          {!mounted ? chartFallback : <ResponsiveContainer width="100%" height="100%">
            <LineChart data={traffic}>
              <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
              <XAxis dataKey="time" stroke="#71717a" tickLine={false} axisLine={false} />
              <YAxis stroke="#71717a" tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#09090b", border: "1px solid rgba(255,255,255,.12)" }} />
              <Line type="monotone" dataKey="errors" stroke="#fb7185" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="requests" stroke="#a7f3d0" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>}
        </CardContent>
      </Card>
    </div>
  );
}
