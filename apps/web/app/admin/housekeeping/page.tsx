"use client";

import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  BedDouble,
  Check,
  ChevronDown,
  CircleMinus,
  ClipboardList,
  LoaderCircle,
  NotebookPen,
  RefreshCw,
  Search,
  SprayCan,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";
import { PeriodSelect } from "@/components/ui/period-select";
import { StatTile } from "@/components/ui/stat-tile";
import { useToast } from "@/components/ui/toast";
import {
  ATTENDANT_NAMES,
  ROOM_TYPES,
  floorPlan,
  nextStatus,
  rooms as seedRooms,
  statusMeta,
  type Room,
  type RoomStatus,
} from "@/lib/demo/housekeeping";
import { cn } from "@/lib/utils";

const STATUS_ORDER: RoomStatus[] = ["ready", "cleaning", "dirty", "blocked", "out_of_order"];

const FLOOR_OPTIONS = ["All Floors", ...floorPlan.map((floor) => `Floor ${floor.floor}`)];
const TYPE_OPTIONS = ["All Room Types", ...ROOM_TYPES];
const STATUS_OPTIONS = ["All Statuses", ...STATUS_ORDER.map((key) => statusMeta[key].label)];
const STAFF_OPTIONS = ["All Staff", ...ATTENDANT_NAMES];

/** Floors expanded when the page first loads. The rest collapse to keep the board short. */
const INITIALLY_OPEN = 5;

