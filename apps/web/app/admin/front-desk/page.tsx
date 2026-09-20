"use client";

import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  BedDouble,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LogIn,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Users,
  X,
} from "lucide-react";

import { RoomCalendar } from "@/components/front-desk/room-calendar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";
import { PeriodSelect } from "@/components/ui/period-select";
import { SectionTabs } from "@/components/ui/section-tabs";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  CALENDAR_LEGEND,
  DEMO_TODAY,
  ROOM_TYPE_FILTERS,
  bookingStateMeta,
  bookings as seedBookings,
  calendarRooms,
  calendarWindow,
  visitHistory,
  type Booking,
  type BookingState,
} from "@/lib/demo/frontdesk";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "calendar", label: "Room Calendar" },
  { value: "list", label: "List View" },
  { value: "arrivals", label: "Arrivals" },
  { value: "departures", label: "Departures" },
  { value: "in-house", label: "In-House" },
] as const;

type Tab = (typeof TABS)[number]["value"];

const PANEL_TABS = [
  { value: "check-in", label: "Check-in" },
  { value: "stay", label: "Stay Details" },
  { value: "profile", label: "Guest Profile" },
  { value: "notes", label: "Notes" },
] as const;

type PanelTab = (typeof PANEL_TABS)[number]["value"];

const STATUS_FILTERS = ["All Statuses", ...CALENDAR_LEGEND.map((s) => bookingStateMeta[s].label)];

/** Pre-arrival steps the desk works through before handing over a key. */
const PRE_CHECKIN = [
  { id: "id", label: "ID proof verified", done: true },
  { id: "payment", label: "Payment method confirmed", done: true },
  { id: "room", label: "Room assigned", done: true },
  { id: "requests", label: "Special requests noted", done: false },
];

