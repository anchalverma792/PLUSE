import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number, suffix = "") {
  return `${Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}

export function severityClass(severity: string) {
  return {
    critical: "border-rose-400/50 bg-rose-500/15 text-rose-100 shadow-rose-500/20",
    high: "border-orange-400/50 bg-orange-500/15 text-orange-100 shadow-orange-500/20",
    warning: "border-amber-400/50 bg-amber-500/15 text-amber-100 shadow-amber-500/20",
    info: "border-cyan-400/50 bg-cyan-500/15 text-cyan-100 shadow-cyan-500/20",
  }[severity] ?? "border-zinc-600 bg-zinc-900 text-zinc-200";
}
