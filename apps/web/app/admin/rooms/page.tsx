"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bed,
  Building2,
  CheckCircle2,
  Clock,
  Compass,
  Layers,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-context";
import { roomsApi, type BackendRoom, type BackendRoomBoard } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; badge: string; text: string }
> = {
  occupied: {
    label: "Occupied",
    color: "bg-sage-600",
    badge: "border-sage-300 bg-sage-50 text-sage-800",
    text: "text-sage-700",
  },
  ready: {
    label: "Ready",
    color: "bg-emerald-500",
    badge: "border-emerald-300 bg-emerald-50 text-emerald-800",
    text: "text-emerald-700",
  },
  dirty: {
    label: "Dirty (Turnover Required)",
    color: "bg-amber-400",
    badge: "border-amber-300 bg-amber-50 text-amber-800",
    text: "text-amber-700",
  },
  cleaning: {
    label: "Housekeeping in Progress",
    color: "bg-blue-400",
    badge: "border-blue-300 bg-blue-50 text-blue-800",
    text: "text-blue-700",
  },
  inspection: {
    label: "Inspection Pending",
    color: "bg-purple-400",
    badge: "border-purple-300 bg-purple-50 text-purple-800",
    text: "text-purple-700",
  },
  out_of_order: {
    label: "Out of Order / Maintenance",
    color: "bg-rose-500",
    badge: "border-rose-300 bg-rose-50 text-rose-800",
    text: "text-rose-700",
  },
};

