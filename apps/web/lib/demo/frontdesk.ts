/**
 * Demo bookings for the front desk, anchored to a fixed demo week (17–23 Nov 2026).
 *
 * Dates are ISO strings rather than offsets from "now" so the calendar tells the same
 * story every time the demo runs. The window is stated here once; the Gantt clips every
 * booking to it rather than each row working the arithmetic out again.
 */

export type BookingState =
  | "confirmed"
  | "checkin_today"
  | "checkout_today"
  | "tentative"
  | "blocked"
  | "in_house"
  | "checked_out";

export interface Booking {
  id: string;
  guest: string;
  room: string;
  category: string;
  adults: number;
  children: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  /** Total room charge for the stay, in rupees. */
  amount: number;
  ratePlan: string;
  source: string;
  state: BookingState;
  previousStays?: number;
  tier?: string;
  phone?: string;
  email?: string;
  specialRequests?: string[];
  notes?: string;
}

/** The week the room calendar shows. */
export const CALENDAR_START = "2026-11-17";
export const CALENDAR_DAYS = 7;

export const calendarWindow = Array.from({ length: CALENDAR_DAYS }, (_, index) => {
  const date = new Date(`${CALENDAR_START}T00:00:00`);
  date.setDate(date.getDate() + index);
  return date;
});

/** Today, for the highlighted column and the arrivals list. */
export const DEMO_TODAY = "2026-11-18";

export const bookingStateMeta: Record<BookingState, { label: string; bar: string; chip: string }> = {
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
  checked_out: {
    label: "Checked Out",
    bar: "bg-sand-100 border-sand-200 text-sand-500",
    chip: "border-sand-200 bg-white text-sand-500",
  },
};

/** The five states the calendar legend names, in the order it lists them. */
export const CALENDAR_LEGEND: BookingState[] = [
  "confirmed",
  "checkin_today",
  "checkout_today",
  "tentative",
  "blocked",
];

export interface CalendarRoom {
  room: string;
  category: string;
}

export const calendarRooms: CalendarRoom[] = [
  { room: "201", category: "Deluxe" },
  { room: "202", category: "Deluxe" },
  { room: "203", category: "Deluxe" },
  { room: "204", category: "Deluxe" },
  { room: "301", category: "Executive" },
  { room: "302", category: "Executive" },
  { room: "303", category: "Executive" },
  { room: "304", category: "Executive" },
  { room: "401", category: "Suite" },
  { room: "402", category: "Suite" },
  { room: "403", category: "Suite" },
  { room: "404", category: "Suite" },
  { room: "501", category: "Presidential" },
];