export default function FrontDeskPage() {
  const { showToast, showUndoToast } = useToast();

  const [bookings, setBookings] = useState<Booking[]>(seedBookings);
  const [tab, setTab] = useState<Tab>("calendar");
  const [panelTab, setPanelTab] = useState<PanelTab>("check-in");
  const [roomType, setRoomType] = useState<string>(ROOM_TYPE_FILTERS[0]);
  const [status, setStatus] = useState<string>(STATUS_FILTERS[0]);
  const [selectedId, setSelectedId] = useState<string | null>("#VM26Q7843");
  const [checklist, setChecklist] = useState(PRE_CHECKIN);

  const counts = useMemo(() => {
    const tally = {
      arrivals: bookings.filter((b) => b.state === "checkin_today").length,
      departures: bookings.filter((b) => b.state === "checkout_today").length,
      inHouse: bookings.filter((b) => b.state === "in_house").length,
    };
    return tally;
  }, [bookings]);

  const filtered = useMemo(
    () =>
      bookings
        .filter((b) => roomType === "All Room Types" || b.category === roomType)
        .filter((b) => status === "All Statuses" || bookingStateMeta[b.state].label === status),
    [bookings, roomType, status]
  );

  const visibleRooms = useMemo(
    () =>
      calendarRooms.filter((room) => roomType === "All Room Types" || room.category === roomType),
    [roomType]
  );

  const selected = bookings.find((b) => b.id === selectedId) ?? null;
  const history = selected ? (visitHistory[selected.guest] ?? []) : [];

  const listFor = (kind: Tab): Booking[] => {
    if (kind === "arrivals") return bookings.filter((b) => b.state === "checkin_today");
    if (kind === "departures") return bookings.filter((b) => b.state === "checkout_today");
    if (kind === "in-house") return bookings.filter((b) => b.state === "in_house");
    return filtered;
  };

  const completeCheckIn = (booking: Booking) => {
    const previous = booking.state;
    setBookings((current) =>
      current.map((item) => (item.id === booking.id ? { ...item, state: "in_house" } : item))
    );

    showUndoToast(
      `${booking.guest} checked in`,
      `Room ${booking.room} released. Key issued and the in-room QR is live.`,
      () =>
        setBookings((current) =>
          current.map((item) => (item.id === booking.id ? { ...item, state: previous } : item))
        ),
      10
    );
  };

  const pending = checklist.filter((item) => !item.done).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Front Desk"
        description="Today's arrivals, departures and room calendar"
        actions={
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-sand-200 bg-white p-2 text-sand-500 transition-colors hover:bg-sand-50"
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm font-medium text-sand-800">
              <CalendarRange className="h-4 w-4 text-sand-500" />
              {format(new Date(`${DEMO_TODAY}T00:00:00`), "EEE, d MMM yyyy")}
            </span>
            <button
              className="rounded-xl border border-sand-200 bg-white p-2 text-sand-500 transition-colors hover:bg-sand-50"
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <Button
              size="sm"
              onClick={() =>
                showToast({
                  title: "New booking",
                  description: "Opening a blank booking for tonight.",
                  type: "default",
                })
              }
            >
              <Plus className="h-3.5 w-3.5" />
              New Booking
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          variant="value-first"
          label="Arrivals Today"
          value={counts.arrivals}
          change="3"
          comparison="vs. yesterday"
          tone="sage"
          icon={LogIn}
        />
        <StatTile
          variant="value-first"
          label="Departures Today"
          value={counts.departures}
          change="2"
          comparison="vs. yesterday"
          tone="sand"
          icon={LogOut}
        />
        <StatTile
          variant="value-first"
          label="In-House Guests"
          value={298}
          change="85% occupancy"
          intent="neutral"
          comparison=""
          tone="forest"
          icon={BedDouble}
        />
        <StatTile
          variant="value-first"
          label="Pending Check-ins"
          value={6}
          change="Requires attention"
          intent="bad"
          comparison=""
          tone="rose"
          icon={ClipboardList}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        <Panel>
          <div className="px-5 pt-4">
            <SectionTabs tabs={TABS} value={tab} onChange={setTab} />
          </div>

          <PanelBody className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <PeriodSelect
                value={roomType}
                onChange={setRoomType}
                options={ROOM_TYPE_FILTERS}
              />
              <PeriodSelect value={status} onChange={setStatus} options={STATUS_FILTERS} />

              {tab === "calendar" && (
                <span className="ml-auto flex items-center gap-2 rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-xs font-medium text-sand-700">
                  <CalendarRange className="h-3.5 w-3.5 text-sand-500" />
                  {format(calendarWindow[0], "d MMM yyyy")} –{" "}
                  {format(calendarWindow[calendarWindow.length - 1], "d MMM yyyy")}
                </span>
              )}
            </div>

            {tab === "calendar" && (
              <>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-sand-200/80 pb-3">
                  {CALENDAR_LEGEND.map((key) => (
                    <span key={key} className="flex items-center gap-1.5 text-xs text-sand-700">
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full border",
                          bookingStateMeta[key].bar
                        )}
                      />
                      {bookingStateMeta[key].label}
                    </span>
                  ))}
                </div>

                <RoomCalendar
                  rooms={visibleRooms}
                  bookings={filtered}
                  today={DEMO_TODAY}
                  selectedId={selectedId}
                  onSelect={(booking) => {
                    setSelectedId(booking.id);
                    setPanelTab("check-in");
                  }}
                />
              </>
            )}

            {tab !== "calendar" && (
              <Table>
                <THead>
                  <tr>
                    <TH>Guest</TH>
                    <TH>Room</TH>
                    <TH>Stay</TH>
                    <TH>Source</TH>
                    <TH align="right">Amount</TH>
                    <TH align="right">Status</TH>
                  </tr>
                </THead>
                <TBody>
                  {listFor(tab).map((booking) => (
                    <TR key={booking.id}>
                      <TD>
                        <button
                          onClick={() => setSelectedId(booking.id)}
                          className="text-left font-medium text-sand-900 hover:text-sage-700 hover:underline"
                        >
                          {booking.guest}
                        </button>
                        <span className="block text-xs text-sand-500">{booking.id}</span>
                      </TD>
                      <TD>
                        <span className="block tabular-nums text-sand-800">{booking.room}</span>
                        <span className="block text-xs text-sand-500">{booking.category}</span>
                      </TD>
                      <TD className="text-sand-600">
                        {format(new Date(`${booking.checkIn}T00:00:00`), "d MMM")} –{" "}
                        {format(new Date(`${booking.checkOut}T00:00:00`), "d MMM")}
                      </TD>
                      <TD className="text-sand-600">{booking.source}</TD>
                      <TD align="right" className="font-medium text-sand-900">
                        {booking.amount === 0
                          ? "—"
                          : `₹${booking.amount.toLocaleString("en-IN")}`}
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
            )}
          </PanelBody>
        </Panel>

        {/* Booking detail */}
        <Panel className="h-fit xl:sticky xl:top-24">
          {selected === null ? (
            <PanelBody className="py-14 text-center text-sm text-sand-500">
              Select a booking to see its detail.
            </PanelBody>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2 px-5 pt-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-serif text-2xl font-semibold leading-tight text-sand-950">
                      {selected.guest}
                    </h2>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        bookingStateMeta[selected.state].chip
                      )}
                    >
                      {selected.state === "checkin_today"
                        ? "Arriving Today"
                        : bookingStateMeta[selected.state].label}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    className="rounded-lg p-1.5 text-sand-400 transition-colors hover:bg-sand-100 hover:text-sand-700"
                    aria-label="More options"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="rounded-lg p-1.5 text-sand-400 transition-colors hover:bg-sand-100 hover:text-sand-700"
                    aria-label="Close panel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="px-5 pt-3">
                <SectionTabs tabs={PANEL_TABS} value={panelTab} onChange={setPanelTab} />
              </div>

              {panelTab === "check-in" && (
                <PanelBody className="space-y-4 pt-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sage-50 text-sm font-semibold text-sage-800">
                      {selected.guest
                        .split(" ")
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-sand-950">{selected.guest}</p>
                        {selected.tier && (
                          <span className="rounded-full border border-gold-200 bg-gold-50 px-2 py-0.5 text-xs font-medium text-gold-800">
                            {selected.tier}
                          </span>
                        )}
                      </div>
                      {selected.phone && <p className="text-xs text-sand-500">{selected.phone}</p>}
                      {selected.email && (
                        <p className="truncate text-xs text-sand-500">{selected.email}</p>
                      )}
                    </div>
                  </div>

                  <dl className="grid grid-cols-3 gap-3 rounded-xl bg-sand-50/70 p-3.5">
                    <div>
                      <dt className="text-xs text-sand-500">Room</dt>
                      <dd className="font-serif text-lg font-semibold text-sand-950">
                        {selected.room}
                      </dd>
                      <dd className="text-xs text-sand-500">{selected.category} Room</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-sand-500">Nights</dt>
                      <dd className="font-serif text-lg font-semibold text-sand-950">
                        {selected.nights}
                      </dd>
                      <dd className="text-xs text-sand-500">
                        {format(new Date(`${selected.checkIn}T00:00:00`), "d")} –{" "}
                        {format(new Date(`${selected.checkOut}T00:00:00`), "d MMM yyyy")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-sand-500">Rate (per night)</dt>
                      <dd className="font-serif text-lg font-semibold text-sand-950">
                        ₹{Math.round(selected.amount / Math.max(1, selected.nights)).toLocaleString("en-IN")}
                      </dd>
                      <dd className="text-xs text-sand-500">{selected.ratePlan}</dd>
                    </div>
                  </dl>

                  <div className="border-t border-sand-200/80 pt-4">
                    <p className="font-serif text-base font-semibold text-sand-950">
                      Booking Details
                    </p>
                    <dl className="mt-2 space-y-2 text-sm">
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-sand-600">Booking ID</dt>
                        <dd className="font-medium tabular-nums text-sand-900">{selected.id}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-sand-600">Source</dt>
                        <dd className="font-medium text-sand-900">{selected.source}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-sand-600">Guests</dt>
                        <dd className="font-medium text-sand-900">
                          {selected.adults} Adult{selected.adults === 1 ? "" : "s"}
                          {selected.children > 0 && `, ${selected.children} Child`}
                        </dd>
                      </div>
                      {selected.specialRequests && (
                        <div className="flex items-start justify-between gap-4">
                          <dt className="shrink-0 text-sand-600">Special Requests</dt>
                          <dd className="text-right text-sand-900">
                            {selected.specialRequests.map((request) => (
                              <span key={request} className="block text-sm">
                                {request}
                              </span>
                            ))}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div className="border-t border-sand-200/80 pt-4">
                    <p className="font-serif text-base font-semibold text-sand-950">Pre Check-in</p>
                    <ul className="mt-2 space-y-1">
                      {checklist.map((item) => (
                        <li key={item.id}>
                          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1.5 text-sm text-sand-800 transition-colors hover:bg-sand-50">
                            <input
                              type="checkbox"
                              checked={item.done}
                              onChange={() =>
                                setChecklist((current) =>
                                  current.map((row) =>
                                    row.id === item.id ? { ...row, done: !row.done } : row
                                  )
                                )
                              }
                              className="h-4 w-4 shrink-0 rounded border-sand-300 text-sage-600 focus:ring-sage-500"
                            />
                            {item.label}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2 border-t border-sand-200/80 pt-4">
                    {selected.state === "checkin_today" ? (
                      <Button className="w-full" onClick={() => completeCheckIn(selected)}>
                        Complete Check-in
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <p className="rounded-xl bg-sand-50 p-3 text-center text-xs text-sand-600">
                        {selected.state === "in_house"
                          ? "This guest is already in house."
                          : `Nothing to check in — this booking is ${bookingStateMeta[selected.state].label.toLowerCase()}.`}
                      </p>
                    )}

                    {pending > 0 && selected.state === "checkin_today" && (
                      <p className="text-center text-xs text-gold-700">
                        {pending} pre-check-in step{pending === 1 ? "" : "s"} still open.
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm">
                        <Pencil className="h-3.5 w-3.5" />
                        Edit Booking
                      </Button>
                      <Button variant="outline" size="sm">
                        <Printer className="h-3.5 w-3.5" />
                        Registration Card
                      </Button>
                    </div>
                  </div>
                </PanelBody>
              )}

              {panelTab === "stay" && (
                <PanelBody className="space-y-3 pt-4 text-sm">
                  {[
                    ["Check-in", format(new Date(`${selected.checkIn}T00:00:00`), "EEE, d MMM yyyy")],
                    ["Check-out", format(new Date(`${selected.checkOut}T00:00:00`), "EEE, d MMM yyyy")],
                    ["Nights", String(selected.nights)],
                    ["Rate plan", selected.ratePlan],
                    [
                      "Total charge",
                      selected.amount === 0 ? "—" : `₹${selected.amount.toLocaleString("en-IN")}`,
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4">
                      <span className="text-sand-600">{label}</span>
                      <span className="font-medium text-sand-900">{value}</span>
                    </div>
                  ))}
                </PanelBody>
              )}

              {panelTab === "profile" && (
                <PanelBody className="space-y-4 pt-4">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-sand-600">Previous stays</span>
                    <span className="font-medium text-sand-900">
                      {selected.previousStays ?? 0}
                      {selected.previousStays ? " · returning guest" : " · first visit"}
                    </span>
                  </div>

                  {history.length === 0 ? (
                    <p className="text-sm text-sand-500">No earlier visits on record.</p>
                  ) : (
                    <ul className="divide-y divide-sand-100">
                      {history.map((visit) => (
                        <li
                          key={visit.date}
                          className="flex items-baseline justify-between gap-3 py-2.5"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm text-sand-900">{visit.detail}</span>
                            <span className="block text-xs text-sand-500">{visit.date}</span>
                          </span>
                          <span className="shrink-0 text-sm tabular-nums text-sand-700">
                            ₹{visit.amount.toLocaleString("en-IN")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </PanelBody>
              )}

              {panelTab === "notes" && (
                <PanelBody className="pt-4">
                  {selected.notes ? (
                    <div className="rounded-xl border border-gold-200 bg-gold-50/50 p-4">
                      <p className="text-xs font-medium text-gold-900">Note for the desk</p>
                      <p className="mt-1 text-sm text-sand-800">{selected.notes}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-sand-500">No notes on this booking.</p>
                  )}
                </PanelBody>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
