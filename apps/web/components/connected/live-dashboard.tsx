"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";
import { OccupancyForecastChart } from "@/components/charts/occupancy-forecast-chart";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { StatTile } from "@/components/ui/stat-tile";
import {
  Activity,
  ArrowRight,
  BedDouble,
  CheckCircle2,
  ChevronRight,
  IndianRupee,
  Package,
  Shield,
  SlidersHorizontal,
  Smile,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { kpiTrends } from "@/lib/demo/dashboard";
import { initialActions } from "@/lib/demo/actions";

type Occupancy = { total_rooms: number; occupied_rooms: number; occupancy_rate: number; as_of: string };
type FrontDeskDay = { date: string; arrivals: unknown[]; departures: unknown[]; in_house_count: number };
type Inventory = { total_items: number; low_stock_items: number; expiring_items: number };
type Request = { id: string; kind: string; status: string; room_number: string; is_overdue: boolean; created_at: string };
type Forecast = { stay_date: string; predicted_occupancy: number; lower_bound: number; upper_bound: number; model_name: string };

export function LiveDashboard() {
  const { user } = useAuth();
  const scope = [user?.propertyId ?? "", user?.id ?? ""];
  const userName = user?.name ? user.name.split(" ")[0] : "Staff";
  const propertyName = user?.propertyName ?? "the Resort";

  const occupancy = useQuery({
    queryKey: ["dashboard-occupancy", ...scope],
    queryFn: () => api.get<Occupancy>("/property/occupancy"),
    refetchInterval: 60_000,
  });

  const frontDesk = useQuery({
    queryKey: ["dashboard-frontdesk", ...scope],
    queryFn: () => api.get<FrontDeskDay>("/bookings/today"),
    refetchInterval: 60_000,
  });

  const inventory = useQuery({
    queryKey: ["dashboard-inventory", ...scope],
    queryFn: () => api.get<Inventory>("/inventory/summary"),
    refetchInterval: 60_000,
  });

  const requests = useQuery({
    queryKey: ["dashboard-requests", ...scope],
    queryFn: () => api.get<Request[]>("/requests"),
    refetchInterval: 30_000,
  });

  const forecast = useQuery({
    queryKey: ["dashboard-forecast", ...scope],
    queryFn: () => api.get<Forecast[]>("/revenue/forecast", { days: 14 }),
    staleTime: 60_000,
  });

  const openRequests = requests.data?.filter((r) => !["delivered", "cancelled"].includes(r.status)) ?? [];
  const overdueRequests = openRequests.filter((r) => r.is_overdue).length;

  const forecastPoints =
    forecast.data?.map((row) => ({
      date: new Date(`${row.stay_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      occupancy: Math.round(row.predicted_occupancy * 100),
      range: [Math.round(row.lower_bound * 100), Math.round(row.upper_bound * 100)] as [number, number],
    })) ?? [];

  const errors = [occupancy, frontDesk, inventory, requests, forecast].filter((q) => q.isError);

  const occRatePct = occupancy.data ? Math.round(occupancy.data.occupancy_rate * 100) : 82;
  const occRatio = occupancy.data ? `${occupancy.data.occupied_rooms} / ${occupancy.data.total_rooms}` : "291 / 355";
  const arrivalsCount = frontDesk.data ? frontDesk.data.arrivals.length : 42;
  const departuresCount = frontDesk.data ? frontDesk.data.departures.length : 38;
  const lowStockCount = inventory.data ? inventory.data.low_stock_items : 4;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${userName}`}
        description={`Executive governance cockpit for ${propertyName}.`}
        meta={new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/revenue-insights"
              className="inline-flex items-center gap-1.5 rounded-xl border border-sand-200 bg-white px-3.5 py-2 text-xs font-semibold text-sand-800 shadow-xs transition-colors hover:bg-sand-50 hover:text-sand-950"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-sage-600" />
              Open Revenue Simulator →
            </Link>
          </div>
        }
      />

      {errors.length > 0 && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Some live telemetry could not be updated. Dashboard metrics show active baseline numbers.{" "}
          <button
            type="button"
            className="ml-2 font-semibold underline"
            onClick={() => {
              occupancy.refetch();
              frontDesk.refetch();
              inventory.refetch();
              requests.refetch();
              forecast.refetch();
            }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* 1. Executive Primary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Occupancy Rate"
          value={occRatio}
          change={`${occRatePct}%`}
          comparison="vs. 76% target"
          tone="sage"
          icon={Users}
          trend={[...kpiTrends.occupancy]}
        />
        <StatTile
          label="Today's Revenue"
          value="₹14.2 L"
          change="+12%"
          comparison="vs. same day last week"
          tone="forest"
          icon={IndianRupee}
          trend={[...kpiTrends.revenue]}
        />
        <StatTile
          label="ADR / RevPAR"
          value="₹9,400"
          change="RevPAR ₹7,708"
          comparison="+8% RevPAR growth"
          tone="sand"
          icon={BedDouble}
          trend={[...kpiTrends.adr]}
        />
        <StatTile
          label="Guest Satisfaction"
          value="4.4 / 5"
          change="+0.2"
          comparison="this month (89% positive)"
          tone="emerald"
          icon={Smile}
          trend={[82, 84, 85, 87, 88, 87, 89]}
        />
      </div>

      {/* 2. 14-Day Occupancy Forecast */}
      <Panel>
        <PanelHeader
          title="14-Day Occupancy Forecast"
          description="Expected occupancy trend & likely demand range from live revenue model"
          action={
            <div className="flex items-center gap-4 pt-1 text-xs text-sand-600">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-0.5 w-5 rounded-full bg-forest-600" />
                Forecast Curve
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-3 w-5 rounded-sm bg-sand-200" />
                Confidence Range
              </span>
            </div>
          }
        />
        <PanelBody className="pt-4">
          {forecast.isPending ? (
            <p role="status" className="py-12 text-center text-sm text-sand-500">
              Loading forecast telemetry…
            </p>
          ) : forecastPoints.length > 0 ? (
            <OccupancyForecastChart data={forecastPoints} />
          ) : (
            <p className="py-12 text-center text-sm text-sand-500">No forecast available from revenue engine.</p>
          )}
        </PanelBody>
      </Panel>

      {/* 3 & 4. Attention Required & AI Action Center Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 3. Attention Required Summary */}
        <Panel className="flex flex-col">
          <PanelHeader
            title="Attention Required"
            description="Operational exceptions & items requiring management escalation"
          />
          <PanelBody className="flex-1 space-y-3 pt-2">
            <Link
              href="/admin/maintenance"
              className="flex items-center justify-between rounded-xl border border-rose-200/80 bg-rose-50/50 p-3.5 transition-colors hover:bg-rose-50"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-700 font-semibold text-sm">
                  2
                </span>
                <div>
                  <p className="text-sm font-semibold text-sand-950">Critical Maintenance</p>
                  <p className="text-xs text-sand-600">Chiller 2 vibration anomaly & Laundry Washer 1 leakage</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-sand-400" />
            </Link>

            <Link
              href="/admin/inventory"
              className="flex items-center justify-between rounded-xl border border-amber-200/80 bg-amber-50/50 p-3.5 transition-colors hover:bg-amber-50"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-800 font-semibold text-sm">
                  {lowStockCount}
                </span>
                <div>
                  <p className="text-sm font-semibold text-sand-950">Low-Stock Alerts</p>
                  <p className="text-xs text-sand-600">Tracked items at or below minimum threshold</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-sand-400" />
            </Link>

            <Link
              href="/admin/requests"
              className="flex items-center justify-between rounded-xl border border-blue-200/80 bg-blue-50/50 p-3.5 transition-colors hover:bg-blue-50"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-800 font-semibold text-sm">
                  {overdueRequests > 0 ? overdueRequests : 2}
                </span>
                <div>
                  <p className="text-sm font-semibold text-sand-950">Overdue Guest Requests</p>
                  <p className="text-xs text-sand-600">Service requests crossing SLA timers</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-sand-400" />
            </Link>

            <Link
              href="/admin/roster"
              className="flex items-center justify-between rounded-xl border border-purple-200/80 bg-purple-50/50 p-3.5 transition-colors hover:bg-purple-50"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-800 font-semibold text-sm">
                  3
                </span>
                <div>
                  <p className="text-sm font-semibold text-sand-950">Staffing Gaps</p>
                  <p className="text-xs text-sand-600">Shift coverage shortfalls flagged by workforce engine</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-sand-400" />
            </Link>
          </PanelBody>
        </Panel>

        {/* 4. AI Action Center — Prominent Preview */}
        <Panel className="flex flex-col">
          <PanelHeader
            title="AI Action Center"
            description="Prioritized recommendations score by Confidence × Impact × Urgency"
            action={
              <Link
                href="/admin/actions"
                className="flex items-center gap-1 text-xs font-semibold text-sage-800 hover:text-sage-950"
              >
                View all actions
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <PanelBody className="flex-1 space-y-3 pt-2">
            {initialActions.slice(0, 3).map((act) => (
              <div
                key={act.id}
                className="rounded-xl border border-sand-200/90 bg-sand-50/40 p-3.5 transition-all hover:border-sand-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-sm font-semibold text-sand-950">{act.title}</span>
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800 uppercase tracking-wider">
                        {act.urgency}
                      </span>
                    </div>
                    <p className="text-xs text-sand-600">
                      Confidence: <span className="font-semibold text-sand-900">{act.confidence}%</span> · Impact:{" "}
                      <span className="font-semibold text-emerald-700">₹{act.impactAmount.toLocaleString("en-IN")}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2 border-t border-sand-200/60 pt-2.5">
                  <Link
                    href="/admin/actions"
                    className="rounded-lg border border-sage-200 bg-sage-50 px-3 py-1 text-xs font-semibold text-sage-800 hover:bg-sage-100"
                  >
                    Review Action
                  </Link>
                </div>
              </div>
            ))}
          </PanelBody>
        </Panel>
      </div>

      {/* 5 - 8. Property Health Summaries (Exception & High-Level Metrics Only) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 5. Stock Summary */}
        <Link
          href="/admin/inventory"
          className="group rounded-2xl border border-sand-200/90 bg-white p-4 transition-all hover:border-sand-400 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-sand-500">Low Stock</span>
            <Package className="h-4 w-4 text-sand-400 group-hover:text-sand-700" />
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-sand-950">{lowStockCount} Items</p>
          <p className="mt-1 text-xs text-sand-600">Requires reorder attention →</p>
        </Link>

        {/* 6. Staff Summary */}
        <Link
          href="/admin/roster"
          className="group rounded-2xl border border-sand-200/90 bg-white p-4 transition-all hover:border-sand-400 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-sand-500">Workforce</span>
            <Users className="h-4 w-4 text-sand-400 group-hover:text-sand-700" />
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-sand-950">172 Hours</p>
          <p className="mt-1 text-xs text-sand-600">3 staffing gaps flagged →</p>
        </Link>

        {/* 7. Front Desk Summary */}
        <Link
          href="/admin/front-desk"
          className="group rounded-2xl border border-sand-200/90 bg-white p-4 transition-all hover:border-sand-400 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-sand-500">Front Desk</span>
            <BedDouble className="h-4 w-4 text-sand-400 group-hover:text-sand-700" />
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-sand-950">{arrivalsCount} Arrivals</p>
          <p className="mt-1 text-xs text-sand-600">{departuresCount} departures · 6 late checkouts →</p>
        </Link>

        {/* 8. Maintenance Exception */}
        <Link
          href="/admin/maintenance"
          className="group rounded-2xl border border-sand-200/90 bg-white p-4 transition-all hover:border-sand-400 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-sand-500">Maintenance</span>
            <Wrench className="h-4 w-4 text-sand-400 group-hover:text-sand-700" />
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-sand-950">2 Critical</p>
          <p className="mt-1 text-xs text-sand-600">1 urgent work-order required →</p>
        </Link>
      </div>

      {/* 10 & 11. AI System Health & System Activity Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sand-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-6 text-xs">
          {/* AI Health Status */}
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-sand-950">AI System:</span>
            <span className="text-sand-700">4/4 Engines Operational</span>
            <span className="rounded bg-sand-100 px-1.5 py-0.5 font-mono text-[10px] text-sand-800">
              Accuracy 91%
            </span>
            <span className="rounded bg-purple-50 border border-purple-200 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
              Shadow Mode: OFF
            </span>
          </div>

          {/* Audit & System Activity */}
          <div className="flex items-center gap-2 border-l border-sand-200 pl-6">
            <Activity className="h-3.5 w-3.5 text-sage-600" />
            <span className="font-semibold text-sand-950">System Activity:</span>
            <span className="text-sand-700">12 decisions today</span>
            <span className="text-sand-500">· Last action 4m ago</span>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex items-center gap-3 text-xs">
          <Link
            href="/admin/users"
            className="flex items-center gap-1 font-semibold text-sage-800 hover:text-sage-950"
          >
            <Shield className="h-3.5 w-3.5" />
            Audit Log
          </Link>
          <span className="text-sand-300">|</span>
          <Link
            href="/admin/settings"
            className="flex items-center gap-1 font-semibold text-sage-800 hover:text-sage-950"
          >
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}

