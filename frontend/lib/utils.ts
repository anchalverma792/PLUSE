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
    critical: "border-red-200 bg-red-50 text-red-700 shadow-red-100",
    high: "border-orange-200 bg-orange-50 text-orange-700 shadow-orange-100",
    warning: "border-amber-200 bg-amber-50 text-amber-700 shadow-amber-100",
    info: "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-emerald-100",
  }[severity] ?? "border-zinc-200 bg-zinc-50 text-zinc-700";
}
