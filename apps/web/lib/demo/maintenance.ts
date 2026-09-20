import {
  Building2,
  Fan,
  Flame,
  Droplets,
  Wind,
  Zap,
  ArrowUpDown,
  Gauge,
  Recycle,
  ShieldCheck,
  BatteryCharging,
  type LucideIcon,
} from "lucide-react";

import type { SensorPoint } from "@/components/charts/sensor-trend-chart";

/**
 * Demo asset register and sensor history for the maintenance section.
 *
 * The sensor series is the point of this screen: a slow rise over a fortnight with three
 * readings the anomaly model objected to. It is written out rather than generated so the
 * story the chart tells — vibration and condenser temperature climbing together since the
 * 5th — stays the same in every demo.
 */

export type RiskLevel = "high" | "medium" | "low";

export interface Asset {
  id: string;
  name: string;
  system: string;
  location: string;
  risk: RiskLevel;
  icon: LucideIcon;
  installedOn: string;
  lastServicedOn: string;
  active: boolean;
}

export const riskMeta: Record<RiskLevel, { label: string; chip: string; score: number }> = {
  high: { label: "High Risk", chip: "border-rose-200 bg-rose-50 text-rose-700", score: 71 },
  medium: { label: "Medium", chip: "border-gold-200 bg-gold-50 text-gold-800", score: 44 },
  low: { label: "Low", chip: "border-sage-200 bg-sage-50 text-sage-800", score: 16 },
};

export const assets: Asset[] = [
  {
    id: "HVAC-CH-002",
    name: "Chiller 2",
    system: "HVAC",
    location: "Plant Room (B2)",
    risk: "high",
    icon: Fan,
    installedOn: "12 Mar 2021",
    lastServicedOn: "18 Aug 2026",
    active: true,
  },
  {
    id: "HVAC-AHU-001",
    name: "AHU 1",
    system: "HVAC",
    location: "1st Floor",
    risk: "medium",
    icon: Building2,
    installedOn: "04 Jul 2021",
    lastServicedOn: "02 Sep 2026",
    active: true,
  },
  {
    id: "VT-LFT-003",
    name: "Lift 3 (Service)",
    system: "Vertical Transport",
    location: "Service Area",
    risk: "high",
    icon: ArrowUpDown,
    installedOn: "28 Jan 2020",
    lastServicedOn: "11 Jul 2026",
    active: true,
  },
  {
    id: "PWR-GEN-001",
    name: "Generator 1",
    system: "Power",
    location: "Basement",
    risk: "low",
    icon: Zap,
    installedOn: "19 Nov 2020",
    lastServicedOn: "06 Sep 2026",
    active: true,
  },
  {
    id: "WTR-PMP-002",
    name: "Water Pump 2",
    system: "Water System",
    location: "Basement",
    risk: "medium",
    icon: Droplets,
    installedOn: "22 May 2022",
    lastServicedOn: "30 Aug 2026",
    active: true,
  },
  {
    id: "FNB-EXF-001",
    name: "Kitchen Exhaust Fan",
    system: "F&B",
    location: "Kitchen",
    risk: "low",
    icon: Wind,
    installedOn: "15 Feb 2021",
    lastServicedOn: "12 Sep 2026",
    active: true,
  },
  {
    id: "UTL-BLR-001",
    name: "Boiler 1",
    system: "Utility",
    location: "Plant Room",
    risk: "medium",
    icon: Flame,
    installedOn: "08 Aug 2019",
    lastServicedOn: "25 Aug 2026",
    active: true,
  },
  {
    id: "WST-STP-001",
    name: "STP Unit",
    system: "Waste Management",
    location: "Rear Block",
    risk: "low",
    icon: Recycle,
    installedOn: "30 Sep 2021",
    lastServicedOn: "01 Sep 2026",
    active: true,
  },
  {
    id: "SFT-FPM-001",
    name: "Fire Pump",
    system: "Safety",
    location: "Basement",
    risk: "low",
    icon: ShieldCheck,
    installedOn: "17 Jun 2020",
    lastServicedOn: "09 Sep 2026",
    active: true,
  },
  {
    id: "ELC-UPS-001",
    name: "UPS System",
    system: "Electrical",
    location: "IT Room",
    risk: "medium",
    icon: BatteryCharging,
    installedOn: "03 Dec 2022",
    lastServicedOn: "21 Aug 2026",
    active: true,
  },
  {
    id: "HVAC-CH-001",
    name: "Chiller 1",
    system: "HVAC",
    location: "Plant Room (B2)",
    risk: "low",
    icon: Fan,
    installedOn: "12 Mar 2021",
    lastServicedOn: "18 Aug 2026",
    active: true,
  },
  {
    id: "WTR-PMP-001",
    name: "Water Pump 1",
    system: "Water System",
    location: "Basement",
    risk: "low",
    icon: Gauge,
    installedOn: "22 May 2022",
    lastServicedOn: "30 Aug 2026",
    active: true,
  },
];

