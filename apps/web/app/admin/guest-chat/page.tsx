"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  ConciergeBell,
  FileText,
  Gift,
  Phone,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  SprayCan,
  User,
  UserCheck,
  UtensilsCrossed,
  Waves,
  Wind,
  Wrench,
  XCircle,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import {
  getStoredChatThreads,
  subscribeChatThreads,
  resolveRoomIssue,
  escalateRoomIssue,
  updateAssignedTeam,
  addMessageToRoomThread,
  type GuestChatThread,
  type RoomIssue,
} from "@/lib/demo/guest-chats";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<
  RoomIssue["category"],
  { icon: typeof Wrench; color: string; badge: string }
> = {
  Maintenance: {
    icon: Wrench,
    color: "text-amber-700 bg-amber-50 border-amber-200",
    badge: "Engineering & Maintenance",
  },
  Housekeeping: {
    icon: SprayCan,
    color: "text-sage-700 bg-sage-50 border-sage-200",
    badge: "Housekeeping",
  },
  "F&B": {
    icon: UtensilsCrossed,
    color: "text-gold-800 bg-gold-50 border-gold-200",
    badge: "Food & Beverage",
  },
  "Front Desk": {
    icon: ConciergeBell,
    color: "text-sky-800 bg-sky-50 border-sky-200",
    badge: "Front Desk & Concierge",
  },
  Wellness: {
    icon: Sparkles,
    color: "text-purple-800 bg-purple-50 border-purple-200",
    badge: "Spa & Wellness",
  },
};

const GUEST_FILES: Record<
  string,
  {
    name: string;
    room: string;
    roomType: string;
    vip: string;
    checkIn: string;
    checkOut: string;
    spend: string;
    phone: string;
    email: string;
    preferences: string[];
    recentActivity: { label: string; time: string; live?: boolean }[];
  }
> = {
  "412": {
    name: "In-Room Guest",
    room: "412",
    roomType: "Deluxe Ocean View",
    vip: "In-House Guest",
    checkIn: "24 Sep 2026",
    checkOut: "27 Sep 2026",
    spend: "₹48,200",
    phone: "+91 98201 55412",
    email: "guest.room412@vesper.demo",
    preferences: [
      "High floor",
      "Extra bath towels",
      "Late checkout requested",
      "Ocean view preference",
    ],
    recentActivity: [
      { label: "Reported AC cooling issue", time: "12:33 PM", live: true },
      { label: "In-room dining menu viewed", time: "12:20 PM", live: false },
      { label: "Room service order placed (₹1,300)", time: "10:24 AM", live: false },
      { label: "Check-in completed", time: "24 Sep, 02:30 PM", live: false },
    ],
  },
  "305": {
    name: "Priya Patel",
    room: "305",
    roomType: "Garden Villa",
    vip: "Platinum Elite",
    checkIn: "25 Sep 2026",
    checkOut: "29 Sep 2026",
    spend: "₹1,18,000",
    phone: "+91 99300 88305",
    email: "priya.patel@patelholdings.com",
    preferences: [
      "Strict Jain diet (Sattvic cookware)",
      "Private garden setup",
      "Daily herbal tea at 7:00 AM",
      "Airport luxury transfer",
    ],
    recentActivity: [
      { label: "Dietary inquiry escalated to Chef", time: "11:32 AM", live: true },
      { label: "Breakfast buffet at The Verandah", time: "08:15 AM", live: false },
      { label: "Check-in completed", time: "25 Sep, 01:15 PM", live: false },
    ],
  },
  "204": {
    name: "Kavya Iyer",
    room: "204",
    roomType: "Deluxe Pool View",
    vip: "In-House Guest",
    checkIn: "25 Sep 2026",
    checkOut: "28 Sep 2026",
    spend: "₹34,000",
    phone: "+91 98111 20400",
    email: "kavya.iyer@gmail.com",
    preferences: ["Hypoallergenic pillows", "Pool access card", "Morning newspaper"],
    recentActivity: [
      { label: "Extra towels requested via AI", time: "11:15 AM", live: true },
      { label: "Turndown requested", time: "Yesterday", live: false },
    ],
  },
  "608": {
    name: "Ananya Kapoor",
    room: "608",
    roomType: "Executive Sea View",
    vip: "Gold Elite",
    checkIn: "18 Nov 2026",
    checkOut: "21 Nov 2026",
    spend: "₹62,700",
    phone: "+91 98765 43210",
    email: "ananya.kapoor@gmail.com",
    preferences: [
      "Sea-facing room",
      "Late checkout (2:00 PM)",
      "Jain meal (no onion/garlic)",
      "High-speed Wi-Fi",
      "Extra pillows",
    ],
    recentActivity: [
      { label: "Late checkout confirmed until 2:00 PM", time: "11:44 AM", live: false },
      { label: "Room service order (Club sandwich)", time: "17 Nov, 08:12 PM", live: false },
    ],
  },
  "514": {
    name: "Rohan Verma",
    room: "514",
    roomType: "Premier Sunset Suite",
    vip: "Silver Elite",
    checkIn: "26 Sep 2026",
    checkOut: "28 Sep 2026",
    spend: "₹39,500",
    phone: "+91 97690 12514",
    email: "rohan.v@techcorp.io",
    preferences: ["Sunset balcony", "Spa & Ayurvedic wellness", "Late breakfast box"],
    recentActivity: [
      { label: "Ayurvedic massage booked for 4:00 PM", time: "10:52 AM", live: false },
      { label: "Check-in completed", time: "26 Sep, 11:30 AM", live: false },
    ],
  },
};

