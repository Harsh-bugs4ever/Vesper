import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Panel } from "@/components/ui/panel";
import { Sparkline } from "@/components/charts/sparkline";
import { chartColors } from "@/lib/chart-theme";
import { cn } from "@/lib/utils";

export type StatTone =
  | "sage"
  | "sand"
  | "forest"
  | "rose"
  | "emerald"
  | "gold"
  | "amber"
  | "blue"
  | "purple";


const tones: Record<StatTone, { chip: string; line: string }> = {
  sage: { chip: "bg-sage-50 text-sage-700", line: chartColors.forest },
  sand: { chip: "bg-sand-100 text-sand-700", line: chartColors.sand },
  forest: { chip: "bg-emerald-50 text-emerald-800", line: chartColors.forest },
  emerald: { chip: "bg-emerald-50 text-emerald-800", line: chartColors.forest },
  gold: { chip: "bg-amber-50 text-amber-800", line: chartColors.gold },
  amber: { chip: "bg-amber-50 text-amber-800", line: chartColors.gold },
  blue: { chip: "bg-sky-50 text-sky-800", line: chartColors.slate },
  rose: { chip: "bg-rose-50 text-rose-700", line: chartColors.rose },
  purple: { chip: "bg-purple-50 text-purple-700", line: chartColors.forest },
};

/**
 * One KPI: circular icon, label, headline figure, and a change against a named period.
 *
 * `direction` is separate from the sign of `change` on purpose — "open requests +3" is a
 * rise in the number and bad news, so the caller decides which way is good.
 *
 * `variant` picks which of label and value comes first. Operational screens lead with the
 * label, because the reader is scanning for a named metric; revenue screens lead with the
 * figure, because the reader already knows which four numbers are there and wants them.
 * Keep one variant per page — mixing them within a row makes the row look misaligned.
 */
export function StatTile({
  label,
  value,
  change,
  comparison,
  direction = "up",
  intent,
  trend,
  tone = "sage",
  variant = "label-first",
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  change?: string;
  comparison?: string;
  direction?: "up" | "down";
  /** Colour of the change text. Defaults to good-when-rising. */
  intent?: "good" | "bad" | "neutral";
  trend?: number[];
  tone?: StatTone;
  variant?: "label-first" | "value-first";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const t = tones[tone] ?? tones.sage;
  const resolved = intent ?? (direction === "up" ? "good" : "bad");
  const Arrow = direction === "up" ? ArrowUp : ArrowDown;

  const changeText = change && (
    <span
      className={cn(
        "flex items-center gap-1 text-xs font-semibold",
        resolved === "good" && "text-emerald-700",
        resolved === "bad" && "text-rose-600",
        resolved === "neutral" && "text-sand-600"
      )}
    >
      <Arrow className="h-3 w-3" />
      {change}
    </span>
  );

  if (variant === "value-first") {
    return (
      <Panel className="p-5">
        <div className="flex items-center gap-4">
          <span
            className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", t.chip)}
          >
            <Icon className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-sans text-3xl font-semibold leading-tight tracking-tight text-sand-950 tabular-nums">
              {value}
            </p>
            <p className="mt-0.5 text-sm text-sand-600">{label}</p>

            {(change || comparison) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                {changeText}
                {comparison && <span className="text-xs text-sand-500">{comparison}</span>}
              </div>
            )}
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="p-5">
      <div className="flex items-start gap-4">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", t.chip)}>
          <Icon className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-sand-600">{label}</p>
          <p className="mt-1 font-sans text-3xl font-semibold tracking-tight text-sand-950 tabular-nums">{value}</p>

          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="min-w-0">
              {changeText}
              {comparison && <p className="mt-0.5 truncate text-xs text-sand-500">{comparison}</p>}
            </div>

            {trend && <Sparkline data={trend} color={t.line} className="shrink-0" />}
          </div>
        </div>
      </div>
    </Panel>
  );
}
