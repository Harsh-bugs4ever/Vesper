import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A price floor, a recommendation and a ceiling on one track.
 *
 * The marker's job is to show that the suggested rate sits inside a band someone set,
 * not at the top of one — a recommendation pinned to the ceiling is the shape of a
 * system optimising against the property rather than for it, and this makes that visible
 * at a glance.
 */
export function RangeMeter({
  floor,
  ceiling,
  value,
  floorLabel = "Price floor",
  ceilingLabel = "Price ceiling",
  valueLabel = "Recommended",
  format = (amount: number) => `₹${amount.toLocaleString("en-IN")}`,
  className,
}: {
  floor: number;
  ceiling: number;
  value: number;
  floorLabel?: string;
  ceilingLabel?: string;
  valueLabel?: string;
  format?: (amount: number) => string;
  className?: string;
}) {
  const span = ceiling - floor || 1;
  const pct = Math.max(0, Math.min(100, ((value - floor) / span) * 100));

  return (
    <div className={cn("w-full", className)}>
      <div className="relative h-2 rounded-full bg-gradient-to-r from-sage-200 via-sage-500 to-gold-300">
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sage-700 shadow-sm"
          style={{ left: `${pct}%` }}
          role="img"
          aria-label={`${valueLabel} ${format(value)}, between ${format(floor)} and ${format(ceiling)}`}
        />
      </div>

      <div className="mt-2 flex items-start justify-between gap-2 text-xs">
        <span className="text-left">
          <span className="block font-medium text-sand-800">{format(floor)}</span>
          <span className="block text-sand-500">{floorLabel}</span>
        </span>

        <span className="text-center">
          <span className="block font-semibold text-sage-800">{format(value)}</span>
          <span className="block text-sand-500">{valueLabel}</span>
        </span>

        <span className="text-right">
          <span className="block font-medium text-sand-800">{format(ceiling)}</span>
          <span className="block text-sand-500">{ceilingLabel}</span>
        </span>
      </div>
    </div>
  );
}
