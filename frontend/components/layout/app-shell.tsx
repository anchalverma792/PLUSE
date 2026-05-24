"use client";

import type { ReactNode } from "react";
import { Activity, Bell, ChevronDown, Command, Search } from "lucide-react";
import { Toaster } from "sonner";

import { useAppState, type Environment } from "@/context/app-state";
import { cn } from "@/lib/utils";

const nav = ["Incidents", "Live Monitor", "AI Analysis", "Testing Playground", "Reports", "Integrations"];
const environments: Array<{ value: Environment; label: string }> = [
  { value: "production", label: "Production" },
  { value: "staging", label: "Staging" },
  { value: "development", label: "Development" },
];

export function AppShell({ children, connected = false }: { children: ReactNode; connected?: boolean }) {
  const { environment, setEnvironment, search, setSearch } = useAppState();

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-xl">
        <div className="flex h-18 items-center gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-[210px] items-center gap-3 border-r border-zinc-200 pr-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 text-white shadow-sm">
              <Activity className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold tracking-tight">PulseRoot AI</p>
              <p className="truncate text-xs text-zinc-500">AI Reliability Engineer</p>
            </div>
          </div>

          <nav className="hidden items-center gap-7 text-sm font-medium text-zinc-600 xl:flex">
            {nav.map((item, index) => (
              <button
                key={item}
                className={cn(
                  "relative h-18 whitespace-nowrap transition hover:text-zinc-950",
                  index === 0 && "text-zinc-950",
                )}
              >
                {item}
                {index === 0 && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-zinc-950" />}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <label className="hidden items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 shadow-sm lg:flex">
              <Search className="h-4 w-4" />
              <input
                className="w-56 border-0 bg-transparent text-sm outline-none placeholder:text-zinc-400"
                placeholder="Search incidents, APIs..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
                <Command className="h-3 w-3" />K
              </span>
            </label>

            <label className="hidden items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm md:flex">
              <span className={cn("h-2 w-2 rounded-full", connected ? "bg-emerald-500" : "bg-orange-500")} />
              {connected ? "Live" : "Reconnecting"}
            </label>

            <select
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm outline-none"
              value={environment}
              onChange={(event) => setEnvironment(event.target.value as Environment)}
            >
              {environments.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
            </button>

            <button className="hidden h-10 items-center gap-2 rounded-full bg-zinc-100 pl-3 pr-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 sm:flex">
              RK
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            </button>
          </div>
        </div>

        <div className="flex gap-5 overflow-x-auto border-t border-zinc-100 px-4 py-3 text-sm font-medium text-zinc-600 sm:px-6 xl:hidden">
          {nav.map((item, index) => (
            <button key={item} className={cn("whitespace-nowrap", index === 0 && "text-zinc-950")}>
              {item}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[1840px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      <Toaster richColors position="top-right" theme="light" />
    </div>
  );
}
