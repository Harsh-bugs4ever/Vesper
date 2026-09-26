/**
 * Frontdesk presentation metadata and UI options.
 */

export type BookingState =
  | "confirmed"
  | "checkin_today"
  | "checkout_today"
  | "tentative"
  | "blocked"
  | "in_house"
  | "checked_in"
  | "checked_out"
  | "cancelled";

export const bookingStateMeta: Record<string, { label: string; bar: string; chip: string }> = {
  confirmed: {
    label: "Confirmed",
    bar: "bg-emerald-100 border-emerald-300 text-emerald-900",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  checkin_today: {
    label: "Check-in Today",
    bar: "bg-gold-100 border-gold-300 text-gold-900",
    chip: "border-gold-200 bg-gold-50 text-gold-800",
  },
  checkout_today: {
    label: "Check-out Today",
    bar: "bg-rose-100 border-rose-300 text-rose-900",
    chip: "border-rose-200 bg-rose-50 text-rose-700",
  },
  tentative: {
    label: "Tentative",
    bar: "bg-sand-100 border-sand-300 text-sand-800",
    chip: "border-sand-200 bg-sand-100 text-sand-700",
  },
  blocked: {
    label: "Blocked",
    bar: "bg-sand-200 border-sand-300 text-sand-600",
    chip: "border-sand-200 bg-sand-100 text-sand-600",
  },
  in_house: {
    label: "In House",
    bar: "bg-emerald-100 border-emerald-300 text-emerald-900",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  checked_in: {
    label: "Checked In",
    bar: "bg-emerald-100 border-emerald-300 text-emerald-900",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  checked_out: {
    label: "Checked Out",
    bar: "bg-sand-100 border-sand-200 text-sand-500",
    chip: "border-sand-200 bg-white text-sand-500",
  },
  cancelled: {
    label: "Cancelled",
    bar: "bg-sand-100 border-sand-200 text-sand-400 line-through",
    chip: "border-sand-200 bg-sand-50 text-sand-500",
  },
};

export const CALENDAR_LEGEND: BookingState[] = [
  "confirmed",
  "checkin_today",
  "checkout_today",
  "tentative",
  "blocked",
];
