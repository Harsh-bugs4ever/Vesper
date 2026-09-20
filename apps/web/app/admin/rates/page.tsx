"use client";

import React, { useState } from "react";
import {
  BarChart3,
  BedDouble,
  CalendarRange,
  CalendarX,
  IndianRupee,
  Music,
  TrendingUp,
  Users,
} from "lucide-react";

import { OccupancyForecastChart } from "@/components/charts/occupancy-forecast-chart";
import { Sparkline } from "@/components/charts/sparkline";
import { Button } from "@/components/ui/button";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { PeriodSelect } from "@/components/ui/period-select";
import { RangeMeter } from "@/components/ui/range-meter";
import { SectionTabs } from "@/components/ui/section-tabs";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { chartColors, formatLakh } from "@/lib/chart-theme";
import {
  SOLD_OUT_THRESHOLD,
  competitors,
  novemberForecast,
  rateRecommendation,
  roomCategories,
} from "@/lib/demo/revenue";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "categories", label: "Room Categories" },
  { value: "competitors", label: "Competitor Rates" },
  { value: "demand", label: "Demand Calendar" },
  { value: "reports", label: "Reports" },
] as const;

type Tab = (typeof TABS)[number]["value"];

const CATEGORY_FILTERS = [
  { value: "All Rooms", label: "All Rooms" },
  { value: "Standard", label: "Standard" },
  { value: "Deluxe", label: "Deluxe" },
  { value: "Executive", label: "Executive" },
  { value: "Suite", label: "Suite" },
  { value: "Premium", label: "Premium" },
] as const;

type CategoryFilter = (typeof CATEGORY_FILTERS)[number]["value"];

const DATE_RANGES = ["1 Nov 2026 – 30 Nov 2026", "1 Dec 2026 – 31 Dec 2026", "Next 90 days"] as const;

/** Icons for the key drivers, matched to what each driver is actually about. */
const DRIVER_ICONS = [Users, Music, BarChart3, BedDouble];

/** Occupancy colour follows the pricing bands, not a gradient. */
function occupancyClass(value: number) {
  if (value >= 85) return "font-semibold text-gold-700";
  if (value >= 70) return "font-semibold text-sage-700";
  return "text-sand-700";
}

