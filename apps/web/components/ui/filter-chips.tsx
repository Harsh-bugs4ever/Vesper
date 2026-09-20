"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface FilterChip<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/**
 * The row of segmented filters above a board or list.
 *
 * Rendered as a radio group rather than buttons: the options are mutually exclusive, so
 * arrow keys should move between them and a screen reader should announce which one is
 * chosen. Buttons would give neither.
 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly FilterChip<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("flex flex-wrap items-center gap-2", className)}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "border-sage-600 bg-sage-600 text-white"
                : "border-sand-200 bg-white text-sand-700 hover:border-sand-300 hover:bg-sand-50"
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  "tabular-nums",
                  isActive ? "text-white/70" : "text-sand-400"
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
