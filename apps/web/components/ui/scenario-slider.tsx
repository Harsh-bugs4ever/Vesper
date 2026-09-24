"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A labelled slider for a what-if lever.
 *
 * A native `input[type=range]` rather than a custom-built control: it is draggable,
 * arrow-key steppable and announced correctly by screen readers with no work, and every
 * hand-rolled replacement loses at least one of those. The track is styled, the
 * behaviour is the browser's.
 */
export function ScenarioSlider({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step = 1,
  ticks,
  format = (v: number) => `${v > 0 ? "+" : ""}${v}%`,
  className,
}: {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Values to print under the track. */
  ticks: number[];
  format?: (value: number) => string;
  className?: string;
}) {
  const id = React.useId();
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn("", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-serif text-lg font-semibold text-sand-950">
          {label}
        </label>
        <span
          className={cn(
            "font-sans text-lg font-semibold tabular-nums",
            value > 0 ? "text-sage-700" : value < 0 ? "text-rose-600" : "text-sand-600"
          )}
        >
          {format(value)}
        </span>
      </div>

      {description && <p className="mt-0.5 text-sm text-sand-600">{description}</p>}

      <div className="relative mt-3">
        {/* The filled portion, drawn behind the native thumb. */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-sand-200">
          <div className="h-full rounded-full bg-sage-600" style={{ width: `${pct}%` }} />
        </div>

        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className={cn(
            "relative h-5 w-full cursor-pointer appearance-none bg-transparent",
            "focus-visible:outline-none",
            // The thumb is the only part the browser draws; both engines need naming.
            "[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white",
            "[&::-webkit-slider-thumb]:bg-sage-700 [&::-webkit-slider-thumb]:shadow-sm",
            "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5",
            "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2",
            "[&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-sage-700"
          )}
        />
      </div>

      <div className="mt-1 flex justify-between text-xs text-sand-500">
        {ticks.map((tick) => (
          <span key={tick} className="tabular-nums">
            {format(tick)}
          </span>
        ))}
      </div>
    </div>
  );
}
