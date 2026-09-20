"use client";

import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  BedDouble,
  CalendarRange,
  FileText,
  Lightbulb,
  RotateCcw,
  Save,
  Tag,
  TrendingUp,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { PeriodSelect } from "@/components/ui/period-select";
import { ScenarioSlider } from "@/components/ui/scenario-slider";
import { useToast } from "@/components/ui/toast";
import { axisProps, chartColors, gridProps, tooltipProps } from "@/lib/chart-theme";
import { ASSUMPTIONS, PRESETS, baseline, project, type Scenario } from "@/lib/demo/simulator";
import { cn } from "@/lib/utils";

const RANGES = ["1 Dec 2026 – 31 Dec 2026", "1 Jan 2027 – 31 Jan 2027", "Next 90 days"] as const;

const DEFAULT: Scenario = PRESETS.balanced.scenario;

/** ₹ in crore or lakh, matching how the rest of the product writes money. */
function money(amount: number): string {
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  return `₹${(amount / 1_00_000).toFixed(1)} L`;
}

export default function SimulatorPage() {
  const { showToast } = useToast();

  const [range, setRange] = useState<string>(RANGES[0]);
  const [scenario, setScenario] = useState<Scenario>(DEFAULT);

  const result = useMemo(() => project(scenario), [scenario]);

  const activePreset = Object.entries(PRESETS).find(
    ([, preset]) =>
      preset.scenario.priceChange === scenario.priceChange &&
      preset.scenario.staffingChange === scenario.staffingChange &&
      preset.scenario.promoDiscount === scenario.promoDiscount
  )?.[0];

  const set = (patch: Partial<Scenario>) =>
    setScenario((current) => ({ ...current, ...patch }));

  const baselineRevpar = Math.round((baseline.arr * baseline.occupancy) / 100);
  const baselineProfit = baseline.revenue * baseline.profitMargin;

  const metrics = [
    {
      label: "Projected Revenue",
      value: money(result.revenue),
      versus: `vs. ${money(baseline.revenue)} (baseline)`,
      delta: result.revenueDeltaPct,
      suffix: "%",
    },
    {
      label: "Projected Occupancy",
      value: `${result.occupancy}%`,
      versus: `vs. ${baseline.occupancy}% (baseline)`,
      delta: result.occupancyDeltaPoints,
      suffix: " pp",
    },
    {
      label: "RevPAR",
      value: `₹${result.revpar.toLocaleString("en-IN")}`,
      versus: `vs. ₹${baselineRevpar.toLocaleString("en-IN")} (baseline)`,
      delta: result.revparDeltaPct,
      suffix: "%",
    },
    {
      label: "Estimated Profit",
      value: money(result.profit),
      versus: `vs. ${money(baselineProfit)} (baseline)`,
      delta: result.profitDeltaPct,
      suffix: "%",
    },
  ];

  const insights = [
    {
      icon: TrendingUp,
      title:
        result.revenueDeltaPct >= 0
          ? `Revenue could increase by ${result.revenueDeltaPct}%`
          : `Revenue could fall by ${Math.abs(result.revenueDeltaPct)}%`,
      detail:
        result.revenueDeltaPct >= 0
          ? "Driven by higher ADR and improved occupancy."
          : "The discount is outrunning the volume it buys.",
    },
    {
      icon: Users,
      title:
        scenario.staffingChange > 0
          ? "Additional staffing may improve guest satisfaction"
          : "Reduced staffing puts service levels at risk",
      detail:
        scenario.staffingChange > 0
          ? "Which can lead to higher repeat bookings."
          : "Turnaround times and review scores usually follow headcount down.",
    },
    {
      icon: Tag,
      title: `A ${Math.abs(scenario.promoDiscount)}% promotion discount`,
      detail: "Helps drive volume with minimal impact on overall RevPAR.",
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="What-If Simulator"
        description="Explore scenarios and see how changes impact your hotel's performance."
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

      <div className="flex items-start gap-3 rounded-2xl border border-gold-200 bg-gold-50/40 p-4">
        <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-gold-700" />
        <div>
          <p className="font-serif text-base font-semibold text-sand-950">
            Make smarter decisions
          </p>
          <p className="mt-0.5 text-sm text-sand-600">
            Simulate pricing, staffing and promotions to find the best outcome for your business.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Levers */}
        <Panel>
          <PanelHeader
            title="Adjust Scenario"
            description="Move the sliders to see the projected impact on revenue, occupancy and profit."
          />
          <PanelBody className="space-y-6 pt-5">
            <div className="flex flex-wrap items-start gap-4">
              <ScenarioSlider
                className="min-w-[240px] flex-1"
                label="Room Price Change"
                description="Adjust average room rate (ARR)"
                value={scenario.priceChange}
                onChange={(value) => set({ priceChange: value })}
                min={-20}
                max={20}
                step={1}
                ticks={[-20, -10, 0, 10, 20]}
              />
              <div className="flex min-w-[140px] items-center gap-3 rounded-xl border border-sand-200 bg-sand-50/60 px-4 py-3">
                <BedDouble className="h-4 w-4 shrink-0 text-sand-500" />
                <div>
                  <p className="font-serif text-lg font-semibold leading-tight text-sand-950">
                    ₹{result.arr.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-sand-500">New ARR</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-4">
              <ScenarioSlider
                className="min-w-[240px] flex-1"
                label="Staffing Change"
                description="Adjust housekeeping & F&B staff"
                value={scenario.staffingChange}
                onChange={(value) => set({ staffingChange: value })}
                min={-30}
                max={30}
                step={5}
                ticks={[-30, -15, 0, 15, 30]}
              />
              <div className="flex min-w-[140px] items-center gap-3 rounded-xl border border-sand-200 bg-sand-50/60 px-4 py-3">
                <Users className="h-4 w-4 shrink-0 text-sand-500" />
                <div>
                  <p className="font-serif text-lg font-semibold leading-tight text-sand-950">
                    {result.staff}
                  </p>
                  <p className="text-xs text-sand-500">
                    Total Staff ({result.staff - baseline.staff >= 0 ? "+" : ""}
                    {result.staff - baseline.staff})
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-4">
              <ScenarioSlider
                className="min-w-[240px] flex-1"
                label="Promotion Discount"
                description="Apply discount on room rates"
                value={scenario.promoDiscount}
                onChange={(value) => set({ promoDiscount: value })}
                min={-20}
                max={0}
                step={1}
                ticks={[0, -5, -10, -15, -20]}
              />
              <div className="flex min-w-[140px] items-center gap-3 rounded-xl border border-sand-200 bg-sand-50/60 px-4 py-3">
                <Tag className="h-4 w-4 shrink-0 text-sand-500" />
                <div>
                  <p className="font-serif text-lg font-semibold leading-tight text-sand-950">
                    {Math.abs(scenario.promoDiscount)}%
                  </p>
                  <p className="text-xs text-sand-500">Discount</p>
                </div>
              </div>
            </div>

            <div className="border-t border-sand-200/80 pt-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-lg font-semibold text-sand-950">Scenario Preset</p>
                  <p className="mt-0.5 text-sm text-sand-600">Quickly try common scenarios.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setScenario(DEFAULT)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset All
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {Object.entries(PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => setScenario(preset.scenario)}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left transition-colors",
                      activePreset === key
                        ? "border-sage-500 bg-sage-50"
                        : "border-sand-200 bg-white hover:bg-sand-50"
                    )}
                  >
                    <span className="block text-sm font-semibold text-sand-950">
                      {preset.label}
                    </span>
                    <span className="block text-xs text-sand-500">{preset.detail}</span>
                  </button>
                ))}
              </div>
            </div>
          </PanelBody>
        </Panel>

        {/* Results */}
        <Panel>
          <PanelHeader
            title="Projected Results"
            description={`Comparison for ${range}`}
            action={
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                  result.revenueDeltaPct >= 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                )}
              >
                <TrendingUp className="h-3 w-3" />
                {result.revenueDeltaPct >= 0 ? "+" : ""}
                {result.revenueDeltaPct}% Revenue
              </span>
            }
          />

          <PanelBody className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-xl border border-sand-200/80 bg-white p-4"
                >
                  <p className="text-xs text-sand-600">{metric.label}</p>
                  <p className="mt-1 font-serif text-2xl font-semibold leading-tight text-sand-950">
                    {metric.value}
                  </p>
                  <p className="mt-0.5 text-xs text-sand-500">{metric.versus}</p>
                  <p
                    className={cn(
                      "mt-1.5 text-xs font-semibold",
                      metric.delta >= 0 ? "text-emerald-700" : "text-rose-600"
                    )}
                  >
                    {metric.delta >= 0 ? "▲" : "▼"} {Math.abs(metric.delta)}
                    {metric.suffix}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-sand-200/80 p-4">
              <p className="font-serif text-base font-semibold text-sand-950">
                Revenue Comparison
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={result.monthly}
                  margin={{ top: 22, right: 8, bottom: 0, left: -12 }}
                  barGap={4}
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis
                    {...axisProps}
                    width={48}
                    tickFormatter={(value: number) => value.toFixed(1)}
                    label={{
                      value: "Revenue (₹ Crore)",
                      angle: -90,
                      position: "insideLeft",
                      fill: "#6b7770",
                      fontSize: 11,
                      dy: 50,
                    }}
                  />
                  <Tooltip {...tooltipProps} formatter={(value: unknown) => `₹${value} Cr`} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    height={24}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12, color: "#6b7770" }}
                  />
                  <Bar dataKey="baseline" name="Baseline" fill={chartColors.sand} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                    <LabelList dataKey="baseline" position="top" fill="#6b7770" fontSize={11} />
                  </Bar>
                  <Bar dataKey="simulated" name="Simulated" fill={chartColors.forest} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                    <LabelList dataKey="simulated" position="top" fill="#6b7770" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border border-sand-200/80 bg-sand-50/60 p-4">
              <p className="flex items-center gap-2 font-serif text-base font-semibold text-sand-950">
                <FileText className="h-4 w-4 text-sand-500" />
                Key Assumptions
              </p>
              <ul className="mt-2 space-y-1.5">
                {ASSUMPTIONS.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-sand-600">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sand-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelBody className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-serif text-lg font-semibold text-sand-950">
              <Lightbulb className="h-4 w-4 text-gold-600" />
              Insights
            </p>
            <p className="mt-0.5 text-sm text-sand-600">
              Based on this scenario, here are a few observations.
            </p>

            <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              {insights.map((insight) => {
                const Icon = insight.icon;
                return (
                  <li key={insight.title} className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage-50 text-sage-700">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-sand-950">
                        {insight.title}
                      </span>
                      <span className="block text-xs text-sand-600">{insight.detail}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <Button
            size="sm"
            onClick={() =>
              showToast({
                title: "Scenario saved",
                description: `Price ${scenario.priceChange >= 0 ? "+" : ""}${scenario.priceChange}%, staffing ${scenario.staffingChange >= 0 ? "+" : ""}${scenario.staffingChange}%, discount ${Math.abs(scenario.promoDiscount)}%.`,
                type: "success",
              })
            }
          >
            <Save className="h-3.5 w-3.5" />
            Save Scenario
          </Button>
        </PanelBody>
      </Panel>
    </div>
  );
}