/** Condenser temperature for Chiller 2 over the past fortnight, in °C. */
export const condenserTemperature: SensorPoint[] = [
  { date: "1 Sep", value: 31 },
  { date: "2 Sep", value: 30 },
  { date: "3 Sep", value: 32 },
  { date: "4 Sep", value: 31 },
  { date: "5 Sep", value: 36, anomaly: 36 },
  { date: "6 Sep", value: 33 },
  { date: "7 Sep", value: 34 },
  { date: "8 Sep", value: 35 },
  { date: "9 Sep", value: 36 },
  { date: "10 Sep", value: 42, anomaly: 42 },
  { date: "11 Sep", value: 39 },
  { date: "12 Sep", value: 41 },
  { date: "13 Sep", value: 43 },
  { date: "14 Sep", value: 44 },
  { date: "15 Sep", value: 46 },
  { date: "16 Sep", value: 50, anomaly: 50 },
  { date: "17 Sep", value: 48 },
  { date: "18 Sep", value: 49 },
  { date: "19 Sep", value: 51 },
  { date: "20 Sep", value: 52 },
];

export interface WorkOrder {
  id: string;
  asset: string;
  summary: string;
  priority: "High" | "Medium" | "Low";
  assignee: string;
  raised: string;
  due: string;
  state: "Open" | "In progress" | "Awaiting parts" | "Closed";
}

export const workOrders: WorkOrder[] = [
  {
    id: "WO-2291",
    asset: "Chiller 2",
    summary: "Inspect and clean condenser coils",
    priority: "High",
    assignee: "Rajesh Verma",
    raised: "19 Sep",
    due: "21 Sep",
    state: "Open",
  },
  {
    id: "WO-2290",
    asset: "Lift 3 (Service)",
    summary: "Door sensor recalibration",
    priority: "High",
    assignee: "Sameer Joshi",
    raised: "18 Sep",
    due: "20 Sep",
    state: "In progress",
  },
  {
    id: "WO-2288",
    asset: "AHU 1",
    summary: "Replace return air filters (Floor 1)",
    priority: "Medium",
    assignee: "Sameer Joshi",
    raised: "17 Sep",
    due: "22 Sep",
    state: "Awaiting parts",
  },
  {
    id: "WO-2285",
    asset: "Room 318",
    summary: "Split AC not cooling — guest reported",
    priority: "High",
    assignee: "Sameer Joshi",
    raised: "20 Sep",
    due: "20 Sep",
    state: "In progress",
  },
  {
    id: "WO-2281",
    asset: "Boiler 1",
    summary: "Quarterly pressure valve test",
    priority: "Medium",
    assignee: "Rajesh Verma",
    raised: "14 Sep",
    due: "25 Sep",
    state: "Open",
  },
  {
    id: "WO-2274",
    asset: "Water Pump 2",
    summary: "Bearing noise investigation",
    priority: "Low",
    assignee: "Rajesh Verma",
    raised: "09 Sep",
    due: "16 Sep",
    state: "Closed",
  },
];

export const workOrderStateChip: Record<WorkOrder["state"], string> = {
  Open: "border-sage-200 bg-sage-50 text-sage-800",
  "In progress": "border-gold-200 bg-gold-50 text-gold-800",
  "Awaiting parts": "border-sand-200 bg-sand-100 text-sand-700",
  Closed: "border-sand-200 bg-white text-sand-500",
};

export const priorityChip: Record<WorkOrder["priority"], string> = {
  High: "border-rose-200 bg-rose-50 text-rose-700",
  Medium: "border-gold-200 bg-gold-50 text-gold-800",
  Low: "border-sage-200 bg-sage-50 text-sage-800",
};
