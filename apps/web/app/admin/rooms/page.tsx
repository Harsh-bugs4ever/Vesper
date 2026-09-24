"use client";

import React, { useState, lazy, Suspense } from "react";
import {
  Activity,
  Building2,
  MapPin,
  Thermometer,
  Wifi,
  Zap,
} from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/* ---------- Lazy-loaded 3D scene component ---------- */
const Resort3DScene = lazy(() =>
  new Promise<{ default: React.ComponentType }>((resolve) => {
    // Simulate a 1.5s load for the heavy 3D scene bundle
    setTimeout(() => resolve({ default: Resort3DSceneInner }), 1500);
  })
);

/* ---------- The simulated 3D resort view ---------- */
function Resort3DSceneInner() {
  const [selectedFloor, setSelectedFloor] = useState(3);
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);

  const floors = [
    { floor: 1, label: "Ground · Garden & Sea Breeze Club", rooms: 10, occupied: 8, cleaning: 1, vacant: 1 },
    { floor: 2, label: "Floor 2 · Deluxe Ocean View", rooms: 30, occupied: 24, cleaning: 3, vacant: 3 },
    { floor: 3, label: "Floor 3 · Deluxe Ocean View", rooms: 30, occupied: 22, cleaning: 4, vacant: 4 },
    { floor: 4, label: "Floor 4 · Deluxe Ocean + Exec Suite", rooms: 35, occupied: 28, cleaning: 2, vacant: 5 },
    { floor: 5, label: "Floor 5 · Executive Ocean Suite", rooms: 25, occupied: 19, cleaning: 2, vacant: 4 },
    { floor: 6, label: "Beachfront · Presidential Villas", rooms: 15, occupied: 11, cleaning: 1, vacant: 3 },
  ];

  const selected = floors.find((f) => f.floor === selectedFloor)!;

  // Deterministic room grid based on floor + index to avoid hydration mismatch
  const rooms = Array.from({ length: selected.rooms }, (_, i) => {
    const roomNum = `${selectedFloor}${String(i + 1).padStart(2, "0")}`;
    // Deterministic status based on room number pattern
    const idx = selectedFloor * 100 + i;
    const status: "occupied" | "vacant" | "cleaning" | "maintenance" =
      idx % 10 < 7 ? "occupied" : idx % 10 < 8 ? "vacant" : idx % 10 < 9 ? "cleaning" : "maintenance";
    const temp = 21 + (idx % 5);
    return { id: roomNum, status, temp };
  });

  const statusColors = {
    occupied: "bg-sage-500",
    vacant: "bg-sand-300",
    cleaning: "bg-amber-400",
    maintenance: "bg-rose-400",
  };

  return (
    <div className="space-y-4">
      {/* Isometric building view */}
      <div className="relative overflow-hidden rounded-2xl border border-sand-200 bg-gradient-to-b from-sky-50 via-white to-sand-50 p-4 sm:p-6">
        <div className="flex flex-col items-center gap-1 py-4 sm:py-6">
          {floors.slice().reverse().map((f) => (
            <button
              key={f.floor}
              onClick={() => setSelectedFloor(f.floor)}
              className={cn(
                "relative flex h-11 items-center justify-center transition-all duration-200",
                "rounded-md border text-[10px] sm:text-xs font-semibold",
                selectedFloor === f.floor
                  ? "border-sage-500 bg-sage-100 text-sage-900 shadow-card z-10 scale-105"
                  : "border-sand-200 bg-white text-sand-700 hover:bg-sand-50 hover:scale-[1.02]"
              )}
              style={{
                width: `${Math.min(100, 50 + f.rooms * 1.4)}%`,
              }}
            >
              <span className="flex items-center gap-1 sm:gap-2">
                <Building2 className="hidden h-3.5 w-3.5 sm:block" />
                <span className="truncate">{f.label}</span>
              </span>
              <span className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 hidden items-center gap-1.5 text-[10px] sm:flex">
                <span className="h-2 w-2 rounded-full bg-sage-500" /> {f.occupied}
                <span className="h-2 w-2 rounded-full bg-sand-300" /> {f.vacant}
                <span className="h-2 w-2 rounded-full bg-amber-400" /> {f.cleaning}
              </span>
            </button>
          ))}
        </div>

        <div className="mx-auto mt-2 h-1 w-3/4 rounded-full bg-gradient-to-r from-transparent via-sand-300 to-transparent" />
        <p className="mt-1 text-center text-[10px] text-sand-500">
          <MapPin className="mr-1 inline h-3 w-3" />
          Juhu Tara Road · Beachfront Orientation · North-facing
        </p>
      </div>

      {/* Selected floor room grid */}
      <Panel>
        <PanelHeader
          title={`Floor ${selectedFloor} · Room Grid`}
          description={selected.label}
          action={
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-sand-500">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-sage-500" /> Occupied</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-sand-300" /> Vacant</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Cleaning</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-rose-400" /> Maintenance</span>
            </div>
          }
        />
        <PanelBody className="pt-4">
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
            {rooms.map((room) => (
              <button
                key={room.id}
                onMouseEnter={() => setHoveredRoom(room.id)}
                onMouseLeave={() => setHoveredRoom(null)}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-lg border p-1.5 sm:p-2 text-xs transition-all duration-150",
                  hoveredRoom === room.id
                    ? "scale-110 shadow-card z-10 border-sage-500 bg-white"
                    : "border-sand-200/80 bg-sand-50/60 hover:shadow-xs"
                )}
              >
                <span className={cn("mb-1 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-sm", statusColors[room.status])} />
                <span className="font-mono text-[9px] sm:text-[10px] font-semibold text-sand-800">{room.id}</span>
                {hoveredRoom === room.id && (
                  <span className="mt-0.5 text-[9px] text-sand-500">{room.temp}°C</span>
                )}
              </button>
            ))}
          </div>
        </PanelBody>
      </Panel>

      {/* Live telemetry strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-sand-200/80 bg-white p-3">
          <div className="flex items-center gap-2 text-xs text-sand-500">
            <Thermometer className="h-3.5 w-3.5" /> Avg. Room Temp
          </div>
          <p className="mt-1 font-serif text-lg font-semibold text-sand-950">23.4°C</p>
        </div>
        <div className="rounded-xl border border-sand-200/80 bg-white p-3">
          <div className="flex items-center gap-2 text-xs text-sand-500">
            <Wifi className="h-3.5 w-3.5" /> IoT Sensors Online
          </div>
          <p className="mt-1 font-serif text-lg font-semibold text-emerald-800">145 / 145</p>
        </div>
        <div className="rounded-xl border border-sand-200/80 bg-white p-3">
          <div className="flex items-center gap-2 text-xs text-sand-500">
            <Activity className="h-3.5 w-3.5" /> HVAC Status
          </div>
          <p className="mt-1 font-serif text-lg font-semibold text-sand-950">12 / 12 Online</p>
        </div>
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3">
          <div className="flex items-center gap-2 text-xs text-amber-600">
            <Zap className="h-3.5 w-3.5" /> Active Alerts
          </div>
          <p className="mt-1 font-serif text-lg font-semibold text-amber-900">1 Anomaly</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Loading skeleton ---------- */
function Resort3DLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-sand-200 bg-sand-50/50 p-6">
        <div className="flex flex-col items-center gap-2 py-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-11 rounded-md" style={{ width: `${50 + (6 - i) * 8}%` }} />
          ))}
        </div>
        <Skeleton className="mx-auto mt-2 h-1 w-3/4" />
        <Skeleton className="mx-auto mt-2 h-4 w-48" />
      </div>
      <div className="rounded-2xl border border-sand-200 bg-white p-6">
        <Skeleton className="h-5 w-48 mb-4" />
        <div className="grid grid-cols-8 gap-2">
          {[...Array(32)].map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function RoomsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="3D Resort Digital Twin"
        description="Interactive floor-by-floor view of 145 keys with live IoT telemetry, room status, and BMS sensor overlay."
      />

      <Suspense fallback={<Resort3DLoadingSkeleton />}>
        <Resort3DScene />
      </Suspense>
    </div>
  );
}
