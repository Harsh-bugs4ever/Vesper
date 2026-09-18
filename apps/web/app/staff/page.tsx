"use client";

import React, { useState } from "react";
import {
  Clock,
  QrCode,
  AlertTriangle,
  Camera,
  Check,
  X,
  BedDouble,
  Sparkles,
  RotateCw,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { StaffBottomNav } from "@/components/layout/staff-bottom-nav";
import { useAuth } from "@/components/auth/auth-context";
import { cn } from "@/lib/utils";

interface StaffTask {
  id: string;
  room: string;
  roomType: string;
  title: string;
  category: "cleaning" | "guest_request" | "inspection";
  priority: "urgent" | "normal";
  sla: string;
  status: "pending" | "in_progress" | "completed";
}

interface RoomStatusItem {
  number: string;
  type: string;
  status: "dirty" | "cleaning" | "ready";
  guestStatus: "occupied" | "departed" | "arrival_today";
  assignedAttendant: string;
}

export default function StaffPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"tasks" | "rooms" | "scan" | "report">("tasks");
  const [showScanModal, setShowScanModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Floor Room Board State
  const [floorRooms, setFloorRooms] = useState<RoomStatusItem[]>([
    { number: "401", type: "Deluxe Ocean View", status: "ready", guestStatus: "arrival_today", assignedAttendant: "Ramesh Patil" },
    { number: "404", type: "Deluxe Ocean View", status: "ready", guestStatus: "occupied", assignedAttendant: "Ramesh Patil" },
    { number: "408", type: "Executive Ocean Suite", status: "cleaning", guestStatus: "occupied", assignedAttendant: "Ramesh Patil" },
    { number: "412", type: "Deluxe Ocean View", status: "dirty", guestStatus: "departed", assignedAttendant: "Ramesh Patil" },
    { number: "415", type: "Deluxe Garden View", status: "ready", guestStatus: "occupied", assignedAttendant: "Anjali Deshmukh" },
    { number: "416", type: "Deluxe Garden View", status: "dirty", guestStatus: "departed", assignedAttendant: "Ramesh Patil" },
    { number: "420", type: "Executive Suite", status: "ready", guestStatus: "arrival_today", assignedAttendant: "Anjali Deshmukh" },
    { number: "425", type: "Presidential Villa", status: "cleaning", guestStatus: "occupied", assignedAttendant: "Ramesh Patil" },
  ]);

  const [tasks, setTasks] = useState<StaffTask[]>([
    {
      id: "tsk_412",
      room: "Room 412",
      roomType: "Deluxe Ocean View",
      title: "Check-out Turnover & Sanitize",
      category: "cleaning",
      priority: "urgent",
      sla: "11:30 AM (Next check-in 14:00)",
      status: "in_progress",
    },
    {
      id: "tsk_408",
      room: "Room 408",
      roomType: "Executive Suite",
      title: "Deliver 2x Egyptian Bath Towels & Water",
      category: "guest_request",
      priority: "urgent",
      sla: "10 mins remaining (Guest App)",
      status: "pending",
    },
    {
      id: "tsk_415",
      room: "Room 415",
      roomType: "Deluxe Garden",
      title: "Mini-bar Replenishment & Inspection",
      category: "inspection",
      priority: "normal",
      sla: "Before 13:00",
      status: "pending",
    },
  ]);

  const handleUpdateTaskStatus = (taskId: string, nextStatus: "in_progress" | "completed") => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
    );

    const task = tasks.find((t) => t.id === taskId);
    if (nextStatus === "completed") {
      showToast({
        title: `Task Completed: ${task?.room}`,
        description: `${task?.title} marked complete. Logged to supervisor board.`,
        type: "success",
      });
    } else {
      showToast({
        title: `Task Started: ${task?.room}`,
        description: `Timer started for ${task?.title}.`,
        type: "default",
      });
    }
  };

  const handleCycleRoomStatus = (roomNumber: string) => {
    setFloorRooms((prev) =>
      prev.map((r) => {
        if (r.number !== roomNumber) return r;
        const nextStatus: "dirty" | "cleaning" | "ready" =
          r.status === "dirty"
            ? "cleaning"
            : r.status === "cleaning"
            ? "ready"
            : "dirty";

        showToast({
          title: `Room ${roomNumber} Flipped: ${nextStatus.toUpperCase()}`,
          description: `Updated status transmitted to Executive Housekeeper board.`,
          type: nextStatus === "ready" ? "success" : "default",
        });

        return { ...r, status: nextStatus };
      })
    );
  };

  const handleSimulateScan = (scannedRoom: string) => {
    setShowScanModal(false);
    // If Room 412, flip to cleaning
    setFloorRooms((prev) =>
      prev.map((r) => (r.number === "412" ? { ...r, status: "cleaning" } : r))
    );
    showToast({
      title: `QR Code Verified: ${scannedRoom}`,
      description: "Nightstand QR token verified. Room board status flipped to In-Progress Cleaning.",
      type: "success",
    });
  };

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const dirtyCount = floorRooms.filter((r) => r.status === "dirty").length;
  const cleaningCount = floorRooms.filter((r) => r.status === "cleaning").length;
  const readyCount = floorRooms.filter((r) => r.status === "ready").length;

  return (
    <div className="space-y-4 pb-12">
      {/* Shift Overview Banner */}
      <div className="bg-gradient-to-br from-sage-50 to-sand-100 p-4 rounded-xl border border-sand-200 shadow-soft flex items-center justify-between">
        <div>
          <span className="text-[11px] font-semibold text-sage-800 uppercase tracking-wider block">
            {user.shift || "Morning Shift (07:00 - 15:30)"}
          </span>
          <h2 className="text-lg font-bold text-sand-950 font-serif">
            {user.name} · Ocean Wing
          </h2>
          <p className="text-xs text-sand-600 mt-0.5">
            {tasks.length - completedCount} assigned tasks · {dirtyCount} dirty turnovers
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-sage-900 font-serif">
            {completedCount}/{tasks.length}
          </span>
          <span className="text-[10px] text-sand-500 block">Tasks Done</span>
        </div>
      </div>

      {/* Action shortcuts */}
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          variant="outline"
          className="h-12 bg-white flex items-center justify-center gap-2 text-xs font-semibold shadow-2xs hover:bg-sage-50"
          onClick={() => setShowScanModal(true)}
        >
          <QrCode className="w-4 h-4 text-sage-600" />
          <span>Scan Door QR</span>
        </Button>
        <Button
          variant="outline"
          className="h-12 bg-white flex items-center justify-center gap-2 text-xs font-semibold shadow-2xs hover:bg-amber-50"
          onClick={() => setShowReportModal(true)}
        >
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>Report Breakdown</span>
        </Button>
      </div>

      {/* View Switcher Tabs (My Tasks vs Room Board) */}
      <div className="grid grid-cols-2 p-1 bg-sand-100/80 rounded-xl text-xs font-semibold">
        <button
          onClick={() => setActiveTab("tasks")}
          className={cn(
            "py-2 rounded-lg transition-all",
            activeTab === "tasks"
              ? "bg-white text-sage-900 shadow-soft font-bold"
              : "text-sand-600 hover:text-sand-900"
          )}
        >
          Assigned Tasks ({tasks.length - completedCount})
        </button>

        <button
          onClick={() => setActiveTab("rooms")}
          className={cn(
            "py-2 rounded-lg transition-all",
            activeTab === "rooms"
              ? "bg-white text-sage-900 shadow-soft font-bold"
              : "text-sand-600 hover:text-sand-900"
          )}
        >
          Floor Room Board ({floorRooms.length})
        </button>
      </div>

      {/* TAB: TASKS LIST */}
      {activeTab === "tasks" && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-sand-950 flex items-center gap-2">
              <span>Task Checklist</span>
              <Badge variant="sage" className="text-[10px] py-0 px-1.5">
                Live Priority
              </Badge>
            </h3>
            <span className="text-xs text-sand-500">Auto-routed by SLA</span>
          </div>

          {tasks.map((task) => {
            const isDone = task.status === "completed";
            const inProgress = task.status === "in_progress";

            return (
              <Card
                key={task.id}
                className={cn(
                  "border transition-all",
                  isDone
                    ? "bg-sand-50/50 border-sand-200 opacity-70"
                    : inProgress
                    ? "border-sage-400 bg-sage-50/20 shadow-soft ring-1 ring-sage-300"
                    : "border-sand-200 bg-white shadow-soft"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-sand-950 font-serif">
                          {task.room}
                        </span>
                        <span className="text-xs text-sand-500">· {task.roomType}</span>
                      </div>
                      <p className="text-xs font-semibold text-sage-900 mt-0.5">
                        {task.title}
                      </p>
                    </div>

                    <Badge
                      variant={
                        isDone
                          ? "ready"
                          : task.priority === "urgent"
                          ? "dirty"
                          : "sand"
                      }
                      className="text-[10px]"
                    >
                      {isDone
                        ? "Completed"
                        : inProgress
                        ? "In Progress"
                        : "Pending"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs pt-2 border-t border-sand-100 mt-2 text-sand-600">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Clock className="w-3 h-3 text-sand-400" />
                      {task.sla}
                    </span>

                    {!isDone && (
                      <div className="flex items-center gap-2">
                        {!inProgress ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleUpdateTaskStatus(task.id, "in_progress")}
                            className="h-7 text-xs"
                          >
                            Start Task
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleUpdateTaskStatus(task.id, "completed")}
                            className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Mark Done
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* TAB: FLOOR ROOM BOARD */}
      {activeTab === "rooms" && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-sm font-bold text-sand-950">Floor 4 Room Board</h3>
              <p className="text-[11px] text-sand-500">Tap status badge to flip Dirty → Cleaning → Ready</p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold">
                {dirtyCount} Dirty
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                {cleaningCount} Clean
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                {readyCount} Ready
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {floorRooms.map((room) => (
              <div
                key={room.number}
                className="p-3.5 rounded-xl border border-sand-200 bg-white shadow-xs flex items-center justify-between gap-3 hover:border-sage-300 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sand-100 border border-sand-200 flex items-center justify-center font-serif font-bold text-sage-900 text-sm">
                    {room.number}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sand-950 text-xs">
                        Room {room.number}
                      </span>
                      <span className="text-[10px] text-sand-400">
                        ({room.guestStatus === "occupied" ? "In-House" : room.guestStatus === "arrival_today" ? "Arrival Today" : "Departed"})
                      </span>
                    </div>
                    <p className="text-[11px] text-sand-500">{room.type}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCycleRoomStatus(room.number)}
                    className="group"
                    title="Click to advance room turnover status"
                  >
                    <Badge
                      variant={
                        room.status === "ready"
                          ? "ready"
                          : room.status === "cleaning"
                          ? "cleaning"
                          : "dirty"
                      }
                      className="text-xs px-2.5 py-1 capitalize cursor-pointer hover:scale-105 transition-transform flex items-center gap-1"
                    >
                      <RotateCw className="w-3 h-3 text-sand-500 group-hover:rotate-180 transition-transform" />
                      <span>{room.status}</span>
                    </Badge>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR Code Scanner Simulation Modal */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sand-950/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 border border-sand-200 shadow-elevated text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-sage-100 mx-auto flex items-center justify-center text-sage-700">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-sand-950 font-serif">
                Scan Room QR Code
              </h3>
              <p className="text-xs text-sand-600 mt-1">
                Scan the QR sticker on door frame or nightstand to update room cleaning status.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 flex flex-col gap-2">
              <span className="text-xs font-semibold text-sand-700">Simulate Scan:</span>
              <Button
                size="sm"
                variant="default"
                onClick={() => handleSimulateScan("Room 412 (Deluxe Ocean)")}
              >
                Scan Room 412 QR
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSimulateScan("AC Chiller #2 QR Sticker")}
              >
                Scan Chiller #2 QR
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowScanModal(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Equipment Breakdown / Incident Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sand-950/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 border border-sand-200 shadow-elevated space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-sand-950 font-serif flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Report Equipment Issue
              </h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1 rounded-lg text-sand-400 hover:text-sand-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-sand-800 block mb-1">
                  Location / Machine
                </label>
                <input
                  type="text"
                  defaultValue="Room 412 - Bathroom Geyser"
                  className="w-full px-3 py-2 rounded-lg border border-sand-200 bg-sand-50/50"
                />
              </div>

              <div>
                <label className="font-semibold text-sand-800 block mb-1">
                  Issue Description
                </label>
                <textarea
                  rows={2}
                  defaultValue="Geyser leaking water under the vanity basin."
                  className="w-full px-3 py-2 rounded-lg border border-sand-200 bg-sand-50/50"
                />
              </div>

              <div className="p-3 border border-dashed border-sand-300 rounded-lg flex items-center justify-center gap-2 text-sand-600 bg-sand-50/30">
                <Camera className="w-4 h-4 text-sage-600" />
                <span>Attach Photo (Simulated)</span>
              </div>
            </div>

            <Button
              className="w-full"
              size="sm"
              onClick={() => {
                setShowReportModal(false);
                showToast({
                  title: "Issue Dispatched to Maintenance",
                  description: "Work order created. Maintenance engineer Deepak Chauhan notified.",
                  type: "success",
                });
              }}
            >
              Dispatch Incident Report
            </Button>
          </div>
        </div>
      )}

      {/* Bottom Navigation for Staff */}
      <StaffBottomNav
        activeTab={activeTab}
        pendingTasksCount={tasks.length - completedCount}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === "scan") setShowScanModal(true);
          if (tab === "report") setShowReportModal(true);
        }}
      />
    </div>
  );
}
