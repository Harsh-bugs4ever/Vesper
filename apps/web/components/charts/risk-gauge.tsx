import * as React from "react";

import { chartColors } from "@/lib/chart-theme";
import { cn } from "@/lib/utils";

/** Where a percentage sits on the risk scale, and what to call it. */
export function riskBand(value: number): { label: string; color: string; text: string } {
  if (value >= 66) return { label: "High Risk", color: chartColors.rose, text: "text-rose-600" };
  if (value >= 33) return { label: "Medium Risk", color: chartColors.gold, text: "text-gold-700" };
  return { label: "Low Risk", color: chartColors.forest, text: "text-sage-700" };
}

/**
 * A half-circle gauge for a single risk percentage.
 *
 * Drawn as two arcs — a full pale track and a coloured overlay clipped by dash offset —
 * so the empty portion stays visible. That matters: a gauge with no track reads as a
 * shape rather than a proportion.
 */
export function RiskGauge({
  value,
  size = 150,
  className,
}: {
  /** 0–100. */
  value: number;
  size?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const band = riskBand(clamped);

  const stroke = 12;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // Semicircle sweeping left to right across the top.
  const arc = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;
  const length = Math.PI * radius;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg width={size} height={cy + stroke} viewBox={`0 0 ${size} ${cy + stroke}`} role="img"
        aria-label={`Risk level ${clamped} percent, ${band.label}`}>
        <path
          d={arc}
          fill="none"
          stroke="#eceae4"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={arc}
          fill="none"
          stroke={band.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - clamped / 100)}
        />
      </svg>

      <div className="-mt-9 text-center">
        <p className="font-sans text-3xl font-semibold text-sand-950 tabular-nums">{clamped}%</p>
        <p className={cn("text-sm font-semibold", band.text)}>{band.label}</p>
      </div>
    </div>
  );
}
