"use client";

import React, { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, BedDouble, ClipboardList, IndianRupee, Users } from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { DepartmentRevenueDonut } from "@/components/charts/department-revenue-donut";
import { OccupancyForecastChart } from "@/components/charts/occupancy-forecast-chart";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { PeriodSelect } from "@/components/ui/period-select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { chartColors, formatLakh } from "@/lib/chart-theme";
import {
  kpiTrends,
  liveActivity,
  occupancyForecast,
  revenueByDepartment,
  topRoomCategories,
} from "@/lib/demo/dashboard";
import { StatTile } from "@/components/ui/stat-tile";

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

  // Rendered client-side, so "today" is the viewer's today — correct for a duty manager
  // reading this at the desk, which is the only place this screen is used.
  const today = new Date();
  const firstName = user.name.split(" ")[0];

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

        {/* Live activity runs the full height of the right column */}
        <Panel className="flex flex-col">
          <PanelHeader
            title="Live Activity"
            action={
              <Link
                href="/admin/requests"
                className="flex items-center gap-1 pt-1 text-xs font-medium text-sage-700 transition-colors hover:text-sage-900"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <PanelBody className="flex-1 pt-4">
            <ActivityFeed items={liveActivity} />
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
