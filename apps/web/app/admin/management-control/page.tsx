"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BedDouble,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  ConciergeBell,
  Layers,
  LineChart,
  Package,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  UtensilsCrossed,
  Wrench,
  X,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// --- Category Data Model ----------------------------------------------------

interface CategoryMeta {
  key: string;
  name: string;
  shortName: string;
  managerName: string;
  managerRole: string;
  managerInitials: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "amber" | "sage" | "forest" | "sand";
  roles: Array<{ role: string; count: number; color: string }>;
  totalStaff: number;
  overallRating: number;
  slaPercent: number;
  activeLoad: number;
  budgetSpent: number;
  budgetRemaining: number;
  forecast14d: Array<{ day: string; date: string; traffic: number; staffNeeded: number; staffScheduled: number }>;
  inventoryRequirements: Array<{ item: string; current: number; required: number; unit: string; status: "good" | "low" | "critical" }>;
  staffRoster: Array<{
    id: string;
    name: string;
    role: string;
    shift: string;
    checkInTime: string;
    attendanceStatus: "on_duty" | "late" | "on_break";
    rating: number;
    tasksDone: number;
    slaScore: number;
  }>;
}

const CATEGORIES: Record<string, CategoryMeta> = {
  fnb: {
    key: "fnb",
    name: "Food & Beverage (F&B)",
    shortName: "F&B",
    managerName: "Chef Devendra Rao",
    managerRole: "Executive Chef & Head of Culinary Operations",
    managerInitials: "DR",
    icon: UtensilsCrossed,
    tone: "amber",
    totalStaff: 14,
    overallRating: 4.8,
    slaPercent: 94,
    activeLoad: 8,
    budgetSpent: 68000,
    budgetRemaining: 52000,
    roles: [
      { role: "Line Chefs & Sous Chefs", count: 6, color: "bg-amber-500" },
      { role: "Waiters & Stewards", count: 5, color: "bg-orange-400" },
      { role: "Bartenders & Mixologists", count: 3, color: "bg-amber-300" },
    ],
    forecast14d: [
      { day: "Today", date: "27 Sep", traffic: 120, staffNeeded: 14, staffScheduled: 14 },
      { day: "Mon", date: "28 Sep", traffic: 95, staffNeeded: 11, staffScheduled: 12 },
      { day: "Tue", date: "29 Sep", traffic: 88, staffNeeded: 10, staffScheduled: 11 },
      { day: "Wed", date: "30 Sep", traffic: 105, staffNeeded: 12, staffScheduled: 12 },
      { day: "Thu", date: "01 Oct", traffic: 130, staffNeeded: 15, staffScheduled: 14 },
      { day: "Fri", date: "02 Oct", traffic: 165, staffNeeded: 18, staffScheduled: 16 },
      { day: "Sat", date: "03 Oct", traffic: 190, staffNeeded: 21, staffScheduled: 17 }, // Peak
      { day: "Sun", date: "04 Oct", traffic: 175, staffNeeded: 19, staffScheduled: 18 },
      { day: "Mon", date: "05 Oct", traffic: 90, staffNeeded: 10, staffScheduled: 11 },
      { day: "Tue", date: "06 Oct", traffic: 85, staffNeeded: 10, staffScheduled: 10 },
      { day: "Wed", date: "07 Oct", traffic: 110, staffNeeded: 13, staffScheduled: 12 },
      { day: "Thu", date: "08 Oct", traffic: 140, staffNeeded: 16, staffScheduled: 15 },
      { day: "Fri", date: "09 Oct", traffic: 180, staffNeeded: 20, staffScheduled: 17 },
      { day: "Sat", date: "10 Oct", traffic: 205, staffNeeded: 22, staffScheduled: 18 }, // Surge
    ],
    inventoryRequirements: [
      { item: "Fresh Atlantic Salmon & Seafood", current: 28, required: 45, unit: "kg", status: "low" },
      { item: "Poultry, Wagyu & Prime Cuts", current: 48, required: 65, unit: "kg", status: "low" },
      { item: "Artisan Burrata & Dairy Produce", current: 24, required: 26, unit: "kg", status: "good" },
      { item: "Wine Reserve & Sommelier Cellar", current: 42, required: 60, unit: "btl", status: "critical" },
      { item: "Organic Espresso Beans", current: 35, required: 30, unit: "kg", status: "good" },
    ],
    staffRoster: [
      { id: "s-1", name: "Ramesh Kumar", role: "Senior Line Chef", shift: "Morning (07:00 - 15:30)", checkInTime: "06:48 AM", attendanceStatus: "on_duty", rating: 4.9, tasksDone: 18, slaScore: 98 },
      { id: "s-2", name: "Pooja Varma", role: "Demi Chef de Partie", shift: "Morning (07:00 - 15:30)", checkInTime: "06:55 AM", attendanceStatus: "on_duty", rating: 4.8, tasksDone: 15, slaScore: 95 },
      { id: "s-3", name: "Suresh Pillai", role: "Head Mixologist", shift: "Evening (15:00 - 23:30)", checkInTime: "Scheduled", attendanceStatus: "on_break", rating: 5.0, tasksDone: 0, slaScore: 100 },
      { id: "s-4", name: "Amitabh Nair", role: "Captain & Head Steward", shift: "Morning (07:00 - 15:30)", checkInTime: "07:12 AM", attendanceStatus: "late", rating: 4.7, tasksDone: 22, slaScore: 91 },
      { id: "s-5", name: "Rohit Deshmukh", role: "Banquet Steward", shift: "Morning (07:00 - 15:30)", checkInTime: "06:50 AM", attendanceStatus: "on_duty", rating: 4.8, tasksDone: 14, slaScore: 94 },
      { id: "s-6", name: "Kavita Rao", role: "Commis Chef - Pastry", shift: "Morning (06:00 - 14:30)", checkInTime: "05:54 AM", attendanceStatus: "on_duty", rating: 4.9, tasksDone: 26, slaScore: 99 },
    ],
  },
  housekeeping: {
    key: "housekeeping",
    name: "Housekeeping & Rooms",
    shortName: "Housekeeping",
    managerName: "Sunita Sharma",
    managerRole: "Executive Housekeeper",
    managerInitials: "SS",
    icon: BedDouble,
    tone: "sage",
    totalStaff: 16,
    overallRating: 4.7,
    slaPercent: 96,
    activeLoad: 12,
    budgetSpent: 42000,
    budgetRemaining: 38000,
    roles: [
      { role: "Floor Supervisors", count: 3, color: "bg-sage-600" },
      { role: "Room Attendants", count: 9, color: "bg-emerald-500" },
      { role: "Public Area & Laundry", count: 4, color: "bg-teal-400" },
    ],
    forecast14d: [
      { day: "Today", date: "27 Sep", traffic: 42, staffNeeded: 16, staffScheduled: 16 },
      { day: "Mon", date: "28 Sep", traffic: 28, staffNeeded: 12, staffScheduled: 13 },
      { day: "Tue", date: "29 Sep", traffic: 25, staffNeeded: 11, staffScheduled: 12 },
      { day: "Wed", date: "30 Sep", traffic: 32, staffNeeded: 13, staffScheduled: 14 },
      { day: "Thu", date: "01 Oct", traffic: 38, staffNeeded: 15, staffScheduled: 15 },
      { day: "Fri", date: "02 Oct", traffic: 54, staffNeeded: 20, staffScheduled: 18 }, // Weekend arrivals
      { day: "Sat", date: "03 Oct", traffic: 62, staffNeeded: 23, staffScheduled: 19 },
      { day: "Sun", date: "04 Oct", traffic: 58, staffNeeded: 21, staffScheduled: 19 },
      { day: "Mon", date: "05 Oct", traffic: 30, staffNeeded: 12, staffScheduled: 13 },
      { day: "Tue", date: "06 Oct", traffic: 26, staffNeeded: 11, staffScheduled: 12 },
      { day: "Wed", date: "07 Oct", traffic: 34, staffNeeded: 14, staffScheduled: 14 },
      { day: "Thu", date: "08 Oct", traffic: 44, staffNeeded: 17, staffScheduled: 16 },
      { day: "Fri", date: "09 Oct", traffic: 58, staffNeeded: 21, staffScheduled: 18 },
      { day: "Sat", date: "10 Oct", traffic: 66, staffNeeded: 24, staffScheduled: 19 },
    ],
    inventoryRequirements: [
      { item: "Luxury Cotton Bed Linen Sets", current: 180, required: 240, unit: "sets", status: "low" },
      { item: "Plush Bath Robes & Towels", current: 220, required: 300, unit: "pcs", status: "low" },
      { item: "Hospital-Grade Sanitizers & Sprays", current: 45, required: 40, unit: "L", status: "good" },
      { item: "Guest Room Eco-Toiletries Amenity Kits", current: 80, required: 150, unit: "kits", status: "critical" },
    ],
    staffRoster: [
      { id: "hk-1", name: "Anita Yadav", role: "Floor 2 Supervisor", shift: "Morning (07:00 - 15:30)", checkInTime: "06:45 AM", attendanceStatus: "on_duty", rating: 4.9, tasksDone: 14, slaScore: 98 },
      { id: "hk-2", name: "Deepak Mehra", role: "Room Attendant (Floors 1-2)", shift: "Morning (07:00 - 15:30)", checkInTime: "06:52 AM", attendanceStatus: "on_duty", rating: 4.8, tasksDone: 8, slaScore: 96 },
      { id: "hk-3", name: "Lakshmi Bai", role: "Room Attendant (Villa Suites)", shift: "Morning (07:00 - 15:30)", checkInTime: "06:40 AM", attendanceStatus: "on_duty", rating: 5.0, tasksDone: 6, slaScore: 100 },
      { id: "hk-4", name: "Manoj Singh", role: "Linen & Laundry Lead", shift: "Morning (07:00 - 15:30)", checkInTime: "07:00 AM", attendanceStatus: "on_duty", rating: 4.7, tasksDone: 28, slaScore: 93 },
    ],
  },
  frontdesk: {
    key: "frontdesk",
    name: "Front Desk & Concierge",
    shortName: "Front Desk",
    managerName: "Ananya Sen",
    managerRole: "Front Office Director",
    managerInitials: "AS",
    icon: ConciergeBell,
    tone: "forest",
    totalStaff: 8,
    overallRating: 4.9,
    slaPercent: 98,
    activeLoad: 4,
    budgetSpent: 24000,
    budgetRemaining: 36000,
    roles: [
      { role: "Front Desk Duty Officers", count: 4, color: "bg-forest-600" },
      { role: "VIP Concierge & Experience", count: 2, color: "bg-emerald-600" },
      { role: "Bellhop & Valet Services", count: 2, color: "bg-forest-400" },
    ],
    forecast14d: [
      { day: "Today", date: "27 Sep", traffic: 36, staffNeeded: 8, staffScheduled: 8 },
      { day: "Mon", date: "28 Sep", traffic: 22, staffNeeded: 6, staffScheduled: 7 },
      { day: "Tue", date: "29 Sep", traffic: 18, staffNeeded: 6, staffScheduled: 6 },
      { day: "Wed", date: "30 Sep", traffic: 26, staffNeeded: 7, staffScheduled: 7 },
      { day: "Thu", date: "01 Oct", traffic: 32, staffNeeded: 8, staffScheduled: 8 },
      { day: "Fri", date: "02 Oct", traffic: 48, staffNeeded: 11, staffScheduled: 9 }, // Surge
      { day: "Sat", date: "03 Oct", traffic: 56, staffNeeded: 12, staffScheduled: 10 },
      { day: "Sun", date: "04 Oct", traffic: 50, staffNeeded: 11, staffScheduled: 10 },
      { day: "Mon", date: "05 Oct", traffic: 24, staffNeeded: 6, staffScheduled: 7 },
      { day: "Tue", date: "06 Oct", traffic: 20, staffNeeded: 6, staffScheduled: 6 },
      { day: "Wed", date: "07 Oct", traffic: 28, staffNeeded: 7, staffScheduled: 7 },
      { day: "Thu", date: "08 Oct", traffic: 36, staffNeeded: 9, staffScheduled: 8 },
      { day: "Fri", date: "09 Oct", traffic: 52, staffNeeded: 12, staffScheduled: 10 },
      { day: "Sat", date: "10 Oct", traffic: 60, staffNeeded: 13, staffScheduled: 10 },
    ],
    inventoryRequirements: [
      { item: "RFID Keycards & Wristbands", current: 320, required: 400, unit: "cards", status: "low" },
      { item: "Welcome Fruit & Flower Baskets", current: 18, required: 20, unit: "baskets", status: "good" },
      { item: "Property Maps & Concierge Guides", current: 250, required: 200, unit: "prints", status: "good" },
    ],
    staffRoster: [
      { id: "fd-1", name: "Priya Nair", role: "Duty Manager", shift: "Morning (07:00 - 15:30)", checkInTime: "06:48 AM", attendanceStatus: "on_duty", rating: 4.9, tasksDone: 24, slaScore: 99 },
      { id: "fd-2", name: "Kunal Kapoor", role: "Guest Experience Concierge", shift: "Morning (07:00 - 15:30)", checkInTime: "06:55 AM", attendanceStatus: "on_duty", rating: 5.0, tasksDone: 19, slaScore: 100 },
      { id: "fd-3", name: "Arjun Verma", role: "Front Desk Associate", shift: "Morning (07:00 - 15:30)", checkInTime: "06:58 AM", attendanceStatus: "on_duty", rating: 4.8, tasksDone: 21, slaScore: 97 },
    ],
  },
  maintenance: {
    key: "maintenance",
    name: "Engineering & Maintenance",
    shortName: "Engineering",
    managerName: "Rajesh Kulkarni",
    managerRole: "Chief Engineer & Facilities Director",
    managerInitials: "RK",
    icon: Wrench,
    tone: "sand",
    totalStaff: 6,
    overallRating: 4.6,
    slaPercent: 92,
    activeLoad: 3,
    budgetSpent: 18000,
    budgetRemaining: 42000,
    roles: [
      { role: "HVAC & Chiller Specialists", count: 2, color: "bg-blue-600" },
      { role: "Electrical & Plumbing Techs", count: 3, color: "bg-amber-600" },
      { role: "Civil & Grounds Crew", count: 1, color: "bg-emerald-600" },
    ],
    forecast14d: [
      { day: "Today", date: "27 Sep", traffic: 8, staffNeeded: 6, staffScheduled: 6 },
      { day: "Mon", date: "28 Sep", traffic: 6, staffNeeded: 5, staffScheduled: 5 },
      { day: "Tue", date: "29 Sep", traffic: 6, staffNeeded: 5, staffScheduled: 5 },
      { day: "Wed", date: "30 Sep", traffic: 7, staffNeeded: 5, staffScheduled: 5 },
      { day: "Thu", date: "01 Oct", traffic: 9, staffNeeded: 6, staffScheduled: 6 },
      { day: "Fri", date: "02 Oct", traffic: 12, staffNeeded: 7, staffScheduled: 6 },
      { day: "Sat", date: "03 Oct", traffic: 14, staffNeeded: 8, staffScheduled: 6 }, // Peak load
      { day: "Sun", date: "04 Oct", traffic: 12, staffNeeded: 7, staffScheduled: 6 },
      { day: "Mon", date: "05 Oct", traffic: 6, staffNeeded: 5, staffScheduled: 5 },
      { day: "Tue", date: "06 Oct", traffic: 5, staffNeeded: 5, staffScheduled: 5 },
      { day: "Wed", date: "07 Oct", traffic: 7, staffNeeded: 5, staffScheduled: 5 },
      { day: "Thu", date: "08 Oct", traffic: 9, staffNeeded: 6, staffScheduled: 6 },
      { day: "Fri", date: "09 Oct", traffic: 12, staffNeeded: 7, staffScheduled: 6 },
      { day: "Sat", date: "10 Oct", traffic: 14, staffNeeded: 8, staffScheduled: 6 },
    ],
    inventoryRequirements: [
      { item: "Chiller Unit 1 Bearing & Filter Kits", current: 2, required: 4, unit: "kits", status: "low" },
      { item: "LED Spotlights & Transformers", current: 40, required: 50, unit: "units", status: "good" },
      { item: "Plumbing Valves & PEX Seals", current: 12, required: 25, unit: "pcs", status: "low" },
    ],
    staffRoster: [
      { id: "m-1", name: "Farhan Siddiqui", role: "HVAC Senior Technician", shift: "Morning (08:00 - 16:30)", checkInTime: "07:50 AM", attendanceStatus: "on_duty", rating: 4.8, tasksDone: 5, slaScore: 96 },
      { id: "m-2", name: "Vijay Shinde", role: "Master Electrician", shift: "Morning (08:00 - 16:30)", checkInTime: "07:55 AM", attendanceStatus: "on_duty", rating: 4.7, tasksDone: 6, slaScore: 94 },
      { id: "m-3", name: "Gopal Rathore", role: "Plumber & Water Systems", shift: "Morning (08:00 - 16:30)", checkInTime: "08:15 AM", attendanceStatus: "late", rating: 4.4, tasksDone: 4, slaScore: 88 },
    ],
  },
};

