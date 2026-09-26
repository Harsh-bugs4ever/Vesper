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

import { axisProps, chartColors, gridProps, tooltipProps } from "@/lib/chart-theme";

export interface SentimentPoint {
  date: string;
  sentiment: number;
  range: [number, number];
}

/**
 * How a guest has felt about us over time, with the uncertainty around it.
 *
 * Sentiment inferred from feedback and in-stay requests is a soft measurement, and
 * drawing it as a bare line invites someone to act on a four-point dip that is well
 * inside the noise. The band is the honesty; the average line is what the eye should
 * actually follow.
 */
export function SentimentTrendChart({
  data,
  average,
  height = 220,
}: {
  data: SentimentPoint[];
  average: number;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 44, bottom: 0, left: -18 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="date" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axisProps} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} width={40} />
        <Tooltip {...tooltipProps} />

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
          dataKey="score"
          name="Sentiment"
          stroke={chartColors.forest}
          strokeWidth={2}
          dot={{ r: 3, fill: chartColors.forest, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />

        <ReferenceLine
          y={average}
          stroke={chartColors.forestSoft}
          strokeDasharray="4 4"
          label={{
            value: `Avg. ${average}`,
            position: "right",
            fill: "#6b7770",
            fontSize: 11,
          }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
