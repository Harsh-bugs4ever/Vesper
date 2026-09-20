"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { axisProps, chartColors, gridProps, tooltipProps } from "@/lib/chart-theme";

export interface MovementPoint {
  date: string;
  arrivals: number;
  departures: number;
}

/**
 * Arrivals against departures for the coming fortnight.
 *
 * Grouped bars rather than stacked: the desk reads this to staff the lobby, and the
 * question is how many of each on a given morning, not what the two add up to.
 */
export function ArrivalsDeparturesChart({ data }: { data: MovementPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barGap={2}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="date" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
        <YAxis {...axisProps} width={40} allowDecimals={false} />
        <Tooltip {...tooltipProps} />
        <Legend
          verticalAlign="top"
          align="right"
          height={28}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: "#6b7770" }}
        />
        <Bar dataKey="arrivals" name="Arrivals" fill={chartColors.forest} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Bar
          dataKey="departures"
          name="Departures"
          fill={chartColors.sand}
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
