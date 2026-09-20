import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The large serif heading each section opens with, with the date or a primary action
 * sitting opposite it. Matches the "Good evening, Harsh" block on the dashboard.
 */
export function PageHeader({
  title,
  description,
  meta,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Quiet right-hand text, typically the date. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-sand-950 leading-tight">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-sand-600">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:pt-2">
        {meta && <span className="text-sm text-sand-500">{meta}</span>}
        {actions}
      </div>
    </div>
  );
}
