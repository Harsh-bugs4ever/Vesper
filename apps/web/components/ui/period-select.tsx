"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The quiet "This Month" control that sits in panel headers.
 *
 * A native `select` on purpose: it is one of the few controls where the OS widget beats
 * anything we would build, and it is keyboard- and screen-reader-correct for free.
 */
export function PeriodSelect({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-sand-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-sand-800 transition-colors hover:bg-sand-50 focus:border-sage-500 focus:outline-none focus:ring-1 focus:ring-sage-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sand-400" />
    </div>
  );
}
