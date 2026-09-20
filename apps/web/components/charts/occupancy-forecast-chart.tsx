"use client";

import * as React from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { axisProps, chartColors, gridProps } from "@/lib/chart-theme";

export interface ForecastPoint {
  date: string;
  occupancy: number;
  /** Lower and upper bound of the prediction interval, in percent. */
  range: [number, number];
}

interface TooltipEntry {
  payload?: ForecastPoint;
}

/**
 * The hover card. Written by hand rather than configured through Recharts' formatter
 * because it has to state the range as one fact ("72% – 95%") rather than as two rows,
 * which is the whole reason the band is on the chart.
 */
function ForecastTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-lg border border-sand-200 bg-white px-3 py-2 shadow-elevated">
      <p className="text-xs font-semibold text-sand-950">{point.date}</p>
      <dl className="mt-1 space-y-0.5 text-xs">
        <div className="flex items-baseline gap-4">
          <dt className="text-sand-600">Occupancy (forecast)</dt>
          <dd className="ml-auto font-semibold tabular-nums text-sand-900">{point.occupancy}%</dd>
        </div>
        <div className="flex items-baseline gap-4">
          <dt className="text-sand-600">Confidence range</dt>
          <dd className="ml-auto tabular-nums text-sand-700">
            {point.range[0]}% – {point.range[1]}%
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Occupancy over a forecast window, drawn with its confidence interval.
 *
 * The band is the point of the chart: a single forecast line invites a manager to treat
 * a guess as a fact, and the whole product rests on them trusting what it shows. The
 * band is painted under the line so the line stays the thing the eye follows.
 *
 * `threshold` draws the sold-out line the revenue team prices against.
 */
export function OccupancyForecastChart({
  data,
  height = 260,
  threshold,
}: {
  data: ForecastPoint[];
  height?: number;
  threshold?: { value: number; label: string };
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="date" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
        <YAxis
          {...axisProps}
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickFormatter={(value: number) => `${value}%`}
          width={48}
        />
        <Tooltip content={<ForecastTooltip />} cursor={{ stroke: "#d8d5cd", strokeWidth: 1 }} />

        <Area
          type="monotone"
          dataKey="range"
          stroke="none"
          fill={chartColors.band}
          fillOpacity={1}
          isAnimationActive={false}
          activeDot={false}
        />
        <Line
          type="monotone"
          dataKey="occupancy"
          stroke={chartColors.forest}
          strokeWidth={2}
          dot={{ r: 3, fill: chartColors.forest, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />

        {threshold && (
          <ReferenceLine
            y={threshold.value}
            stroke={chartColors.gold}
            strokeDasharray="6 4"
            label={{
              value: threshold.label,
              position: "insideTopLeft",
              fill: chartColors.gold,
              fontSize: 11,
            }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
