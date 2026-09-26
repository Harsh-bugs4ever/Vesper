"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";
import { CalendarCheck, CalendarDays, IndianRupee, PercentCircle, RefreshCw } from "lucide-react";

import { ArrivalsDeparturesChart, type MovementPoint } from "@/components/charts/arrivals-departures-chart";
import { OccupancyForecastChart } from "@/components/charts/occupancy-forecast-chart";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { bookingStateMeta } from "@/lib/config/frontdesk-ui";
import { cn } from "@/lib/utils";

interface BookingOut {
  id: string;
  reference: string;
  guest_id: string;
  room_category_id: string;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  total_amount: number;
  source: string;
  status: string;
}

interface ForecastOut {
  stay_date: string;
  predicted_occupancy: number;
  lower_bound: number;
  upper_bound: number;
  model_name: string;
}

const SOURCES = ["All sources", "Direct", "OTA", "Corporate", "Walk-in"] as const;
type Source = (typeof SOURCES)[number];

function sourceBucket(source: string): Source {
  if (source.toLowerCase().includes("direct")) return "Direct";
  if (source.toLowerCase().includes("corporate")) return "Corporate";
  if (source.toLowerCase().includes("walk")) return "Walk-in";
  return "OTA";
}

export default function ReservationsPage() {
  const { isConnected } = useAuth();
  const [source, setSource] = useState<Source>("All sources");

  const bookingsQuery = useQuery({
    queryKey: ["reservations-bookings"],
    queryFn: () => api.get<BookingOut[]>("/bookings"),
    enabled: isConnected,
  });

  const forecastQuery = useQuery({
    queryKey: ["reservations-forecast"],
    queryFn: () => api.get<ForecastOut[]>("/revenue/forecast", { days: 14 }),
    enabled: isConnected,
  });

  const visible = useMemo(
    () =>
      source === "All sources"
        ? (bookingsQuery.data ?? [])
        : (bookingsQuery.data ?? []).filter((b) => sourceBucket(b.source) === source),
    [source, bookingsQuery.data]
  );

  const bookedValue = visible.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
  const totalBookingsCount = visible.length;

  const forecastPoints = useMemo(() => {
    return (forecastQuery.data ?? []).map((f) => ({
      date: new Date(`${f.stay_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      occupancy: Math.round(f.predicted_occupancy * 100),
      range: [Math.round(f.lower_bound * 100), Math.round(f.upper_bound * 100)] as [number, number],
    }));
  }, [forecastQuery.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations & Demand Pace"
        description="Bookings ledger, revenue value, and 14-day demand forecast."
        actions={
          <button
            onClick={() => {
              bookingsQuery.refetch();
              forecastQuery.refetch();
            }}
            className="rounded-xl border border-sand-200 bg-white p-2 text-sand-600 hover:bg-sand-50"
            title="Refresh Ledger"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          variant="value-first"
          label="Booked Revenue"
          value={`₹${bookedValue.toLocaleString("en-IN")}`}
          change="Total active value"
          tone="sage"
          icon={IndianRupee}
        />
        <StatTile
          variant="value-first"
          label="Active Bookings"
          value={totalBookingsCount}
          change="System reservations"
          tone="sand"
          icon={CalendarCheck}
        />
        <StatTile
          variant="value-first"
          label="Forecast Days"
          value={forecastPoints.length}
          change="14-day ML horizon"
          tone="forest"
          icon={CalendarDays}
        />
        <StatTile
          variant="value-first"
          label="Filtered Ledger"
          value={source}
          change={`${visible.length} entries`}
          tone="gold"
          icon={PercentCircle}
        />
      </div>

      {/* Demand Forecast Chart */}
      <Panel>
        <PanelHeader
          title="14-Day Demand Forecast"
          description="Predicted occupancy bounds calculated by revenue engine."
        />
        <PanelBody className="pt-4">
          {forecastQuery.isPending ? (
            <p className="py-12 text-center text-xs text-sand-500">Loading forecast data…</p>
          ) : forecastPoints.length === 0 ? (
            <p className="py-12 text-center text-xs text-sand-500">No demand forecast model available.</p>
          ) : (
            <OccupancyForecastChart data={forecastPoints} />
          )}
        </PanelBody>
      </Panel>

      {/* Bookings Table */}
      <Panel>
        <PanelHeader
          title="Reservations Ledger"
          description="Filter by booking channel or source."
          action={
            <FilterChips
              options={SOURCES.map((s) => ({ value: s, label: s }))}
              value={source}
              onChange={(val) => setSource(val as Source)}
            />
          }
        />
        <PanelBody>
          <Table>
            <THead>
              <tr>
                <TH>Reference</TH>
                <TH>Check In</TH>
                <TH>Check Out</TH>
                <TH>Source</TH>
                <TH align="right">Amount</TH>
                <TH align="right">Status</TH>
              </tr>
            </THead>
            <TBody>
              {bookingsQuery.isPending ? (
                <TR><TD colSpan={6} className="py-8 text-center text-xs text-sand-500">Loading reservations…</TD></TR>
              ) : visible.length === 0 ? (
                <TR><TD colSpan={6} className="py-8 text-center text-xs text-sand-500">No bookings match selected filter.</TD></TR>
              ) : (
                visible.map((b) => (
                  <TR key={b.id}>
                    <TD className="font-bold text-sand-950 font-mono">{b.reference}</TD>
                    <TD className="text-sand-600">{b.check_in_date}</TD>
                    <TD className="text-sand-600">{b.check_out_date}</TD>
                    <TD className="text-sand-600">{b.source}</TD>
                    <TD align="right" className="font-semibold text-sand-900">₹{b.total_amount}</TD>
                    <TD align="right">
                      <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", bookingStateMeta[b.status]?.chip ?? "bg-sand-100")}>
                        {bookingStateMeta[b.status]?.label ?? b.status}
                      </span>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </PanelBody>
      </Panel>
    </div>
  );
}