export const bookings: Booking[] = [
  {
    id: "#VM26Q7801",
    guest: "Amit Sharma",
    room: "201",
    category: "Deluxe",
    adults: 2,
    children: 0,
    checkIn: "2026-11-15",
    checkOut: "2026-11-18",
    nights: 3,
    amount: 28_500,
    ratePlan: "Corporate Rate",
    source: "Direct · Website",
    state: "checkout_today",
    phone: "+91 98201 11223",
    email: "amit.sharma@gmail.com",
  },
  {
    id: "#VM26Q7843",
    guest: "Neha Kapoor",
    room: "202",
    category: "Deluxe",
    adults: 2,
    children: 1,
    checkIn: "2026-11-18",
    checkOut: "2026-11-21",
    nights: 3,
    amount: 37_500,
    ratePlan: "Flexible Rate",
    source: "Marriott.com",
    state: "checkin_today",
    tier: "Gold Member",
    previousStays: 4,
    phone: "+91 98765 43210",
    email: "neha.kapoor@gmail.com",
    specialRequests: [
      "High floor, sea view (subject to availability)",
      "Late check-in (after 8 PM)",
    ],
  },
  {
    id: "#VM26Q7812",
    guest: "Rohan Mehta",
    room: "203",
    category: "Deluxe",
    adults: 2,
    children: 0,
    checkIn: "2026-11-16",
    checkOut: "2026-11-20",
    nights: 4,
    amount: 39_200,
    ratePlan: "Best Available",
    source: "Direct · Website",
    state: "in_house",
    tier: "Gold Elite",
    previousStays: 5,
    phone: "+91 98765 43210",
    email: "rohan.mehta@gmail.com",
    notes: "Prefers a high floor away from the lift.",
  },
  {
    id: "#VM26Q7855",
    guest: "Priya Iyer",
    room: "204",
    category: "Deluxe",
    adults: 1,
    children: 0,
    checkIn: "2026-11-18",
    checkOut: "2026-11-22",
    nights: 4,
    amount: 34_800,
    ratePlan: "Advance Purchase",
    source: "Booking.com",
    state: "confirmed",
    phone: "+91 99871 22004",
    email: "priya.iyer@outlook.com",
  },
  {
    id: "#VM26Q7808",
    guest: "Karan Deshmukh",
    room: "301",
    category: "Executive",
    adults: 1,
    children: 0,
    checkIn: "2026-11-17",
    checkOut: "2026-11-19",
    nights: 2,
    amount: 24_600,
    ratePlan: "Corporate Rate",
    source: "Corporate · Infosys",
    state: "in_house",
    phone: "+91 98330 55110",
    email: "karan.d@infosys.com",
  },
  {
    id: "MAINT-3021",
    guest: "Maintenance",
    room: "302",
    category: "Executive",
    adults: 0,
    children: 0,
    checkIn: "2026-11-18",
    checkOut: "2026-11-20",
    nights: 2,
    amount: 0,
    ratePlan: "—",
    source: "Engineering",
    state: "blocked",
    notes: "Bathroom re-grouting. Room off the sell list until 20 Nov.",
  },
  {
    id: "#VM26Q7871",
    guest: "Sneha Patil",
    room: "303",
    category: "Executive",
    adults: 2,
    children: 0,
    checkIn: "2026-11-19",
    checkOut: "2026-11-23",
    nights: 4,
    amount: 49_200,
    ratePlan: "Best Available",
    source: "Agoda",
    state: "confirmed",
    phone: "+91 98204 77321",
    email: "sneha.patil@gmail.com",
  },
  {
    id: "#VM26Q7849",
    guest: "Vikram Rao",
    room: "304",
    category: "Executive",
    adults: 1,
    children: 0,
    checkIn: "2026-11-18",
    checkOut: "2026-11-21",
    nights: 3,
    amount: 36_900,
    ratePlan: "Flexible Rate",
    source: "Direct · Phone",
    state: "checkin_today",
    previousStays: 2,
    phone: "+91 98191 40028",
    email: "vikram.rao@gmail.com",
    specialRequests: ["Airport pickup at 6 PM"],
  },
  {
    id: "#VM26Q7795",
    guest: "Anjali Singh",
    room: "401",
    category: "Suite",
    adults: 2,
    children: 0,
    checkIn: "2026-11-16",
    checkOut: "2026-11-19",
    nights: 3,
    amount: 62_400,
    ratePlan: "Suite Package",
    source: "Direct · Website",
    state: "in_house",
    tier: "Platinum",
    previousStays: 9,
    phone: "+91 98675 33410",
    email: "anjali.singh@gmail.com",
  },
  {
    id: "#VM26Q7890",
    guest: "Rahul Khanna",
    room: "402",
    category: "Suite",
    adults: 2,
    children: 2,
    checkIn: "2026-11-20",
    checkOut: "2026-11-24",
    nights: 4,
    amount: 84_000,
    ratePlan: "Suite Package",
    source: "MakeMyTrip",
    state: "tentative",
    phone: "+91 99201 66845",
    email: "rahul.khanna@gmail.com",
    notes: "Holding until deposit clears on 19 Nov.",
  },
  {
    id: "#VM26Q7819",
    guest: "Deepa Nair",
    room: "403",
    category: "Suite",
    adults: 1,
    children: 0,
    checkIn: "2026-11-17",
    checkOut: "2026-11-18",
    nights: 1,
    amount: 19_800,
    ratePlan: "Best Available",
    source: "Walk-in",
    state: "checkout_today",
    phone: "+91 98334 21770",
    email: "deepa.nair@gmail.com",
  },
  {
    id: "#VM26Q7861",
    guest: "Arjun Malhotra",
    room: "404",
    category: "Suite",
    adults: 2,
    children: 0,
    checkIn: "2026-11-18",
    checkOut: "2026-11-22",
    nights: 4,
    amount: 78_600,
    ratePlan: "Flexible Rate",
    source: "Direct · Website",
    state: "confirmed",
    previousStays: 1,
    phone: "+91 98110 90455",
    email: "arjun.malhotra@gmail.com",
  },
  {
    id: "#VM26Q7788",
    guest: "Kunal Soni",
    room: "501",
    category: "Presidential",
    adults: 2,
    children: 1,
    checkIn: "2026-11-15",
    checkOut: "2026-11-23",
    nights: 8,
    amount: 2_96_000,
    ratePlan: "Presidential Package",
    source: "Corporate · Reliance",
    state: "in_house",
    tier: "Platinum",
    previousStays: 14,
    phone: "+91 98200 10001",
    email: "kunal.soni@reliance.com",
    notes: "Butler service throughout. Daily press delivery at 6:30 AM.",
  },
];

export interface VisitRecord {
  date: string;
  detail: string;
  amount: number;
}

export const visitHistory: Record<string, VisitRecord[]> = {
  "Rohan Mehta": [
    { date: "12 Jun 2026", detail: "Deluxe · 2 nights", amount: 17_600 },
    { date: "03 Mar 2026", detail: "Deluxe · 1 night", amount: 8_700 },
    { date: "18 Nov 2025", detail: "Standard · 2 nights", amount: 13_400 },
  ],
  "Neha Kapoor": [
    { date: "02 Aug 2026", detail: "Deluxe · 2 nights", amount: 24_000 },
    { date: "14 May 2026", detail: "Spa · Couple therapy", amount: 6_800 },
  ],
  "Kunal Soni": [
    { date: "21 Sep 2026", detail: "Presidential · 5 nights", amount: 1_85_000 },
    { date: "16 Jul 2026", detail: "Banquet · Board dinner", amount: 2_40_000 },
  ],
};

export const ROOM_TYPE_FILTERS = [
  "All Room Types",
  "Deluxe",
  "Executive",
  "Suite",
  "Presidential",
] as const;
