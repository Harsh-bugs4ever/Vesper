"use client";

import React, { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  IndianRupee,
  Info,
  Radio,
  Users,
  Zap,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { DepartmentRevenueDonut } from "@/components/charts/department-revenue-donut";
import { OccupancyForecastChart } from "@/components/charts/occupancy-forecast-chart";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { PeriodSelect } from "@/components/ui/period-select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatLakh } from "@/lib/chart-theme";
import {
  kpiTrends,
  liveActivity,
  occupancyForecast,
  revenueByDepartment,
  systemAlerts,
  topRoomCategories,
  type SystemAlert,
} from "@/lib/demo/dashboard";
import { StatTile } from "@/components/ui/stat-tile";
import { cn } from "@/lib/utils";

const PERIODS = ["This Month", "Last Month", "This Quarter"] as const;


/** "Good morning" before noon, "Good afternoon" until 5, "Good evening" after. */
function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [revenuePeriod, setRevenuePeriod] = useState<string>(PERIODS[0]);
  const [categoryPeriod, setCategoryPeriod] = useState<string>(PERIODS[0]);
  const [activeRightTab, setActiveRightTab] = useState<"feed" | "alerts">("feed");
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  // Rendered client-side, so "today" is the viewer's today — correct for a duty manager
  // reading this at the desk, which is the only place this screen is used.
  const today = new Date();
  const firstName = user.name.split(" ")[0];
  const activeAlerts = systemAlerts.filter((a) => !dismissedAlerts.includes(a.id));


  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greetingFor(today)}, ${firstName}`}
        description={`Here's what's happening at ${user.propertyName} today.`}
        meta={format(today, "EEE, d MMM yyyy")}
      />

      {/* Today at a glance */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Occupancy Rate"
          value="78%"
          change="+6%"
          comparison="vs. last week"
          tone="sage"
          icon={Users}
          trend={[...kpiTrends.occupancy]}
        />
        <StatTile
          label="Average Daily Rate (ADR)"
          value="₹9,400"
          change="+8%"
          comparison="vs. last week"
          tone="sand"
          icon={BedDouble}
          trend={[...kpiTrends.adr]}
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
          label="Open Requests"
          value="12"
          change="+3"
          comparison="vs. yesterday"
          direction="up"
          intent="bad"
          tone="rose"
          icon={ClipboardList}
          trend={[...kpiTrends.requests]}
        />
      </div>

      {/* AI Action Queue Highlight Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gold-200/80 bg-gradient-to-r from-gold-50/80 via-white to-sage-50/40 p-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500 text-white shadow-xs">
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-serif text-base font-semibold text-sand-950">
                AI Action Queue · 5 Pending Suggestions
              </span>
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                2 High Urgency
              </span>
            </div>
            <p className="text-xs text-sand-600">
              Weekend rate surge (+₹42k) and Chiller 2 predictive maintenance recommended today.
            </p>
          </div>
        </div>

        <Link
          href="/admin/actions"
          className="flex items-center gap-1.5 rounded-xl bg-sand-900 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-sand-800"
        >
          Review in Action Queue
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Forecast, then the two breakdowns beneath it */}
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <PanelHeader
              title="Occupancy Forecast"
              description="Expected occupancy for the next 14 days"
              action={
                <div className="flex items-center gap-4 pt-1 text-xs text-sand-600">
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-5 rounded-full bg-forest-600" />
                    Forecast
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-5 rounded-sm bg-sand-200" />
                    Confidence range
                  </span>
                </div>
              }
            />
            <PanelBody className="pt-4">
              <OccupancyForecastChart data={occupancyForecast} />
            </PanelBody>
          </Panel>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Panel>
              <PanelHeader
                title="Revenue by Department"
                action={
                  <PeriodSelect value={revenuePeriod} onChange={setRevenuePeriod} options={PERIODS} />
                }
              />
              <PanelBody className="pt-4">
                <DepartmentRevenueDonut data={revenueByDepartment} />
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                title="Top Room Categories"
                action={
                  <PeriodSelect value={categoryPeriod} onChange={setCategoryPeriod} options={PERIODS} />
                }
              />
              <PanelBody className="pt-4">
                <Table>
                  <THead>
                    <tr>
                      <TH>Room Category</TH>
                      <TH align="right">Occupancy</TH>
                      <TH align="right">ADR</TH>
                      <TH align="right">Revenue</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {topRoomCategories.map((row) => (
                      <TR key={row.category}>
                        <TD className="font-medium text-sand-900">{row.category}</TD>
                        <TD align="right">{row.occupancy}%</TD>
                        <TD align="right">₹{row.adr.toLocaleString("en-IN")}</TD>
                        <TD align="right">{formatLakh(row.revenue)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </PanelBody>
            </Panel>
          </div>
        </div>

        {/* Live activity & Operational alerts */}
        <Panel className="flex flex-col">
          <div className="flex items-center justify-between border-b border-sand-200/80 px-4 pt-3 pb-2.5">
            <div className="flex items-center gap-1 bg-sand-100/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveRightTab("feed")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                  activeRightTab === "feed"
                    ? "bg-white text-sand-950 shadow-xs"
                    : "text-sand-600 hover:text-sand-900"
                )}
              >
                <Radio className="h-3.5 w-3.5 text-sage-600" />
                Live Feed
              </button>
              <button
                type="button"
                onClick={() => setActiveRightTab("alerts")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                  activeRightTab === "alerts"
                    ? "bg-white text-sand-950 shadow-xs"
                    : "text-sand-600 hover:text-sand-900"
                )}
              >
                <Bell className="h-3.5 w-3.5 text-rose-600" />
                Alerts
                {activeAlerts.length > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                    {activeAlerts.length}
                  </span>
                )}
              </button>
            </div>

            {activeRightTab === "feed" ? (
              <Link
                href="/admin/requests"
                className="flex items-center gap-1 text-xs font-medium text-sage-700 transition-colors hover:text-sage-900"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <span className="text-[11px] text-sand-500 font-medium">Real-time IoT & AI</span>
            )}
          </div>

          <PanelBody className="flex-1 pt-4">
            {activeRightTab === "feed" ? (
              <ActivityFeed items={liveActivity} />
            ) : (
              <div className="space-y-3">
                {activeAlerts.length === 0 ? (
                  <div className="py-12 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                    <p className="mt-2 text-sm font-semibold text-sand-900">All systems optimal</p>
                    <p className="text-xs text-sand-500">No active alerts requiring attention.</p>
                  </div>
                ) : (
                  activeAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        "rounded-xl border p-3.5 transition-all",
                        alert.level === "critical" && "border-rose-200 bg-rose-50/50",
                        alert.level === "warning" && "border-amber-200 bg-amber-50/50",
                        alert.level === "info" && "border-blue-200 bg-blue-50/50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {alert.level === "critical" && <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />}
                          {alert.level === "warning" && <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />}
                          {alert.level === "info" && <Info className="h-4 w-4 text-blue-600 shrink-0" />}
                          <span className="font-serif text-sm font-semibold text-sand-950">
                            {alert.title}
                          </span>
                        </div>
                        <span className="text-[11px] text-sand-500 shrink-0">{alert.time}</span>
                      </div>
                      <p className="mt-1.5 text-xs text-sand-700 leading-relaxed">{alert.detail}</p>
                      <div className="mt-2.5 flex items-center justify-between border-t border-sand-200/50 pt-2 text-[11px]">
                        <span className="rounded bg-sand-200/60 px-1.5 py-0.5 font-mono text-[10px] text-sand-700">
                          {alert.source}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDismissedAlerts((prev) => [...prev, alert.id])}
                            className="text-sand-500 hover:text-sand-700 font-medium"
                          >
                            Dismiss
                          </button>
                          {alert.actionUrl && (
                            <Link
                              href={alert.actionUrl}
                              className="font-semibold text-sage-800 hover:text-sage-950 flex items-center gap-0.5"
                            >
                              {alert.actionLabel || "Review"}
                              <ChevronRight className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