export default function RateManagementPage() {
  const { showToast, showUndoToast } = useToast();

  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState<string>(DATE_RANGES[0]);
  const [category, setCategory] = useState<CategoryFilter>("All Rooms");
  const [applied, setApplied] = useState(false);

  const visibleCategories =
    category === "All Rooms"
      ? roomCategories
      : roomCategories.filter((row) => row.category === category);

  const applyRate = () => {
    setApplied(true);
    showUndoToast(
      `${rateRecommendation.roomType} · ₹${rateRecommendation.suggestedRate.toLocaleString("en-IN")}`,
      `Published for ${rateRecommendation.forDate} only. Every other date is untouched.`,
      () => setApplied(false),
      10
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue Management"
        description="Optimize rates with data-driven insights"
        actions={
          <div className="flex items-center gap-2 rounded-xl border border-sand-200 bg-white py-1 pl-3 pr-1">
            <CalendarRange className="h-4 w-4 shrink-0 text-sand-500" />
            <PeriodSelect
              value={range}
              onChange={setRange}
              options={DATE_RANGES}
              className="[&>select]:border-0 [&>select]:bg-transparent"
            />
          </div>
        }
      />

      <SectionTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              variant="value-first"
              label="Current Occupancy"
              value="74%"
              change="+12%"
              comparison="vs. last month"
              tone="sage"
              icon={BedDouble}
            />
            <StatTile
              variant="value-first"
              label="Average Daily Rate (ADR)"
              value="₹9,800"
              change="+8%"
              comparison="vs. last month"
              tone="sand"
              icon={IndianRupee}
            />
            <StatTile
              variant="value-first"
              label="Total Room Revenue (MTD)"
              value="₹28.4 L"
              change="+15%"
              comparison="vs. last month"
              tone="forest"
              icon={BarChart3}
            />
            <StatTile
              variant="value-first"
              label="Total Room Nights"
              value="12,480"
              change="+10%"
              comparison="vs. last month"
              tone="rose"
              icon={Users}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
            <Panel>
              <PanelHeader
                title="30-Day Occupancy Forecast"
                description="Projected occupancy with confidence range and optimal pricing window"
                action={
                  <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-sand-600">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-0.5 w-5 rounded-full"
                        style={{ backgroundColor: chartColors.forest }}
                      />
                      Forecast
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-3 w-5 rounded-sm"
                        style={{ backgroundColor: chartColors.band }}
                      />
                      Confidence range
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-0 w-5 border-t-2 border-dashed"
                        style={{ borderColor: chartColors.gold }}
                      />
                      Sold-out threshold
                    </span>
                  </div>
                }
              />
              <PanelBody className="pt-4">
                <OccupancyForecastChart
                  data={novemberForecast}
                  height={300}
                  threshold={{
                    value: SOLD_OUT_THRESHOLD,
                    label: `${SOLD_OUT_THRESHOLD}% (Sold-out threshold)`,
                  }}
                />
              </PanelBody>
            </Panel>

            {/* Rate recommendation */}
            <Panel className="flex flex-col">
              <PanelHeader
                title="Rate Recommendation"
                description={`${rateRecommendation.roomType} • ${rateRecommendation.forDate}`}
                action={
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-200 bg-gold-50 px-2.5 py-0.5 text-xs font-medium text-gold-800">
                    <TrendingUp className="h-3 w-3" />
                    High demand
                  </span>
                }
              />

              <PanelBody className="flex-1 space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-sand-200 bg-white p-4">
                    <p className="text-xs text-sand-600">Current Rate</p>
                    <p className="mt-1 font-serif text-2xl font-semibold text-sand-950">
                      ₹{rateRecommendation.currentRate.toLocaleString("en-IN")}
                    </p>
                    <p className="mt-0.5 text-xs text-sand-500">per night</p>
                  </div>

                  <div className="rounded-xl border border-sage-300 bg-sage-50 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-sage-800">Suggested Rate</p>
                      <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-xs font-semibold text-sage-800">
                        +{rateRecommendation.upliftPct}%
                      </span>
                    </div>
                    <p className="mt-1 font-serif text-2xl font-semibold text-sage-900">
                      ₹{rateRecommendation.suggestedRate.toLocaleString("en-IN")}
                    </p>
                    <p className="mt-0.5 text-xs text-sage-700">per night</p>
                  </div>
                </div>

                <div className="border-t border-sand-200/80 pt-4">
                  <p className="text-xs text-sand-600">Expected Impact</p>
                  <p className="mt-0.5 font-serif text-2xl font-semibold text-emerald-700">
                    +₹{rateRecommendation.expectedImpact.toLocaleString("en-IN")}
                  </p>
                  <p className="mt-0.5 text-xs text-sand-500">{rateRecommendation.impactBasis}</p>
                </div>

                <div className="border-t border-sand-200/80 pt-4">
                  <p className="text-sm font-semibold text-sand-950">Key Drivers</p>
                  <ul className="mt-2 space-y-2">
                    {rateRecommendation.drivers.map((driver, index) => {
                      const Icon = DRIVER_ICONS[index % DRIVER_ICONS.length];
                      return (
                        <li key={driver} className="flex items-start gap-2.5 text-sm text-sand-700">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-700">
                            <Icon className="h-3 w-3" />
                          </span>
                          {driver}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="border-t border-sand-200/80 pt-4">
                  <p className="mb-3 text-sm font-semibold text-sand-950">Recommended Range</p>
                  <RangeMeter
                    floor={rateRecommendation.priceFloor}
                    ceiling={rateRecommendation.priceCeiling}
                    value={rateRecommendation.suggestedRate}
                  />
                </div>

                {applied ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-800">
                    Applied to {rateRecommendation.forDate}. Logged to the audit trail and
                    reversible from there.
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        showToast({
                          title: "Recommendation dismissed",
                          description: "Fed back into the model's accuracy weights.",
                          type: "default",
                        })
                      }
                    >
                      Dismiss
                    </Button>
                    <Button size="sm" className="flex-1" onClick={applyRate}>
                      Apply rate
                    </Button>
                  </div>
                )}
              </PanelBody>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
            <Panel>
              <PanelHeader
                title="Occupancy by Room Category"
                action={
                  <FilterChips
                    className="pt-1"
                    options={CATEGORY_FILTERS}
                    value={category}
                    onChange={(value) => setCategory(value as CategoryFilter)}
                  />
                }
              />
              <PanelBody className="pt-4">
                <Table>
                  <THead>
                    <tr>
                      <TH>Room Category</TH>
                      <TH align="right">Inventory</TH>
                      <TH align="right">Occupancy</TH>
                      <TH align="right">ADR</TH>
                      <TH align="right">Revenue (MTD)</TH>
                      <TH align="right">Trend</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {visibleCategories.map((row) => (
                      <TR key={row.category}>
                        <TD className="font-medium text-sand-900">{row.category}</TD>
                        <TD align="right" className="text-sand-700">
                          {row.inventory}
                        </TD>
                        <TD align="right" className={occupancyClass(row.occupancy)}>
                          {row.occupancy}%
                        </TD>
                        <TD align="right" className="text-sand-800">
                          ₹{row.adr.toLocaleString("en-IN")}
                        </TD>
                        <TD align="right" className="font-medium text-sand-900">
                          {formatLakh(row.revenue)}
                        </TD>
                        <TD align="right">
                          <span className="flex justify-end">
                            <Sparkline
                              data={row.trend}
                              color={row.occupancy >= 85 ? chartColors.gold : chartColors.forest}
                            />
                          </span>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                title={`Competitor Rates (${rateRecommendation.roomType})`}
                action={
                  <button
                    onClick={() => setTab("competitors")}
                    className="pt-1 text-xs font-medium text-sage-700 transition-colors hover:text-sage-900"
                  >
                    View all competitors →
                  </button>
                }
              />
              <PanelBody className="pt-4">
                <Table>
                  <THead>
                    <tr>
                      <TH>Hotel</TH>
                      <TH align="right">Current</TH>
                      <TH align="right">Weekend</TH>
                      <TH align="right">Difference</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {competitors.map((row) => {
                      const isUs = row.difference === null;
                      return (
                        <TR key={row.hotel} className={cn(isUs && "bg-sage-50/70")}>
                          <TD className={cn(isUs ? "font-semibold text-sage-900" : "text-sand-800")}>
                            {row.hotel}
                          </TD>
                          <TD align="right" className="text-sand-700">
                            ₹{row.currentRate.toLocaleString("en-IN")}
                          </TD>
                          <TD align="right" className="text-sand-700">
                            ₹{row.weekendRate.toLocaleString("en-IN")}
                          </TD>
                          <TD
                            align="right"
                            className={cn(isUs ? "text-sand-400" : "font-medium text-rose-600")}
                          >
                            {isUs ? "—" : `+${row.difference}%`}
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </PanelBody>
            </Panel>
          </div>
        </div>
      )}

      {tab === "categories" && (
        <Panel>
          <PanelHeader
            title="Room Categories"
            description="Inventory, pace and achieved rate for every category."
          />
          <PanelBody className="pt-4">
            <Table>
              <THead>
                <tr>
                  <TH>Room Category</TH>
                  <TH align="right">Inventory</TH>
                  <TH align="right">Occupancy</TH>
                  <TH align="right">ADR</TH>
                  <TH align="right">RevPAR</TH>
                  <TH align="right">Revenue (MTD)</TH>
                  <TH align="right">Trend</TH>
                </tr>
              </THead>
              <TBody>
                {roomCategories.map((row) => (
                  <TR key={row.category}>
                    <TD className="font-medium text-sand-900">{row.category}</TD>
                    <TD align="right" className="text-sand-700">
                      {row.inventory}
                    </TD>
                    <TD align="right" className={occupancyClass(row.occupancy)}>
                      {row.occupancy}%
                    </TD>
                    <TD align="right" className="text-sand-800">
                      ₹{row.adr.toLocaleString("en-IN")}
                    </TD>
                    <TD align="right" className="text-sand-800">
                      ₹{Math.round((row.adr * row.occupancy) / 100).toLocaleString("en-IN")}
                    </TD>
                    <TD align="right" className="font-medium text-sand-900">
                      {formatLakh(row.revenue)}
                    </TD>
                    <TD align="right">
                      <span className="flex justify-end">
                        <Sparkline data={row.trend} color={chartColors.forest} />
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </PanelBody>
        </Panel>
      )}

      {tab === "competitors" && (
        <Panel>
          <PanelHeader
            title="Competitor Rates"
            description="The Juhu and Andheri set, refreshed twice daily from public rates."
          />
          <PanelBody className="pt-4">
            <Table>
              <THead>
                <tr>
                  <TH>Hotel</TH>
                  <TH align="right">Current rate</TH>
                  <TH align="right">Weekend rate (22 Nov)</TH>
                  <TH align="right">Difference</TH>
                </tr>
              </THead>
              <TBody>
                {competitors.map((row) => {
                  const isUs = row.difference === null;
                  return (
                    <TR key={row.hotel} className={cn(isUs && "bg-sage-50/70")}>
                      <TD className={cn(isUs ? "font-semibold text-sage-900" : "text-sand-800")}>
                        {row.hotel}
                        {isUs && <span className="ml-2 text-xs font-normal text-sage-700">(you)</span>}
                      </TD>
                      <TD align="right" className="text-sand-700">
                        ₹{row.currentRate.toLocaleString("en-IN")}
                      </TD>
                      <TD align="right" className="text-sand-700">
                        ₹{row.weekendRate.toLocaleString("en-IN")}
                      </TD>
                      <TD
                        align="right"
                        className={cn(isUs ? "text-sand-400" : "font-medium text-rose-600")}
                      >
                        {isUs ? "—" : `+${row.difference}%`}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </PanelBody>
        </Panel>
      )}

      {tab === "demand" && (
        <Panel>
          <PanelHeader
            title="Demand Calendar"
            description="Every night in the window, with the forecast the pricing engine is working from."
          />
          <PanelBody className="pt-4">
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
              {novemberForecast.map((point) => {
                const soldOut = point.occupancy >= SOLD_OUT_THRESHOLD;
                const busy = point.occupancy >= 75;
                return (
                  <div
                    key={point.date}
                    className={cn(
                      "rounded-xl border px-2 py-2.5 text-center",
                      soldOut
                        ? "border-gold-300 bg-gold-50 text-gold-900"
                        : busy
                          ? "border-sage-200 bg-sage-50 text-sage-900"
                          : "border-sand-200 bg-white text-sand-700"
                    )}
                  >
                    <span className="block text-xs text-sand-500">{point.date}</span>
                    <span className="mt-0.5 block text-sm font-semibold tabular-nums">
                      {point.occupancy}%
                    </span>
                  </div>
                );
              })}
            </div>
          </PanelBody>
        </Panel>
      )}

      {tab === "reports" && (
        <Panel>
          <PanelBody className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sand-100 text-sand-500">
              <CalendarX className="h-5 w-5" />
            </span>
            <div className="max-w-sm">
              <h3 className="font-serif text-lg font-semibold text-sand-950">Reports land on Day 6</h3>
              <p className="mt-1 text-sm text-sand-600">
                Pace against budget, segment mix and engine accuracy will live here. The forecast
                and rate tabs beside this one are already working.
              </p>
            </div>
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}
