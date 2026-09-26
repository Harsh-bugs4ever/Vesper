"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  BedDouble,
  CalendarRange,
  CalendarX,
  IndianRupee,
  Loader2,
  Music,
  TrendingUp,
  Users,
} from "lucide-react";

import { OccupancyForecastChart } from "@/components/charts/occupancy-forecast-chart";
import { Button } from "@/components/ui/button";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { RangeMeter } from "@/components/ui/range-meter";
import { SectionTabs } from "@/components/ui/section-tabs";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  revenueApi,
  property,
  actionCardsApi,
  type ActionCardDetail,
  type BackendRoomCategory,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "categories", label: "Room Categories" },
  { value: "competitors", label: "Competitor Rates" },
  { value: "demand", label: "Demand Calendar" },
  { value: "reports", label: "Reports" },
] as const;

type Tab = (typeof TABS)[number]["value"];
const SOLD_OUT_THRESHOLD = 95;

export default function RateManagementPage() {

  const [tab, setTab] = useState<Tab>("overview");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

  // 1. Live revenue forecast (30 days)
  const {
    data: forecastData = [],
    isLoading: forecastLoading,
    isError: forecastError,
  } = useQuery<any[]>({
    queryKey: ["revenue-forecast-30"],
    queryFn: () => revenueApi.forecast(30),
    staleTime: 60_000,
  });

  // 2. Live Room Categories
  const { data: categories = [], isLoading: catLoading } = useQuery<
    BackendRoomCategory[]
  >({
    queryKey: ["room-categories"],
    queryFn: () => property.roomCategories(),
    staleTime: 300_000,
  });

  // 3. Live Revenue Action Cards (Recommendations)
  const { data: actionCards = [], isLoading: cardsLoading } = useQuery<
    ActionCardDetail[]
  >({
    queryKey: ["revenue-action-cards"],
    queryFn: () => actionCardsApi.list({ kind: "rate_change", limit: 3 }),
  });

  // 4. Competitor rates (if available from scraper)
  const { data: competitorData = [], isLoading: compLoading } = useQuery<any[]>({
    queryKey: ["revenue-competitors"],
    queryFn: () => revenueApi.competitors(14),
    staleTime: 120_000,
  });

  const topRecommendation = actionCards[0];

  const forecastPoints = forecastData.map((row) => ({
    date: new Date(`${row.stay_date}T00:00:00`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    }),
    occupancy: Math.round(row.predicted_occupancy * 100),
    range: [
      Math.round(row.lower_bound * 100),
      Math.round(row.upper_bound * 100),
    ] as [number, number],
  }));

  const visibleCategories =
    selectedCategoryId === "all"
      ? categories
      : categories.filter((c) => c.id === selectedCategoryId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue & Rate Management"
        description="Dynamic rate optimization, occupancy forecasting, and channel parity governance."
      />

      <SectionTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
            {/* Occupancy Forecast */}
            <Panel>
              <PanelHeader
                title="30-Day Occupancy Forecast"
                description="Projected demand from revenue optimization model"
                action={
                  <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-sand-600">
                    <span className="flex items-center gap-1.5">
                      <span className="h-0.5 w-5 rounded-full bg-forest-600" />
                      Forecast
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-5 rounded-sm bg-sand-200" />
                      Confidence range
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-0 w-5 border-t-2 border-dashed border-gold-500" />
                      Sold-out ({SOLD_OUT_THRESHOLD}%)
                    </span>
                  </div>
                }
              />
              <PanelBody className="pt-4">
                {forecastLoading ? (
                  <p role="status" className="py-12 text-center text-sm text-sand-500">
                    Loading forecast curve…
                  </p>
                ) : forecastPoints.length > 0 ? (
                  <OccupancyForecastChart
                    data={forecastPoints}
                    height={300}
                    threshold={{
                      value: SOLD_OUT_THRESHOLD,
                      label: `${SOLD_OUT_THRESHOLD}% (Sold-out threshold)`,
                    }}
                  />
                ) : (
                  <div className="py-16 text-center text-sm text-sand-500">
                    <p className="font-semibold text-sand-800">No Forecast Available</p>
                    <p className="text-xs text-sand-400 mt-1">
                      Revenue engine did not return 30-day forecast points.
                    </p>
                  </div>
                )}
              </PanelBody>
            </Panel>

            {/* Rate recommendation */}
            <Panel className="flex flex-col">
              <PanelHeader
                title="Rate Recommendation"
                description={
                  topRecommendation
                    ? topRecommendation.title
                    : "Live pricing optimization engine"
                }
                action={
                  topRecommendation && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-200 bg-gold-50 px-2.5 py-0.5 text-xs font-medium text-gold-800">
                      <TrendingUp className="h-3 w-3" />
                      {topRecommendation.urgency.toUpperCase()}
                    </span>
                  )
                }
              />

              <PanelBody className="flex-1 space-y-4 pt-4">
                {cardsLoading ? (
                  <p role="status" className="py-8 text-center text-sm text-sand-500">
                    Checking pricing recommendations…
                  </p>
                ) : !topRecommendation ? (
                  <div className="py-12 text-center text-sm text-sand-500">
                    <p className="font-semibold text-sand-800">Rates Optimized</p>
                    <p className="text-xs text-sand-400 mt-1">
                      Current CRS rate cards match demand curve. No pricing adjustments recommended.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-sand-200 bg-white p-4">
                      <p className="text-xs text-sand-600">Model Recommendation</p>
                      <p className="mt-1 font-sans text-sm text-sand-900">
                        {topRecommendation.summary}
                      </p>
                      {topRecommendation.impact_amount !== undefined && (
                        <p className="mt-2 text-xs font-semibold text-emerald-700">
                          Estimated Revenue Impact: +₹{topRecommendation.impact_amount.toLocaleString("en-IN")}
                        </p>
                      )}
                    </div>

                    <div className="border-t border-sand-200/80 pt-4">
                      <p className="text-xs text-sand-500">
                        Confidence: {Math.round(topRecommendation.confidence * 100)}%
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Link href="/admin/actions" className="w-full rounded-lg bg-sage-700 px-3 py-2 text-center text-sm font-medium text-white">
                        Review in Action Queue
                      </Link>
                    </div>
                  </>
                )}
              </PanelBody>
            </Panel>
          </div>
        </div>
      )}

      {tab === "categories" && (
        <Panel>
          <PanelHeader
            title="Room Categories & Base Tariffs"
            description="Inventory capacity and baseline rack rates configured in the backend property service."
          />
          <PanelBody className="pt-4">
            {catLoading ? (
              <p role="status" className="py-12 text-center text-sm text-sand-500">
                Loading room categories…
              </p>
            ) : categories.length === 0 ? (
              <p className="py-12 text-center text-sm text-sand-500">
                No room categories configured.
              </p>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Category</TH>
                    <TH>Code</TH>
                    <TH align="right">Max guests</TH>
                    <TH align="right">Base Rack Rate</TH>
                    <TH>Description</TH>
                  </tr>
                </THead>
                <TBody>
                  {categories.map((cat) => (
                    <TR key={cat.id}>
                      <TD className="font-semibold text-sand-950">{cat.name}</TD>
                      <TD className="font-mono text-xs text-sand-600">{cat.key}</TD>
                      <TD align="right" className="font-semibold text-sand-800">
                        {cat.max_occupancy}
                      </TD>
                      <TD align="right" className="font-semibold text-emerald-700">
                        ₹{Number(cat.base_rate).toLocaleString("en-IN")}
                      </TD>
                      <TD className="text-xs text-sand-600 line-clamp-1">
                        {cat.amenities.join(", ") || "—"}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </PanelBody>
        </Panel>
      )}

      {tab === "competitors" && (
        <Panel>
          <PanelHeader
            title="Market Competitor Telemetry"
            description="External hotel rate comparison from automated scrapers."
          />
          <PanelBody className="pt-4">
            {compLoading ? (
              <p role="status" className="py-12 text-center text-sm text-sand-500">
                Querying competitor rate channels…
              </p>
            ) : competitorData.length === 0 ? (
              <div className="py-16 text-center text-sm text-sand-500">
                <p className="font-semibold text-sand-800">Competitor Telemetry Offline</p>
                <p className="text-xs text-sand-400 mt-1 max-w-md mx-auto">
                  Market parity crawler has no cached competitor quotes for the current window.
                </p>
              </div>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Property</TH>
                    <TH align="right">Current Rate</TH>
                    <TH align="right">Weekend Rate</TH>
                  </tr>
                </THead>
                <TBody>
                  {competitorData.map((row, idx) => (
                    <TR key={idx}>
                      <TD className="font-medium text-sand-900">{row.hotel ?? row.name}</TD>
                      <TD align="right" className="text-sand-700">
                        ₹{row.current_rate?.toLocaleString("en-IN") ?? "—"}
                      </TD>
                      <TD align="right" className="text-sand-700">
                        ₹{row.weekend_rate?.toLocaleString("en-IN") ?? "—"}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </PanelBody>
        </Panel>
      )}

      {tab === "demand" && (
        <Panel>
          <PanelHeader
            title="Demand Calendar"
            description="Forecasted occupancy rates for the upcoming 30 days."
          />
          <PanelBody className="pt-4">
            {forecastPoints.length === 0 ? (
              <p className="py-12 text-center text-sm text-sand-500">
                No demand calendar points loaded.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
                {forecastPoints.map((point) => {
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
            )}
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
              <h3 className="font-serif text-lg font-semibold text-sand-950">
                Detailed Revenue Reports
              </h3>
              <p className="mt-1 text-sm text-sand-600">
                Historical pace reports and yield variance summaries require at least 60 days of consecutive operational logs.
              </p>
            </div>
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}
