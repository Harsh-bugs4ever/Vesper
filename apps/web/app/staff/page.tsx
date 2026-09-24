"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Clock,
  QrCode,
  AlertTriangle,
  Camera,
  Check,
  X,
  BedDouble,
  RotateCw,
  CheckCircle2,
  Filter,
  MapPin,
  Timer,
  Inbox,
  Coffee,
  ListTodo,
  Sparkles,
  ChevronRight,
  Package,
  Wrench,
  CheckSquare,
  ShieldCheck,
  Smartphone,
  LogOut,
  Play,
  Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FilterChips } from "@/components/ui/filter-chips";
import { useToast } from "@/components/ui/toast";
import { StaffBottomNav, type StaffTab } from "@/components/layout/staff-bottom-nav";
import { useAuth } from "@/components/auth/auth-context";
import { LiveStaff } from "@/components/connected/live-staff";
import {
  getStoredRequests,
  subscribeRequests,
  updateGuestRequest,
  addGuestRequest,
  channelMeta,
  type GuestRequest,
  type RequestChannel,
} from "@/lib/demo/requests";
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
  checklist: {
    linens: boolean;
    bathroom: boolean;
    minibar: boolean;
    floor: boolean;
  };
}

type TaskFilter = "all" | "urgent" | "cleaning" | "guest_request" | "inspection" | "completed";
type RoomFilter = "all" | "dirty" | "cleaning" | "ready";
type RequestFilter = "all" | "new" | "accepted" | "done";

export default function StaffPage() {
  const { isConnected } = useAuth();
  return isConnected ? <LiveStaff /> : <DemoStaffPage />;
}

