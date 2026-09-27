"use client";

import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { safeFormatDate } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BedDouble,
  Check,
  ChevronDown,
  CircleMinus,
  ClipboardList,
  DoorClosed,
  DoorOpen,
  Filter,
  Loader2,
  LoaderCircle,
  NotebookPen,
  RefreshCw,
  Search,
  Sparkles,
  SprayCan,
  TriangleAlert,
  UserCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";
import { PeriodSelect } from "@/components/ui/period-select";
import { StatTile } from "@/components/ui/stat-tile";
import { useToast } from "@/components/ui/toast";
import { rooms as roomsApi, type BackendRoom, type BackendRoomBoard } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";
import { MaintenancePanel } from "@/components/connected/maintenance-panel";
import { cn } from "@/lib/utils";

type HousekeepingStatus =
  | "ready"
  | "occupied"
  | "dirty"
  | "cleaning"
  | "inspection"
  | "out_of_order";

interface StatusPresentation {
  label: string;
  shortLabel: string;
  dot: string;
  chip: string;
  tile: string;
  nextStep?: {
    action: string;
    to: HousekeepingStatus;
  };
}

const STATUS_META: Record<HousekeepingStatus, StatusPresentation> = {
  ready: {
    label: "Ready / Clean",
    shortLabel: "Ready",
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    tile: "border-emerald-200/90 bg-emerald-50/40 text-emerald-950 hover:border-emerald-400",
    nextStep: { action: "Mark Dirty for Turnover", to: "dirty" },
  },
  dirty: {
    label: "Dirty / Turnover Required",
    shortLabel: "Dirty",
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-800 border-rose-200",
    tile: "border-rose-200/90 bg-rose-50/60 text-rose-950 hover:border-rose-400",
    nextStep: { action: "Start Attendant Cleaning", to: "cleaning" },
  },
  cleaning: {
    label: "Cleaning in Progress",
    shortLabel: "Cleaning",
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    tile: "border-amber-200/90 bg-amber-50/50 text-amber-950 hover:border-amber-400",
    nextStep: { action: "Send for Inspection", to: "inspection" },
  },
  inspection: {
    label: "Inspection Pending",
    shortLabel: "Inspection",
    dot: "bg-purple-500",
    chip: "bg-purple-50 text-purple-800 border-purple-200",
    tile: "border-purple-200/90 bg-purple-50/40 text-purple-950 hover:border-purple-400",
    nextStep: { action: "Approve & Mark Ready", to: "ready" },
  },
  occupied: {
    label: "Occupied by Guest",
    shortLabel: "Occupied",
    dot: "bg-blue-500",
    chip: "bg-blue-50 text-blue-800 border-blue-200",
    tile: "border-blue-200/90 bg-blue-50/40 text-blue-950 hover:border-blue-400",
    nextStep: { action: "Request Daily Turnover", to: "dirty" },
  },
  out_of_order: {
    label: "Out of Order / Blocked",
    shortLabel: "Blocked",
    dot: "bg-stone-500",
    chip: "bg-stone-100 text-stone-700 border-stone-300",
    tile: "border-stone-200/90 bg-stone-100/70 text-stone-900 hover:border-stone-400",
    nextStep: { action: "Release to Cleaning", to: "cleaning" },
  },
};

const STATUS_ORDER: HousekeepingStatus[] = [
  "ready",
  "dirty",
  "cleaning",
  "inspection",
  "occupied",
  "out_of_order",
];

const OCCUPANCY_OPTIONS = [
  "All Occupancy",
  "Occupied Only",
  "Vacant Only",
  "Occupied & Needs Cleaning",
];