export default function GeneralManagerGuestIssuesPage() {
  const { showToast } = useToast();
  const { user } = useAuth();

  const managerName = user?.name || "Arjun Mehta";
  const managerRole = user?.roleTitle || "General Manager";

  const [threads, setThreads] = useState<GuestChatThread[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("412");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "escalated" | "resolved">("all");
  const [resolutionNoteInput, setResolutionNoteInput] = useState("");
  const [messageToRoomInput, setMessageToRoomInput] = useState("");
  const [rightTab, setRightTab] = useState<"guest-profile" | "history">("guest-profile");

  // Sync threads from stored threads
  useEffect(() => {
    const update = (allThreads?: GuestChatThread[]) => {
      const current = allThreads || getStoredChatThreads();
      setThreads(current);
    };
    update();
    const unsub = subscribeChatThreads(update);
    return unsub;
  }, []);

  const activeThread = threads.find((t) => t.room === selectedRoom) || threads[0];
  const issue = activeThread?.currentIssue;

  // Filter threads based on problem resolution status
  const filteredThreads = threads.filter((t) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "pending")
      return t.currentIssue.status === "open" || t.currentIssue.status === "in_progress";
    if (statusFilter === "escalated") return t.currentIssue.status === "escalated";
    if (statusFilter === "resolved") return t.currentIssue.status === "resolved";
    return true;
  });

  // Action: Mark Problem Resolved
  const handleResolveProblem = () => {
    if (!activeThread) return;
    const note =
      resolutionNoteInput.trim() ||
      `Issue verified and resolved for Room ${activeThread.room} by ${managerName}.`;

    resolveRoomIssue(activeThread.room, note, `${managerName} (${managerRole})`);
    setResolutionNoteInput("");

    showToast({
      title: `Room ${activeThread.room} Problem Resolved`,
      description: note,
      type: "success",
    });
  };

  // Action: Escalate
  const handleEscalateProblem = () => {
    if (!activeThread) return;
    escalateRoomIssue(
      activeThread.room,
      `Escalated by ${managerName} for urgent duty management attention.`
    );
    showToast({
      title: `Room ${activeThread.room} Escalated`,
      description: "Marked high priority. Department head notified.",
      type: "warning",
    });
  };

  // Action: Reassign / Expedite
  const handleExpediteTeam = (teamName: string) => {
    if (!activeThread) return;
    updateAssignedTeam(activeThread.room, teamName);
    showToast({
      title: "Team Dispatched & Priority Escalated",
      description: `${teamName} dispatched to Room ${activeThread.room}.`,
      type: "success",
    });
  };

  // Action: Send Manager Message to Room
  const handleSendMessageToRoom = () => {
    if (!messageToRoomInput.trim() || !activeThread) return;

    const timeStr = new Date().toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    });

    addMessageToRoomThread(activeThread.room, {
      id: `staff-msg-${Date.now()}`,
      from: "staff",
      senderName: managerName,
      senderRole: managerRole,
      text: messageToRoomInput.trim(),
      time: timeStr,
      type: "text",
    });

    setMessageToRoomInput("");

    showToast({
      title: `Update Sent to Room ${activeThread.room}`,
      description: `Guest in Room ${activeThread.room} received your message.`,
      type: "success",
    });
  };

  // Action: Service Recovery Offering
  const handleOfferRecovery = (offer: string) => {
    if (!activeThread) return;
    const timeStr = new Date().toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    });

    addMessageToRoomThread(activeThread.room, {
      id: `staff-recovery-${Date.now()}`,
      from: "staff",
      senderName: managerName,
      senderRole: managerRole,
      text: `Dear Guest, to ensure your comfort, we have arranged: ${offer}. Please let our Front Desk know if we can do anything further.`,
      time: timeStr,
      type: "text",
    });

    showToast({
      title: `Service Recovery Dispatched`,
      description: `${offer} applied for Room ${activeThread.room}.`,
      type: "success",
    });
  };

  const guestDetails =
    GUEST_FILES[activeThread?.room || "412"] || {
      name: activeThread?.guestName || "In-Room Guest",
      room: activeThread?.room || "412",
      roomType: activeThread?.roomType || "Deluxe Ocean View",
      vip: activeThread?.vipStatus || "In-House Guest",
      checkIn: "24 Sep 2026",
      checkOut: "27 Sep 2026",
      spend: "₹45,000",
      phone: "+91 98200 11412",
      email: "guest@vesper.demo",
      preferences: ["High floor", "Daily housekeeping"],
      recentActivity: [{ label: "Reported room issue", time: "Just now", live: true }],
    };

  const categoryMeta = issue ? CATEGORY_META[issue.category] : CATEGORY_META.Maintenance;
  const CategoryIcon = categoryMeta.icon;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Guest Room Issues & Inquiries"
        description="Review problems reported by in-house guests and execute manager resolutions directly"
      />

      {/* High-Level Issue Status KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Panel className="p-4">
          <div className="flex items-center justify-between text-xs text-sand-500">
            <span>Pending Guest Issues</span>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 font-sans text-2xl font-semibold text-sand-950">
            {threads.filter((t) => t.currentIssue.status === "open" || t.currentIssue.status === "in_progress").length}
          </p>
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Requiring resolution
          </span>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between text-xs text-sand-500">
            <span>Escalated to Manager</span>
            <ShieldAlert className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2 font-sans text-2xl font-semibold text-rose-700">
            {threads.filter((t) => t.currentIssue.status === "escalated").length}
          </p>
          <span className="mt-1 text-[11px] text-rose-600 font-medium">
            High priority / VIP attention
          </span>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between text-xs text-sand-500">
            <span>Resolved Today</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-sans text-2xl font-semibold text-emerald-800">
            {threads.filter((t) => t.currentIssue.status === "resolved").length}
          </p>
          <span className="mt-1 text-[11px] text-emerald-700 font-medium">
            100% SLA compliance
          </span>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between text-xs text-sand-500">
            <span>Average Resolution SLA</span>
            <Clock className="h-4 w-4 text-sage-600" />
          </div>
          <p className="mt-2 font-sans text-2xl font-semibold text-sand-950">14 mins</p>
          <span className="mt-1 text-[11px] text-sand-500">
            Under 20m target
          </span>
        </Panel>
      </div>

      {/* Main Layout: Room Problem List on Left + Problem Detail & Manager Resolution Center */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)_340px]">
        {/* Left: In-House Guest Room Problems List */}
        <Panel className="flex h-[760px] flex-col">
          <div className="border-b border-sand-200/80 p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-sm font-semibold text-sand-950">
                  Guest Room Problems
                </h2>
                <p className="text-[11px] text-sand-500">Click a room to view issue & resolve</p>
              </div>
              <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-semibold text-sand-700">
                {threads.length} Rooms
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="mt-3 flex gap-1 rounded-lg bg-sand-100/70 p-1 text-[11px]">
              {[
                { id: "all", label: "All" },
                { id: "pending", label: "Pending" },
                { id: "escalated", label: "Escalated" },
                { id: "resolved", label: "Resolved" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
                  className={cn(
                    "flex-1 rounded-md py-1 font-medium transition",
                    statusFilter === tab.id
                      ? "bg-white text-sand-950 shadow-3xs"
                      : "text-sand-600 hover:text-sand-900"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* List of Room Issues */}
          <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
            {filteredThreads.map((thread) => {
              const isSelected = thread.room === selectedRoom;
              const itmIssue = thread.currentIssue;
              const meta = CATEGORY_META[itmIssue.category];
              const Icon = meta.icon;

              const isResolved = itmIssue.status === "resolved";
              const isEscalated = itmIssue.status === "escalated";

              return (
                <button
                  key={thread.room}
                  onClick={() => setSelectedRoom(thread.room)}
                  className={cn(
                    "w-full rounded-xl p-3 text-left transition-all border",
                    isSelected
                      ? "border-gold-400/90 bg-gold-50/80 shadow-xs ring-1 ring-gold-400/30"
                      : "border-sand-200/80 bg-white hover:bg-sand-50/80"
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sage-800 text-[11px] font-bold text-gold-300">
                        {thread.room}
                      </span>
                      <div>
                        <p className="font-semibold text-xs text-sand-950 leading-none">
                          Room {thread.room}
                        </p>
                        <p className="text-[10px] text-sand-500 mt-0.5">{thread.guestName}</p>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                        isResolved && "bg-emerald-100 text-emerald-800",
                        isEscalated && "bg-rose-100 text-rose-800 animate-pulse",
                        !isResolved && !isEscalated && "bg-amber-100 text-amber-900"
                      )}
                    >
                      {itmIssue.status === "open"
                        ? "Open"
                        : itmIssue.status === "in_progress"
                        ? "In Progress"
                        : itmIssue.status === "escalated"
                        ? "Escalated"
                        : "Resolved"}
                    </span>
                  </div>

                  {/* Problem Headline */}
                  <div className="mt-2.5 rounded-lg bg-sand-50/80 p-2 border border-sand-200/60">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-sand-600">
                      <Icon className="h-3 w-3 shrink-0 text-sand-500" />
                      <span>{meta.badge}</span>
                      <span className="text-sand-300">&bull;</span>
                      <span className="text-sand-400">{itmIssue.reportedAt}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs font-medium text-sand-900 leading-snug">
                      {itmIssue.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>

        {/* Center: Selected Room Problem Overview & Manager Resolution Actions */}
        <Panel className="flex h-[760px] flex-col overflow-y-auto">
          {/* Header */}
          <div className="border-b border-sand-200/80 px-6 py-4 bg-white sticky top-0 z-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sage-800 text-gold-300 font-sans font-bold text-lg shadow-xs">
                  {activeThread?.room}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-lg font-semibold text-sand-950">
                      Room {activeThread?.room} &mdash; {activeThread?.guestName}
                    </h3>
                    <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5 text-[11px] font-medium text-sand-700">
                      {activeThread?.roomType}
                    </span>
                  </div>
                  <p className="text-xs text-sand-500 mt-0.5">
                    VIP: <span className="font-semibold text-gold-800">{activeThread?.vipStatus}</span> &bull; Check-in: {activeThread?.checkIn} &bull; Check-out: {activeThread?.checkOut}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border",
                    issue?.status === "resolved" && "bg-emerald-50 text-emerald-800 border-emerald-200",
                    issue?.status === "escalated" && "bg-rose-50 text-rose-800 border-rose-200 animate-pulse",
                    issue?.status !== "resolved" && issue?.status !== "escalated" && "bg-amber-50 text-amber-800 border-amber-200"
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      issue?.status === "resolved" && "bg-emerald-600",
                      issue?.status === "escalated" && "bg-rose-600",
                      issue?.status !== "resolved" && issue?.status !== "escalated" && "bg-amber-500"
                    )}
                  />
                  {issue?.status === "open"
                    ? "Open Issue"
                    : issue?.status === "in_progress"
                    ? "In Progress"
                    : issue?.status === "escalated"
                    ? "Escalated to GM"
                    : "Resolved"}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* The Specific Problem Card */}
            <div className="rounded-2xl border border-sand-200/90 bg-gradient-to-br from-sand-50/90 via-white to-sand-50/40 p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-sand-200/70 pb-3">
                <div className="flex items-center gap-2">
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg border", categoryMeta.color)}>
                    <CategoryIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sand-500">
                      Problem Reported by Guest
                    </span>
                    <p className="text-xs font-medium text-sand-800">{categoryMeta.badge}</p>
                  </div>
                </div>

                <div className="text-right text-xs">
                  <span className="text-sand-400 text-[10px]">Reported At</span>
                  <p className="font-semibold text-sand-900">{issue?.reportedAt}</p>
                </div>
              </div>

              {/* Problem Title & Detailed Statement */}
              <div className="mt-4 space-y-2">
                <h4 className="font-serif text-xl font-semibold text-sand-950 leading-tight">
                  &ldquo;{issue?.title}&rdquo;
                </h4>
                <p className="text-sm text-sand-700 leading-relaxed bg-white/80 p-3 rounded-xl border border-sand-200/60">
                  {issue?.description}
                </p>
              </div>

              {/* Action taken by AI Concierge summary */}
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3 text-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-emerald-950">AI Concierge Autonomous Action</p>
                  <p className="text-emerald-800 text-[11px] mt-0.5">{issue?.aiActionTaken}</p>
                </div>
                {issue?.ticketId && (
                  <span className="shrink-0 font-mono text-[10px] font-bold rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">
                    {issue.ticketId}
                  </span>
                )}
              </div>

              {/* Assigned Team & SLA */}
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs border-t border-sand-200/60 pt-3">
                <div>
                  <span className="text-sand-400 text-[11px]">Assigned Department / Staff</span>
                  <p className="font-semibold text-sand-900 mt-0.5">{issue?.assignedTeam}</p>
                </div>
                <div>
                  <span className="text-sand-400 text-[11px]">Department SLA Guarantee</span>
                  <p className="font-semibold text-sand-900 mt-0.5">{issue?.slaMinutes} Minutes Target</p>
                </div>
              </div>

              {/* Resolution details if already resolved */}
              {issue?.status === "resolved" && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-emerald-900">
                    <span className="flex items-center gap-1.5">
                      <Check className="h-4 w-4 text-emerald-600" />
                      Resolution Verified
                    </span>
                    <span className="text-[10px] font-normal text-emerald-700">
                      {issue.resolvedAt} &bull; {issue.resolvedBy}
                    </span>
                  </div>
                  <p className="text-emerald-800 text-[11px]">{issue.resolutionNote}</p>
                </div>
              )}
            </div>

            {/* Manager Resolution & Action Suite */}
            <div className="rounded-2xl border border-sand-200/90 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-sand-200/80 pb-3">
                <div>
                  <h4 className="font-serif text-base font-semibold text-sand-950">
                    Manager Resolution Controls
                  </h4>
                  <p className="text-xs text-sand-500">
                    Resolve this issue, expedite staff, or send updates to Room {activeThread?.room}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {issue?.status !== "escalated" && issue?.status !== "resolved" && (
                    <button
                      onClick={handleEscalateProblem}
                      className="flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 transition"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Escalate
                    </button>
                  )}
                </div>
              </div>

              {/* 1. Mark as Resolved box */}
              {issue?.status !== "resolved" ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                  <p className="font-semibold text-xs text-emerald-950 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    Verify and Mark Problem Resolved
                  </p>
                  <input
                    type="text"
                    value={resolutionNoteInput}
                    onChange={(e) => setResolutionNoteInput(e.target.value)}
                    placeholder="Enter resolution notes (e.g. Technician inspected AC, reset compressor, room cooled to 21°C)..."
                    className="w-full rounded-xl border border-emerald-300/80 bg-white px-3.5 py-2 text-xs text-sand-950 placeholder:text-sand-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button
                    onClick={handleResolveProblem}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white shadow-soft hover:bg-emerald-800 transition w-full sm:w-auto"
                  >
                    <Check className="h-4 w-4" />
                    <span>Confirm & Mark Issue Resolved</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900 border border-emerald-200">
                  <span className="font-semibold">This guest room problem has been marked resolved.</span>
                  <button
                    onClick={() => {
                      if (!activeThread) return;
                      escalateRoomIssue(activeThread.room, "Re-opened by manager for additional follow-up.");
                      showToast({ title: "Issue Re-opened", description: "Status changed to pending attention.", type: "warning" });
                    }}
                    className="text-xs font-medium text-emerald-800 underline hover:text-emerald-950"
                  >
                    Re-open Issue
                  </button>
                </div>
              )}

              {/* 2. Expedite / Reassign Department Staff */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-sand-800 block">
                  Expedite Staff Dispatch for Room {activeThread?.room}
                </span>
                <div className="flex flex-wrap gap-2 text-xs">
                  {[
                    "Duty Engineering (Senior Technician)",
                    "Housekeeping Supervisor",
                    "F&B Duty Captain",
                    "Front Desk Manager",
                  ].map((team) => (
                    <button
                      key={team}
                      onClick={() => handleExpediteTeam(team)}
                      className="rounded-lg border border-sand-200 bg-sand-50/80 px-2.5 py-1.5 text-sand-700 hover:border-gold-300 hover:bg-gold-50/60 transition text-xs font-medium"
                    >
                      &rarr; Dispatch {team}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Send Direct Resolution Message to Guest Room */}
              <div className="space-y-2 border-t border-sand-200/80 pt-4">
                <span className="text-xs font-semibold text-sand-800 block flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-gold-700" />
                  Send Official Update to Guest in Room {activeThread?.room}
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageToRoomInput}
                    onChange={(e) => setMessageToRoomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendMessageToRoom();
                    }}
                    placeholder={`e.g., Dear guest, our senior technician is at your door to inspect the AC. We apologize for the delay.`}
                    className="flex-1 rounded-xl border border-sand-300 bg-sand-50/50 px-3.5 py-2 text-xs text-sand-950 placeholder:text-sand-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-gold-500/20"
                  />
                  <button
                    onClick={handleSendMessageToRoom}
                    disabled={!messageToRoomInput.trim()}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-sage-800 px-4 py-2 text-xs font-semibold text-white shadow-soft hover:bg-sage-900 transition disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send to Room</span>
                  </button>
                </div>
              </div>

              {/* 4. One-Click Hospitality Service Recovery */}
              <div className="space-y-2 border-t border-sand-200/80 pt-4">
                <span className="text-xs font-semibold text-sand-800 block flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5 text-gold-700" />
                  Service Recovery Offerings for Room {activeThread?.room}
                </span>
                <div className="flex flex-wrap gap-2 text-xs">
                  {[
                    "Complimentary 2:00 PM Late Checkout",
                    "Chef's Artisanal Fruit & Pastry Platter",
                    "₹1,000 F&B Dining Credit at The Verandah",
                    "Complimentary Signature Foot Reflexology at Vesper Spa",
                  ].map((offer) => (
                    <button
                      key={offer}
                      onClick={() => handleOfferRecovery(offer)}
                      className="rounded-full border border-gold-200 bg-gold-50/70 px-3 py-1 text-gold-900 hover:bg-gold-100 transition text-[11px] font-medium"
                    >
                      + Grant {offer}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Panel>

        {/* Right: In-House Guest File & Stay Intelligence */}
        <div className="space-y-4">
          {/* Tab Selector */}
          <div className="flex rounded-xl border border-sand-200 bg-sand-100/60 p-1">
            <button
              onClick={() => setRightTab("guest-profile")}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-xs font-medium transition",
                rightTab === "guest-profile"
                  ? "bg-white text-sand-950 shadow-xs"
                  : "text-sand-600 hover:text-sand-900"
              )}
            >
              Guest Stay File
            </button>
            <button
              onClick={() => setRightTab("history")}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-xs font-medium transition",
                rightTab === "history"
                  ? "bg-white text-sand-950 shadow-xs"
                  : "text-sand-600 hover:text-sand-900"
              )}
            >
              Stay Activity
            </button>
          </div>

          {rightTab === "guest-profile" ? (
            <>
              {/* In-House Guest Profile */}
              <Panel>
                <PanelBody className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sage-800 text-gold-300 font-sans font-bold text-sm shadow-xs">
                      {guestDetails.room}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-serif text-base font-semibold leading-tight text-sand-950">
                          {guestDetails.name}
                        </p>
                        <span className="rounded-full border border-gold-200 bg-gold-50 px-2 py-0.2 text-[10px] font-semibold text-gold-800">
                          {guestDetails.vip}
                        </span>
                      </div>
                      <p className="text-xs text-sand-500 mt-0.5">{guestDetails.roomType}</p>
                      <p className="text-xs text-sand-500">{guestDetails.phone}</p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-2.5 border-t border-sand-200/80 pt-3 text-xs">
                    <div>
                      <dt className="text-sand-400">Check-in</dt>
                      <dd className="font-medium text-sand-900">{guestDetails.checkIn}</dd>
                    </div>
                    <div>
                      <dt className="text-sand-400">Check-out</dt>
                      <dd className="font-medium text-sand-900">{guestDetails.checkOut}</dd>
                    </div>
                    <div>
                      <dt className="text-sand-400">Total Spend</dt>
                      <dd className="font-medium text-sand-900">{guestDetails.spend}</dd>
                    </div>
                    <div>
                      <dt className="text-sand-400">Room Status</dt>
                      <dd className="font-medium text-emerald-700">Occupied (Clean)</dd>
                    </div>
                  </dl>
                </PanelBody>
              </Panel>

              {/* Guest Preferences */}
              <Panel>
                <PanelHeader title="Guest Stay Preferences" />
                <PanelBody className="pt-3">
                  <ul className="flex flex-wrap gap-1.5">
                    {guestDetails.preferences.map((pref) => (
                      <li
                        key={pref}
                        className="rounded-full border border-sand-200 bg-sand-50/70 px-2.5 py-1 text-xs text-sand-800"
                      >
                        {pref}
                      </li>
                    ))}
                  </ul>
                </PanelBody>
              </Panel>
            </>
          ) : (
            <>
              {/* Recent Activity */}
              <Panel>
                <PanelHeader title="Recent Activity" />
                <PanelBody className="pt-3">
                  <ul className="space-y-2">
                    {guestDetails.recentActivity.map((act) => (
                      <li key={act.label} className="flex items-center gap-2 text-xs">
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            act.live ? "bg-amber-500 animate-pulse" : "bg-sand-300"
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-sand-800">
                          {act.label}
                        </span>
                        <span className="shrink-0 text-sand-400">{act.time}</span>
                      </li>
                    ))}
                  </ul>
                </PanelBody>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
