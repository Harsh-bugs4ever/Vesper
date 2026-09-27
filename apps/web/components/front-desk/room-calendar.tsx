"use client";

import * as React from "react";
import { format, isSameDay } from "date-fns";
import { ArrowRight } from "lucide-react";
import { bookingStateMeta } from "@/lib/config/frontdesk-ui";
import { cn, safeFormatDate } from "@/lib/utils";

const DAY_MS = 86_400_000;

function midnight(value: string | Date): Date {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00`) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export interface CalendarBooking {
  id: string;
  guest: string;
  room: string;
  category: string;
  checkIn: string;
  checkOut: string;
  state: string;
}

export interface CalendarRoom {
  room: string;
  category: string;
}

interface Placement {
  booking: CalendarBooking;
  start: number;
  span: number;
  clippedStart: boolean;
  clippedEnd: boolean;
}

function place(booking: CalendarBooking, windowStart: Date, days: number): Placement | null {
  const checkIn = midnight(booking.checkIn);
  const checkOut = midnight(booking.checkOut);

  const startOffset = Math.round((checkIn.getTime() - windowStart.getTime()) / DAY_MS);
  const endOffset = Math.round((checkOut.getTime() - windowStart.getTime()) / DAY_MS);

  if (endOffset <= 0 || startOffset >= days) return null;

  const clampedStart = Math.max(0, startOffset);
  const clampedEnd = Math.min(days, endOffset);

  return {
    booking,
    start: clampedStart + 1,
    span: Math.max(1, clampedEnd - clampedStart),
    clippedStart: startOffset < 0,
    clippedEnd: endOffset > days,
  };
}

export function RoomCalendar({
  rooms,
  bookings,
  today,
  calendarDays,
  selectedId,
  onSelect,
}: {
  rooms: CalendarRoom[];
  bookings: CalendarBooking[];
  today: string;
  calendarDays?: Date[];
  selectedId: string | null;
  onSelect: (booking: CalendarBooking) => void;
}) {
  const defaultWindow = React.useMemo(() => {
    const start = new Date(today);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [today]);

  const window = calendarDays || defaultWindow;
  const windowStart = midnight(window[0]);
  const daysCount = window.length;
  const todayDate = midnight(today);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[860px]">
        {/* Day headers */}
        <div
          className="grid border-b border-sand-200/80"
          style={{ gridTemplateColumns: `100px 110px repeat(${daysCount}, minmax(0, 1fr))` }}
        >
          <div className="px-3 pb-2 text-xs font-medium text-sand-500">Room</div>
          <div className="px-3 pb-2 text-xs font-medium text-sand-500">Type</div>
          {window.map((day) => {
            const isToday = isSameDay(day, todayDate);
            return (
              <div
                key={day.toISOString()}
                className={cn("px-2 pb-2 text-center", isToday && "bg-gold-50/60")}
              >
                <span className="block text-sm font-semibold text-sand-900">
                  {format(day, "EEE")}
                </span>
                <span className="block text-xs text-sand-500">{format(day, "d MMM")}</span>
              </div>
            );
          })}
        </div>

        {/* One row per room */}
        {rooms.map((room) => {
          const placements = bookings
            .filter((booking) => booking.room === room.room)
            .map((booking) => place(booking, windowStart, daysCount))
            .filter((item): item is Placement => item !== null);

          return (
            <div
              key={room.room}
              className="grid items-center border-b border-sand-100 last:border-b-0"
              style={{ gridTemplateColumns: `100px 110px repeat(${daysCount}, minmax(0, 1fr))` }}
            >
              <div className="px-3 py-2 text-sm font-medium tabular-nums text-sand-900">
                {room.room}
              </div>
              <div className="px-3 py-2 text-sm text-sand-600">{room.category}</div>

              {/* Grid background */}
              {window.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "h-12 border-l border-sand-100",
                    isSameDay(day, todayDate) && "bg-gold-50/40"
                  )}
                />
              ))}

              {/* Bars */}
              {placements.map((placement) => {
                const meta = bookingStateMeta[placement.booking.state] ?? {
                  label: placement.booking.state,
                  bar: "bg-sage-100 border-sage-300 text-sage-900",
                  chip: "border-sage-200 bg-sage-50 text-sage-800",
                };
                const isSelected = placement.booking.id === selectedId;

                return (
                  <button
                    key={placement.booking.id}
                    onClick={() => onSelect(placement.booking)}
                    title={`${placement.booking.guest} · ${placement.booking.id}`}
                    className={cn(
                      "z-10 mx-1 flex h-9 items-center gap-2 overflow-hidden border px-2.5 text-left transition-all",
                      meta.bar,
                      placement.clippedStart ? "rounded-l-none" : "rounded-l-lg",
                      placement.clippedEnd ? "rounded-r-none" : "rounded-r-lg",
                      isSelected && "ring-2 ring-sage-700 ring-offset-1"
                    )}
                    style={{
                      gridRow: 1,
                      gridColumnStart: placement.start + 2,
                      gridColumnEnd: `span ${placement.span}`,
                    }}
                  >
                    <span className="truncate text-xs font-medium">
                      {placement.booking.guest}
                    </span>
                    <span className="hidden shrink-0 text-xs opacity-70 sm:inline">
                      {safeFormatDate(midnight(placement.booking.checkIn), "d")} –{" "}
                      {safeFormatDate(midnight(placement.booking.checkOut), "d MMM")}
                    </span>
                    <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 opacity-60" />
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
