"use client";

import type { ReactNode } from "react";
import { Activity, Bell, Command, Search } from "lucide-react";
import { Toaster, toast } from "sonner";

import { useAppState, type Environment } from "@/context/app-state";
import { cn } from "@/lib/utils";

const nav = [
  { label: "APIs", href: "#apis" },
  { label: "Incidents", href: "#incidents" },
  { label: "AI Analysis", href: "#ai-analysis" },
  { label: "Reports", href: "#reports" },
  { label: "Integrations", href: "#integrations" },
];

const environments: Array<{ value: Environment; label: string }> = [
  { value: "production", label: "Production" },
  { value: "staging", label: "Staging" },
  { value: "development", label: "Development" },
];

export function AppShell({ children, connected = false }: { children: ReactNode; connected?: boolean }) {
  const { environment, setEnvironment, search, setSearch } = useAppState();

  const showNotificationState = () => {
    toast(connected ? "Realtime alerts are active" : "Alert stream is reconnecting", {
      description: connected ? "New incidents and API signals will appear live." : "APY will resume alerts automatically.",
    });
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur-xl">
        <div className="flex min-h-16 items-center gap-4 px-4 sm:px-6 lg:px-8">
          <a href="#overview" className="flex min-w-0 items-center gap-3 pr-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-950 text-white shadow-sm">
              <Activity className="h-4 w-4" />
            </span>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-semibold tracking-tight">APY</p>
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Observability</p>
            </div>
          </a>

          <nav className="hidden items-center gap-1 text-sm font-medium text-zinc-600 xl:flex">
            {nav.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="rounded-md px-3 py-2 transition hover:bg-zinc-100 hover:text-zinc-950"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <label className="hidden min-w-0 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 shadow-sm lg:flex">
              <Search className="h-4 w-4 shrink-0" />
              <input
                className="w-52 border-0 bg-transparent text-sm outline-none placeholder:text-zinc-400 xl:w-64"
                placeholder="Search APIs, incidents..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500">
                <Command className="h-3 w-3" />K
              </span>
            </label>

            <span className="hidden items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm md:flex">
              <span className={cn("h-2 w-2 rounded-full", connected ? "bg-emerald-500" : "bg-red-500")} />
              {connected ? "Live" : "Reconnecting"}
            </span>

            <select
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm outline-none transition hover:border-zinc-300 focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100"
              value={environment}
              onChange={(event) => setEnvironment(event.target.value as Environment)}
            >
              {environments.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
              onClick={showNotificationState}
              aria-label="Notification status"
              title="Notification status"
            >
              <Bell className="h-4 w-4" />
              <span className={cn("absolute right-2 top-2 h-2 w-2 rounded-full", connected ? "bg-emerald-500" : "bg-red-500")} />
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto border-t border-zinc-100 px-4 py-2 text-sm font-medium text-zinc-600 sm:px-6 xl:hidden">
          {nav.map((item) => (
            <a key={item.label} href={item.href} className="whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-zinc-100 hover:text-zinc-950">
              {item.label}
            </a>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[1720px] px-4 py-4 sm:px-6 lg:px-8">{children}</main>
      <Toaster richColors position="top-right" theme="light" />
    </div>
  );
}
