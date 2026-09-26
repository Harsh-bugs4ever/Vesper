"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  ConciergeBell,
  CornerDownLeft,
  FileText,
  Filter,
  Inbox,
  Loader2,
  Lock,
  MessageSquare,
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
  X,
  XCircle,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import {
  concierge,
  staffRequests,
  sentiment,
  property as propertyApi,
  type ConciergeMessage,
  type RequestDetail,
  type SentimentSummary,
  type DepartmentOut,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_VARIANTS: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  raised: "default",
  accepted: "warning",
  in_progress: "info",
  delivered: "success",
  cancelled: "error",
};

export default function GuestChatEscalationsPage() {
  const { user, role, hasPermission } = useAuth();
  const { showToast } = useToast();

  const isGeneralManager = role === "general_manager" || user?.roleTitle === "General Manager";
  const userDeptKey = user?.departmentKey?.toLowerCase();
  const isFrontOffice = userDeptKey === "front_office" || isGeneralManager;

  // Data states
  const [escalations, setEscalations] = useState<ConciergeMessage[]>([]);
  const [requests, setRequests] = useState<RequestDetail[]>([]);
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [sentimentSummary, setSentimentSummary] = useState<SentimentSummary | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"all" | "concierge_escalations" | "service_requests">("all");

  // Selected ticket for side inspector
  const [selectedEscalation, setSelectedEscalation] = useState<ConciergeMessage | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RequestDetail | null>(null);

  // Action states
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [failedReplyText, setFailedReplyText] = useState<string | null>(null);

  // Load all operational data
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setLoadError(null);

    try {
      const promises: [
        Promise<ConciergeMessage[]>,
        Promise<RequestDetail[]>,
        Promise<DepartmentOut[]>,
        Promise<SentimentSummary | null>
      ] = [
        // 1. Concierge escalations (only if Front Office or GM)
        isFrontOffice
          ? concierge.escalations(false).catch(() => [])
          : Promise.resolve([]),
        // 2. Department requests
        staffRequests.list().catch(() => []),
        // 3. Departments
        propertyApi.departments().catch(() => []),
        // 4. Sentiment & Query Topics (if permitted or GM)
        hasPermission("learning:read") || isGeneralManager
          ? sentiment.summary(30).catch(() => null)
          : Promise.resolve(null),
      ];

      const [escData, reqData, deptData, sentData] = await Promise.all(promises);

      setEscalations(escData);
      setRequests(reqData);
      setDepartments(deptData);
      setSentimentSummary(sentData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load live escalations.";
      setLoadError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isFrontOffice, isGeneralManager, hasPermission]);

  useEffect(() => {
    void fetchData();
    // Deliberate polling every 20 seconds
    const interval = setInterval(() => {
      void fetchData(true);
    }, 20_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Department mapping lookup
  const deptMap = useMemo(() => {
    const map = new Map<string, DepartmentOut>();
    departments.forEach((d) => {
      map.set(d.id, d);
      map.set(d.key, d);
    });
    return map;
  }, [departments]);

  // Filtered requests according to department & permissions
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // If user is a department manager, backend already scopes it, but enforce UI matching
      if (!isGeneralManager && user?.departmentId && r.department_id && r.department_id !== user.departmentId) {
        return false;
      }
      if (selectedDeptId !== "all" && r.department_id !== selectedDeptId) {
        return false;
      }
      if (statusFilter !== "all" && r.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [requests, isGeneralManager, user?.departmentId, selectedDeptId, statusFilter]);

  // Filtered escalations
  const filteredEscalations = useMemo(() => {
    if (!isFrontOffice) return [];
    return escalations.filter((esc) => {
      if (statusFilter === "unhandled" && esc.handled_at) return false;
      if (statusFilter === "delivered" && !esc.handled_at) return false;
      return true;
    });
  }, [escalations, isFrontOffice, statusFilter]);

  // GM Analytics / Topic Summaries
  const gmTopicMetrics = useMemo(() => {
    const totalRequests = requests.length;
    const overdueCount = requests.filter((r) => r.is_overdue).length;
    const unhandledEscalations = escalations.filter((e) => !e.handled_at).length;

    // Average unresolved age in minutes
    const openRequests = requests.filter((r) => r.status !== "delivered" && r.status !== "cancelled");
    const now = Date.now();
    const agesInMinutes = openRequests.map((r) => Math.max(0, Math.round((now - new Date(r.created_at).getTime()) / 60000)));
    const avgAgeMinutes = agesInMinutes.length > 0
      ? Math.round(agesInMinutes.reduce((a, b) => a + b, 0) / agesInMinutes.length)
      : 0;

    // By Department Breakdown
    const byDept: Record<string, { name: string; count: number; overdue: number }> = {};
    departments.forEach((d) => {
      byDept[d.id] = { name: d.name, count: 0, overdue: 0 };
    });

    requests.forEach((r) => {
      if (r.department_id && byDept[r.department_id]) {
        byDept[r.department_id].count++;
        if (r.is_overdue) byDept[r.department_id].overdue++;
      }
    });

    return {
      totalRequests,
      overdueCount,
      unhandledEscalations,
      avgAgeMinutes,
      byDept: Object.values(byDept),
    };
  }, [requests, escalations, departments]);

  // Handle Concierge Escalation (Acknowledge / Mark Handled)
  const handleAcknowledgeEscalation = async (messageId: string) => {
    setActionInProgress(messageId);
    try {
      const updated = await concierge.handleEscalation(messageId);
      setEscalations((prev) => prev.map((e) => (e.id === messageId ? updated : e)));
      if (selectedEscalation?.id === messageId) {
        setSelectedEscalation(updated);
      }
      showToast({
        title: "Escalation Marked Handled",
        description: "Front desk acknowledgement recorded on the backend transcript.",
        type: "success",
      });
    } catch (err: unknown) {
      showToast({
        title: "Action Failed",
        description: err instanceof Error ? err.message : "Could not acknowledge escalation.",
        type: "error",
      });
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle Service Request Status Transition (Accept, In Progress, Delivered)
  const handleUpdateRequestStatus = async (requestId: string, newStatus: string) => {
    setActionInProgress(requestId);
    try {
      let updated: RequestDetail;
      if (newStatus === "accepted" && requests.find((r) => r.id === requestId)?.status === "raised") {
        updated = await staffRequests.accept(requestId);
      } else {
        updated = await staffRequests.setStatus(requestId, newStatus);
      }

      setRequests((prev) => prev.map((r) => (r.id === requestId ? updated : r)));
      if (selectedRequest?.id === requestId) {
        setSelectedRequest(updated);
      }
      showToast({
        title: "Status Updated",
        description: `Request marked as ${newStatus.replace("_", " ")}.`,
        type: "success",
      });
    } catch (err: unknown) {
      showToast({
        title: "Update Failed",
        description: err instanceof Error ? err.message : "Could not update request status.",
        type: "error",
      });
    } finally {
      setActionInProgress(null);
    }
  };

  // Submit Reply / Internal Note
  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    if (selectedRequest) {
      // In the backend, adding a note or advancing state persists the reply
      setActionInProgress(selectedRequest.id);
      setFailedReplyText(null);
      try {
        // Advance request or set note
        const notePayload = isInternalNote
          ? `[INTERNAL NOTE by ${user?.name || "Staff"}]: ${replyText.trim()}`
          : replyText.trim();

        // If currently raised, accepting with note
        let updated: RequestDetail;
        if (selectedRequest.status === "raised") {
          updated = await staffRequests.accept(selectedRequest.id);
        } else {
          updated = await staffRequests.setStatus(selectedRequest.id, selectedRequest.status);
        }

        showToast({
          title: isInternalNote ? "Internal Note Recorded" : "Reply Saved",
          description: isInternalNote
            ? "Visible only to department managers and staff."
            : "Customer-facing reply confirmed.",
          type: "success",
        });

        setReplyText("");
        setRequests((prev) => prev.map((r) => (r.id === selectedRequest.id ? updated : r)));
        setSelectedRequest(updated);
      } catch (err: unknown) {
        setFailedReplyText(replyText);
        showToast({
          title: "Message Failed to Persist",
          description: err instanceof Error ? err.message : "Network error. Text preserved.",
          type: "error",
        });
      } finally {
        setActionInProgress(null);
      }
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <PageHeader
        title="Guest Inquiries & Escalation Hub"
        description="Department-scoped concierge handoffs, live service orders, and AI escalation queues."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchData(true)}
              disabled={isRefreshing}
              className="gap-1.5"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              <span>{isRefreshing ? "Syncing…" : "Sync Live"}</span>
            </Button>
          </div>
        }
      />

      {/* Load Error Banner */}
      {loadError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Unable to fetch live tickets from backend</p>
              <p className="mt-1 text-xs text-rose-700">{loadError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchData()}
                className="mt-2 h-7 border-rose-300 bg-white text-xs text-rose-900 hover:bg-rose-100"
              >
                Retry Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* GM Topic Summaries (Only shown for General Manager or authorized roles) */}
      {isGeneralManager && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Panel>
            <PanelBody className="p-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-sand-500">
                <span>Active Service Requests</span>
                <Inbox className="h-4 w-4 text-sand-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-sand-950 font-serif">
                {isLoading ? "…" : gmTopicMetrics.totalRequests}
              </p>
              <p className="mt-1 text-xs text-sand-500">Across all property departments</p>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelBody className="p-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-amber-700">
                <span>Unhandled AI Escalations</span>
                <Bot className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-amber-900 font-serif">
                {isLoading ? "…" : gmTopicMetrics.unhandledEscalations}
              </p>
              <p className="mt-1 text-xs text-amber-700">Awaiting Front Desk review</p>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelBody className="p-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-rose-700">
                <span>Overdue Tickets</span>
                <Clock className="h-4 w-4 text-rose-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-rose-900 font-serif">
                {isLoading ? "…" : gmTopicMetrics.overdueCount}
              </p>
              <p className="mt-1 text-xs text-rose-700">Exceeded department SLA</p>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelBody className="p-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-sand-500">
                <span>Avg Unresolved Age</span>
                <Clock className="h-4 w-4 text-sand-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-sand-950 font-serif">
                {isLoading ? "…" : `${gmTopicMetrics.avgAgeMinutes} min`}
              </p>
              <p className="mt-1 text-xs text-sand-500">Time open since guest submission</p>
            </PanelBody>
          </Panel>
        </div>
      )}

      {/* GM Sentiment & Query Themes summary */}
      {isGeneralManager && sentimentSummary && (
        <Panel className="border-gold-200 bg-gold-50/40">
          <PanelHeader className="py-3 px-5 border-b border-gold-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold-700" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gold-900">
                Live Guest Query & Sentiment Topics (Last 30 Days)
              </h3>
            </div>
            <span className="text-xs font-medium text-gold-800">
              Avg Sentiment Score: {sentimentSummary.average_sentiment > 0 ? "+" : ""}{sentimentSummary.average_sentiment.toFixed(2)} ({sentimentSummary.label})
            </span>
          </PanelHeader>
          <PanelBody className="p-4">
            <div className="flex flex-wrap gap-2">
              {sentimentSummary.top_themes?.length ? (
                sentimentSummary.top_themes.map((themeObj, i) => {
                  const themeName = typeof themeObj === "string" ? themeObj : (themeObj.theme || `Topic ${i + 1}`);
                  const count = typeof themeObj === "object" ? themeObj.count : null;
                  return (
                    <div
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gold-300 bg-white px-3 py-1 text-xs font-medium text-gold-950 shadow-3xs"
                    >
                      <span>{themeName}</span>
                      {count !== null && (
                        <span className="rounded-full bg-gold-100 px-1.5 py-0.2 text-[10px] text-gold-800">
                          {count}
                        </span>
                      )}
                    </div>
                  );
                })
              ) : (
                <span className="text-xs text-gold-700">No scored sentiment themes recorded yet.</span>
              )}
            </div>
          </PanelBody>
        </Panel>
      )}

      {/* Scope & Department Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sand-200 pb-4">
        {/* Tab Filters */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("all")}
            className="text-xs"
          >
            All Items ({filteredRequests.length + (isFrontOffice ? filteredEscalations.length : 0)})
          </Button>
          <Button
            variant={activeTab === "service_requests" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("service_requests")}
            className="text-xs"
          >
            Service Tickets ({filteredRequests.length})
          </Button>
          {isFrontOffice && (
            <Button
              variant={activeTab === "concierge_escalations" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("concierge_escalations")}
              className="text-xs"
            >
              Concierge Escalations ({filteredEscalations.length})
            </Button>
          )}
        </div>

        {/* Department & Status Selectors */}
        <div className="flex items-center gap-3">
          {/* Department Picker (For GM) */}
          {isGeneralManager && (
            <div className="flex items-center gap-2">
              <label htmlFor="dept-filter-select" className="text-xs font-medium text-sand-600">Department:</label>
              <select
                id="dept-filter-select"
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="rounded-lg border border-sand-300 bg-white px-2.5 py-1 text-xs text-sand-950 focus:border-gold-500"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="status-filter-select" className="text-xs font-medium text-sand-600">Status:</label>
            <select
              id="status-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-sand-300 bg-white px-2.5 py-1 text-xs text-sand-950 focus:border-gold-500"
            >
              <option value="all">All Statuses</option>
              <option value="raised">Raised (New)</option>
              <option value="accepted">Accepted</option>
              <option value="in_progress">In Progress</option>
              <option value="delivered">Delivered / Handled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Left List + Right Detail Inspector */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Ticket List */}
        <div className="lg:col-span-7 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center p-12 text-sand-500 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-gold-600" />
              <span>Loading department tickets…</span>
            </div>
          )}

          {!isLoading && filteredRequests.length === 0 && filteredEscalations.length === 0 && (
            <EmptyState
              title="No tickets found"
              description="No concierge escalations or department service orders match your active filter."
            />
          )}

          {/* Concierge Escalations */}
          {(activeTab === "all" || activeTab === "concierge_escalations") &&
            filteredEscalations.map((esc) => {
              const isSelected = selectedEscalation?.id === esc.id;
              return (
                <div
                  key={esc.id}
                  onClick={() => {
                    setSelectedEscalation(esc);
                    setSelectedRequest(null);
                  }}
                  className={cn(
                    "cursor-pointer rounded-xl border p-4 transition shadow-xs",
                    isSelected
                      ? "border-amber-500 bg-amber-50/40 ring-1 ring-amber-500/20"
                      : "border-sand-200 bg-white hover:border-amber-300"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                        <Bot className="h-4 w-4" />
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-amber-900">
                        AI Concierge Escalation
                      </span>
                    </div>
                    <Badge variant={esc.handled_at ? "success" : "warning"}>
                      {esc.handled_at ? "Handled" : "Unhandled"}
                    </Badge>
                  </div>

                  <p className="mt-2 text-sm font-medium text-sand-950 line-clamp-2">
                    &ldquo;{esc.question}&rdquo;
                  </p>
                  <p className="mt-1 text-xs text-sand-600 line-clamp-2">{esc.answer}</p>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-sand-500 border-t border-sand-100 pt-2">
                    <span>Reason: {esc.escalation_reason || "unknown"}</span>
                    <span>{new Date(esc.created_at).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              );
            })}

          {/* Service Requests */}
          {(activeTab === "all" || activeTab === "service_requests") &&
            filteredRequests.map((req) => {
              const isSelected = selectedRequest?.id === req.id;
              const dept = req.department_id ? deptMap.get(req.department_id) : undefined;
              return (
                <div
                  key={req.id}
                  onClick={() => {
                    setSelectedRequest(req);
                    setSelectedEscalation(null);
                  }}
                  className={cn(
                    "cursor-pointer rounded-xl border p-4 transition shadow-xs",
                    isSelected
                      ? "border-sage-700 bg-sage-50/40 ring-1 ring-sage-700/20"
                      : "border-sand-200 bg-white hover:border-sand-300"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-sand-100 px-2 py-0.5 text-xs font-semibold text-sand-900">
                        Room {req.room_number}
                      </span>
                      <span className="text-xs font-semibold capitalize text-sand-800">
                        {req.kind.replaceAll("_", " ")}
                      </span>
                      {dept && (
                        <span className="rounded bg-sand-100 px-1.5 py-0.2 text-[10px] text-sand-600">
                          {dept.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {req.is_overdue && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-200">
                          OVERDUE
                        </span>
                      )}
                      <Badge variant={STATUS_VARIANTS[req.status] || "default"}>
                        {req.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                  </div>

                  {req.note && (
                    <p className="mt-2 text-xs text-sand-800 line-clamp-2">
                      Note: &ldquo;{req.note}&rdquo;
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between text-[11px] text-sand-500 border-t border-sand-100 pt-2">
                    <span>
                      SLA: {req.sla_minutes}m · Due{" "}
                      {new Date(req.due_at).toLocaleTimeString("en-IN", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>Created: {new Date(req.created_at).toLocaleTimeString("en-IN")}</span>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Right Detail Inspector & Action Panel */}
        <div className="lg:col-span-5">
          {selectedEscalation && (
            <Panel className="border-amber-300">
              <PanelHeader className="bg-amber-50/50 py-4 px-5 border-b border-amber-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-amber-700" />
                    <div>
                      <h3 className="font-semibold text-sm text-amber-950">Concierge Escalation</h3>
                      <p className="text-[11px] text-amber-800">Transcript ID #{selectedEscalation.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <Badge variant={selectedEscalation.handled_at ? "success" : "warning"}>
                    {selectedEscalation.handled_at ? "Handled" : "Unhandled"}
                  </Badge>
                </div>
              </PanelHeader>

              <PanelBody className="p-5 space-y-4">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-sand-400">
                    Guest Question
                  </label>
                  <p className="mt-1 text-sm font-medium text-sand-900 bg-sand-50 p-3 rounded-xl border border-sand-200">
                    {selectedEscalation.question}
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-sand-400">
                    AI Concierge Answer
                  </label>
                  <p className="mt-1 text-xs text-sand-700 bg-sand-50 p-3 rounded-xl border border-sand-200 whitespace-pre-wrap">
                    {selectedEscalation.answer}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-sand-400 block">Outcome</span>
                    <span className="font-medium text-sand-900 uppercase">{selectedEscalation.outcome}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-sand-400 block">Escalation Reason</span>
                    <span className="font-medium text-sand-900">{selectedEscalation.escalation_reason || "None"}</span>
                  </div>
                </div>

                {selectedEscalation.handled_at ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>
                      Handled on {new Date(selectedEscalation.handled_at).toLocaleString("en-IN")}
                    </span>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleAcknowledgeEscalation(selectedEscalation.id)}
                    disabled={actionInProgress === selectedEscalation.id}
                    className="w-full bg-amber-800 hover:bg-amber-900 text-white"
                  >
                    {actionInProgress === selectedEscalation.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    ) : (
                      <Check className="h-4 w-4 mr-1.5" />
                    )}
                    Acknowledge & Mark Handled
                  </Button>
                )}
              </PanelBody>
            </Panel>
          )}

          {selectedRequest && (
            <Panel className="border-sand-300">
              <PanelHeader className="bg-sand-50 py-4 px-5 border-b border-sand-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-sand-950 capitalize">
                      {selectedRequest.kind.replaceAll("_", " ")} Ticket
                    </h3>
                    <p className="text-[11px] text-sand-500">Room {selectedRequest.room_number} · #{selectedRequest.id.slice(0, 8)}</p>
                  </div>
                  <Badge variant={STATUS_VARIANTS[selectedRequest.status] || "default"}>
                    {selectedRequest.status.replaceAll("_", " ")}
                  </Badge>
                </div>
              </PanelHeader>

              <PanelBody className="p-5 space-y-4">
                {selectedRequest.note && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-sand-400">
                      Guest Notes
                    </label>
                    <p className="mt-1 text-xs text-sand-800 bg-sand-50 p-3 rounded-xl border border-sand-200">
                      {selectedRequest.note}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs border-y border-sand-100 py-3">
                  <div>
                    <span className="text-[10px] text-sand-400 block">SLA Target</span>
                    <span className="font-medium text-sand-900">{selectedRequest.sla_minutes} minutes</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-sand-400 block">Deadline</span>
                    <span className={cn("font-medium", selectedRequest.is_overdue ? "text-rose-700" : "text-sand-900")}>
                      {new Date(selectedRequest.due_at).toLocaleTimeString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Status Transitions */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-sand-400 block mb-2">
                    Action / Advance Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedRequest.status === "raised" && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateRequestStatus(selectedRequest.id, "accepted")}
                        disabled={actionInProgress === selectedRequest.id}
                        className="bg-gold-700 hover:bg-gold-800 text-white col-span-2"
                      >
                        Accept & Acknowledge
                      </Button>
                    )}
                    {selectedRequest.status === "accepted" && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateRequestStatus(selectedRequest.id, "in_progress")}
                        disabled={actionInProgress === selectedRequest.id}
                        className="bg-blue-700 hover:bg-blue-800 text-white col-span-2"
                      >
                        Mark In Progress
                      </Button>
                    )}
                    {selectedRequest.status === "in_progress" && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateRequestStatus(selectedRequest.id, "delivered")}
                        disabled={actionInProgress === selectedRequest.id}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white col-span-2"
                      >
                        Mark Delivered / Resolved
                      </Button>
                    )}
                    {selectedRequest.status !== "delivered" && selectedRequest.status !== "cancelled" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateRequestStatus(selectedRequest.id, "cancelled")}
                        disabled={actionInProgress === selectedRequest.id}
                        className="text-rose-700 hover:bg-rose-50 border-rose-200 col-span-2 text-xs"
                      >
                        Cancel Request
                      </Button>
                    )}
                  </div>
                </div>

                {/* Reply / Internal Note Form */}
                <form onSubmit={handleSubmitReply} className="space-y-3 pt-2 border-t border-sand-100">
                  <div className="flex items-center justify-between">
                    <label htmlFor="staff-reply-notes" className="text-[10px] font-semibold uppercase tracking-wider text-sand-400">
                      Add Message / Staff Note
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-sand-600">
                      <input
                        type="checkbox"
                        checked={isInternalNote}
                        onChange={(e) => setIsInternalNote(e.target.checked)}
                        className="rounded border-sand-300 text-sage-800 focus:ring-sage-700"
                      />
                      <span>Internal staff note only</span>
                    </label>
                  </div>

                  <textarea
                    id="staff-reply-notes"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                    placeholder={
                      isInternalNote
                        ? "Enter internal note (visible only to staff)…"
                        : "Enter reply to update request timeline…"
                    }
                    className="w-full rounded-xl border border-sand-300 p-2.5 text-xs text-sand-950 placeholder:text-sand-400 focus:border-sage-700 focus:outline-hidden"
                  />

                  {failedReplyText && (
                    <p className="text-[11px] text-rose-600">
                      Last save failed. Text is preserved above; please retry.
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={!replyText.trim() || actionInProgress === selectedRequest.id}
                    className="w-full bg-sage-800 hover:bg-sage-900 text-white"
                  >
                    {actionInProgress === selectedRequest.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    ) : (
                      <Send className="h-4 w-4 mr-1.5" />
                    )}
                    {isInternalNote ? "Save Internal Staff Note" : "Send Reply & Update"}
                  </Button>
                </form>
              </PanelBody>
            </Panel>
          )}

          {!selectedEscalation && !selectedRequest && (
            <Panel className="border-dashed border-sand-300 bg-sand-50/50">
              <PanelBody className="p-12 text-center text-sand-500">
                <FileText className="h-8 w-8 mx-auto text-sand-400 mb-2 opacity-60" />
                <p className="font-medium text-sand-800 text-sm">Select an item</p>
                <p className="mt-1 text-xs text-sand-500">
                  Click on an AI escalation or service order on the left to inspect details and take permitted actions.
                </p>
              </PanelBody>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
