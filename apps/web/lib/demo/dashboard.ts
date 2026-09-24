import {
  BedDouble,
  CalendarCheck,
  CheckCircle2,
  LogOut,
  MessageSquareQuote,
  TriangleAlert,
  UserRound,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";

import type { ActivityItem } from "@/components/ui/activity-feed";
import type { DepartmentSlice } from "@/components/charts/department-revenue-donut";
import type { ForecastPoint } from "@/components/charts/occupancy-forecast-chart";

/**
 * Demo figures for the owner dashboard.
 *
 * Kept apart from the page so that swapping in the real endpoints later is a change of
 * import, not a rewrite of the markup. The numbers are plausible for a 145-room Mumbai
 * property in September — shoulder season, mid-week dip, weekend recovery.
 */

export const occupancyForecast: ForecastPoint[] = [
  { date: "18 Sep", occupancy: 38, range: [32, 45] },
  { date: "19 Sep", occupancy: 49, range: [42, 57] },
  { date: "20 Sep", occupancy: 57, range: [49, 66] },
  { date: "21 Sep", occupancy: 48, range: [40, 58] },
  { date: "22 Sep", occupancy: 46, range: [37, 56] },
  { date: "23 Sep", occupancy: 55, range: [45, 65] },
  { date: "24 Sep", occupancy: 62, range: [51, 72] },
  { date: "25 Sep", occupancy: 70, range: [59, 80] },
  { date: "26 Sep", occupancy: 78, range: [67, 88] },
  { date: "27 Sep", occupancy: 80, range: [68, 91] },
  { date: "28 Sep", occupancy: 71, range: [59, 83] },
  { date: "29 Sep", occupancy: 60, range: [47, 73] },
  { date: "30 Sep", occupancy: 56, range: [42, 70] },
  { date: "1 Oct", occupancy: 62, range: [47, 77] },
];

export const revenueByDepartment: DepartmentSlice[] = [
  { name: "Rooms", value: 26_50_000 },
  { name: "F&B", value: 7_70_000 },
  { name: "Spa & Wellness", value: 3_40_000 },
  { name: "Events", value: 3_00_000 },
  { name: "Other", value: 2_20_000 },
];

export interface RoomCategoryRow {
  category: string;
  occupancy: number;
  adr: number;
  revenue: number;
}

export const topRoomCategories: RoomCategoryRow[] = [
  { category: "Deluxe", occupancy: 82, adr: 8_900, revenue: 12_40_000 },
  { category: "Executive", occupancy: 76, adr: 11_200, revenue: 9_80_000 },
  { category: "Suite", occupancy: 68, adr: 18_500, revenue: 8_60_000 },
  { category: "Premium", occupancy: 71, adr: 13_400, revenue: 6_10_000 },
  { category: "Standard", occupancy: 65, adr: 6_800, revenue: 3_90_000 },
];

export const liveActivity: ActivityItem[] = [
  {
    id: "a1",
    title: "New booking received",
    detail: "Deluxe Room · 2 nights · ₹18,800",
    time: "7:12 PM",
    tone: "sage",
    icon: CalendarCheck,
  },
  {
    id: "a2",
    title: "Guest check-in",
    detail: "Mr. Rohan Mehta · Room 612",
    time: "6:48 PM",
    tone: "sand",
    icon: UserRound,
  },
  {
    id: "a3",
    title: "Housekeeping completed",
    detail: "Room 405 · Deluxe Room",
    time: "6:20 PM",
    tone: "emerald",
    icon: CheckCircle2,
  },
  {
    id: "a4",
    title: "Maintenance request raised",
    detail: "AC not cooling · Room 318",
    time: "5:54 PM",
    tone: "rose",
    icon: Wrench,
  },
  {
    id: "a5",
    title: "Restaurant order",
    detail: "Table 6 · ₹2,850",
    time: "5:32 PM",
    tone: "gold",
    icon: UtensilsCrossed,
  },
  {
    id: "a6",
    title: "Guest check-out",
    detail: "Ms. Priya Sharma · Room 210",
    time: "4:18 PM",
    tone: "slate",
    icon: LogOut,
  },
  {
    id: "a7",
    title: "Low inventory alert",
    detail: "Toiletries (Shampoo) below 10 units",
    time: "5:47 PM",
    tone: "rose",
    icon: TriangleAlert,
  },
  {
    id: "a8",
    title: "Positive feedback received",
    detail: '"Excellent service and great staff!" — Mr. Arvind Nair',
    time: "2:31 PM",
    tone: "sage",
    icon: MessageSquareQuote,
  },
];

/** Sparkline series for the four KPI tiles, oldest point first. */
export const kpiTrends = {
  occupancy: [64, 61, 68, 70, 66, 73, 78],
  adr: [8700, 8850, 8600, 9000, 9150, 9050, 9400],
  revenue: [11.4, 12.1, 11.8, 12.9, 13.4, 13.1, 14.2],
  requests: [6, 5, 8, 7, 9, 9, 12],
} as const;

export interface SystemAlert {
  id: string;
  title: string;
  detail: string;
  level: "critical" | "warning" | "info";
  time: string;
  source: string;
  actionUrl?: string;
  actionLabel?: string;
}

export const systemAlerts: SystemAlert[] = [
  {
    id: "alt-1",
    title: "Chiller 2 Vibration Anomaly",
    detail: "Bearing vibration 4.8 mm/s exceeding 3.5 mm/s limit. Predictive failure model projects breakdown within 72 hours.",
    level: "critical",
    time: "10m ago",
    source: "IoT BMS",
    actionUrl: "/admin/maintenance",
    actionLabel: "Inspect Asset",
  },
  {
    id: "alt-2",
    title: "Weekend Demand Surge (+38%)",
    detail: "Booking velocity outpaced forecast for 26-28 Sep. Dynamic pricing suggests +₹1,200 ADR increase on Deluxe keys.",
    level: "warning",
    time: "25m ago",
    source: "Revenue Engine",
    actionUrl: "/admin/rates",
    actionLabel: "Adjust Rates",
  },
  {
    id: "alt-3",
    title: "VIP Arrival: Ambassador Suite #501",
    detail: "Mr. Aditya Singhania arriving in 45m. Pre-arrival champagne setup and room inspection awaiting duty manager sign-off.",
    level: "info",
    time: "42m ago",
    source: "Front Desk",
    actionUrl: "/admin/front-desk",
    actionLabel: "View Stay",
  },
];

export const roomsIcon = BedDouble;

