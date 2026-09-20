"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { axisProps, chartColors, gridProps, tooltipProps } from "@/lib/chart-theme";
import type { DepartmentStaffing } from "@/lib/demo/roster";

/**
 * Required against scheduled headcount, per department.
 *
 * Grouped rather than stacked, and with both values labelled: the reader's question is
 * "are we short, and by how many", which a stacked bar actively hides. Short departments
 * get a deeper bar colour so the gap is visible without reading the axis.
 */
export function StaffingChart({ data }: { data: DepartmentStaffing[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -20 }} barGap={2}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="department" {...axisProps} interval={0} tick={{ fill: "#6b7770", fontSize: 10 }} />
        <YAxis {...axisProps} width={40} allowDecimals={false} domain={[0, 80]} />
        <Tooltip {...tooltipProps} />

        <Bar dataKey="required" name="Required Staff" fill={chartColors.band} radius={[3, 3, 0, 0]} isAnimationActive={false}>
          <LabelList dataKey="required" position="top" fill="#6b7770" fontSize={11} />
        </Bar>
        <Bar dataKey="scheduled" name="Scheduled Staff" radius={[3, 3, 0, 0]} isAnimationActive={false}>
          <LabelList dataKey="scheduled" position="top" fill="#6b7770" fontSize={11} />
          {data.map((row) => (
            <Cell
              key={row.department}
              fill={row.scheduled < row.required ? chartColors.rose : chartColors.forest}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
