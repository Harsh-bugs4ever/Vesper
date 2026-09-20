import * as React from "react";
import { cn } from "@/lib/utils";

export type ActivityTone = "sage" | "sand" | "gold" | "emerald" | "rose" | "slate";

const toneChip: Record<ActivityTone, string> = {
  sage: "bg-sage-50 text-sage-700",
  sand: "bg-sand-100 text-sand-700",
  gold: "bg-gold-50 text-gold-700",
  emerald: "bg-emerald-50 text-emerald-700",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-sand-100 text-sand-500",
};

export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: ActivityTone;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * The running list of what just happened — bookings, check-ins, completed cleans,
 * raised faults. Used on the dashboard and, filtered, inside department sections.
 */
export function ActivityFeed({ items, className }: { items: ActivityItem[]; className?: string }) {
  return (
    <ul className={cn("divide-y divide-sand-100", className)}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                toneChip[item.tone]
              )}
            >
              <Icon className="h-4 w-4" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug text-sand-950">{item.title}</p>
              <p className="mt-0.5 text-xs leading-snug text-sand-600">{item.detail}</p>
            </div>

            <span className="shrink-0 pt-0.5 text-xs tabular-nums text-sand-400">{item.time}</span>
          </li>
        );
      })}
    </ul>
  );
}