export default function HousekeepingPage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [floor, setFloor] = useState("All Floors");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [occupancyFilter, setOccupancyFilter] = useState(OCCUPANCY_OPTIONS[0]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [statusNote, setStatusNote] = useState("");

  // Real backend query scoped by property
  const {
    data: board,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<BackendRoomBoard>({
    queryKey: ["rooms-board", user?.propertyId, user?.id, user?.departmentId],
    queryFn: () => roomsApi.board(),
    enabled: Boolean(user),
    refetchInterval: 15_000,
  });

  // Flat list of all rooms
  const allRooms = useMemo(() => {
    if (!board?.floors) return [];
    return board.floors.flatMap((f) => f.rooms);
  }, [board]);

  // Dynamic filter options
  const floorOptions = useMemo(() => {
    if (!board?.floors) return ["All Floors"];
    const numbers = board.floors.map((f) => `Floor ${f.floor}`);
    return ["All Floors", ...numbers];
  }, [board]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    allRooms.forEach((r) => {
      if (r.category_name) set.add(r.category_name);
    });
    return ["All Categories", ...Array.from(set).sort()];
  }, [allRooms]);

  const statusOptions = useMemo(() => {
    return ["All Statuses", ...STATUS_ORDER.map((k) => STATUS_META[k].label)];
  }, []);

  // Filtered rooms
  const visibleRooms = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allRooms.filter((room) => {
      if (floor !== "All Floors" && `Floor ${room.floor}` !== floor) return false;
      if (categoryFilter !== "All Categories" && room.category_name !== categoryFilter)
        return false;

      // Housekeeping status filter
      if (statusFilter !== "All Statuses") {
        const meta = STATUS_META[room.status as HousekeepingStatus];
        if (meta?.label !== statusFilter) return false;
      }

      // Distinct Occupancy filter
      const isOccupied = room.status === "occupied" || room.is_occupied === true;
      if (occupancyFilter === "Occupied Only" && !isOccupied) return false;
      if (occupancyFilter === "Vacant Only" && isOccupied) return false;
      if (occupancyFilter === "Occupied & Needs Cleaning") {
        // Room is occupied AND marked dirty or cleaning or has turnover requested
        if (!isOccupied) return false;
        if (room.status !== "dirty" && room.status !== "cleaning") {
          // If status is "occupied" but notes indicate service needed
          const notesLower = (room.notes || "").toLowerCase();
          const needsService =
            notesLower.includes("clean") ||
            notesLower.includes("towel") ||
            notesLower.includes("dirty") ||
            notesLower.includes("service");
          if (!needsService) return false;
        }
      }

      if (needle && !room.number.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [allRooms, floor, categoryFilter, statusFilter, occupancyFilter, query]);

  // Group visible rooms by floor
  const byFloor = useMemo(() => {
    const groups = new Map<number, BackendRoom[]>();
    visibleRooms.forEach((room) => {
      const list = groups.get(room.floor) ?? [];
      list.push(room);
      groups.set(room.floor, list);
    });
    return [...groups.entries()].sort(([a], [b]) => a - b);
  }, [visibleRooms]);

  // Currently selected room
  const selected = useMemo(() => {
    if (!selectedId) {
      return visibleRooms[0] ?? allRooms[0] ?? null;
    }
    return allRooms.find((r) => r.id === selectedId) ?? null;
  }, [selectedId, allRooms, visibleRooms]);

  // Mutation to persist status changes to real backend
  const updateStatus = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      roomsApi.setStatus(id, status, note),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["rooms-board"] });
      showToast({
        title: `Room ${updated.number} Updated`,
        description: `Status successfully updated to ${STATUS_META[updated.status as HousekeepingStatus]?.label ?? updated.status}.`,
        type: "success",
      });
      setStatusNote("");
    },
    onError: (err) => {
      showToast({
        title: "Status Update Failed",
        description:
          err instanceof Error
            ? err.message
            : "Could not persist room status to the server.",
        type: "error",
      });
    },
  });

  const toggleFloor = (value: number) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  const counts = board?.counts ?? {};
  const total = allRooms.length;
  const occupiedCount = counts["occupied"] ?? 0;
  const readyCount = counts["ready"] ?? 0;
  const dirtyCount = counts["dirty"] ?? 0;
  const cleaningCount = counts["cleaning"] ?? 0;
  const blockedCount = counts["out_of_order"] ?? 0;

  const pct = (val: number) => (total > 0 ? Math.round((val / total) * 100) : 0);

  const now = new Date();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Housekeeping Board"
        description="Live floor-by-floor room serviceability and distinct occupancy tracking."
        meta={
          <div className="text-right">
            <span className="block text-sm font-medium text-sand-900">
              {format(now, "EEE, d MMM yyyy")}
            </span>
            <span className="block text-xs text-sand-500">{format(now, "hh:mm a")}</span>
          </div>
        }
      />

      {/* Backend API Failure State */}
      {isError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50/80 p-6 text-rose-900"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <h3 className="font-serif text-lg font-semibold text-rose-950">
                Could not load housekeeping data from server
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-rose-700">
                {error instanceof Error ? error.message : "The backend service is unreachable."}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-4 py-2 text-xs font-medium text-white hover:bg-rose-800"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry Connection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stat Tiles: Computed from real backend room board */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile
          variant="value-first"
          label="Total Inventory"
          value={isLoading || isError ? "—" : total}
          tone="sand"
          icon={ClipboardList}
        />
        <StatTile
          variant="value-first"
          label="Occupied Rooms"
          value={board ? occupiedCount : "—"}
          change={board ? `${pct(occupiedCount)}%` : "Unavailable"}
          intent="good"
          comparison="In-house guests"
          tone="sage"
          icon={DoorClosed}
        />
        <StatTile
          variant="value-first"
          label="Ready / Clean"
          value={board ? readyCount : "—"}
          change={board ? `${pct(readyCount)}%` : "Unavailable"}
          intent="good"
          comparison="Available for check-in"
          tone="forest"
          icon={BedDouble}
        />
        <StatTile
          variant="value-first"
          label="Dirty / Turnover"
          value={board ? dirtyCount : "—"}
          change={board ? `${pct(dirtyCount)}%` : "Unavailable"}
          intent="bad"
          comparison="Awaiting cleaning"
          tone="rose"
          icon={SprayCan}
        />
        <StatTile
          variant="value-first"
          label="Cleaning in Progress"
          value={board ? cleaningCount : "—"}
          change={board ? `${pct(cleaningCount)}%` : "Unavailable"}
          intent="neutral"
          comparison="Attendant assigned"
          tone="sand"
          icon={LoaderCircle}
        />
        <StatTile
          variant="value-first"
          label="Out of Order"
          value={board ? blockedCount : "—"}
          change={board ? `${pct(blockedCount)}%` : "Unavailable"}
          intent="neutral"
          comparison="Maintenance blocked"
          tone="rose"
          icon={CircleMinus}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,390px)]">
        {/* Main Board Panel */}
        <Panel>
          <PanelBody className="space-y-5">
            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2.5">
              <PeriodSelect value={floor} onChange={setFloor} options={floorOptions} />
              <PeriodSelect
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={categoryOptions}
              />
              <PeriodSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusOptions}
              />
              <PeriodSelect
                value={occupancyFilter}
                onChange={setOccupancyFilter}
                options={OCCUPANCY_OPTIONS}
              />

              <div className="min-w-[180px] flex-1">
                <Input
                  icon={<Search className="h-4 w-4" />}
                  placeholder="Search room number…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-9"
                />
              </div>

              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="inline-flex items-center gap-1.5 text-xs text-sand-600 transition-colors hover:text-sand-900 disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
                {isFetching ? "Refreshing…" : "Sync with PMS"}
              </button>
            </div>

            {/* Status & Occupancy Legend */}
            <div className="flex flex-wrap items-center justify-between gap-y-2 border-b border-sand-200/80 pb-4 text-xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span className="text-sand-500 font-medium">Service Status:</span>
                {STATUS_ORDER.map((k) => (
                  <span key={k} className="inline-flex items-center gap-1.5 text-sand-700">
                    <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_META[k].dot)} />
                    {STATUS_META[k].shortLabel}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sand-500 font-medium">Occupancy:</span>
                <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-200">
                  <UserCheck className="h-3 w-3" /> Occupied
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-600 border border-stone-200">
                  <DoorOpen className="h-3 w-3" /> Vacant
                </span>
              </div>
            </div>

            {/* Loading Indicator */}
            {isLoading && (
              <div className="py-20 text-center" role="status">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-sand-500" />
                <p className="mt-3 text-sm text-sand-600">Retrieving live room board from server…</p>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !isError && byFloor.length === 0 && (
              <div className="py-16 text-center text-sand-500">
                <Filter className="mx-auto h-8 w-8 text-sand-300" aria-hidden="true" />
                <p className="mt-3 font-medium text-sand-900">No rooms match active filters</p>
                <p className="mt-1 text-xs text-sand-500">
                  Try adjusting the floor, room category, or occupancy filter.
                </p>
              </div>
            )}

            {/* Floor by floor board */}
            {!isLoading && !isError && byFloor.length > 0 && (
              <div className="space-y-6">
                {byFloor.map(([floorNumber, floorRooms]) => {
                  const isCollapsed = collapsed.has(floorNumber);
                  return (
                    <div key={floorNumber} className="border-b border-sand-100 pb-5 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => toggleFloor(floorNumber)}
                        aria-expanded={!isCollapsed}
                        className="mb-3 flex items-center gap-2 text-left hover:text-sand-950"
                      >
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-sand-500 transition-transform",
                            isCollapsed && "-rotate-90"
                          )}
                        />
                        <span className="font-serif text-lg font-semibold text-sand-950">
                          Floor {floorNumber}
                        </span>
                        <span className="text-xs text-sand-500">
                          ({floorRooms.length} room{floorRooms.length === 1 ? "" : "s"})
                        </span>
                      </button>

                      {!isCollapsed && (
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9">
                          {floorRooms.map((room) => {
                            const isSelected = selected?.id === room.id;
                            const statusMeta =
                              STATUS_META[room.status as HousekeepingStatus] ?? STATUS_META.ready;
                            const isOccupied =
                              room.status === "occupied" || room.is_occupied === true;

                            return (
                              <button
                                key={room.id}
                                type="button"
                                onClick={() => setSelectedId(room.id)}
                                aria-current={isSelected ? "true" : undefined}
                                className={cn(
                                  "relative flex flex-col justify-between rounded-xl border p-2.5 text-left transition-all",
                                  statusMeta.tile,
                                  isSelected
                                    ? "ring-2 ring-sage-700 ring-offset-2 scale-[1.03] shadow-md z-10"
                                    : "hover:scale-[1.02]"
                                )}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-serif text-base font-bold tabular-nums">
                                    {room.number}
                                  </span>
                                  {/* Distinct Occupancy Badge */}
                                  <span
                                    title={isOccupied ? "Occupied by guest" : "Vacant room"}
                                    className={cn(
                                      "inline-flex items-center justify-center rounded px-1 text-[9px] font-semibold uppercase tracking-wider",
                                      isOccupied
                                        ? "bg-blue-600 text-white"
                                        : "bg-stone-200 text-stone-700"
                                    )}
                                  >
                                    {isOccupied ? "OCC" : "VAC"}
                                  </span>
                                </div>

                                <div className="mt-2 flex items-center justify-between gap-1">
                                  <span className="text-[11px] font-medium opacity-90 truncate">
                                    {statusMeta.shortLabel}
                                  </span>
                                  <span
                                    className={cn("h-2 w-2 shrink-0 rounded-full", statusMeta.dot)}
                                    aria-hidden="true"
                                  />
                                </div>

                                {room.notes && (
                                  <span className="mt-1 block truncate text-[10px] text-sand-500 italic">
                                    {room.notes}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </PanelBody>
        </Panel>

        {/* Selected Room Details Panel */}
        <Panel className="h-fit xl:sticky xl:top-24">
          {selected === null ? (
            <PanelBody className="py-16 text-center text-sm text-sand-500">
              Select a room on the board to view its live status and operations.
            </PanelBody>
          ) : (
            <PanelBody className="space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-sand-200/80 pb-4">
                <div>
                  <h2 className="font-serif text-3xl font-semibold text-sand-950">
                    Room {selected.number}
                  </h2>
                  <p className="mt-1 text-xs text-sand-600">
                    {selected.category_name}
                    <span className="mx-2 text-sand-300">|</span>
                    Floor {selected.floor}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  {/* Distinct Occupancy Badge */}
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                      selected.status === "occupied" || selected.is_occupied
                        ? "border-blue-300 bg-blue-50 text-blue-800"
                        : "border-stone-300 bg-stone-100 text-stone-700"
                    )}
                  >
                    {selected.status === "occupied" || selected.is_occupied
                      ? "Occupied by Guest"
                      : "Vacant"}
                  </span>
                  {/* Housekeeping Badge */}
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      STATUS_META[selected.status as HousekeepingStatus]?.chip ??
                        STATUS_META.ready.chip
                    )}
                  >
                    {STATUS_META[selected.status as HousekeepingStatus]?.label ?? selected.status}
                  </span>
                </div>
              </div>

              {/* Status Details */}
              <dl className="grid grid-cols-2 gap-3 rounded-xl bg-sand-50/80 p-3.5 text-xs">
                <div>
                  <dt className="text-sand-500">Category Key</dt>
                  <dd className="mt-0.5 font-medium text-sand-900">{selected.category_key}</dd>
                </div>
                <div>
                  <dt className="text-sand-500">Last Changed</dt>
                  <dd className="mt-0.5 font-medium text-sand-900">
                    {safeFormatDate(selected.status_changed_at, "d MMM, hh:mm a")}
                  </dd>
                </div>
                <div className="col-span-2 border-t border-sand-200/60 pt-2">
                  <dt className="text-sand-500">Housekeeping Notes</dt>
                  <dd className="mt-0.5 font-normal text-sand-800">
                    {selected.notes || "No notes registered for this room."}
                  </dd>
                </div>
              </dl>

              {/* Status Update Form */}
              <div className="border-t border-sand-200/80 pt-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-sand-700">
                  Update Housekeeping Status
                </h3>

                <div>
                  <label htmlFor="status-note" className="block text-xs text-sand-600">
                    Shift handover note (optional)
                  </label>
                  <input
                    id="status-note"
                    type="text"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="e.g. Linen turnover complete; restocked towels"
                    className="mt-1 block w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-xs text-sand-950 focus:border-sage-600 focus:outline-none focus:ring-1 focus:ring-sage-600"
                  />
                </div>

                {/* Primary Next Action Button */}
                {STATUS_META[selected.status as HousekeepingStatus]?.nextStep && (
                  <Button
                    className="w-full"
                    disabled={updateStatus.isPending || !hasPermission("rooms:status_write")}
                    onClick={() => {
                      const next =
                        STATUS_META[selected.status as HousekeepingStatus]?.nextStep?.to;
                      if (next) {
                        updateStatus.mutate({
                          id: selected.id,
                          status: next,
                          note: statusNote.trim() || undefined,
                        });
                      }
                    }}
                  >
                    {updateStatus.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {STATUS_META[selected.status as HousekeepingStatus]?.nextStep?.action}
                  </Button>
                )}

                {/* Direct Status Override Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateStatus.isPending || !hasPermission("rooms:status_write") || selected.status === "ready"}
                    onClick={() =>
                      updateStatus.mutate({
                        id: selected.id,
                        status: "ready",
                        note: statusNote.trim() || "Inspected and ready",
                      })
                    }
                  >
                    Mark Ready
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateStatus.isPending || !hasPermission("rooms:status_write") || selected.status === "dirty"}
                    onClick={() =>
                      updateStatus.mutate({
                        id: selected.id,
                        status: "dirty",
                        note: statusNote.trim() || "Marked dirty for cleaning",
                      })
                    }
                  >
                    Mark Dirty
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateStatus.isPending || !hasPermission("rooms:status_write") || selected.status === "cleaning"}
                    onClick={() =>
                      updateStatus.mutate({
                        id: selected.id,
                        status: "cleaning",
                        note: statusNote.trim() || "Attendant cleaning",
                      })
                    }
                  >
                    Start Cleaning
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateStatus.isPending || !hasPermission("rooms:status_write") || selected.status === "out_of_order"}
                    onClick={() =>
                      updateStatus.mutate({
                        id: selected.id,
                        status: "out_of_order",
                        note: statusNote.trim() || "Blocked for maintenance",
                      })
                    }
                  >
                    Block Room
                  </Button>
                </div>
              </div>
            </PanelBody>
          )}
        </Panel>
      </div>
      <MaintenancePanel />
    </div>
  );
}