// --- Management Control Page Component --------------------------------------

export default function ManagementControlPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [selectedKey, setSelectedKey] = useState<string>("fnb");
  const [showRosterDrawer, setShowRosterDrawer] = useState(false);

  const selectedCategory = CATEGORIES[selectedKey] ?? CATEGORIES.fnb;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Management Control"
        description="Unified General Manager operational command: 4 division flashcards, 14-day crowd & manpower forecasting, crowd inventory provisioning, and combined staff roster execution."
        meta={format(new Date(), "EEE, d MMM yyyy")}
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              All 4 Divisions Synchronized
            </span>
          </div>
        }
      />

      {/* ─────────────────────────────────────────────────────────────────────────────
          STEP 1: TOP-LEVEL FLASHCARDS (Summarizing All 4 Categories at a glance)
          ───────────────────────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sand-500">
              Operational Division Flashcards
            </h3>
            <span className="text-xs text-sand-400">· Select any category to deep-dive</span>
          </div>
          <span className="text-xs font-medium text-sand-500">
            Current Active Category: <strong className="text-sand-900">{selectedCategory.name}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.values(CATEGORIES).map((cat) => {
            const Icon = cat.icon;
            const isSelected = cat.key === selectedKey;

            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedKey(cat.key)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer",
                  isSelected
                    ? "border-sand-950 bg-white ring-2 ring-sand-950/10 shadow-md"
                    : "border-sand-200/90 bg-sand-50/50 hover:bg-white hover:border-sand-400 hover:shadow-xs"
                )}
              >
                {isSelected && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-sand-950" />
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg",
                          isSelected ? "bg-sand-950 text-white" : "bg-sand-200/60 text-sand-700"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-serif text-base font-bold text-sand-950">
                        {cat.shortName}
                      </span>
                    </div>

                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        cat.slaPercent >= 95
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      )}
                    >
                      {cat.slaPercent}% SLA
                    </span>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-sand-600">
                    <div className="flex justify-between items-center">
                      <span>Category Manager:</span>
                      <strong className="text-sand-900 font-semibold">{cat.managerName.split(" ").slice(-1)[0]}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Active On Duty:</span>
                      <strong className="text-sand-900 font-semibold">{cat.totalStaff} Workers</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Performance Rating:</span>
                      <strong className="text-gold-700 flex items-center gap-1 font-semibold">
                        <Star className="h-3 w-3 fill-gold-400 text-gold-500" />
                        {cat.overallRating} / 5.0
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-sand-200/60 flex items-center justify-between text-xs">
                  <span className="text-sand-400">{cat.activeLoad} active tasks</span>
                  <span
                    className={cn(
                      "font-semibold flex items-center gap-1",
                      isSelected ? "text-sand-950 font-bold" : "text-sage-700"
                    )}
                  >
                    {isSelected ? "Currently Inspected" : "Deep Dive"} <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          STEP 2: DEEP-DIVE COCKPIT FOR SELECTED CATEGORY (e.g. F&B)
          ───────────────────────────────────────────────────────────────────────────── */}
      <Panel className="border-sand-200/90 shadow-sm">
        <PanelHeader
          title={`${selectedCategory.name} Detailed Operational Command`}
          description={`Direct oversight for ${selectedCategory.managerName}'s division: staffing structure, upcoming crowd forecasting, and crowd inventory buffers.`}
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRosterDrawer(true)}
                className="gap-1.5 bg-sand-950 text-sand-50 hover:bg-sand-800 hover:text-white border-sand-950 font-medium"
              >
                <Users className="h-3.5 w-3.5 text-amber-400" />
                Inspect Staff Roster ({selectedCategory.totalStaff})
              </Button>
            </div>
          }
        />
        <PanelBody className="pt-5 space-y-6">

          {/* MANAGER BANNER & WORKERS ROLE BAR CHART */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center rounded-2xl bg-sand-50/70 border border-sand-200 p-5">
            {/* Category Manager Profile */}
            <div className="lg:col-span-5 flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sand-950 text-gold-400 font-serif text-lg font-bold shadow-xs">
                {selectedCategory.managerInitials}
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-sand-500 block">
                  Category Manager in Charge
                </span>
                <h3 className="font-serif text-xl font-bold text-sand-950">
                  {selectedCategory.managerName}
                </h3>
                <p className="text-xs text-sand-600 mt-0.5">
                  {selectedCategory.managerRole}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                    <UserCheck className="h-3 w-3" />
                    Verified On Site
                  </span>
                  <span className="text-xs text-sand-500 font-medium">
                    Shift 06:30 – 16:00
                  </span>
                </div>
              </div>
            </div>

            {/* Workers Breakdown in Visual Bar Chart Format */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-sand-200/90 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-sand-900">
                    Active Workforce Distribution ({selectedCategory.totalStaff} On Duty)
                  </h4>
                  <p className="text-xs text-sand-500">Live role allocation currently floor-deployed</p>
                </div>
                <span className="text-xs font-semibold text-emerald-700">100% Attendance Verified</span>
              </div>

              {/* Stacked Progress Bar */}
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-sand-100">
                {selectedCategory.roles.map((r, i) => {
                  const pct = Math.round((r.count / selectedCategory.totalStaff) * 100);
                  return (
                    <div
                      key={i}
                      title={`${r.role}: ${r.count} staff (${pct}%)`}
                      className={cn("h-full transition-all", r.color)}
                      style={{ width: `${pct}%` }}
                    />
                  );
                })}
              </div>

              {/* Role Legend and Counts */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                {selectedCategory.roles.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-sand-50 px-2.5 py-1.5 border border-sand-200/60">
                    <div className="flex items-center gap-2 truncate">
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", r.color)} />
                      <span className="truncate text-sand-700 font-medium">{r.role}</span>
                    </div>
                    <strong className="text-sand-950 font-bold ml-2">{r.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* LOWER GRID: 14-DAY FORECASTING (LEFT) & INVENTORY PROVISIONING (RIGHT) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* DOWN LEFT: 14-DAY BOOKING FORECASTING & MANPOWER NEEDED */}
            <div className="lg:col-span-7 rounded-2xl border border-sand-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-sand-100 pb-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-forest-600" />
                      <h4 className="font-serif text-base font-bold text-sand-950">
                        14-Day Demand & Manpower Forecasting
                      </h4>
                    </div>
                    <p className="text-xs text-sand-500 mt-0.5">
                      Projected crowd covers and required worker scaling to manage the traffic
                    </p>
                  </div>
                  <span className="rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-semibold text-sand-800">
                    AI Capacity Model
                  </span>
                </div>

                {/* 14-Day Bar Chart */}
                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-sand-500 mb-1">
                    <span>Bar height = Forecasted traffic / covers</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-[11px] font-medium text-sand-700">
                        <span className="h-2 w-2 rounded-xs bg-forest-600" />
                        Optimal Buffer
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-rose-700">
                        <span className="h-2 w-2 rounded-xs bg-rose-500" />
                        Manpower Shortage
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-14 gap-1 items-end h-36 pt-4 border-b border-sand-200">
                    {selectedCategory.forecast14d.map((fc, idx) => {
                      const maxTraffic = Math.max(...selectedCategory.forecast14d.map((f) => f.traffic));
                      const heightPct = Math.round((fc.traffic / maxTraffic) * 100);
                      const isShortage = fc.staffScheduled < fc.staffNeeded;

                      return (
                        <div key={idx} className="flex flex-col items-center gap-1 h-full justify-end group">
                          {/* Hover Tooltip Info */}
                          <span className="text-[9px] font-bold text-sand-600 group-hover:text-sand-950">
                            {fc.staffNeeded}p
                          </span>
                          <div
                            title={`${fc.day} (${fc.date}): ${fc.traffic} covers | Staff Needed: ${fc.staffNeeded} | Scheduled: ${fc.staffScheduled} ${isShortage ? `(Short by ${fc.staffNeeded - fc.staffScheduled})` : ""}`}
                            className={cn(
                              "w-full rounded-t-sm transition-all cursor-pointer",
                              isShortage
                                ? "bg-rose-500 group-hover:bg-rose-600"
                                : idx === 0
                                ? "bg-sand-900"
                                : "bg-forest-600 group-hover:bg-forest-700"
                            )}
                            style={{ height: `${Math.max(20, heightPct)}%` }}
                          />
                          <span className={cn("text-[9px] truncate w-full text-center", idx === 0 ? "font-bold text-sand-900" : "text-sand-500")}>
                            {fc.day.slice(0, 3)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary Narrative */}
                  <div className="mt-3 rounded-xl bg-sand-50/80 border border-sand-200 p-3 text-xs text-sand-700 space-y-1">
                    <p className="font-semibold text-sand-900 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-gold-600" />
                      AI Crowd Planning Insight:
                    </p>
                    <p>
                      Weekend banquet and dinner reservations peak on <strong>Sat, 03 Oct (190 covers)</strong> and <strong>Sat, 10 Oct (205 covers)</strong>.
                      Recommend adding <strong>+4 line stewards & 2 banquet hands</strong> to avoid SLA delays during evening rushes.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-sand-100 flex items-center justify-between text-xs">
                <span className="text-sand-500">Auto-calibrated with Front Desk reservations</span>
                <Link href="/admin/roster" className="font-semibold text-sage-700 hover:text-sage-900 flex items-center gap-1">
                  Adjust Roster Allocator <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* DOWN RIGHT: INVENTORY NEEDED TO MANAGE THAT CROWD */}
            <div className="lg:col-span-5 rounded-2xl border border-sand-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-sand-100 pb-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-amber-600" />
                      <h4 className="font-serif text-base font-bold text-sand-950">
                        Crowd Inventory Provisioning
                      </h4>
                    </div>
                    <p className="text-xs text-sand-500 mt-0.5">
                      Required stock buffers to sustain the 14-day forecasted traffic
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                    {selectedCategory.inventoryRequirements.filter((i) => i.status !== "good").length} Low Stock
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {selectedCategory.inventoryRequirements.map((inv, idx) => {
                    const pct = Math.min(100, Math.round((inv.current / inv.required) * 100));
                    const isDeficit = inv.current < inv.required;

                    return (
                      <div key={idx} className="rounded-xl border border-sand-200/80 bg-sand-50/40 p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sand-900 truncate max-w-[200px]">
                            {inv.item}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                              inv.status === "critical"
                                ? "bg-rose-100 text-rose-800"
                                : inv.status === "low"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            )}
                          >
                            {inv.status === "critical" ? "Critical Deficit" : inv.status === "low" ? "Needs Refill" : "Stocked"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sand-600 text-[11px]">
                          <span>Current: <strong>{inv.current} {inv.unit}</strong></span>
                          <span>Target for Crowd: <strong>{inv.required} {inv.unit}</strong></span>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-2 w-full overflow-hidden rounded-full bg-sand-200">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              pct < 50 ? "bg-rose-500" : pct < 85 ? "bg-amber-500" : "bg-emerald-600"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-sand-100 flex items-center justify-between">
                <Button
                  size="sm"
                  onClick={() => {
                    showToast({
                      title: "Procurement Requisition Generated",
                      description: `Auto-generated batch restock order for ${selectedCategory.name} crowd buffer.`,
                      type: "default",
                    });
                  }}
                  className="w-full bg-sand-900 text-sand-50 hover:bg-sand-800 text-xs py-2"
                >
                  Generate 1-Click Crowd Requisition
                </Button>
              </div>
            </div>

          </div>

          {/* SECTION: CLICKABLE STAFF ROSTER & LIVE PERFORMANCE (INLINE PREVIEW) */}
          <div className="rounded-2xl border border-sand-200 bg-sand-50/50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-serif text-lg font-bold text-sand-950 flex items-center gap-2">
                  <Users className="h-4 w-4 text-sage-700" />
                  Staff Roster Working Under {selectedCategory.managerName}
                </h4>
                <p className="text-xs text-sand-600 mt-0.5">
                  Click to inspect live check-in attendance, shift status, and individual review performance
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRosterDrawer((v) => !v)}
                className="text-xs border-sand-300 hover:bg-white gap-1"
              >
                {showRosterDrawer ? "Collapse Staff Roster" : "Open Full Staff Roster & Ratings"}
                <ChevronDown className={cn("h-4 w-4 transition-transform", showRosterDrawer && "rotate-180")} />
              </Button>
            </div>

            {/* Clickable Staff Roster Table */}
            {showRosterDrawer && (
              <div className="mt-4 overflow-hidden rounded-xl border border-sand-200 bg-white shadow-xs animate-in fade-in duration-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-sand-100/70 border-b border-sand-200 text-sand-700 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Staff Member</th>
                        <th className="py-3 px-4">Assigned Role</th>
                        <th className="py-3 px-4">Shift Schedule</th>
                        <th className="py-3 px-4">Attendance Check-in</th>
                        <th className="py-3 px-4">Performance Rating</th>
                        <th className="py-3 px-4">Tasks Completed</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand-100 text-sand-800">
                      {selectedCategory.staffRoster.map((staff) => (
                        <tr key={staff.id} className="hover:bg-sand-50/60 transition-colors">
                          <td className="py-3 px-4 font-semibold text-sand-950">
                            {staff.name}
                          </td>
                          <td className="py-3 px-4 text-sand-600">
                            {staff.role}
                          </td>
                          <td className="py-3 px-4 text-sand-600">
                            {staff.shift}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px]">
                            {staff.checkInTime}
                          </td>
                          <td className="py-3 px-4 font-bold text-gold-700">
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-gold-400 text-gold-500" />
                              {staff.rating} / 5.0
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-sand-900">{staff.tasksDone} orders</span>
                            <span className="text-emerald-700 text-[10px] ml-1">({staff.slaScore}% SLA)</span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                                staff.attendanceStatus === "on_duty"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : staff.attendanceStatus === "late"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-sand-100 text-sand-600"
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  staff.attendanceStatus === "on_duty"
                                    ? "bg-emerald-600"
                                    : staff.attendanceStatus === "late"
                                    ? "bg-amber-600"
                                    : "bg-sand-400"
                                )}
                              />
                              {staff.attendanceStatus.replace("_", " ")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        </PanelBody>
      </Panel>
    </div>
  );
}
