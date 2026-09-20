"use client";

import * as React from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { axisProps, chartColors, gridProps, tooltipProps } from "@/lib/chart-theme";

export interface SensorPoint {
  date: string;
  value: number;
  /** Present only on readings the anomaly model flagged. */
  anomaly?: number;
}

/**
 * A sensor series with the flagged readings called out.
 *
 * Anomalies ride as a separate scatter series rather than as coloured dots on the line,
 * so they keep their own legend entry — an engineer needs to know that the amber marks
 * mean "the model objected here", not simply "a higher reading".
 */
export function SensorTrendChart({
  data,
  unit,
  domain,
  height = 220,
}: {
  data: SensorPoint[];
  unit: string;
  domain?: [number, number];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="date" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
        <YAxis
          {...axisProps}
          domain={domain ?? ["auto", "auto"]}
          width={52}
          tickFormatter={(value: number) => `${value}${unit}`}
        />
        <Tooltip
          {...tooltipProps}
          formatter={(value: unknown, name: unknown) => [
            `${value as number}${unit}`,
            name === "anomaly" ? "Anomaly" : "Reading",
          ]}
        />

        <Line
          type="monotone"
          dataKey="value"
          name="value"
          stroke={chartColors.forest}
          strokeWidth={2}
          dot={{ r: 2.5, fill: chartColors.forest, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
        <Scatter dataKey="anomaly" name="anomaly" fill={chartColors.gold} shape="circle" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
