"use client";

import * as React from "react";
import { format, isSameDay } from "date-fns";
import { ArrowRight } from "lucide-react";

import {
  bookingStateMeta,
  calendarWindow,
  type Booking,
  type CalendarRoom,
} from "@/lib/demo/frontdesk";
import { cn } from "@/lib/utils";

/**
 * The room-by-night timeline.
 *
 * A CSS grid rather than absolute positioning: each booking is placed by column start
 * and span, so the bars stay aligned to the day headers at any width and the browser
 * does the arithmetic. Bookings that begin before the window or end after it are
 * clipped, and the clipped edge is drawn square so it reads as "continues" rather than
 * as a stay that happens to start on Monday.
 */

const DAY_MS = 86_400_000;

function midnight(value: string | Date): Date {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00`) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

interface Placement {
  booking: Booking;
  /** 1-based grid column. */
  start: number;
  span: number;
  clippedStart: boolean;
  clippedEnd: boolean;
}

/** Where a booking sits in the visible window, or null when it falls entirely outside. */
function place(booking: Booking, windowStart: Date, days: number): Placement | null {
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
  selectedId,
  onSelect,
}: {
  rooms: CalendarRoom[];
  bookings: Booking[];
  today: string;
  selectedId: string | null;
  onSelect: (booking: Booking) => void;
}) {
  const windowStart = midnight(calendarWindow[0]);
  const days = calendarWindow.length;
  const todayDate = midnight(today);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[860px]">
        {/* Day headers */}
        <div
          className="grid border-b border-sand-200/80"
          style={{ gridTemplateColumns: `100px 110px repeat(${days}, minmax(0, 1fr))` }}
        >
          <div className="px-3 pb-2 text-xs font-medium text-sand-500">Room</div>
          <div className="px-3 pb-2 text-xs font-medium text-sand-500">Type</div>
          {calendarWindow.map((day) => {
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
            .map((booking) => place(booking, windowStart, days))
            .filter((item): item is Placement => item !== null);

          return (
            <div
              key={room.room}
              className="grid items-center border-b border-sand-100 last:border-b-0"
              style={{ gridTemplateColumns: `100px 110px repeat(${days}, minmax(0, 1fr))` }}
            >
              <div className="px-3 py-2 text-sm font-medium tabular-nums text-sand-900">
                {room.room}
              </div>
              <div className="px-3 py-2 text-sm text-sand-600">{room.category}</div>

              {/* The day cells sit underneath as the grid background. */}
              {calendarWindow.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "h-12 border-l border-sand-100",
                    isSameDay(day, todayDate) && "bg-gold-50/40"
                  )}
                />
              ))}

              {/* Bars are placed into the same row, over the cells. */}
              {placements.map((placement) => {
                const meta = bookingStateMeta[placement.booking.state];
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
                      {format(midnight(placement.booking.checkIn), "d")} –{" "}
                      {format(midnight(placement.booking.checkOut), "d MMM")}
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
