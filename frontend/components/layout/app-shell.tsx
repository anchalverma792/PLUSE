"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bot, FlaskConical, Gauge, LayoutDashboard, Radio, Search, ShieldAlert } from "lucide-react";
import { Toaster } from "sonner";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/incidents", label: "Incidents", icon: ShieldAlert },
  { href: "/playground", label: "Playground", icon: FlaskConical },
  { href: "/testing", label: "QA Engine", icon: Gauge },
  { href: "/assistant", label: "AI Assistant", icon: Bot },
];

export function AppShell({ children, connected = false }: { children: React.ReactNode; connected?: boolean }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/10 bg-black/30 p-4 backdrop-blur-2xl lg:block">
        <Link href="/" className="flex items-center gap-3 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-300 text-zinc-950">
            <Activity className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-white">PulseRoot AI</span>
            <span className="text-xs text-cyan-100/70">Groq Reliability Agent</span>
          </span>
        </Link>
        <nav className="mt-6 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-white",
                  active && "bg-white/12 text-white shadow-lg shadow-cyan-500/10",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/50 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <div className="relative max-w-lg flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input className="pl-9" placeholder="Search traces, incidents, APIs..." />
            </div>
            <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300">
              <Radio className={cn("h-4 w-4", connected ? "text-emerald-300" : "text-rose-300")} />
              {connected ? "Live" : "Reconnecting"}
            </div>
          </div>
        </header>
        <div className="px-4 py-5 sm:px-6">{children}</div>
      </main>
      <Toaster richColors position="top-right" theme="dark" />
    </div>
  );
}