export default function RoomsSpatialPage() {
  const { user } = useAuth();

  // Role Gate: Access granted to Departmental Managers (Front Desk, Maintenance, Housekeeping, F&B) & GM
  const isManagerOrGm =
    user?.role === "general_manager" ||
    user?.role === "owner" ||
    user?.role === "dept_manager_hk" ||
    user?.role === "dept_manager_fb" ||
    user?.role === "dept_manager_frontdesk" ||
    user?.role === "dept_manager_maint" ||
    user?.departmentKey === "maintenance" ||
    user?.departmentKey === "front_office" ||
    Boolean(user?.roleTitle?.toLowerCase().includes("manager")) ||
    Boolean(user?.roleTitle?.toLowerCase().includes("engineer")) ||
    user?.email === "chiefeng@vesper.demo" ||
    user?.email === "fom@vesper.demo";

  const [selectedFloorNum, setSelectedFloorNum] = useState<number | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<BackendRoom | null>(null);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

  // 1. Fetch live room board from backend
  const {
    data: roomBoard,
    isLoading: boardLoading,
    isError: boardError,
    refetch: refetchBoard,
  } = useQuery({
    queryKey: ["rooms-board-spatial", user?.propertyId],
    enabled: isManagerOrGm,
    queryFn: () => roomsApi.board(),
  });

  // 2. Fetch live occupancy snapshot
  const { data: occupancy, isLoading: occLoading } = useQuery({
    queryKey: ["rooms-occupancy-spatial", user?.propertyId],
    enabled: isManagerOrGm,
    queryFn: () => roomsApi.occupancy(),
  });

  const floors = roomBoard?.floors ?? [];
  const counts = roomBoard?.counts ?? {};

  // Default to first floor available when data loads
  const activeFloor = useMemo(() => {
    if (floors.length === 0) return null;
    if (selectedFloorNum !== null) {
      const match = floors.find((f) => f.floor === selectedFloorNum);
      if (match) return match;
    }
    return floors[0];
  }, [floors, selectedFloorNum]);

  if (!isManagerOrGm) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Resort Spatial Layout"
          description="Architectural room inventory and floor status schematics."
        />
        <div className="rounded-3xl border border-sand-200 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="mt-4 font-serif text-2xl font-bold text-sand-950">
            Manager Access Required
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-sand-600">
            Resort 3D schematics and architectural room status monitoring are restricted to General Management and Department Managers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resort Spatial Layout & Floor Schematics"
        description="Live floor-by-floor room status mapped directly from property room turnover data."
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sand-200 bg-sand-100/80 px-3 py-1 text-xs font-semibold text-sand-700">
              <Layers className="h-3.5 w-3.5 text-sage-700" />
              Floorplan Schematic Active
            </span>
          </div>
        }
      />

      {/* 3D Asset Disclaimer Badge */}
      <div className="flex items-start gap-3 rounded-2xl border border-sand-200 bg-sand-50/70 p-4 text-xs text-sand-600">
        <Compass className="mt-0.5 h-4 w-4 shrink-0 text-sage-700" />
        <div>
          <strong className="font-semibold text-sand-950">
            Architectural Schematic Mode:
          </strong>{" "}
          Rendering verified room configurations and live turn-over telemetry from the property database. High-polygon photogrammetric 3D CAD mesh is withheld pending sensor package calibration.
        </div>
      </div>

      {/* Live Floorplan Strip & Elevator Stack */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Elevator / Floor Stack Selector */}
        <div className="space-y-3 lg:col-span-1">
          <Panel>
            <PanelHeader
              title="Building Floor Stack"
              description="Select a vertical level to inspect room distribution"
            />
            <PanelBody className="space-y-2 p-3">
              {boardLoading ? (
                <div className="space-y-2 p-4 text-center text-xs text-sand-500">
                  <RefreshCw className="mx-auto h-5 w-5 animate-spin text-sage-600" />
                  <p className="mt-2">Loading building floors…</p>
                </div>
              ) : boardError ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-rose-700">Failed to load room board.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchBoard()}
                    className="mt-2 text-xs"
                  >
                    Retry
                  </Button>
                </div>
              ) : floors.length === 0 ? (
                <p className="p-4 text-center text-xs text-sand-500">No floors found on property.</p>
              ) : (
                floors
                  .slice()
                  .reverse()
                  .map((f) => {
                    const isSelected = activeFloor?.floor === f.floor;
                    const occupiedCount = f.rooms.filter((r) => r.status === "occupied").length;
                    const readyCount = f.rooms.filter((r) => r.status === "ready").length;
                    const dirtyCount = f.rooms.filter((r) => r.status === "dirty").length;

                    return (
                      <button
                        key={f.floor}
                        type="button"
                        onClick={() => setSelectedFloorNum(f.floor)}
                        className={cn(
                          "w-full rounded-xl border p-3.5 text-left transition-all",
                          isSelected
                            ? "border-sage-600 bg-sage-50 text-sage-950 shadow-sm ring-1 ring-sage-600"
                            : "border-sand-200 bg-white text-sand-700 hover:border-sand-300 hover:bg-sand-50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-serif text-sm font-bold">
                            Floor {f.floor}
                          </span>
                          <span className="text-[11px] font-mono text-sand-500">
                            {f.rooms.length} Rooms
                          </span>
                        </div>

                        <div className="mt-2 flex items-center gap-3 text-[10px]">
                          <span className="inline-flex items-center gap-1 text-sage-800">
                            <span className="h-2 w-2 rounded-full bg-sage-600" />
                            {occupiedCount} Occupied
                          </span>
                          <span className="inline-flex items-center gap-1 text-emerald-800">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            {readyCount} Ready
                          </span>
                          {dirtyCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-amber-800">
                              <span className="h-2 w-2 rounded-full bg-amber-400" />
                              {dirtyCount} Dirty
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
              )}
            </PanelBody>
          </Panel>
        </div>

        {/* Selected Floor Layout Grid */}
        <div className="space-y-6 lg:col-span-2">
          <Panel>
            <PanelHeader
              title={`Floor ${activeFloor?.floor ?? "—"} Layout & Room Grid`}
              description={
                activeFloor
                  ? `${activeFloor.rooms.length} registered room keys on this floor`
                  : "No floor selected"
              }
              action={
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-sand-600">
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-sage-600" /> Occupied
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Ready
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Dirty
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> OOO
                  </span>
                </div>
              }
            />
            <PanelBody className="p-6">
              {!activeFloor ? (
                <p className="py-12 text-center text-sm text-sand-500">
                  Select a floor from the building stack to view its layout.
                </p>
              ) : activeFloor.rooms.length === 0 ? (
                <p className="py-12 text-center text-sm text-sand-500">
                  No rooms configured on this level.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                  {activeFloor.rooms.map((room) => {
                    const cfg = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.ready;
                    const isHovered = hoveredRoomId === room.id;

                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => setSelectedRoom(room)}
                        onMouseEnter={() => setHoveredRoomId(room.id)}
                        onMouseLeave={() => setHoveredRoomId(null)}
                        className={cn(
                          "relative flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all",
                          isHovered
                            ? "scale-105 shadow-md ring-2 ring-sage-600 bg-white z-10"
                            : "border-sand-200 bg-sand-50/60 hover:bg-white hover:border-sand-300"
                        )}
                      >
                        <span className={cn("mb-1.5 h-2 w-2 rounded-full", cfg.color)} />
                        <span className="font-mono text-xs font-bold text-sand-900">
                          {room.number}
                        </span>
                        <span className="mt-0.5 truncate text-[9px] text-sand-500 max-w-full">
                          {room.category_name?.split(" ")[0] ?? "Room"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </PanelBody>
          </Panel>

          {/* Real Property Telemetry Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-sand-200 bg-white p-4 shadow-xs">
              <span className="text-xs text-sand-500">Total Rooms</span>
              <p className="mt-1 font-mono text-2xl font-bold text-sand-950">
                {occLoading ? "…" : occupancy?.total_rooms ?? counts.total ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-sand-200 bg-white p-4 shadow-xs">
              <span className="text-xs text-sand-500">Occupied</span>
              <p className="mt-1 font-mono text-2xl font-bold text-sage-800">
                {occLoading ? "…" : occupancy?.occupied_rooms ?? counts.occupied ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-sand-200 bg-white p-4 shadow-xs">
              <span className="text-xs text-sand-500">Ready for Arrival</span>
              <p className="mt-1 font-mono text-2xl font-bold text-emerald-700">
                {boardLoading ? "…" : counts.ready ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-sand-200 bg-white p-4 shadow-xs">
              <span className="text-xs text-sand-500">Turnover / Dirty</span>
              <p className="mt-1 font-mono text-2xl font-bold text-amber-700">
                {boardLoading ? "…" : counts.dirty ?? "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Room Detail Drawer */}
      <Drawer
        open={Boolean(selectedRoom)}
        onOpenChange={(open) => { if (!open) setSelectedRoom(null); }}
        title={selectedRoom ? `Room ${selectedRoom.number} · Overview` : "Room"}
        description={selectedRoom ? `${selectedRoom.category_name} · Floor ${selectedRoom.floor}` : ""}
      >
        {selectedRoom && (
          <div className="space-y-5 p-4">
            <div className="rounded-2xl border border-sand-200 bg-sand-50/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-sand-600">Current Status:</span>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                    STATUS_CONFIG[selectedRoom.status]?.badge ?? "bg-sand-100 text-sand-800"
                  )}
                >
                  {STATUS_CONFIG[selectedRoom.status]?.label ?? selectedRoom.status}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-sand-600">
                <span>Room Category:</span>
                <strong className="text-sand-900">{selectedRoom.category_name}</strong>
              </div>

              <div className="flex items-center justify-between text-xs text-sand-600">
                <span>Level / Floor:</span>
                <strong className="text-sand-900">Floor {selectedRoom.floor}</strong>
              </div>

              {selectedRoom.status_changed_at && (
                <div className="flex items-center justify-between text-xs text-sand-600">
                  <span>Last Turnover:</span>
                  <span className="font-mono text-sand-700">
                    {new Date(selectedRoom.status_changed_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </div>

            {selectedRoom.notes && (
              <div className="rounded-xl border border-sand-200 bg-white p-3.5 text-xs text-sand-700">
                <p className="font-semibold text-sand-950 mb-1">Housekeeping Notes:</p>
                <p>{selectedRoom.notes}</p>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
