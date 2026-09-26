"use client";

import React, { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BedDouble,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  IndianRupee,
  Package,
  Shield,
  SlidersHorizontal,
  Smile,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { LiveDashboard } from "@/components/connected/live-dashboard";
import { OccupancyForecastChart } from "@/components/charts/occupancy-forecast-chart";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { StatTile } from "@/components/ui/stat-tile";
import { occupancyForecast, kpiTrends } from "@/lib/demo/dashboard";
import { initialActions, type ActionItem } from "@/lib/demo/actions";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/** "Good morning" before noon, "Good afternoon" until 5, "Good evening" after. */
function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function AdminDashboardPage() {
  const { isConnected } = useAuth();
  return isConnected ? <LiveDashboard /> : <DemoDashboardPage />;
}

function DemoDashboardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [actions, setActions] = useState<ActionItem[]>(initialActions.slice(0, 3));

  const today = new Date();
  const firstName = user?.name ? user.name.split(" ")[0] : "Manager";

  const handleAction = (id: string, type: "approve" | "dismiss") => {
    const act = actions.find((a) => a.id === id);
    setActions((prev) => prev.filter((a) => a.id !== id));
    if (act) {
      showToast({
        title: type === "approve" ? `Approved: ${act.title}` : `Dismissed Action`,
        description:
          type === "approve"
            ? `Recommendation applied. Safe undo window open for 10s.`
            : `Logged to AI training feedback loop.`,
        type: type === "approve" ? "success" : "default",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Strategy Actions */}
      <PageHeader
        title={`${greetingFor(today)}, ${firstName}`}
        description={`Executive governance cockpit for ${user?.propertyName ?? "the Resort"}.`}
        meta={format(today, "EEE, d MMM yyyy")}
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

      {/* 1. Primary Executive KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Occupancy Rate"
          value="291 / 355"
          change="82%"
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
          description="Expected occupancy trend & likely demand range across the next two weeks"
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
          <OccupancyForecastChart data={occupancyForecast} />
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
                  4
                </span>
                <div>
                  <p className="text-sm font-semibold text-sand-950">Low-Stock Alerts</p>
                  <p className="text-xs text-sand-600">Basmati Rice, Olive Oil, Toiletries, Linen Detergent below minimum</p>
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
                  2
                </span>
                <div>
                  <p className="text-sm font-semibold text-sand-950">Overdue Guest Requests</p>
                  <p className="text-xs text-sand-600">Room 304 extra towels & Room 512 AC inspection past SLA</p>
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
                  <p className="text-xs text-sand-600">Sunday peak checkout shift housekeeping coverage short by 2</p>
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
            {actions.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                <p className="mt-2 text-sm font-semibold text-sand-900">Action Queue Clear</p>
                <p className="text-xs text-sand-500">All high-priority recommendations have been addressed.</p>
              </div>
            ) : (
              actions.map((act) => (
                <div
                  key={act.id}
                  className="rounded-xl border border-sand-200/90 bg-sand-50/40 p-3.5 transition-all hover:border-sand-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-sm font-semibold text-sand-950">{act.title}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            act.urgency === "high"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          )}
                        >
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
                    <button
                      type="button"
                      onClick={() => handleAction(act.id, "dismiss")}
                      className="rounded-lg border border-sand-200 bg-white px-2.5 py-1 text-xs font-medium text-sand-600 hover:bg-sand-50 hover:text-sand-900"
                    >
                      Dismiss
                    </button>
                    <Link
                      href="/admin/actions"
                      className="rounded-lg border border-sage-200 bg-sage-50 px-2.5 py-1 text-xs font-semibold text-sage-800 hover:bg-sage-100"
                    >
                      Review
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleAction(act.id, "approve")}
                      className="rounded-lg bg-sand-900 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-sand-800"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))
            )}
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
          <p className="mt-2 font-serif text-2xl font-bold text-sand-950">4 Items</p>
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
          <p className="mt-2 font-serif text-2xl font-bold text-sand-950">42 Arrivals</p>
          <p className="mt-1 text-xs text-sand-600">38 departures · 6 late checkouts →</p>
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

