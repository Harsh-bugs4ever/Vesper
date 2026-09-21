import {
  CalendarClock,
  CircleDollarSign,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type ActionCategory = "pricing" | "inventory" | "staffing" | "maintenance";
export type UrgencyLevel = "high" | "medium" | "low";

export interface ActionItem {
  id: string;
  title: string;
  category: ActionCategory;
  urgency: UrgencyLevel;
  confidence: number; // 0 - 100
  impactAmount: number; // ₹
  impactDescription: string;
  drivers: string[];
  rationale: string;
  currentValue: string;
  proposedValue: string;
  unit?: string;
  targetDate?: string;
  roomType?: string;
  icon: LucideIcon;
  createdAt: string;
}

export const urgencyMeta: Record<UrgencyLevel, { label: string; chip: string; bar: string }> = {
  high: {
    label: "High Urgency",
    chip: "border-rose-300 bg-rose-50 text-rose-800",
    bar: "bg-rose-500",
  },
  medium: {
    label: "Medium",
    chip: "border-gold-300 bg-gold-50 text-gold-800",
    bar: "bg-gold-500",
  },
  low: {
    label: "Low",
    chip: "border-sand-300 bg-sand-100 text-sand-700",
    bar: "bg-sand-400",
  },
};

export const categoryMeta: Record<ActionCategory, { label: string; icon: LucideIcon }> = {
  pricing: { label: "Revenue & Pricing", icon: CircleDollarSign },
  inventory: { label: "Stock & F&B", icon: TrendingUp },
  staffing: { label: "Workforce", icon: Users },
  maintenance: { label: "Engineering", icon: Wrench },
};

export const initialActions: ActionItem[] = [
  {
    id: "ACT-101",
    title: "Surge Rate on Deluxe Rooms (Coldplay Weekend)",
    category: "pricing",
    urgency: "high",
    confidence: 94,
    impactAmount: 42000,
    impactDescription: "+₹42,000 incremental revenue across 30 room nights",
    drivers: [
      "Juhu comp-set sold out",
      "Coldplay concert in Bandra (21–22 Nov)",
      "Pace +140% vs. last year",
    ],
    rationale:
      "Competitor hotels are 96% booked for Friday and Saturday. Demand elasticity indicates zero cancellation risk at ₹11,200.",
    currentValue: "₹8,900",
    proposedValue: "₹11,200",
    unit: "per night",
    targetDate: "21–22 Nov 2026",
    roomType: "Deluxe Ocean View",
    icon: CircleDollarSign,
    createdAt: "10 mins ago",
  },
  {
    id: "ACT-102",
    title: "Preventive Inspection: Chiller 2 Condenser Fan",
    category: "maintenance",
    urgency: "high",
    confidence: 89,
    impactAmount: 85000,
    impactDescription: "Avoids ₹85,000 emergency repair + 3-day cooling outage",
    drivers: [
      "Condenser temp reached 52°C (+8°C anomaly)",
      "Vibration +120% above baseline",
      "Low occupancy window available 18–20 Nov",
    ],
    rationale:
      "Vibration patterns match bearing degradation profile. Scheduling repair during Wednesday's 62% occupancy prevents guest disturbance.",
    currentValue: "Unscheduled",
    proposedValue: "Book repair 19 Nov",
    targetDate: "19 Nov 2026",
    icon: Wrench,
    createdAt: "25 mins ago",
  },
  {
    id: "ACT-103",
    title: "Add 2 Housekeeping Staff for Sunday Peak Turnovers",
    category: "staffing",
    urgency: "medium",
    confidence: 91,
    impactAmount: 18000,
    impactDescription: "Prevents 45-min check-in delays & guest satisfaction dips",
    drivers: [
      "34 checkout departures scheduled before 12 PM",
      "28 arrivals requested early check-in before 2 PM",
      "Current roster has only 4 attendants on shift",
    ],
    rationale:
      "Staffing gap of 2 attendants will cause room ready delays. Auto-assigning Rajesh M. and Sunita K. from Tuesday off-shift.",
    currentValue: "4 Attendants",
    proposedValue: "6 Attendants",
    targetDate: "22 Nov 2026",
    icon: Users,
    createdAt: "1 hour ago",
  },
  {
    id: "ACT-104",
    title: "Reorder Basmati Rice & Olive Oil before Weekend Rush",
    category: "inventory",
    urgency: "medium",
    confidence: 86,
    impactAmount: 12500,
    impactDescription: "Ensures banquet catering & restaurant dining continuity",
    drivers: [
      "Basmati rice on-hand: 18kg (Min: 20kg)",
      "Banquet booked for 120 guests on Saturday",
      "Supplier lead time: 48 hours",
    ],
    rationale:
      "Stock is below safety buffer. Triggering PO-489 to Metro Cash & Carry ensures delivery by Friday afternoon.",
    currentValue: "18 kg",
    proposedValue: "Order 50 kg",
    unit: "kg",
    targetDate: "20 Nov 2026",
    icon: TrendingUp,
    createdAt: "2 hours ago",
  },
  {
    id: "ACT-105",
    title: "Executive Suite Minimum Stay Restriction (Dec 30 – Jan 2)",
    category: "pricing",
    urgency: "low",
    confidence: 96,
    impactAmount: 64000,
    impactDescription: "+₹64,000 projected by eliminating 1-night orphaned gaps",
    drivers: [
      "New Year's Eve peak demand",
      "Historical orphan night loss: 22%",
      "Direct channel searches +85%",
    ],
    rationale:
      "Enforce 3-night minimum stay restriction for all Suite categories to maximize RevPAR across the holiday weekend.",
    currentValue: "1 night min",
    proposedValue: "3 nights min",
    targetDate: "30 Dec – 2 Jan",
    roomType: "Executive Suites",
    icon: CalendarClock,
    createdAt: "3 hours ago",
  },
];
