"use client";

import React, { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BedDouble,
  CalendarRange,
  CheckCircle2,
  CircleAlert,
  Crosshair,
  LineChart as LineChartIcon,
  Percent,
  RefreshCw,
  Star,
} from "lucide-react";

import { MiniStat } from "@/components/ui/mini-stat";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { PeriodSelect } from "@/components/ui/period-select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { axisProps, chartColors, gridProps, tooltipProps } from "@/lib/chart-theme";
import {
  ACCURACY_TOLERANCE,
  accuracy,
  engines,
  keyMetrics,
  lastUpdated,
  outcomes,
} from "@/lib/demo/model-performance";
import { cn } from "@/lib/utils";

const RANGES = ["1 Nov 2026 – 30 Nov 2026", "1 Oct 2026 – 31 Oct 2026", "Last 90 days"] as const;
const OUTCOME_WINDOWS = ["Last 10 Days", "Last 30 Days", "Last 90 Days"] as const;

/** A bar for a percentage, used for both confidence and acceptance. */
function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-sand-600">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-sand-950">{value}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand-100">
        <div
          className={cn(
            "h-full rounded-full",
            value >= 80 ? "bg-sage-600" : value >= 65 ? "bg-gold-500" : "bg-rose-400"
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function ModelPerformancePage() {
  const [range, setRange] = useState<string>(RANGES[0]);
  const [window, setWindow] = useState<string>(OUTCOME_WINDOWS[0]);

  const withinTarget = keyMetrics.meanAbsoluteError <= keyMetrics.maeTarget;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Model Performance"
        description="Track how our models perform and drive better decisions."
        actions={
          <div className="flex items-center gap-2 rounded-xl border border-sand-200 bg-white py-1 pl-3 pr-1">
            <CalendarRange className="h-4 w-4 shrink-0 text-sand-500" />
            <PeriodSelect
              value={range}
              onChange={setRange}
              options={RANGES}
              className="[&>select]:border-0 [&>select]:bg-transparent"
            />
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-end gap-4 text-xs text-sand-500">
        <span>Models are retrained weekly with latest data.</span>
        <span className="flex items-center gap-2 border-l border-sand-200 pl-4">
          <RefreshCw className="h-3.5 w-3.5 text-sand-400" />
          <span>
            <span className="block text-sand-700">Last updated</span>
            <span className="block">{lastUpdated}</span>
          </span>
        </span>
      </div>

      {/* Engines */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {engines.map((engine) => (
          <Panel key={engine.id} className="flex flex-col">
            <PanelBody className="flex flex-1 flex-col gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-50 text-sage-700">
                  <LineChartIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-serif text-base font-semibold leading-tight text-sand-950">
                    {engine.name}
                  </p>
                  <p className="mt-0.5 text-xs text-sand-600">{engine.description}</p>
                </div>
              </div>

              <div className="space-y-3">
                <Meter label="Confidence" value={engine.confidence} />
                <Meter label="Acceptance Rate" value={engine.acceptanceRate} />
              </div>

              <button className="mt-auto flex items-center justify-end gap-1 text-xs font-medium text-sage-700 transition-colors hover:text-sage-900">
                View Details
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </PanelBody>
          </Panel>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        <Panel>
          <PanelHeader
            title="Occupancy Prediction vs Actual"
            description={`Last 30 days (${range})`}
            action={
              <div className="flex items-center gap-4 pt-1 text-xs text-sand-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-forest-600" />
                  Predicted Occupancy
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-gold-500" />
                  Actual Occupancy
                </span>
              </div>
            }
          />
          <PanelBody className="pt-4">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={accuracy} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} interval="preserveStartEnd" minTickGap={28} />
                <YAxis
                  {...axisProps}
                  domain={[0, 100]}
                  ticks={[0, 20, 40, 60, 80, 100]}
                  width={44}
                  tickFormatter={(value: number) => `${value}`}
                />
                <Tooltip
                  {...tooltipProps}
                  formatter={(value: unknown, name: unknown) => [
                    `${value as number}%`,
                    name === "predicted" ? "Predicted" : "Actual",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke={chartColors.forest}
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: chartColors.forest, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke={chartColors.gold}
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: chartColors.gold, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Key Metrics (30 Days)" />
          <PanelBody className="space-y-3 pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MiniStat
                label="Avg. Occupancy (Actual)"
                value={`${keyMetrics.avgActual}%`}
                tone="sage"
                icon={BedDouble}
              />
              <MiniStat
                label="Avg. Occupancy (Predicted)"
                value={`${keyMetrics.avgPredicted}%`}
                tone="gold"
                icon={LineChartIcon}
              />
              <MiniStat
                label="Mean Absolute Error (MAE)"
                value={`${keyMetrics.meanAbsoluteError}%`}
                tone="sand"
                icon={Percent}
              />
              <MiniStat
                label="R² Score"
                value={keyMetrics.rSquared}
                tone="sage"
                icon={Crosshair}
              />
            </div>

            <div
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4",
                withinTarget
                  ? "border-gold-200 bg-gold-50/50"
                  : "border-rose-200 bg-rose-50/50"
              )}
            >
              {withinTarget ? (
                <Star className="mt-0.5 h-5 w-5 shrink-0 fill-gold-400 text-gold-500" />
              ) : (
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              )}
              <div>
                <p className="text-sm font-medium text-sand-950">
                  {withinTarget
                    ? "Model accuracy is within target range."
                    : "Model accuracy is outside the target range."}
                </p>
                <p className="mt-0.5 text-xs text-sand-600">
                  {withinTarget
                    ? "Predictions are aligning well with actual demand."
                    : `MAE of ${keyMetrics.meanAbsoluteError}% exceeds the ${keyMetrics.maeTarget}% target. Treat rate suggestions with more caution until it recovers.`}
                </p>
              </div>
            </div>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Recent Prediction Outcomes"
          description={window}
          action={<PeriodSelect value={window} onChange={setWindow} options={OUTCOME_WINDOWS} />}
        />
        <PanelBody className="pt-4">
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH align="right">Predicted Occupancy</TH>
                <TH align="right">Actual Occupancy</TH>
                <TH align="right">Difference</TH>
                <TH align="right">Predicted Rev (₹)</TH>
                <TH align="right">Actual Rev (₹)</TH>
                <TH align="right">Outcome</TH>
              </tr>
            </THead>
            <TBody>
              {outcomes.map((row) => {
                const difference = row.actualOccupancy - row.predictedOccupancy;
                const accurate = Math.abs(difference) <= ACCURACY_TOLERANCE;

                return (
                  <TR key={row.date}>
                    <TD className="text-sand-700">{row.date}</TD>
                    <TD align="right" className="text-sand-800">
                      {row.predictedOccupancy}%
                    </TD>
                    <TD align="right" className="text-sand-800">
                      {row.actualOccupancy}%
                    </TD>
                    <TD
                      align="right"
                      className={cn(
                        "font-medium",
                        difference > 0 ? "text-emerald-700" : difference < 0 ? "text-rose-600" : "text-sand-600"
                      )}
                    >
                      {difference > 0 ? "+" : ""}
                      {difference}%
                    </TD>
                    <TD align="right" className="text-sand-700">
                      {row.predictedRevenue.toLocaleString("en-IN")}
                    </TD>
                    <TD align="right" className="text-sand-700">
                      {row.actualRevenue.toLocaleString("en-IN")}
                    </TD>
                    <TD align="right">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          accurate
                            ? "border-sage-200 bg-sage-50 text-sage-800"
                            : "border-gold-200 bg-gold-50 text-gold-800"
                        )}
                      >
                        {accurate ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <CircleAlert className="h-3 w-3" />
                        )}
                        {accurate ? "Accurate" : "Slight variance"}
                      </span>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>

          <p className="mt-4 text-xs text-sand-500">
            &ldquo;Accurate&rdquo; means the prediction landed within {ACCURACY_TOLERANCE} percentage
            points of what actually happened. The threshold is stated rather than implied, because
            a label that grades its own homework is worth nothing.
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
