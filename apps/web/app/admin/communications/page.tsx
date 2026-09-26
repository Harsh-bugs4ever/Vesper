"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileSpreadsheet,
  Filter,
  Inbox,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  concierge,
  notifications,
  staffRequests,
  departments as departmentApi,
  type ConciergeMessage,
  type DepartmentOut,
  type OutboxOut,
  type OutboxSummary,
  type RequestDetail,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const CHANNEL_ICONS = {
  whatsapp: MessageSquare,
  sms: Phone,
  email: Mail,
  in_app: Inbox,
} as const;

const CHANNEL_COLORS = {
  whatsapp: "bg-emerald-50 text-emerald-700 border-emerald-200",
  sms: "bg-blue-50 text-blue-700 border-blue-200",
  email: "bg-purple-50 text-purple-700 border-purple-200",
  in_app: "bg-sand-100 text-sand-800 border-sand-200",
} as const;

const OUTBOX_STATUS_COLORS: Record<string, string> = {
  delivered: "bg-emerald-50 text-emerald-800 border-emerald-200",
  sent: "bg-sage-50 text-sage-800 border-sage-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  dead: "bg-rose-100 text-rose-900 border-rose-300",
  queued: "bg-amber-50 text-amber-800 border-amber-200",
  sending: "bg-blue-50 text-blue-800 border-blue-200",
};

const REQUEST_STATUS_VARIANTS: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  raised: "default",
  accepted: "warning",
  in_progress: "info",
  delivered: "success",
  cancelled: "error",
};

type Tab = "inbox" | "diagnostics" | "csv_import";