export default function HousekeepingPage() {
  const { showToast, showUndoToast } = useToast();

  const [rooms, setRooms] = useState<Room[]>(seedRooms);
  const [floor, setFloor] = useState(FLOOR_OPTIONS[0]);
  const [roomType, setRoomType] = useState(TYPE_OPTIONS[0]);
  const [status, setStatus] = useState(STATUS_OPTIONS[0]);
  const [staff, setStaff] = useState(STAFF_OPTIONS[0]);
  const [query, setQuery] = useState("");
  const [selectedNumber, setSelectedNumber] = useState<string>("204");
  const [collapsed, setCollapsed] = useState<Set<number>>(
    () => new Set(floorPlan.slice(INITIALLY_OPEN).map((plan) => plan.floor))
  );

  const counts = useMemo(() => {
    const tally: Record<RoomStatus, number> = {
      ready: 0,
      cleaning: 0,
      dirty: 0,
      blocked: 0,
      out_of_order: 0,
    };
    rooms.forEach((room) => {
      tally[room.status] += 1;
    });
    return tally;
  }, [rooms]);

  const total = rooms.length;
  const pct = (value: number) => Math.round((value / total) * 100);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rooms.filter((room) => {
      if (floor !== "All Floors" && `Floor ${room.floor}` !== floor) return false;
      if (roomType !== "All Room Types" && room.category !== roomType) return false;
      if (status !== "All Statuses" && statusMeta[room.status].label !== status) return false;
      if (staff !== "All Staff" && room.attendant !== staff) return false;
      if (needle && !room.number.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rooms, floor, roomType, status, staff, query]);

  /** Group what survived the filters back under its floor heading. */
  const byFloor = useMemo(() => {
    const groups = new Map<number, Room[]>();
    visible.forEach((room) => {
      const list = groups.get(room.floor) ?? [];
      list.push(room);
      groups.set(room.floor, list);
    });
    return [...groups.entries()].sort(([a], [b]) => a - b);
  }, [visible]);

  const selected = rooms.find((room) => room.number === selectedNumber) ?? null;

  const toggleFloor = (value: number) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  const toggleTask = (roomNumber: string, taskId: string) =>
    setRooms((current) =>
      current.map((room) =>
        room.number === roomNumber
          ? {
              ...room,
              checklist: room.checklist.map((item) =>
                item.id === taskId ? { ...item, done: !item.done } : item
              ),
            }
          : room
      )
    );

  const advance = (room: Room) => {
    const step = nextStatus[room.status];
    if (!step) return;

    const previous = room.status;
    setRooms((current) =>
      current.map((item) =>
        item.number === room.number
          ? { ...item, status: step.to, cleaningMinutes: step.to === "cleaning" ? 0 : undefined }
          : item
      )
    );

    showUndoToast(
      `Room ${room.number} · ${statusMeta[step.to].label}`,
      `${room.category} · Floor ${room.floor}. Front desk notified.`,
      () =>
        setRooms((current) =>
          current.map((item) =>
            item.number === room.number ? { ...item, status: previous } : item
          )
        ),
      10
    );
  };

  const now = new Date();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Housekeeping Board"
        description="Real-time room status and housekeeping operations"
        meta={
          <span className="text-right">
            <span className="block">{format(now, "EEE, d MMM yyyy")}</span>
            <span className="block text-sand-400">{format(now, "hh:mm a")}</span>
          </span>
        }
      />

      {/* Board totals, computed from the same rooms the grid draws. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile
          variant="value-first"
          label="Rooms Ready"
          value={counts.ready}
          change={`${pct(counts.ready)}%`}
          intent="good"
          comparison=""
          tone="forest"
          icon={BedDouble}
        />
        <StatTile
          variant="value-first"
          label="Rooms Dirty"
          value={counts.dirty}
          change={`${pct(counts.dirty)}%`}
          intent="bad"
          comparison=""
          tone="sand"
          icon={SprayCan}
        />
        <StatTile
          variant="value-first"
          label="Rooms Cleaning"
          value={counts.cleaning}
          change={`${pct(counts.cleaning)}%`}
          intent="good"
          comparison=""
          tone="sage"
          icon={LoaderCircle}
        />
        <StatTile
          variant="value-first"
          label="Rooms Blocked"
          value={counts.blocked}
          change={`${pct(counts.blocked)}%`}
          intent="neutral"
          comparison=""
          tone="rose"
          icon={CircleMinus}
        />
        <StatTile
          variant="value-first"
          label="Total Rooms"
          value={total}
          tone="sand"
          icon={ClipboardList}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        {/* Board */}
        <Panel>
          <PanelBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <PeriodSelect value={floor} onChange={setFloor} options={FLOOR_OPTIONS} />
              <PeriodSelect value={roomType} onChange={setRoomType} options={TYPE_OPTIONS} />
              <PeriodSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} />
              <PeriodSelect value={staff} onChange={setStaff} options={STAFF_OPTIONS} />

              <div className="min-w-[200px] flex-1">
                <Input
                  icon={<Search className="h-4 w-4" />}
                  placeholder="Search room number..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-9"
                />
              </div>

              <button
                onClick={() =>
                  showToast({
                    title: "Board refreshed",
                    description: "Room statuses synchronised with the front desk.",
                    type: "success",
                  })
                }
                className="flex items-center gap-2 text-xs text-sand-500 transition-colors hover:text-sand-800"
              >
                Last updated: 2 mins ago
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-sand-200/80 pb-4">
              {STATUS_ORDER.map((key) => (
                <span key={key} className="flex items-center gap-1.5 text-xs text-sand-700">
                  <span className={cn("h-2.5 w-2.5 rounded-full", statusMeta[key].dot)} />
                  {statusMeta[key].label}
                </span>
              ))}
            </div>

            {byFloor.length === 0 ? (
              <p className="py-14 text-center text-sm text-sand-500">
                No rooms match these filters.
              </p>
            ) : (
              <div className="space-y-5">
                {byFloor.map(([floorNumber, floorRooms]) => {
                  const plan = floorPlan.find((item) => item.floor === floorNumber);
                  const isCollapsed = collapsed.has(floorNumber);

                  return (
                    <div key={floorNumber}>
                      <button
                        onClick={() => toggleFloor(floorNumber)}
                        aria-expanded={!isCollapsed}
                        className="mb-2 flex items-center gap-2 text-left"
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
                        <span className="text-sm text-sand-500">
                          {plan?.category} ({floorRooms.length} room
                          {floorRooms.length === 1 ? "" : "s"})
                        </span>
                      </button>

                      {!isCollapsed && (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10">
                          {floorRooms.map((room) => {
                            const isSelected = room.number === selectedNumber;
                            return (
                              <button
                                key={room.number}
                                onClick={() => setSelectedNumber(room.number)}
                                aria-current={isSelected ? "true" : undefined}
                                className={cn(
                                  "rounded-xl border px-2 py-2.5 text-center transition-all",
                                  statusMeta[room.status].tile,
                                  isSelected
                                    ? "ring-2 ring-sage-700 ring-offset-1"
                                    : "hover:scale-[1.04]"
                                )}
                              >
                                <span className="block text-sm font-semibold tabular-nums">
                                  {room.number}
                                </span>
                                <span className="mt-0.5 block text-[11px] font-medium opacity-90">
                                  {statusMeta[room.status].label}
                                </span>
                                {room.status === "cleaning" && (
                                  <span className="block text-[11px] opacity-75">
                                    ({room.cleaningMinutes} min)
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

        {/* Room detail */}
        <Panel className="h-fit xl:sticky xl:top-24">
          {selected === null ? (
            <PanelBody className="py-14 text-center text-sm text-sand-500">
              Select a room to see its detail.
            </PanelBody>
          ) : (
            <PanelBody className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif text-2xl font-semibold leading-tight text-sand-950">
                    Room {selected.number}
                  </h2>
                  <p className="mt-0.5 text-sm text-sand-600">
                    {selected.category} Room
                    <span className="mx-2 text-sand-300">|</span>
                    Floor {selected.floor}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium",
                    statusMeta[selected.status].chip
                  )}
                >
                  {statusMeta[selected.status].label}
                </span>
              </div>

              {/* Room image. A gradient stands in for the photography a real property
                  supplies; the shape and ratio are what the layout has to survive. */}
              <div
                className="h-40 rounded-xl border border-sand-200 bg-gradient-to-br from-sand-200 via-sand-100 to-sage-100"
                role="img"
                aria-label={`Photograph of a ${selected.category} room`}
              />

              {selected.guest && (
                <div className="border-t border-sand-200/80 pt-4">
                  <p className="text-xs font-medium text-sand-700">Guest</p>
                  <div className="mt-1 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-sand-950">{selected.guest}</p>
                      <p className="text-xs text-sand-500">{selected.guestNote}</p>
                    </div>
                    <Button variant="outline" size="sm">
                      View Folio
                    </Button>
                  </div>
                </div>
              )}

              <div className="border-t border-sand-200/80 pt-4">
                <p className="text-xs font-medium text-sand-700">Housekeeping</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-50 text-xs font-semibold text-sage-800">
                      {(selected.attendant ?? "Unassigned")
                        .split(" ")
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-sand-950">
                        {selected.attendant ?? "Unassigned"}
                      </p>
                      <p className="text-xs text-sand-500">
                        {selected.attendantRole ?? "No attendant on this room"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      showToast({
                        title: `Room ${selected.number} reassigned`,
                        description: "Picked the attendant with the lightest floor load.",
                        type: "success",
                      })
                    }
                  >
                    Reassign
                  </Button>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-sand-50/70 p-3">
                  <div>
                    <dt className="text-xs text-sand-500">Estimated Time</dt>
                    <dd className="text-sm font-medium text-sand-950">
                      {selected.estimatedMinutes} min
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-sand-500">Time Taken</dt>
                    <dd className="text-sm font-medium text-sand-950">
                      {selected.cleaningMinutes === undefined
                        ? "—"
                        : `${selected.cleaningMinutes} min`}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="border-t border-sand-200/80 pt-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-medium text-sand-700">Checklist</p>
                  <p className="text-xs tabular-nums text-sand-500">
                    {selected.checklist.filter((item) => item.done).length} /{" "}
                    {selected.checklist.length}
                  </p>
                </div>

                <ul className="mt-2 space-y-1">
                  {selected.checklist.map((item) => (
                    <li key={item.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1.5 text-sm text-sand-800 transition-colors hover:bg-sand-50">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => toggleTask(selected.number, item.id)}
                          className="h-4 w-4 shrink-0 rounded-full border-sand-300 text-sage-600 focus:ring-sage-500"
                        />
                        <span className={cn(item.done && "text-sand-400 line-through")}>
                          {item.label}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2 border-t border-sand-200/80 pt-4">
                {nextStatus[selected.status] && (
                  <Button className="w-full" onClick={() => advance(selected)}>
                    <Check className="h-4 w-4" />
                    {nextStatus[selected.status]?.action}
                  </Button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      showToast({
                        title: "Note added",
                        description: `Attached to room ${selected.number} for the next shift.`,
                        type: "default",
                      })
                    }
                  >
                    <NotebookPen className="h-3.5 w-3.5" />
                    Add Note
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      showToast({
                        title: "Issue reported",
                        description: `Work order raised for room ${selected.number}.`,
                        type: "warning",
                      })
                    }
                  >
                    <TriangleAlert className="h-3.5 w-3.5" />
                    Report Issue
                  </Button>
                </div>
              </div>
            </PanelBody>
          )}
        </Panel>
      </div>
    </div>
  );
}