function DemoStaffPage() {
  const { user } = useAuth();
  const { showToast, showUndoToast } = useToast();

  const [activeTab, setActiveTab] = useState<StaffTab>("tasks");
  const [showScanModal, setShowScanModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  // Attendance state
  const [attendance, setAttendance] = useState<{
    status: "off_duty" | "on_shift" | "on_break";
    checkInTime: string | null;
    method: "qr" | "location" | null;
    elapsedMinutes: number;
  }>({
    status: "on_shift",
    checkInTime: "07:15 AM",
    method: "qr",
    elapsedMinutes: 215,
  });

  // Task Filter
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  // Room Filter
  const [roomFilter, setRoomFilter] = useState<RoomFilter>("all");
  // Request Filter
  const [requestFilter, setRequestFilter] = useState<RequestFilter>("all");

  // Swipe-to-complete state: record dragging x offsets per task ID
  const [dragOffsets, setDragOffsets] = useState<Record<string, number>>({});
  const dragStartRef = useRef<{ id: string; startX: number } | null>(null);

  // Floor Room Board State
  const [floorRooms, setFloorRooms] = useState<RoomStatusItem[]>([
    {
      number: "401",
      type: "Deluxe Ocean View",
      status: "ready",
      guestStatus: "arrival_today",
      assignedAttendant: "Ramesh Patil",
      checklist: { linens: true, bathroom: true, minibar: true, floor: true },
    },
    {
      number: "404",
      type: "Deluxe Ocean View",
      status: "ready",
      guestStatus: "occupied",
      assignedAttendant: "Ramesh Patil",
      checklist: { linens: true, bathroom: true, minibar: true, floor: true },
    },
    {
      number: "408",
      type: "Executive Ocean Suite",
      status: "cleaning",
      guestStatus: "occupied",
      assignedAttendant: "Ramesh Patil",
      checklist: { linens: true, bathroom: true, minibar: false, floor: false },
    },
    {
      number: "412",
      type: "Deluxe Ocean View",
      status: "dirty",
      guestStatus: "departed",
      assignedAttendant: "Ramesh Patil",
      checklist: { linens: false, bathroom: false, minibar: false, floor: false },
    },
    {
      number: "415",
      type: "Deluxe Garden View",
      status: "ready",
      guestStatus: "occupied",
      assignedAttendant: "Anjali Deshmukh",
      checklist: { linens: true, bathroom: true, minibar: true, floor: true },
    },
    {
      number: "416",
      type: "Deluxe Garden View",
      status: "dirty",
      guestStatus: "departed",
      assignedAttendant: "Ramesh Patil",
      checklist: { linens: false, bathroom: false, minibar: false, floor: false },
    },
    {
      number: "420",
      type: "Executive Suite",
      status: "ready",
      guestStatus: "arrival_today",
      assignedAttendant: "Anjali Deshmukh",
      checklist: { linens: true, bathroom: true, minibar: true, floor: true },
    },
    {
      number: "425",
      type: "Presidential Villa",
      status: "cleaning",
      guestStatus: "occupied",
      assignedAttendant: "Ramesh Patil",
      checklist: { linens: true, bathroom: true, minibar: false, floor: false },
    },
  ]);

  // Tasks state
  const [tasks, setTasks] = useState<StaffTask[]>([
    {
      id: "tsk_412",
      room: "Room 412",
      roomType: "Deluxe Ocean View",
      title: "Check-out Turnover & Sanitize",
      category: "cleaning",
      priority: "urgent",
      sla: "11:30 AM (Check-in 14:00)",
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
    {
      id: "tsk_416",
      room: "Room 416",
      roomType: "Deluxe Garden View",
      title: "Deep Clean & Balcony Sanitization",
      category: "cleaning",
      priority: "urgent",
      sla: "12:00 PM (Turnaround)",
      status: "pending",
    },
    {
      id: "tsk_425",
      room: "Room 425",
      roomType: "Presidential Villa",
      title: "Evening Turndown & Pillow Menu",
      category: "cleaning",
      priority: "normal",
      sla: "14:30 PM",
      status: "pending",
    },
  ]);

  // Live Guest Requests from shared store
  const [requests, setRequests] = useState<GuestRequest[]>([]);

  useEffect(() => {
    setRequests(getStoredRequests());
    const unsub = subscribeRequests((next) => {
      setRequests(next);
    });
    return unsub;
  }, []);

  // Tick attendance timer every 60s
  useEffect(() => {
    if (attendance.status !== "on_shift") return;
    const interval = setInterval(() => {
      setAttendance((prev) => ({
        ...prev,
        elapsedMinutes: prev.elapsedMinutes + 1,
      }));
    }, 60000);
    return () => clearInterval(interval);
  }, [attendance.status]);

  // Attendance actions
  const handleCheckIn = (method: "qr" | "location") => {
    const timeNow = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setAttendance({
      status: "on_shift",
      checkInTime: timeNow,
      method,
      elapsedMinutes: 0,
    });
    setShowAttendanceModal(false);
    showToast({
      title: `Checked In (${method === "qr" ? "Entrance QR Verified" : "GPS Geofence Verified"})`,
      description: `Shift active at ${timeNow}. Welcome back, ${user.name}!`,
      type: "success",
    });
  };

  const handleToggleBreak = () => {
    if (attendance.status === "on_shift") {
      setAttendance((prev) => ({ ...prev, status: "on_break" }));
      showToast({
        title: "Break Started",
        description: "Your break timer is running. Tasks paused.",
        type: "default",
      });
    } else if (attendance.status === "on_break") {
      setAttendance((prev) => ({ ...prev, status: "on_shift" }));
      showToast({
        title: "Shift Resumed",
        description: "Break ended. You are back on duty.",
        type: "success",
      });
    }
  };

  const handleCheckOut = () => {
    setAttendance((prev) => ({ ...prev, status: "off_duty", checkInTime: null, method: null }));
    showToast({
      title: "Checked Out",
      description: "Shift ended. Handover submitted to Executive Housekeeper.",
      type: "default",
    });
  };

  // Task Actions
  const handleUpdateTaskStatus = (taskId: string, nextStatus: "in_progress" | "completed") => {
    const previous = tasks.find((t) => t.id === taskId)?.status;
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
    );

    const task = tasks.find((t) => t.id === taskId);
    if (nextStatus === "completed") {
      showUndoToast(
        `Task Completed: ${task?.room}`,
        `${task?.title} marked complete.`,
        () => {
          setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, status: previous || "pending" } : t))
          );
        },
        10
      );
    } else {
      showToast({
        title: `Task Started: ${task?.room}`,
        description: `Timer running for ${task?.title}.`,
        type: "default",
      });
    }
  };

  // Swipe handling for tasks
  const handleTouchStart = (id: string, clientX: number) => {
    dragStartRef.current = { id, startX: clientX };
  };

  const handleTouchMove = (id: string, clientX: number) => {
    if (!dragStartRef.current || dragStartRef.current.id !== id) return;
    const delta = Math.max(0, Math.min(160, clientX - dragStartRef.current.startX));
    setDragOffsets((prev) => ({ ...prev, [id]: delta }));
  };

  const handleTouchEnd = (id: string) => {
    if (!dragStartRef.current || dragStartRef.current.id !== id) return;
    const offset = dragOffsets[id] || 0;
    if (offset > 110) {
      // Swiped past threshold -> complete task!
      handleUpdateTaskStatus(id, "completed");
    }
    dragStartRef.current = null;
    setDragOffsets((prev) => ({ ...prev, [id]: 0 }));
  };

  // Room Board Actions (Dirty -> Cleaning -> Ready)
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
          title: `Room ${roomNumber} → ${nextStatus.toUpperCase()}`,
          description:
            nextStatus === "ready"
              ? "Inspection passed. Room released to Front Desk for check-in."
              : nextStatus === "cleaning"
              ? "Turnover started. Attendant logged on floor."
              : "Room marked for turnover.",
          type: nextStatus === "ready" ? "success" : "default",
        });

        return { ...r, status: nextStatus };
      })
    );
  };

  const handleSimulateScan = (scannedTarget: string) => {
    setShowScanModal(false);
    if (scannedTarget.includes("Room 412")) {
      setFloorRooms((prev) =>
        prev.map((r) => (r.number === "412" ? { ...r, status: "cleaning" } : r))
      );
      showToast({
        title: "Nightstand QR Verified: Room 412",
        description: "Room turnover flipped to Cleaning. Live status synced to Front Desk.",
        type: "success",
      });
    } else {
      showToast({
        title: `QR Verified: ${scannedTarget}`,
        description: "Asset inspection check-in logged to Maintenance telemetry.",
        type: "success",
      });
    }
  };

  // Guest Requests actions
  const handleAcceptRequest = (request: GuestRequest) => {
    updateGuestRequest(request.id, (r) => ({
      ...r,
      state: "accepted",
      assignee: user.name || "Floor Attendant",
    }));
    showToast({
      title: `Accepted: ${request.id}`,
      description: `Room ${request.room} · ${request.summary}. SLA timer running (${request.sla}m).`,
      type: "success",
    });
  };

  const handleCompleteRequest = (request: GuestRequest) => {
    const prevAssignee = request.assignee;
    const prevState = request.state;
    updateGuestRequest(request.id, (r) => ({
      ...r,
      state: "done",
    }));

    showUndoToast(
      `Completed: ${request.id}`,
      `Delivered to Room ${request.room}. Guest prompted for 1-tap rating.`,
      () => {
        updateGuestRequest(request.id, (r) => ({
          ...r,
          state: prevState,
          assignee: prevAssignee,
        }));
      },
      10
    );
  };

  // Filtered lists
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (taskFilter === "all") return true;
      if (taskFilter === "completed") return t.status === "completed";
      if (taskFilter === "urgent") return t.priority === "urgent" && t.status !== "completed";
      return t.category === taskFilter && t.status !== "completed";
    });
  }, [tasks, taskFilter]);

  const filteredRooms = useMemo(() => {
    return floorRooms.filter((r) => {
      if (roomFilter === "all") return true;
      return r.status === roomFilter;
    });
  }, [floorRooms, roomFilter]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (requestFilter === "all") return true;
      return r.state === requestFilter;
    });
  }, [requests, requestFilter]);

  // Counts
  const completedTasksCount = tasks.filter((t) => t.status === "completed").length;
  const pendingTasksCount = tasks.length - completedTasksCount;
  const activeRequestsCount = requests.filter((r) => r.state !== "done").length;
  const dirtyCount = floorRooms.filter((r) => r.status === "dirty").length;
  const cleaningCount = floorRooms.filter((r) => r.status === "cleaning").length;
  const readyCount = floorRooms.filter((r) => r.status === "ready").length;

  // Format shift elapsed
  const hoursOnShift = Math.floor(attendance.elapsedMinutes / 60);
  const minsOnShift = attendance.elapsedMinutes % 60;

  return (
    <div className="space-y-4 pb-20 max-w-xl mx-auto">
      {/* 1. ATTENDANCE & SHIFT BANNER */}
      <div className="rounded-2xl border border-sand-200 bg-white p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-sage-700 text-gold-300 flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              {user.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-sand-950 font-serif leading-tight">
                  {user.name}
                </h2>
                <Badge
                  variant={
                    attendance.status === "on_shift"
                      ? "ready"
                      : attendance.status === "on_break"
                      ? "sand"
                      : "dirty"
                  }
                  className="text-[10px] py-0 px-2 uppercase tracking-wider"
                >
                  {attendance.status === "on_shift"
                    ? "On Duty"
                    : attendance.status === "on_break"
                    ? "On Break"
                    : "Off Duty"}
                </Badge>
              </div>
              <p className="text-xs text-sand-500 mt-0.5">
                {user.roleTitle || "Housekeeping Floor Attendant"} · Floor 4 (Ocean Wing)
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold text-sand-700 block tabular-nums">
              {attendance.status === "off_duty"
                ? "Not Checked In"
                : `${hoursOnShift}h ${minsOnShift}m on shift`}
            </span>
            <span className="text-[10px] text-sand-400">
              {attendance.checkInTime ? `Since ${attendance.checkInTime}` : "Shift: 07:00 - 15:30"}
            </span>
          </div>
        </div>

        {/* Attendance Action Row */}
        <div className="mt-3 pt-3 border-t border-sand-100 flex items-center justify-between gap-2">
          {attendance.status === "off_duty" ? (
            <div className="flex items-center gap-2 w-full">
              <Button
                size="sm"
                variant="default"
                onClick={() => setShowAttendanceModal(true)}
                className="flex-1 bg-sage-700 hover:bg-sage-800 text-xs h-8 flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Check In for Shift</span>
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-xs text-sand-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px]">
                  {attendance.method === "qr" ? "Entrance QR verified" : "GPS Geofence active"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleToggleBreak}
                  className="h-7 text-xs px-2.5"
                >
                  {attendance.status === "on_break" ? (
                    <>
                      <Play className="w-3 h-3 mr-1 text-emerald-600" />
                      <span>Resume</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3 h-3 mr-1 text-sand-500" />
                      <span>Break</span>
                    </>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCheckOut}
                  className="h-7 text-xs px-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                >
                  <LogOut className="w-3 h-3 mr-1" />
                  <span>Check Out</span>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. ACTION SHORTCUTS (QR SCAN & REPORT BREAKDOWN) */}
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          variant="outline"
          className="h-11 bg-white border-sand-200 flex items-center justify-center gap-2 text-xs font-semibold shadow-2xs hover:bg-sage-50"
          onClick={() => setShowScanModal(true)}
        >
          <QrCode className="w-4 h-4 text-sage-700" />
          <span>Scan Door QR</span>
        </Button>
        <Button
          variant="outline"
          className="h-11 bg-white border-sand-200 flex items-center justify-center gap-2 text-xs font-semibold shadow-2xs hover:bg-amber-50"
          onClick={() => setShowReportModal(true)}
        >
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>Report Defect / Shortage</span>
        </Button>
      </div>

      {/* 3. VIEW SWITCHER SEGMENT (TASKS / REQUESTS / ROOM BOARD) */}
      <div className="grid grid-cols-3 p-1 bg-sand-100/90 rounded-xl text-xs font-semibold">
        <button
          onClick={() => setActiveTab("tasks")}
          className={cn(
            "py-2 rounded-lg transition-all flex items-center justify-center gap-1.5",
            activeTab === "tasks"
              ? "bg-white text-sage-900 shadow-soft font-bold"
              : "text-sand-600 hover:text-sand-900"
          )}
        >
          <span>Tasks</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sand-200 text-sand-800">
            {pendingTasksCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("requests")}
          className={cn(
            "py-2 rounded-lg transition-all flex items-center justify-center gap-1.5",
            activeTab === "requests"
              ? "bg-white text-sage-900 shadow-soft font-bold"
              : "text-sand-600 hover:text-sand-900"
          )}
        >
          <span>Requests</span>
          {activeRequestsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sage-700 text-white font-bold">
              {activeRequestsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("rooms")}
          className={cn(
            "py-2 rounded-lg transition-all flex items-center justify-center gap-1.5",
            activeTab === "rooms"
              ? "bg-white text-sage-900 shadow-soft font-bold"
              : "text-sand-600 hover:text-sand-900"
          )}
        >
          <span>Room Board</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sand-200 text-sand-800">
            {floorRooms.length}
          </span>
        </button>
      </div>

      {/* 4. TAB CONTENT: MY TASKS */}
      {activeTab === "tasks" && (
        <div className="space-y-3 pt-1">
          {/* Task Filter Chips */}
          <FilterChips
            options={[
              { value: "all" as const, label: "All Tasks", count: tasks.length },
              {
                value: "urgent" as const,
                label: "Urgent",
                count: tasks.filter((t) => t.priority === "urgent" && t.status !== "completed").length,
              },
              {
                value: "cleaning" as const,
                label: "Cleaning",
                count: tasks.filter((t) => t.category === "cleaning" && t.status !== "completed").length,
              },
              {
                value: "guest_request" as const,
                label: "Guest Requests",
                count: tasks.filter((t) => t.category === "guest_request" && t.status !== "completed").length,
              },
              {
                value: "completed" as const,
                label: "Done",
                count: completedTasksCount,
              },
            ]}
            value={taskFilter}
            onChange={(val) => setTaskFilter(val as TaskFilter)}
          />

          <div className="flex items-center justify-between text-xs text-sand-500 px-1 pt-1">
            <span>Tip: Drag or swipe card right to complete</span>
            <span>{filteredTasks.length} shown</span>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="rounded-2xl border border-sand-200 bg-white p-8 text-center text-sm text-sand-500">
              No tasks match this filter. All caught up!
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTasks.map((task) => {
                const isDone = task.status === "completed";
                const inProgress = task.status === "in_progress";
                const offset = dragOffsets[task.id] || 0;

                return (
                  <div
                    key={task.id}
                    className="relative overflow-hidden rounded-2xl select-none"
                    onTouchStart={(e) => handleTouchStart(task.id, e.touches[0].clientX)}
                    onTouchMove={(e) => handleTouchMove(task.id, e.touches[0].clientX)}
                    onTouchEnd={() => handleTouchEnd(task.id)}
                    onMouseDown={(e) => handleTouchStart(task.id, e.clientX)}
                    onMouseMove={(e) => {
                      if (dragStartRef.current?.id === task.id) {
                        handleTouchMove(task.id, e.clientX);
                      }
                    }}
                    onMouseUp={() => handleTouchEnd(task.id)}
                  >
                    {/* Swipe background reveal */}
                    <div className="absolute inset-0 bg-emerald-600 flex items-center px-6 text-white text-xs font-bold gap-2">
                      <Check className="w-5 h-5" />
                      <span>{offset > 100 ? "Release to Complete" : "Swipe to Complete"}</span>
                    </div>

                    {/* Card container with transform */}
                    <div
                      className={cn(
                        "relative bg-white border border-sand-200 p-4 transition-transform duration-100 ease-out",
                        isDone
                          ? "bg-sand-50/60 opacity-60"
                          : inProgress
                          ? "border-sage-400 ring-1 ring-sage-300"
                          : "hover:border-sand-300"
                      )}
                      style={{
                        transform: `translateX(${offset}px)`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-sans font-bold text-sm text-sand-950 tabular-nums">
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
                          className="text-[10px] shrink-0"
                        >
                          {isDone ? "Done" : inProgress ? "In Progress" : "Pending"}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-sand-100 text-xs text-sand-600">
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateTaskStatus(task.id, "in_progress");
                                }}
                                className="h-7 text-xs px-2.5"
                              >
                                Start
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateTaskStatus(task.id, "completed");
                                }}
                                className="h-7 text-xs px-2.5 bg-emerald-700 hover:bg-emerald-800"
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                Mark Done
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. TAB CONTENT: REQUESTS INBOX (ACCEPT & TIMER) */}
      {activeTab === "requests" && (
        <div className="space-y-3 pt-1">
          {/* Request Filter Chips */}
          <FilterChips
            options={[
              { value: "all" as const, label: "All Requests", count: requests.length },
              {
                value: "new" as const,
                label: "Unclaimed",
                count: requests.filter((r) => r.state === "new").length,
              },
              {
                value: "accepted" as const,
                label: "In Progress",
                count: requests.filter((r) => r.state === "accepted").length,
              },
              {
                value: "done" as const,
                label: "Delivered",
                count: requests.filter((r) => r.state === "done").length,
              },
            ]}
            value={requestFilter}
            onChange={(val) => setRequestFilter(val as RequestFilter)}
          />

          <div className="flex items-center justify-between text-xs text-sand-500 px-1 pt-1">
            <span>Incoming guest requests from in-room QR</span>
            <span>{filteredRequests.length} requests</span>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-sand-200 bg-white p-8 text-center text-sm text-sand-500">
              No requests in this view.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredRequests.map((req) => {
                const isOverdue = req.state !== "done" && req.openFor > req.sla;
                const remaining = Math.max(0, req.sla - req.openFor);
                const isAccepted = req.state === "accepted";
                const isDone = req.state === "done";

                return (
                  <div
                    key={req.id}
                    className={cn(
                      "rounded-2xl border p-4 transition-all bg-white",
                      isOverdue
                        ? "border-rose-300 bg-rose-50/20"
                        : isAccepted
                        ? "border-gold-300 ring-1 ring-gold-200"
                        : "border-sand-200"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-sans font-bold text-base text-sand-950 tabular-nums">
                            Room {req.room}
                          </span>
                          <span className="text-xs text-sand-500">· {req.guest}</span>
                        </div>
                        <h4 className="text-xs font-semibold text-sand-900 mt-0.5">
                          {req.summary}
                        </h4>
                      </div>

                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-semibold border",
                          channelMeta[req.channel]?.chip || "border-sand-200 bg-sand-100 text-sand-700"
                        )}
                      >
                        {req.channel}
                      </span>
                    </div>

                    <p className="text-xs text-sand-600 bg-sand-50/60 p-2.5 rounded-xl border border-sand-100 mb-3">
                      {req.detail}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-sand-100 text-xs">
                      <div className="flex items-center gap-3 text-sand-600">
                        <span className="flex items-center gap-1 text-[11px]">
                          <Clock className="w-3 h-3 text-sand-400" />
                          Raised {req.raisedAt}
                        </span>

                        {!isDone && (
                          <span
                            className={cn(
                              "flex items-center gap-1 text-[11px] font-medium tabular-nums",
                              isOverdue ? "text-rose-600 font-bold" : "text-amber-700"
                            )}
                          >
                            <Timer className="w-3 h-3" />
                            {isOverdue ? "SLA Breached" : `${remaining}m target remaining`}
                          </span>
                        )}
                      </div>

                      <div>
                        {req.state === "new" ? (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleAcceptRequest(req)}
                            className="h-7 text-xs bg-sage-700 hover:bg-sage-800"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Accept & Start Timer
                          </Button>
                        ) : req.state === "accepted" ? (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleCompleteRequest(req)}
                            className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Mark Delivered
                          </Button>
                        ) : (
                          <Badge variant="ready" className="text-[10px]">
                            Completed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. TAB CONTENT: FLOOR ROOM BOARD */}
      {activeTab === "rooms" && (
        <div className="space-y-3 pt-1">
          {/* Room Filter Chips */}
          <FilterChips
            options={[
              { value: "all" as const, label: "All Rooms", count: floorRooms.length },
              { value: "dirty" as const, label: "Dirty", count: dirtyCount },
              { value: "cleaning" as const, label: "In Cleaning", count: cleaningCount },
              { value: "ready" as const, label: "Ready", count: readyCount },
            ]}
            value={roomFilter}
            onChange={(val) => setRoomFilter(val as RoomFilter)}
          />

          <div className="flex items-center justify-between text-xs text-sand-500 px-1 pt-1">
            <span>Tap badge to cycle: Dirty → Cleaning → Ready</span>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold">
                {dirtyCount} Dirty
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                {cleaningCount} Cleaning
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                {readyCount} Ready
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {filteredRooms.map((room) => (
              <div
                key={room.number}
                className="p-3.5 rounded-2xl border border-sand-200 bg-white shadow-xs flex items-center justify-between gap-3 hover:border-sage-300 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-sand-100 border border-sand-200 flex items-center justify-center font-sans font-bold text-sage-900 text-sm shrink-0 tabular-nums">
                    {room.number}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sand-950 text-xs truncate">
                        Room {room.number}
                      </span>
                      <span className="text-[10px] text-sand-400 shrink-0">
                        (
                        {room.guestStatus === "occupied"
                          ? "In-House"
                          : room.guestStatus === "arrival_today"
                          ? "Arrival Today"
                          : "Departed"}
                        )
                      </span>
                    </div>
                    <p className="text-[11px] text-sand-500 truncate">{room.type}</p>
                    <div className="flex items-center gap-2 text-[10px] text-sand-400 mt-1">
                      <span>Attendant: {room.assignedAttendant}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleCycleRoomStatus(room.number)}
                    className="group"
                    title="Advance room status"
                  >
                    <Badge
                      variant={
                        room.status === "ready"
                          ? "ready"
                          : room.status === "cleaning"
                          ? "cleaning"
                          : "dirty"
                      }
                      className="text-xs px-2.5 py-1 capitalize cursor-pointer hover:scale-105 transition-transform flex items-center gap-1.5"
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

      {/* 7. ATTENDANCE CHECK-IN MODAL (QR & LOCATION) */}
      {showAttendanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sand-950/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 border border-sand-200 shadow-elevated space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-sand-950 font-serif flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-sage-700" />
                Staff Shift Check-In
              </h3>
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="p-1 rounded-lg text-sand-400 hover:text-sand-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-sand-600">
              Verify your physical arrival at JW Marriott Mumbai Sahar / Vesper Resort using either the
              entrance QR scanner or GPS geofence.
            </p>

            <div className="space-y-2.5 pt-1">
              {/* Option A: Entrance QR */}
              <div className="p-3.5 rounded-xl border border-sand-200 hover:border-sage-400 bg-sand-50/50 hover:bg-white transition-all cursor-pointer flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sage-100 text-sage-800 flex items-center justify-center shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-sand-950">Staff Gate QR Post</h4>
                    <p className="text-[11px] text-sand-500">Scan biometric post at employee gate</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleCheckIn("qr")}
                  className="h-7 text-xs bg-sage-700 hover:bg-sage-800"
                >
                  Scan
                </Button>
              </div>

              {/* Option B: Location GPS */}
              <div className="p-3.5 rounded-xl border border-sand-200 hover:border-sage-400 bg-sand-50/50 hover:bg-white transition-all cursor-pointer flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-sand-950">GPS Geofence</h4>
                    <p className="text-[11px] text-sand-500">Within resort perimeter (19.1025° N)</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCheckIn("location")}
                  className="h-7 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                >
                  Verify
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. QR SCAN MODAL */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sand-950/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 border border-sand-200 shadow-elevated text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-sage-100 mx-auto flex items-center justify-center text-sage-700">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-sand-950 font-serif">
                Scan Room or Asset QR
              </h3>
              <p className="text-xs text-sand-600 mt-1">
                Scan nightstand QR or equipment maintenance tag to flip room status.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-sand-50 border border-sand-200 flex flex-col gap-2">
              <span className="text-xs font-semibold text-sand-700">Simulate Scan:</span>
              <Button
                size="sm"
                variant="default"
                onClick={() => handleSimulateScan("Room 412 (Deluxe Ocean View)")}
                className="bg-sage-700 hover:bg-sage-800 text-xs"
              >
                Scan Room 412 QR (Turnover)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSimulateScan("AC Chiller #2 Tag")}
                className="text-xs"
              >
                Scan Chiller #2 QR (Maintenance)
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowScanModal(false)}
              className="w-full text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* 9. REPORT DEFECT OR SHORTAGE MODAL */}
      {showReportModal && (
        <ReportModal
          onClose={() => setShowReportModal(false)}
          onSubmit={(report) => {
            setShowReportModal(false);
            if (report.type === "defect") {
              showToast({
                title: `Incident Dispatched: ${report.item}`,
                description: `Maintenance engineer Deepak Chauhan notified. Priority: ${report.priority}.`,
                type: "success",
              });
            } else {
              showToast({
                title: `Shortage Logged: ${report.item}`,
                description: `Quantity: ${report.quantity}. Central Linen Store & Purchase Queue notified.`,
                type: "success",
              });
            }
          }}
        />
      )}

      {/* 10. BOTTOM NAVIGATION */}
      <StaffBottomNav
        activeTab={activeTab}
        pendingTasksCount={pendingTasksCount}
        pendingRequestsCount={activeRequestsCount}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === "scan") setShowScanModal(true);
          if (tab === "report") setShowReportModal(true);
        }}
      />
    </div>
  );
}

// Modal component for Reporting Defect or Shortage
function ReportModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (report: {
    type: "defect" | "shortage";
    item: string;
    description: string;
    priority?: string;
    quantity?: string;
  }) => void;
}) {
  const [reportType, setReportType] = useState<"defect" | "shortage">("defect");
  const [item, setItem] = useState("Room 412 - Bathroom Geyser");
  const [description, setDescription] = useState("Geyser leaking water under the vanity basin.");
  const [priority, setPriority] = useState<"urgent" | "normal">("urgent");
  const [quantity, setQuantity] = useState("10 sets");
  const [hasPhoto, setHasPhoto] = useState(true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sand-950/40 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 border border-sand-200 shadow-elevated space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-sand-950 font-serif flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Report Issue or Shortage
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-sand-400 hover:text-sand-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="grid grid-cols-2 p-1 bg-sand-100 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setReportType("defect");
              setItem("Room 412 - Bathroom Geyser");
              setDescription("Geyser leaking water under the vanity basin.");
            }}
            className={cn(
              "py-1.5 rounded-lg transition-all",
              reportType === "defect"
                ? "bg-white text-sand-950 shadow-xs font-bold"
                : "text-sand-600 hover:text-sand-900"
            )}
          >
            Broken Item
          </button>
          <button
            type="button"
            onClick={() => {
              setReportType("shortage");
              setItem("Floor 4 Linen Closet - Bath Towels");
              setDescription("Linen closet below safety threshold (only 4 towels remaining).");
            }}
            className={cn(
              "py-1.5 rounded-lg transition-all",
              reportType === "shortage"
                ? "bg-white text-sand-950 shadow-xs font-bold"
                : "text-sand-600 hover:text-sand-900"
            )}
          >
            Stock Shortage
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-sand-800 block mb-1">
              {reportType === "defect" ? "Location / Equipment" : "Item & Location"}
            </label>
            <input
              type="text"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-sand-200 bg-sand-50/50"
            />
          </div>

          <div>
            <label className="font-semibold text-sand-800 block mb-1">
              {reportType === "defect" ? "Defect Details" : "Shortage Reason"}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-sand-200 bg-sand-50/50"
            />
          </div>

          {reportType === "shortage" ? (
            <div>
              <label className="font-semibold text-sand-800 block mb-1">Quantity Needed</label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-sand-200 bg-sand-50/50"
              />
            </div>
          ) : (
            <div>
              <label className="font-semibold text-sand-800 block mb-1">Severity / Urgency</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPriority("urgent")}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg border text-xs font-semibold",
                    priority === "urgent"
                      ? "border-rose-300 bg-rose-50 text-rose-800"
                      : "border-sand-200 text-sand-700"
                  )}
                >
                  Urgent (SLA 30m)
                </button>
                <button
                  type="button"
                  onClick={() => setPriority("normal")}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg border text-xs font-semibold",
                    priority === "normal"
                      ? "border-sage-400 bg-sage-50 text-sage-900"
                      : "border-sand-200 text-sand-700"
                  )}
                >
                  Normal (SLA 2h)
                </button>
              </div>
            </div>
          )}

          {/* Simulated Photo Capture */}
          <div
            onClick={() => setHasPhoto(!hasPhoto)}
            className={cn(
              "p-3 border border-dashed rounded-lg flex items-center justify-between cursor-pointer transition-all",
              hasPhoto
                ? "border-emerald-400 bg-emerald-50/40 text-emerald-800"
                : "border-sand-300 bg-sand-50/30 text-sand-600"
            )}
          >
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-sage-600" />
              <span>{hasPhoto ? "Photo Attached (defect_proof_412.jpg)" : "Attach Photo Proof"}</span>
            </div>
            {hasPhoto && <Check className="w-4 h-4 text-emerald-600" />}
          </div>
        </div>

        <Button
          className="w-full bg-sage-700 hover:bg-sage-800 text-xs"
          size="sm"
          onClick={() => {
            onSubmit({
              type: reportType,
              item,
              description,
              priority: reportType === "defect" ? priority : undefined,
              quantity: reportType === "shortage" ? quantity : undefined,
            });
          }}
        >
          {reportType === "defect" ? "Dispatch Maintenance Order" : "Request Stock Replenishment"}
        </Button>
      </div>
    </div>
  );
}