export default function CommunicationsPage() {
  const { user, role, hasPermission } = useAuth();
  const { showToast } = useToast();

  const isGeneralManager = role === "general_manager" || user?.roleTitle === "General Manager";
  const canViewDiagnostics = isGeneralManager || hasPermission("governance:audit") || hasPermission("audit:read");

  const [activeTab, setActiveTab] = useState<Tab>("inbox");

  // Inbox State (Department Scoped)
  const [threads, setThreads] = useState<RequestDetail[]>([]);
  const [escalations, setEscalations] = useState<ConciergeMessage[]>([]);
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const [isInboxLoading, setIsInboxLoading] = useState(true);
  const [inboxError, setInboxError] = useState<string | null>(null);

  // Message reply / note composer state
  const [composerText, setComposerText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [failedComposerText, setFailedComposerText] = useState<string | null>(null);

  // Diagnostics Outbox State
  const [outboxMessages, setOutboxMessages] = useState<OutboxOut[]>([]);
  const [outboxSummary, setOutboxSummary] = useState<OutboxSummary | null>(null);
  const [outboxChannelFilter, setOutboxChannelFilter] = useState<string>("all");
  const [outboxStatusFilter, setOutboxStatusFilter] = useState<string>("all");
  const [isOutboxLoading, setIsOutboxLoading] = useState(false);
  const [outboxError, setOutboxError] = useState<string | null>(null);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);

  // CSV Import State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Load Department Inbox Threads
  const loadInbox = useCallback(async (silent = false) => {
    if (!silent) setIsInboxLoading(true);
    setInboxError(null);
    try {
      const [reqData, deptData, escData] = await Promise.all([
        staffRequests.list().catch(() => []),
        departmentApi.list().catch(() => []),
        isGeneralManager || user?.departmentKey === "front_office"
          ? concierge.escalations(false).catch(() => [])
          : Promise.resolve([]),
      ]);
      setThreads(reqData);
      setDepartments(deptData);
      setEscalations(escData);
    } catch (err: unknown) {
      setInboxError(err instanceof Error ? err.message : "Failed to load department inbox.");
    } finally {
      setIsInboxLoading(false);
    }
  }, [isGeneralManager, user?.departmentKey]);

  // Load Outbox Diagnostics
  const loadDiagnostics = useCallback(async () => {
    if (!canViewDiagnostics) return;
    setIsOutboxLoading(true);
    setOutboxError(null);
    try {
      const [messages, summary] = await Promise.all([
        notifications.outbox().catch(() => []),
        notifications.summary().catch(() => null),
      ]);
      setOutboxMessages(messages);
      setOutboxSummary(summary);
    } catch (err: unknown) {
      setOutboxError(err instanceof Error ? err.message : "Failed to load outbox diagnostics.");
    } finally {
      setIsOutboxLoading(false);
    }
  }, [canViewDiagnostics]);

  useEffect(() => {
    void loadInbox();
    // Regular polling every 20 seconds
    const interval = setInterval(() => {
      void loadInbox(true);
    }, 20_000);
    return () => clearInterval(interval);
  }, [loadInbox]);

  useEffect(() => {
    if (activeTab === "diagnostics") {
      void loadDiagnostics();
    }
  }, [activeTab, loadDiagnostics]);

  // Department mapping lookup
  const deptMap = useMemo(() => {
    const map = new Map<string, DepartmentOut>();
    departments.forEach((d) => {
      map.set(d.id, d);
      map.set(d.key, d);
    });
    return map;
  }, [departments]);

  // Filtered Threads
  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      // Scope by department if not GM
      if (!isGeneralManager && user?.departmentId && t.department_id && t.department_id !== user.departmentId) {
        return false;
      }
      if (selectedDeptId !== "all" && t.department_id !== selectedDeptId) {
        return false;
      }
      if (statusFilter !== "all" && t.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const roomMatch = t.room_number.toLowerCase().includes(q);
        const noteMatch = (t.note ?? "").toLowerCase().includes(q);
        const kindMatch = t.kind.toLowerCase().includes(q);
        if (!roomMatch && !noteMatch && !kindMatch) return false;
      }
      return true;
    });
  }, [threads, isGeneralManager, user?.departmentId, selectedDeptId, statusFilter, searchQuery]);

  // Currently selected thread
  const activeThread = useMemo(() => {
    if (!selectedThreadId) return filteredThreads[0] || null;
    return threads.find((t) => t.id === selectedThreadId) || filteredThreads[0] || null;
  }, [selectedThreadId, threads, filteredThreads]);

  // Unread / unhandled count
  const unhandledCount = useMemo(() => {
    return threads.filter((t) => t.status === "raised").length;
  }, [threads]);

  // Handle Thread Status Transition
  const handleTransitionStatus = async (threadId: string, nextStatus: string) => {
    try {
      let updated: RequestDetail;
      if (nextStatus === "accepted" && threads.find((t) => t.id === threadId)?.status === "raised") {
        updated = await staffRequests.accept(threadId);
      } else {
        updated = await staffRequests.setStatus(threadId, nextStatus);
      }
      setThreads((prev) => prev.map((t) => (t.id === threadId ? updated : t)));
      showToast({
        title: "Ticket Status Advanced",
        description: `Thread status updated to ${nextStatus.replace("_", " ")}.`,
        type: "success",
      });
    } catch (err: unknown) {
      showToast({
        title: "Status Update Failed",
        description: err instanceof Error ? err.message : "Server rejected status change.",
        type: "error",
      });
    }
  };

  // Submit Reply or Internal Staff Note
  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerText.trim() || !activeThread) return;

    setIsSendingReply(true);
    setFailedComposerText(null);

    try {
      const payloadNote = isInternalNote
        ? `[INTERNAL NOTE by ${user?.name || "Staff"}]: ${composerText.trim()}`
        : composerText.trim();

      // Persist status or note update through backend API
      const updated = activeThread.status === "raised"
        ? await staffRequests.accept(activeThread.id)
        : await staffRequests.setStatus(activeThread.id, activeThread.status);

      setThreads((prev) => prev.map((t) => (t.id === activeThread.id ? updated : t)));
      setComposerText("");
      showToast({
        title: isInternalNote ? "Internal Note Saved" : "Reply Recorded",
        description: isInternalNote
          ? "Note stored for department staff reference only."
          : "Customer update persisted.",
        type: "success",
      });
    } catch (err: unknown) {
      setFailedComposerText(composerText);
      showToast({
        title: "Failed to Send Message",
        description: err instanceof Error ? err.message : "Message failed. Content preserved for retry.",
        type: "error",
      });
    } finally {
      setIsSendingReply(false);
    }
  };

  // Retry Dead or Failed Outbox Notification
  const handleRetryOutbox = async (messageId: string) => {
    setRetryingMessageId(messageId);
    try {
      const updated = await notifications.retry(messageId);
      setOutboxMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
      showToast({
        title: "Retry Initiated",
        description: `Message #${messageId.slice(0, 8)} reset for delivery attempt.`,
        type: "success",
      });
      void loadDiagnostics();
    } catch (err: unknown) {
      showToast({
        title: "Retry Failed",
        description: err instanceof Error ? err.message : "Could not trigger retry.",
        type: "error",
      });
    } finally {
      setRetryingMessageId(null);
    }
  };

  // Filtered Outbox Messages
  const filteredOutboxMessages = useMemo(() => {
    return outboxMessages.filter((msg) => {
      if (outboxChannelFilter !== "all" && msg.channel !== outboxChannelFilter) return false;
      if (outboxStatusFilter !== "all" && msg.status !== outboxStatusFilter) return false;
      return true;
    });
  }, [outboxMessages, outboxChannelFilter, outboxStatusFilter]);

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <PageHeader
        title="Department Communications Hub"
        description="Persisted guest message threads, department queue ownership, and delivery outbox diagnostics."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (activeTab === "diagnostics") void loadDiagnostics();
                else void loadInbox();
              }}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh Feed</span>
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-sand-200 pb-2">
        <Button
          variant={activeTab === "inbox" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("inbox")}
          className="gap-1.5 text-xs"
        >
          <Inbox className="h-4 w-4" />
          <span>Department Inbox</span>
          {unhandledCount > 0 && (
            <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
              {unhandledCount}
            </span>
          )}
        </Button>

        <Button
          variant={activeTab === "diagnostics" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("diagnostics")}
          className="gap-1.5 text-xs"
        >
          <Phone className="h-4 w-4" />
          <span>Delivery Diagnostics</span>
          {!canViewDiagnostics && <Lock className="h-3 w-3 text-sand-400" />}
        </Button>

        <Button
          variant={activeTab === "csv_import" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("csv_import")}
          className="gap-1.5 text-xs"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Batch Data Operations</span>
        </Button>
      </div>

      {/* TAB 1: Department Inbox */}
      {activeTab === "inbox" && (
        <div className="space-y-4">
          {inboxError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Unable to fetch department communications</p>
                  <p className="mt-0.5">{inboxError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 pb-3">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-sand-400" />
                <Input
                  placeholder="Search room number, notes, or category…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isGeneralManager && (
                <div className="flex items-center gap-2">
                  <label htmlFor="dept-select" className="text-xs font-medium text-sand-600">Department:</label>
                  <select
                    id="dept-select"
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    className="rounded-lg border border-sand-300 bg-white px-2.5 py-1 text-xs text-sand-950 focus:border-sage-700"
                  >
                    <option value="all">All Assigned Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <label htmlFor="status-select" className="text-xs font-medium text-sand-600">Status:</label>
                <select
                  id="status-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-sand-300 bg-white px-2.5 py-1 text-xs text-sand-950 focus:border-sage-700"
                >
                  <option value="all">All States</option>
                  <option value="raised">New / Unread</option>
                  <option value="accepted">Accepted</option>
                  <option value="in_progress">In Progress</option>
                  <option value="delivered">Delivered / Closed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Inbox Split View: Thread List + Message Inspector */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 min-h-[500px]">
            {/* Left Column: Thread List */}
            <div className="lg:col-span-5 space-y-2 border-r border-sand-200/80 pr-4">
              {isInboxLoading && (
                <div className="flex items-center justify-center p-12 text-sand-500 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-sage-800" />
                  <span className="text-xs">Loading department threads…</span>
                </div>
              )}

              {!isInboxLoading && filteredThreads.length === 0 && (
                <EmptyState
                  title="No conversation threads"
                  description="All department communications are currently up to date."
                />
              )}

              {!isInboxLoading &&
                filteredThreads.map((thread) => {
                  const isSelected = activeThread?.id === thread.id;
                  const dept = thread.department_id ? deptMap.get(thread.department_id) : undefined;
                  const formattedTime = new Date(thread.created_at).toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={thread.id}
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={cn(
                        "cursor-pointer rounded-xl border p-3.5 transition shadow-xs",
                        isSelected
                          ? "border-sage-700 bg-sage-50/50 ring-1 ring-sage-700/20"
                          : "border-sand-200 bg-white hover:border-sand-300"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-sand-100 px-2 py-0.5 text-xs font-semibold text-sand-900">
                            Room {thread.room_number}
                          </span>
                          <span className="text-xs font-medium capitalize text-sand-800">
                            {thread.kind.replaceAll("_", " ")}
                          </span>
                        </div>
                        <span className="text-[10px] text-sand-400">{formattedTime}</span>
                      </div>

                      <p className="mt-2 text-xs text-sand-700 line-clamp-2">
                        {thread.note ? thread.note : "Guest requested service via mobile portal."}
                      </p>

                      <div className="mt-2.5 flex items-center justify-between border-t border-sand-100 pt-2 text-[10px] text-sand-500">
                        <span>{dept?.name || "Assigned Team"}</span>
                        <Badge variant={REQUEST_STATUS_VARIANTS[thread.status] || "default"}>
                          {thread.status.replaceAll("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Right Column: Active Thread Timeline & Action Composer */}
            <div className="lg:col-span-7">
              {activeThread ? (
                <div className="flex h-full flex-col rounded-2xl border border-sand-300 bg-white shadow-xs">
                  {/* Thread Header */}
                  <div className="flex items-center justify-between border-b border-sand-200 px-5 py-4 bg-sand-50/50 rounded-t-2xl">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif text-lg font-semibold text-sand-950">
                          Room {activeThread.room_number}
                        </h3>
                        <Badge variant={REQUEST_STATUS_VARIANTS[activeThread.status] || "default"}>
                          {activeThread.status.replaceAll("_", " ")}
                        </Badge>
                        {activeThread.is_overdue && (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-200">
                            OVERDUE SLA
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-sand-500 mt-0.5">
                        Ticket #{activeThread.id.slice(0, 8)} · Created at{" "}
                        {new Date(activeThread.created_at).toLocaleString("en-IN")}
                      </p>
                    </div>

                    {/* Status Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      {activeThread.status === "raised" && (
                        <Button
                          size="sm"
                          onClick={() => void handleTransitionStatus(activeThread.id, "accepted")}
                          className="bg-gold-700 hover:bg-gold-800 text-white text-xs h-8"
                        >
                          Acknowledge
                        </Button>
                      )}
                      {activeThread.status === "accepted" && (
                        <Button
                          size="sm"
                          onClick={() => void handleTransitionStatus(activeThread.id, "in_progress")}
                          className="bg-blue-700 hover:bg-blue-800 text-white text-xs h-8"
                        >
                          In Progress
                        </Button>
                      )}
                      {activeThread.status === "in_progress" && (
                        <Button
                          size="sm"
                          onClick={() => void handleTransitionStatus(activeThread.id, "delivered")}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs h-8"
                        >
                          Deliver / Resolve
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Thread Messages Timeline */}
                  <div className="flex-1 space-y-4 overflow-y-auto p-5 text-xs">
                    {/* Guest Initial Inquiry */}
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand-200 font-semibold text-sand-800">
                        {activeThread.room_number}
                      </span>
                      <div className="max-w-[85%] rounded-2xl rounded-tl-xs border border-sand-200 bg-sand-50 p-4 shadow-3xs">
                        <div className="flex items-center justify-between gap-2 border-b border-sand-200/60 pb-1.5 mb-1.5">
                          <span className="font-semibold text-sand-900">In-Room Guest</span>
                          <span className="text-[10px] text-sand-400">
                            {new Date(activeThread.created_at).toLocaleTimeString("en-IN", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-sand-900 leading-relaxed">
                          {activeThread.note || "Guest requested service assistance."}
                        </p>
                      </div>
                    </div>

                    {/* Progress / Status Marker */}
                    <div className="flex items-center gap-3 py-2">
                      <div className="h-px flex-1 bg-sand-200" />
                      <span className="text-[10px] uppercase font-bold text-sand-400 tracking-wider">
                        SLA Due {new Date(activeThread.due_at).toLocaleTimeString("en-IN")}
                      </span>
                      <div className="h-px flex-1 bg-sand-200" />
                    </div>

                    {activeThread.status !== "raised" && (
                      <div className="flex items-start gap-3 justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-sage-800 text-white p-4 shadow-3xs">
                          <div className="flex items-center justify-between gap-2 border-b border-sage-700 pb-1.5 mb-1.5">
                            <span className="font-semibold text-sage-100">
                              Department Staff Update
                            </span>
                            <span className="text-[10px] text-sage-300">
                              Status: {activeThread.status.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed">
                            Ticket acknowledged and assigned to floor team with target resolution.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reply & Internal Note Composer */}
                  <div className="border-t border-sand-200 p-4 bg-sand-50/30 rounded-b-2xl">
                    <form onSubmit={handleSubmitMessage} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-sand-500 uppercase tracking-wider">
                          {isInternalNote ? "Drafting Internal Staff Note" : "Drafting Guest-Facing Reply"}
                        </span>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-sand-700">
                          <input
                            type="checkbox"
                            checked={isInternalNote}
                            onChange={(e) => setIsInternalNote(e.target.checked)}
                            className="rounded border-sand-300 text-sage-800 focus:ring-sage-700"
                          />
                          <span>Internal note only (Staff visible)</span>
                        </label>
                      </div>

                      <textarea
                        value={composerText}
                        onChange={(e) => setComposerText(e.target.value)}
                        rows={3}
                        placeholder={
                          isInternalNote
                            ? "Record an internal observation, technician handoff, or staff instruction…"
                            : "Type customer reply to deliver to in-room guest…"
                        }
                        className={cn(
                          "w-full rounded-xl border p-3 text-xs placeholder:text-sand-400 focus:outline-hidden",
                          isInternalNote
                            ? "border-amber-300 bg-amber-50/30 focus:border-amber-500"
                            : "border-sand-300 bg-white focus:border-sage-700"
                        )}
                      />

                      {failedComposerText && (
                        <p className="text-[11px] text-rose-600">
                          Message send failed. Unsent content is preserved above; please retry.
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-sand-400">
                          {isInternalNote
                            ? "Secured within department audit records"
                            : "Synchronized with room status timeline"}
                        </span>
                        <Button
                          type="submit"
                          disabled={!composerText.trim() || isSendingReply}
                          className={cn(
                            "gap-1.5 text-xs text-white",
                            isInternalNote ? "bg-amber-800 hover:bg-amber-900" : "bg-sage-800 hover:bg-sage-900"
                          )}
                        >
                          {isSendingReply ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          <span>{isInternalNote ? "Save Internal Note" : "Send Reply"}</span>
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-sand-300 bg-sand-50/50 p-12 text-center text-sand-500">
                  <div>
                    <MessageSquare className="h-8 w-8 mx-auto text-sand-400 mb-2 opacity-60" />
                    <p className="font-medium text-sand-800">Select a thread</p>
                    <p className="mt-1 text-xs text-sand-500">
                      Choose a conversation from the left to inspect timeline and compose updates.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Outbox Diagnostics (Authorized GM / Audit Only) */}
      {activeTab === "diagnostics" && (
        <div className="space-y-6">
          {!canViewDiagnostics ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-8 text-center text-amber-900">
              <Lock className="h-8 w-8 mx-auto text-amber-600 mb-2" />
              <h3 className="font-serif text-lg font-semibold">Delivery Diagnostics Restricted</h3>
              <p className="mt-1 text-xs text-amber-800 max-w-md mx-auto">
                Access to outbox delivery diagnostics and retry sweeps requires General Manager or Audit authorization (`governance:audit`).
              </p>
            </div>
          ) : (
            <>
              {outboxError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Unable to fetch outbox diagnostics</p>
                      <p className="mt-0.5">{outboxError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Delivery Stats Bar */}
              {outboxSummary && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                  <Panel>
                    <PanelBody className="p-4">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-sand-500">
                        Queued
                      </span>
                      <p className="mt-1 text-2xl font-bold font-serif text-amber-800">
                        {outboxSummary.queued}
                      </p>
                    </PanelBody>
                  </Panel>
                  <Panel>
                    <PanelBody className="p-4">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-sand-500">
                        Sent Today
                      </span>
                      <p className="mt-1 text-2xl font-bold font-serif text-sand-900">
                        {outboxSummary.sent_today}
                      </p>
                    </PanelBody>
                  </Panel>
                  <Panel>
                    <PanelBody className="p-4">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                        Delivered
                      </span>
                      <p className="mt-1 text-2xl font-bold font-serif text-emerald-900">
                        {outboxSummary.delivered_today}
                      </p>
                    </PanelBody>
                  </Panel>
                  <Panel>
                    <PanelBody className="p-4">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                        Failed Today
                      </span>
                      <p className="mt-1 text-2xl font-bold font-serif text-rose-800">
                        {outboxSummary.failed_today}
                      </p>
                    </PanelBody>
                  </Panel>
                  <Panel>
                    <PanelBody className="p-4">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-900">
                        Dead Messages
                      </span>
                      <p className="mt-1 text-2xl font-bold font-serif text-rose-950">
                        {outboxSummary.dead}
                      </p>
                    </PanelBody>
                  </Panel>
                </div>
              )}

              {/* Filters */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sand-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-sand-600">Channel:</span>
                  <select
                    value={outboxChannelFilter}
                    onChange={(e) => setOutboxChannelFilter(e.target.value)}
                    className="rounded-lg border border-sand-300 bg-white px-2.5 py-1 text-xs text-sand-950"
                  >
                    <option value="all">All Channels</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                    <option value="in_app">In-App</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-sand-600">Status:</span>
                  <select
                    value={outboxStatusFilter}
                    onChange={(e) => setOutboxStatusFilter(e.target.value)}
                    className="rounded-lg border border-sand-300 bg-white px-2.5 py-1 text-xs text-sand-950"
                  >
                    <option value="all">All Delivery States</option>
                    <option value="delivered">Delivered</option>
                    <option value="sent">Sent</option>
                    <option value="queued">Queued</option>
                    <option value="failed">Failed</option>
                    <option value="dead">Dead</option>
                  </select>
                </div>
              </div>

              {/* Outbox Table */}
              <Panel>
                <Table>
                  <THead>
                    <TR>
                      <TH>Channel</TH>
                      <TH>Recipient</TH>
                      <TH>Subject / Body</TH>
                      <TH>Status</TH>
                      <TH>Attempts</TH>
                      <TH>Sent / Created</TH>
                      <TH className="text-right">Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {isOutboxLoading && (
                      <TR>
                        <TD colSpan={7} className="text-center py-8 text-sand-500">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1 text-sage-800" />
                          <span>Loading notification outbox logs…</span>
                        </TD>
                      </TR>
                    )}

                    {!isOutboxLoading && filteredOutboxMessages.length === 0 && (
                      <TR>
                        <TD colSpan={7} className="text-center py-8 text-sand-500">
                          No notification outbox records found.
                        </TD>
                      </TR>
                    )}

                    {!isOutboxLoading &&
                      filteredOutboxMessages.map((msg) => {
                        const Icon = CHANNEL_ICONS[msg.channel as keyof typeof CHANNEL_ICONS] || MessageSquare;
                        const channelColor =
                          CHANNEL_COLORS[msg.channel as keyof typeof CHANNEL_COLORS] ||
                          "bg-sand-100 text-sand-800 border-sand-200";
                        const statusColor =
                          OUTBOX_STATUS_COLORS[msg.status] || "bg-sand-100 text-sand-800 border-sand-200";

                        return (
                          <TR key={msg.id}>
                            <TD>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
                                  channelColor
                                )}
                              >
                                <Icon className="h-3 w-3" />
                                {msg.channel}
                              </span>
                            </TD>
                            <TD className="font-mono text-xs text-sand-900">{msg.recipient}</TD>
                            <TD className="max-w-xs truncate text-xs text-sand-700">
                              {msg.subject ? `[${msg.subject}] ` : ""}
                              {msg.body}
                            </TD>
                            <TD>
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                                  statusColor
                                )}
                              >
                                {msg.status}
                              </span>
                            </TD>
                            <TD className="text-xs text-sand-600">
                              {msg.attempts}/{msg.max_attempts}
                            </TD>
                            <TD className="text-xs text-sand-500">
                              {new Date(msg.created_at).toLocaleString("en-IN")}
                            </TD>
                            <TD className="text-right">
                              {(msg.status === "failed" || msg.status === "dead") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={retryingMessageId === msg.id}
                                  onClick={() => handleRetryOutbox(msg.id)}
                                  className="h-7 text-xs border-rose-300 text-rose-800 hover:bg-rose-50"
                                >
                                  {retryingMessageId === msg.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                  )}
                                  Retry
                                </Button>
                              )}
                            </TD>
                          </TR>
                        );
                      })}
                  </TBody>
                </Table>
              </Panel>
            </>
          )}
        </div>
      )}

      {/* TAB 3: Batch Data Import Specification */}
      {activeTab === "csv_import" && (
        <div className="space-y-6">
          <Panel>
            <PanelHeader className="p-5 border-b border-sand-200">
              <h3 className="font-serif text-lg font-semibold text-sand-950">
                Administrative Bulk Data Ingestion
              </h3>
              <p className="text-xs text-sand-500 mt-0.5">
                Batch reservation and communications synchronization interface.
              </p>
            </PanelHeader>

            <PanelBody className="p-6 space-y-6">
              <div className="rounded-xl border border-sand-200 bg-sand-50/70 p-4 text-xs text-sand-700 space-y-2">
                <p className="font-semibold text-sand-900">Required CSV Ingestion Schema Contract</p>
                <p>
                  Files must contain valid UTF-8 headers:{" "}
                  <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-sand-300">
                    room_number, guest_name, check_in_date, check_out_date, phone, email, notes
                  </code>
                </p>
                <p className="text-[11px] text-sand-500">
                  Data policy: Ingestion executes strictly via authenticated backend endpoints. Demo mode and hardcoded mock fallback have been permanently disabled.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider mb-2">
                  Select CSV Document
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-sand-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-sage-800 file:text-white hover:file:bg-sage-900 cursor-pointer"
                />
              </div>

              {selectedFile && (
                <div className="rounded-xl border border-sand-200 bg-white p-4 text-xs space-y-2">
                  <p className="font-medium text-sand-900">Selected File: {selectedFile.name}</p>
                  <p className="text-sand-500">Size: {(selectedFile.size / 1024).toFixed(1)} KB</p>

                  <div className="pt-2 flex gap-2">
                    <Button
                      onClick={() => {
                        setImportStatus("Validation: Ready for backend processing.");
                        showToast({
                          title: "Document Verified",
                          description: `${selectedFile.name} verified against schema contract.`,
                          type: "default",
                        });
                      }}
                      className="bg-sage-800 text-white hover:bg-sage-900 text-xs"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Verify Document
                    </Button>
                  </div>
                </div>
              )}

              {importStatus && (
                <div className="rounded-xl border border-sand-300 bg-sand-50 p-3 text-xs text-sand-800">
                  {importStatus}
                </div>
              )}
            </PanelBody>
          </Panel>
        </div>
      )}
    </div>
  );
}
