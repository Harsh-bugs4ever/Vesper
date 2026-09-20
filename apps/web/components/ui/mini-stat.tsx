import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";

export type MiniStatTone = "sage" | "sand" | "gold" | "rose" | "slate";

const toneChip: Record<MiniStatTone, string> = {
  sage: "bg-sage-50 text-sage-700",
  sand: "bg-sand-100 text-sand-700",
  gold: "bg-gold-50 text-gold-700",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-sand-100 text-sand-500",
};

/**
 * A metric card small enough to sit several-across inside a panel — current temperature,
 * vibration, estimated time to failure.
 *
 * Distinct from `StatTile`, which is a page-level KPI with its own surface and sparkline.
 * This one is a detail of whatever panel encloses it, so it carries no border of its own
 * unless asked.
 */
export function MiniStat({
  label,
  value,
  detail,
  delta,
  deltaDirection,
  deltaIntent = "neutral",
  tone = "sage",
  icon: Icon,
  valueClassName,
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  delta?: string;
  deltaDirection?: "up" | "down";
  deltaIntent?: "good" | "bad" | "neutral";
  tone?: MiniStatTone;
  icon?: React.ComponentType<{ className?: string }>;
  /** Override for the headline, e.g. to colour a qualitative value like "High". */
  valueClassName?: string;
  className?: string;
}) {
  const Arrow = deltaDirection === "down" ? ArrowDown : ArrowUp;

  return (
    <div className={cn("rounded-xl border border-sand-200/80 bg-white p-4", className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              toneChip[tone]
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-xs text-sand-600">{label}</p>
          <p
            className={cn(
              "mt-0.5 font-serif text-2xl font-semibold leading-tight text-sand-950",
              valueClassName
            )}
          >
            {value}
          </p>

          {delta && (
            <span
              className={cn(
                "mt-1 flex items-center gap-1 text-xs font-semibold",
                deltaIntent === "good" && "text-emerald-700",
                deltaIntent === "bad" && "text-rose-600",
                deltaIntent === "neutral" && "text-sand-600"
              )}
            >
              <Arrow className="h-3 w-3" />
              {delta}
            </span>
          )}

          {detail && <p className="mt-1 text-xs leading-snug text-sand-500">{detail}</p>}
        </div>
      </div>
    </div>
  );
}
