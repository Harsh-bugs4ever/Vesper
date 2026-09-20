"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SectionTab<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/**
 * The underlined tab row that sits under a page title.
 *
 * Used for views of the same subject — Assets, Work Orders, Service History — rather than
 * for filtering one list; that job belongs to `FilterChips`. Rendered as a real tablist so
 * arrow keys move between tabs.
 */
export function SectionTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: readonly SectionTab<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();

    const next = (index + delta + tabs.length) % tabs.length;
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      className={cn("flex items-center gap-6 overflow-x-auto border-b border-sand-200/80", className)}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "-mb-px shrink-0 whitespace-nowrap border-b-2 px-0.5 pb-3 text-sm transition-colors",
              isActive
                ? "border-sage-700 font-semibold text-sage-800"
                : "border-transparent font-medium text-sand-600 hover:text-sand-900"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 tabular-nums text-sand-400">({tab.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
