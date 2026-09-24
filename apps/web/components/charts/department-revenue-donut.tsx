"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { categorical, formatLakh } from "@/lib/chart-theme";

export interface DepartmentSlice {
  name: string;
  /** Rupees, not percent — the share is derived so the two can never disagree. */
  value: number;
}

/**
 * Revenue split by department, with the total sitting in the hole.
 *
 * The legend is a list rather than chips: five departments with a share and an amount
 * each is a small table, and a table is easier to read down than a scatter of labels.
 */
export function DepartmentRevenueDonut({ data }: { data: DepartmentSlice[] }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={1}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((slice, index) => (
                <Cell key={slice.name} fill={categorical[index % categorical.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-sans text-xl font-semibold text-sand-950 tabular-nums">{formatLakh(total)}</span>
          <span className="text-xs text-sand-500">Total Revenue</span>
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-2.5">
        {data.map((slice, index) => (
          <li key={slice.name} className="flex items-center gap-3 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: categorical[index % categorical.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-sand-800">{slice.name}</span>
            <span className="shrink-0 tabular-nums text-sand-500">
              {Math.round((slice.value / total) * 100)}%
            </span>
            <span className="w-16 shrink-0 text-right tabular-nums font-medium text-sand-900">
              {formatLakh(slice.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
