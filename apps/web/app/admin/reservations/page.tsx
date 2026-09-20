"use client";

import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarCheck, CalendarDays, IndianRupee, PercentCircle } from "lucide-react";

import { ArrivalsDeparturesChart, type MovementPoint } from "@/components/charts/arrivals-departures-chart";
import { OccupancyForecastChart } from "@/components/charts/occupancy-forecast-chart";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { chartColors, formatLakh } from "@/lib/chart-theme";
import { bookingStateMeta, bookings } from "@/lib/demo/frontdesk";
import { occupancyForecast } from "@/lib/demo/dashboard";
import { cn } from "@/lib/utils";

/** Booked arrivals and departures for the same fortnight the forecast covers. */
const movements: MovementPoint[] = [
  { date: "20 Sep", arrivals: 12, departures: 9 },
  { date: "21 Sep", arrivals: 14, departures: 16 },
  { date: "22 Sep", arrivals: 11, departures: 13 },
  { date: "23 Sep", arrivals: 9, departures: 12 },
  { date: "24 Sep", arrivals: 15, departures: 8 },
  { date: "25 Sep", arrivals: 21, departures: 10 },
  { date: "26 Sep", arrivals: 26, departures: 7 },
  { date: "27 Sep", arrivals: 18, departures: 14 },
  { date: "28 Sep", arrivals: 10, departures: 24 },
  { date: "29 Sep", arrivals: 8, departures: 19 },
  { date: "30 Sep", arrivals: 11, departures: 11 },
  { date: "1 Oct", arrivals: 16, departures: 9 },
];

const SOURCES = ["All sources", "Direct", "OTA", "Corporate", "Walk-in"] as const;
type Source = (typeof SOURCES)[number];

/** Which bucket a booking's source string belongs to. */
function sourceBucket(source: string): Source {
  if (source.startsWith("Direct")) return "Direct";
  if (source.startsWith("Corporate")) return "Corporate";
  if (source === "Walk-in") return "Walk-in";
  return "OTA";
}

export default function ReservationsPage() {
  const [source, setSource] = useState<Source>("All sources");

  const visible = useMemo(
    () =>
      source === "All sources"
        ? bookings
        : bookings.filter((booking) => sourceBucket(booking.source) === source),
    [source]
  );

  const roomNights = visible.reduce((sum, booking) => sum + booking.nights, 0);
  const bookedValue = visible.reduce((sum, booking) => sum + booking.amount, 0);
  const adr = roomNights === 0 ? 0 : Math.round(bookedValue / roomNights);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="The forward book: what is sold, what is arriving, and where the pressure is."
        meta={format(new Date(), "EEE, d MMM yyyy")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Bookings on File"
          value={visible.length}
          change="+4"
          comparison="added in the last 24h"
          tone="sage"
          icon={CalendarCheck}
          trend={[6, 7, 7, 9, 8, 10, visible.length]}
        />
        <StatTile
          label="Room Nights Sold"
          value={roomNights}
          change="+9%"
          comparison="vs. same period last month"
          tone="forest"
          icon={CalendarDays}
          trend={[18, 20, 19, 23, 24, 25, roomNights]}
        />
        <StatTile
          label="Booked Value"
          value={formatLakh(bookedValue)}
          change="+12%"
          comparison="across the forward book"
          tone="sand"
          icon={IndianRupee}
          trend={[2.6, 2.8, 2.9, 3.1, 3.2, 3.4, 3.5]}
        />
        <StatTile
          label="Achieved ADR"
          value={`₹${adr.toLocaleString("en-IN")}`}
          change="+8%"
          comparison="vs. last week"
          tone="rose"
          icon={PercentCircle}
          trend={[8700, 8850, 8600, 9000, 9150, 9050, 9400]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
                  <span className="h-3 w-5 rounded-sm" style={{ backgroundColor: chartColors.band }} />
                  Confidence range
                </span>
              </div>
            }
          />
          <PanelBody className="pt-4">
            <OccupancyForecastChart data={occupancyForecast} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Arrivals & Departures"
            description="Booked movements per day — staff the lobby against the taller bar."
          />
          <PanelBody className="pt-4">
            <ArrivalsDeparturesChart data={movements} />
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Forward Book" description="Every booking currently on file." />
        <PanelBody className="space-y-4 pt-4">
          <FilterChips
            options={SOURCES.map((item) => ({
              value: item,
              label: item,
              count:
                item === "All sources"
                  ? bookings.length
                  : bookings.filter((booking) => sourceBucket(booking.source) === item).length,
            }))}
            value={source}
            onChange={setSource}
          />

          <Table>
            <THead>
              <tr>
                <TH>Booking</TH>
                <TH>Guest</TH>
                <TH>Room</TH>
                <TH>Dates</TH>
                <TH align="right">Nights</TH>
                <TH align="right">Value</TH>
                <TH align="right">Status</TH>
              </tr>
            </THead>
            <TBody>
              {visible.map((booking) => (
                <TR key={booking.id}>
                  <TD>
                    <span className="block font-medium tabular-nums text-sand-900">{booking.id}</span>
                    <span className="block text-xs text-sand-500">{booking.source}</span>
                  </TD>
                  <TD className="text-sand-800">{booking.guest}</TD>
                  <TD>
                    <span className="block tabular-nums text-sand-800">{booking.room}</span>
                    <span className="block text-xs text-sand-500">{booking.category}</span>
                  </TD>
                  <TD className="text-sand-600">
                    {format(new Date(booking.checkIn), "d MMM")} –{" "}
                    {format(new Date(booking.checkOut), "d MMM")}
                  </TD>
                  <TD align="right" className="text-sand-700">
                    {booking.nights}
                  </TD>
                  <TD align="right" className="font-medium text-sand-900">
                    ₹{booking.amount.toLocaleString("en-IN")}
                  </TD>
                  <TD align="right">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        bookingStateMeta[booking.state].chip
                      )}
                    >
                      {bookingStateMeta[booking.state].label}
                    </span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </PanelBody>
      </Panel>
    </div>
  );
}
