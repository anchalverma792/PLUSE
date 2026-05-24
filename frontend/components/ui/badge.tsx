import * as React from "react";

import { cn, severityClass } from "@/lib/utils";

export function Badge({ className, severity, ...props }: React.HTMLAttributes<HTMLSpanElement> & { severity?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold uppercase tracking-normal shadow-lg",
        severity ? severityClass(severity) : "border-zinc-200 bg-zinc-50 text-zinc-700",
        className,
      )}
      {...props}
    />
  );
}
