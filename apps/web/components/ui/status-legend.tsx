import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Dot-and-count key for board views (room status, task state, request queues).
 *
 * The dot carries the colour and the label carries the meaning, so the board stays
 * readable without relying on colour alone.
 */
export function StatusLegend({
  items,
  className,
}: {
  items: { label: string; count?: number; dotClass: string }[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs text-sand-700">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", item.dotClass)} />
          <span className="font-medium">{item.label}</span>
          {item.count !== undefined && <span className="tabular-nums text-sand-500">{item.count}</span>}
        </span>
      ))}
    </div>
  );
}
