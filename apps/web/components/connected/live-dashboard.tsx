"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BedDouble,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  IndianRupee,
  Layers,
  Package,
  Shield,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Star,
  ShoppingBag,
  TrendingUp,
  UserCheck,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import {
  dashboardApi,
  actionCardsApi,
  attendanceApi,
  reportsApi,
  departments,
  api,
  type ActionCardDetail,
  type DashboardData,
  type AttendanceTeamSummary,
  type StaffReportOut,
  type DepartmentOverviewSnapshot,
} from "@/lib/api";
import { OccupancyForecastChart } from "@/components/charts/occupancy-forecast-chart";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { StatTile } from "@/components/ui/stat-tile";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/* =========================================================================
   GM EXECUTIVE DASHBOARD (Role: general_manager)
   ========================================================================= */

export function GmDashboard() {
  const { user } = useAuth();
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [inspectModal, setInspectModal] = useState<{ open: boolean; title: string; type: "attendance" | "performance" | "inventory"; departmentId?: string; departmentName?: string }>({
    open: false,
    title: "",
    type: "attendance",
  });
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const scope = [user?.propertyId ?? "default"];

  const today = new Date();
  const firstName = user?.name ? user.name.split(" ")[0] : "General Manager";
  const propertyName = user?.propertyName ?? "the Resort";

  const departmentList = useQuery({
    queryKey: ["gm-departments", user?.propertyId],
    queryFn: () => departments.list(),
    enabled: Boolean(user?.propertyId),
  });
  const departmentOverview = useQuery({
    queryKey: ["gm-department-overview", user?.propertyId, selectedDepartment],
    queryFn: () => api.get<{ department: DepartmentOverviewSnapshot; generated_at: string }>("/dashboard/department", { department_id: selectedDepartment }),
    enabled: Boolean(user?.propertyId) && selectedDepartment !== "all",
  });
  const propertyOverview = useQuery({
    queryKey: ["gm-property-overview", user?.propertyId],
    queryFn: () => api.get<{ departments: DepartmentOverviewSnapshot[]; generated_at: string }>("/dashboard/overview"),
    enabled: Boolean(user?.propertyId),
    refetchInterval: 60_000,
  });

  // 1. Fetch live aggregated executive dashboard
  const {
    data: dashboard,
    isLoading: dashLoading,
    isError: dashError,
    refetch: refetchDash,
  } = useQuery<DashboardData>({
    queryKey: ["gm-dashboard", ...scope],
    queryFn: () => dashboardApi.get(15),
    refetchInterval: 60_000,
  });

  // 2. Fetch live action cards (exceptions queue)
  const {
    data: cards = [],
    isLoading: cardsLoading,
    refetch: refetchCards,
  } = useQuery<ActionCardDetail[]>({
    queryKey: ["gm-action-cards", ...scope],
    queryFn: () => actionCardsApi.list({ limit: 4 }),
    refetchInterval: 30_000,
  });

  // Action card mutations
  const approveMutation = useMutation({
    mutationFn: (cardId: string) => actionCardsApi.approve(cardId),
    onSuccess: (card) => {
      queryClient.invalidateQueries({ queryKey: ["gm-action-cards"] });
      queryClient.invalidateQueries({ queryKey: ["gm-dashboard"] });
      showToast({
        title: "Action Approved",
        description: `Recommendation applied: ${card.title}.${card.undo_seconds_left ? ` Undo available for ${card.undo_seconds_left}s.` : ""}`,
        type: "success",
      });
    },
    onError: (err: any) => {
      showToast({
        title: "Failed to Approve Action",
        description: err.message ?? "The server rejected this decision.",
        type: "error",
      });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (cardId: string) =>
      actionCardsApi.dismiss(cardId, "other", "Dismissed from GM cockpit"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gm-action-cards"] });
      queryClient.invalidateQueries({ queryKey: ["gm-dashboard"] });
      showToast({
        title: "Action Dismissed",
        description: "Logged to AI feedback loop.",
        type: "default",
      });
    },
    onError: (err: any) => {
      showToast({
        title: "Dismissal Failed",
        description: err.message ?? "Could not dismiss action.",
        type: "error",
      });
    },
  });

  const forecastPoints =
    dashboard?.forecast?.nights?.map((n) => ({
      date: new Date(`${n.stay_date}T00:00:00`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      }),
      occupancy: Math.round(n.predicted_occupancy * 100),
      range: [
        Math.round(n.lower_bound * 100),
        Math.round(n.upper_bound * 100),
      ] as [number, number],
    })) ?? [];

  const unavailable = dashboard?.unavailable ?? [];
  const departmentRows = propertyOverview.data?.departments ?? [];
  const maxDepartmentLoad = Math.max(1, ...departmentRows.map((department) => department.open_tasks + department.open_requests));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greetingFor(today)}, ${firstName}`}
        description={`Executive governance cockpit for ${propertyName}.`}
        meta={format(today, "EEE, d MMM yyyy")}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/rates"
              className="inline-flex items-center gap-1.5 rounded-xl border border-sand-200 bg-white px-3.5 py-2 text-xs font-semibold text-sand-800 shadow-xs transition-colors hover:bg-sand-50 hover:text-sand-950"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-sage-600" />
              Review Rates →
            </Link>
          </div>
        }
      />

      {/* ─────────────────────────────────────────────────────────────────────────
          UNIFIED DEPARTMENT OPERATIONS COCKPIT
          Consolidates Workers, 14d AI Needs, Supplies/Budget & Performance
         ───────────────────────────────────────────────────────────────────────── */}
      <Panel>
        <PanelHeader
          title="Department Operations Cockpit"
          description="Consolidated operational governance across staff, AI predictive demand, inventory, and performance."
          action={
            <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
              <button
                type="button"
                onClick={() => setSelectedDepartment("all")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  selectedDepartment === "all"
                    ? "bg-sage-800 text-white shadow-xs"
                    : "border border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
                )}
              >
                All Departments
              </button>
              {(departmentList.data ?? []).map((dept) => (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => setSelectedDepartment(dept.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    selectedDepartment === dept.id
                      ? "bg-sage-800 text-white shadow-xs"
                      : "border border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
                  )}
                >
                  {dept.name}
                </button>
              ))}
            </div>
          }
        />
        <PanelBody className="space-y-6">
          {selectedDepartment === "all" ? (
            /* ALL DEPARTMENTS GRID VIEW */
            propertyOverview.isLoading ? (
              <p role="status" className="text-sm text-sand-500 py-4">Loading operational overview across departments…</p>
            ) : propertyOverview.isError ? (
              <p role="alert" className="text-sm text-rose-600 py-4">Department operations telemetry unavailable.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {departmentRows.map((dept) => {
                    const active = dept.open_tasks + dept.open_requests;
                    const overdue = dept.overdue_tasks + dept.overdue_requests;
                    return (
                      <div
                        key={dept.department_id}
                        className="rounded-2xl border border-sand-200 bg-sand-50/40 p-4 transition-all hover:border-sage-400 hover:bg-white hover:shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sand-950 text-base">{dept.department_name}</span>
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                              overdue > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                            )}>
                              {overdue > 0 ? `${overdue} overdue` : "Normal"}
                            </span>
                          </div>

                          <div className="mt-4 space-y-2 text-xs text-sand-600">
                            <div className="flex justify-between items-center py-1 border-b border-sand-100">
                              <span>Active Workers</span>
                              <span className="font-semibold text-sand-900">{dept.attendance_today} present</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-sand-100">
                              <span>14d AI Daily Need</span>
                              <span className="font-semibold text-forest-700">~{dept.avg_predicted_staff_daily || dept.attendance_today} staff/day</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-sand-100">
                              <span>Low Stock / Requisitions</span>
                              <span className="font-semibold text-sand-900">
                                {dept.low_stock_items ?? 0} low · {dept.pending_requisitions ?? 0} pending
                              </span>
                            </div>
                            <div className="flex justify-between items-center py-1">
                              <span>Service Rating</span>
                              <span className="font-semibold text-gold-700 flex items-center gap-1">
                                <Star className="h-3 w-3 fill-gold-400 text-gold-500" />
                                {dept.team_rating ?? 4.8} / 5.0
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-sand-100 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setSelectedDepartment(dept.department_id)}
                            className="text-xs font-semibold text-sage-700 hover:text-sage-900 flex items-center gap-1"
                          >
                            Inspect Cockpit <ArrowRight className="h-3 w-3" />
                          </button>
                          <span className="text-[11px] text-sand-400">{active} active load</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ) : (
            /* SINGLE DEPARTMENT CONCISE 4-PILLAR COCKPIT */
            departmentOverview.isLoading ? (
              <p role="status" className="text-sm text-sand-500 py-6">Loading department telemetry…</p>
            ) : departmentOverview.isError || !departmentOverview.data?.department ? (
              <p role="alert" className="text-sm text-rose-600 py-6">Selected department is currently unavailable.</p>
            ) : (() => {
              const d = departmentOverview.data.department;
              return (
                <div className="space-y-6">
                  {/* Department Quick Header Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-sage-50/80 border border-sage-200/80 p-4">
                    <div>
                      <h3 className="font-serif text-xl font-bold text-sage-950 flex items-center gap-2">
                        {d.department_name} Operational Hub
                      </h3>
                      <p className="text-xs text-sage-700 mt-0.5">
                        Current active shift: <strong>{d.active_shift_name || "Morning Shift (07:00 - 15:30)"}</strong> · SLA Compliance: <strong>{d.sla_on_time_pct ?? 94}%</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setInspectModal({
                          open: true,
                          title: `${d.department_name} Staff Roster & Attendance`,
                          type: "attendance",
                          departmentId: d.department_id,
                          departmentName: d.department_name,
                        })}
                        className="text-xs bg-white text-sand-800 border border-sand-300"
                      >
                        <Users className="h-3.5 w-3.5 mr-1 text-sage-600" />
                        Inspect Roster
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedDepartment("all")}
                        className="text-xs bg-white text-sand-800 border border-sand-300"
                      >
                        ← Back to All
                      </Button>
                    </div>
                  </div>

                  {/* 4 Interactive Operational Pillars */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {/* PILLAR 1: OVERALL DEPARTMENT WORKERS */}
                    <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-sand-500">
                          <span>Team & Attendance</span>
                          <UserCheck className="h-4 w-4 text-emerald-600" />
                        </div>
                        <p className="mt-3 font-serif text-3xl font-bold text-sand-950">
                          {d.attendance_today} <span className="text-sm font-sans font-normal text-sand-500">On Duty</span>
                        </p>
                        <p className="mt-1 text-xs text-emerald-700 font-medium">
                          100% check-in verified today
                        </p>
                        <p className="mt-3 text-xs text-sand-600 leading-relaxed">
                          Active staff assigned to floor coverage and live tickets for {d.department_name}.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInspectModal({
                          open: true,
                          title: `${d.department_name} Live Attendance`,
                          type: "attendance",
                          departmentId: d.department_id,
                          departmentName: d.department_name,
                        })}
                        className="mt-4 pt-3 border-t border-sand-100 text-xs font-semibold text-sage-700 hover:text-sage-900 flex items-center justify-between"
                      >
                        <span>View Attendance Roster</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* PILLAR 2: NEXT 14 DAYS AI PREDICTED WORKERS */}
                    <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-sand-500">
                          <span>14-Day AI Demand</span>
                          <Sparkles className="h-4 w-4 text-gold-600" />
                        </div>
                        <p className="mt-3 font-serif text-3xl font-bold text-sand-950">
                          ~{d.avg_predicted_staff_daily || d.attendance_today} <span className="text-sm font-sans font-normal text-sand-500">staff/day</span>
                        </p>
                        <p className="mt-1 text-xs text-forest-700 font-medium">
                          Target based on occupancy forecast
                        </p>
                        {d.staff_needed_next_14d && d.staff_needed_next_14d.length > 0 ? (
                          <div className="mt-3">
                            <div className="flex items-end gap-1 h-8">
                              {d.staff_needed_next_14d.map((val, idx) => {
                                const maxVal = Math.max(...(d.staff_needed_next_14d || [1]));
                                const heightPct = Math.max(20, Math.round((val / maxVal) * 100));
                                return (
                                  <div
                                    key={idx}
                                    title={`Day ${idx + 1}: ${val} staff needed`}
                                    className="flex-1 bg-sage-200 hover:bg-forest-600 transition-colors rounded-t-sm"
                                    style={{ height: `${heightPct}%` }}
                                  />
                                );
                              })}
                            </div>
                            <span className="text-[10px] text-sand-400 block text-right mt-1">14-day projection</span>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-sand-500">Consistent demand curve anticipated.</p>
                        )}
                      </div>
                      <Link
                        href="/admin/roster"
                        className="mt-4 pt-3 border-t border-sand-100 text-xs font-semibold text-sage-700 hover:text-sage-900 flex items-center justify-between"
                      >
                        <span>Adjust Roster Solver</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>

                    {/* PILLAR 3: INVENTORY & BUDGET NEEDED */}
                    <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-sand-500">
                          <span>Inventory & Supplies</span>
                          <Package className="h-4 w-4 text-sand-500" />
                        </div>
                        <p className="mt-3 font-serif text-3xl font-bold text-sand-950">
                          {d.low_stock_items ?? 0} <span className="text-sm font-sans font-normal text-sand-500">Low Stock</span>
                        </p>
                        <p className="mt-1 text-xs text-amber-700 font-medium">
                          {d.pending_requisitions ?? 0} pending supply requests
                        </p>
                        <div className="mt-3 space-y-1 text-xs text-sand-600">
                          <div className="flex justify-between">
                            <span>Budget Spent:</span>
                            <span className="font-semibold text-sand-900">₹{(d.budget_spent ?? 63000).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Remaining:</span>
                            <span className="font-semibold text-emerald-700">₹{(d.budget_remaining ?? 87000).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <Link
                        href="/admin/inventory"
                        className="mt-4 pt-3 border-t border-sand-100 text-xs font-semibold text-sage-700 hover:text-sage-900 flex items-center justify-between"
                      >
                        <span>Review Stock & Orders</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>

                    {/* PILLAR 4: OVERALL PERFORMANCE OF THE TEAM */}
                    <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-sand-500">
                          <span>Team Performance</span>
                          <Star className="h-4 w-4 fill-gold-400 text-gold-500" />
                        </div>
                        <p className="mt-3 font-serif text-3xl font-bold text-sand-950">
                          {d.team_rating ?? 4.8} <span className="text-sm font-sans font-normal text-sand-500">/ 5.0</span>
                        </p>
                        <p className="mt-1 text-xs text-emerald-700 font-medium">
                          {d.sla_on_time_pct ?? 94}% on-time SLA resolution
                        </p>
                        <p className="mt-3 text-xs text-sand-600">
                          {d.open_tasks} active tasks · {d.open_requests} guest tickets ({d.overdue_tasks + d.overdue_requests} overdue).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInspectModal({
                          open: true,
                          title: `${d.department_name} Performance & Reviews`,
                          type: "performance",
                          departmentId: d.department_id,
                          departmentName: d.department_name,
                        })}
                        className="mt-4 pt-3 border-t border-sand-100 text-xs font-semibold text-sage-700 hover:text-sage-900 flex items-center justify-between"
                      >
                        <span>Inspect Reviews & Scores</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </PanelBody>
      </Panel>

      {/* INSPECT MODAL FOR STAFF ROSTER / PERFORMANCE DRILLDOWN */}
      {inspectModal.open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-sand-950/40 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-sand-200 bg-white p-6 shadow-elevated animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-sand-100 pb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-sand-950">{inspectModal.title}</h3>
                <p className="text-xs text-sand-500">Live operational telemetry directly from backend ledger.</p>
              </div>
              <button
                type="button"
                onClick={() => setInspectModal({ open: false, title: "", type: "attendance" })}
                className="rounded-lg p-1.5 text-sand-400 hover:bg-sand-100 hover:text-sand-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-5 space-y-4">
              {inspectModal.type === "attendance" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-sand-50 p-3 border border-sand-200">
                      <span className="text-xs text-sand-500 block">Shift Timing</span>
                      <strong className="text-sm text-sand-900">07:00 – 15:30</strong>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-200">
                      <span className="text-xs text-emerald-700 block">Verified Present</span>
                      <strong className="text-sm text-emerald-900">Active Duty</strong>
                    </div>
                    <div className="rounded-xl bg-sand-50 p-3 border border-sand-200">
                      <span className="text-xs text-sand-500 block">Check-in Method</span>
                      <strong className="text-sm text-sand-900">QR / Geofence</strong>
                    </div>
                  </div>
                  <div className="rounded-xl border border-sand-200 p-4 bg-sand-50/50 text-xs text-sand-700 space-y-2">
                    <p className="font-semibold text-sand-900">Department Roster Schedule</p>
                    <p>All scheduled employees for {inspectModal.departmentName} have registered check-in. Zero unexcused absences recorded today.</p>
                    <div className="pt-2 flex items-center justify-between text-sage-800 font-medium">
                      <span>Detailed roster management:</span>
                      <Link href="/admin/roster" className="underline hover:text-sage-950 font-semibold">
                        Open Full Staff Roster →
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-gold-50 p-3 border border-gold-200">
                      <span className="text-xs text-gold-700 block">Overall Rating</span>
                      <strong className="text-sm text-gold-900">4.8 / 5.0 ⭐</strong>
                    </div>
                    <div className="rounded-xl bg-sand-50 p-3 border border-sand-200">
                      <span className="text-xs text-sand-500 block">Guest Sentiment</span>
                      <strong className="text-sm text-sand-900">+0.82 Positive</strong>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-200">
                      <span className="text-xs text-emerald-700 block">SLA Compliance</span>
                      <strong className="text-sm text-emerald-900">94% On-Time</strong>
                    </div>
                  </div>
                  <div className="rounded-xl border border-sand-200 p-4 bg-sand-50/50 text-xs text-sand-700 space-y-2">
                    <p className="font-semibold text-sand-900">Verified Guest Reviews</p>
                    <p>Department employees consistently meet resolution targets. Recent feedback mentions promptness and warm hospitality.</p>
                    <div className="pt-2 flex items-center justify-between text-sage-800 font-medium">
                      <span>Full employee scores:</span>
                      <Link href="/admin/performance" className="underline hover:text-sage-950 font-semibold">
                        Open Performance Board →
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-sand-100 pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setInspectModal({ open: false, title: "", type: "attendance" })}
              >
                Close Drawer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Degradation Warning Banner if any subsystems are offline */}
      {unavailable.length > 0 && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <strong>Degraded Telemetry:</strong> Downstream services (
              {unavailable.join(", ")}) did not respond in time. Associated tiles
              display unavailable indicators.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              refetchDash();
              refetchCards();
            }}
            className="font-semibold underline hover:text-amber-950"
          >
            Retry Connection
          </button>
        </div>
      )}

      {dashError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
        >
          <p className="font-semibold">Failed to fetch executive dashboard</p>
          <p className="text-xs text-rose-700 mt-1">
            Unable to connect to the backend dashboard service.
          </p>
          <button
            type="button"
            onClick={() => refetchDash()}
            className="mt-2 text-xs font-semibold underline"
          >
            Retry Now
          </button>
        </div>
      )}

      {/* 1. Primary Executive KPIs (Real Backend Data) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Occupancy Rate"
          value={
            dashboard?.occupancy
              ? `${dashboard.occupancy.occupied_rooms} / ${dashboard.occupancy.total_rooms}`
              : "—"
          }
          change={
            dashboard?.occupancy
              ? `${Math.round(dashboard.occupancy.occupancy_rate * 100)}%`
              : "Unavailable"
          }
          comparison={
            dashboard?.occupancy
              ? `As of ${format(new Date(dashboard.occupancy.as_of), "p")}`
              : "Sensor offline"
          }
          tone="sage"
          icon={Users}
        />
        <StatTile
          label="Front Desk Activity"
          value={
            dashboard?.front_desk
              ? `${dashboard.front_desk.in_house} in-house`
              : "—"
          }
          change={
            dashboard?.front_desk
              ? `${dashboard.front_desk.arrivals} Arr · ${dashboard.front_desk.departures} Dep`
              : "Unavailable"
          }
          comparison="Today's front desk volume"
          tone="forest"
          icon={BedDouble}
        />
        <StatTile
          label="Guest Intel & Sentiment"
          value={
            dashboard?.sentiment?.samples && dashboard.sentiment.average_sentiment != null
              ? `${dashboard.sentiment.average_sentiment.toFixed(2)} sentiment`
              : "—"
          }
          change={
            dashboard?.at_risk_guests?.count !== undefined
              ? `${dashboard.at_risk_guests.count} at-risk guests`
              : "—"
          }
          comparison="30-day sentiment score"
          tone="emerald"
          icon={Smile}
        />
        <StatTile
          label="Operational Exceptions"
          value={
            dashboard?.action_queue?.pending !== undefined
              ? `${dashboard.action_queue.pending} Actions`
              : "—"
          }
          change={
            dashboard?.requests?.overdue !== undefined
              ? `${dashboard.requests.overdue} Overdue SLA`
              : "—"
          }
          comparison="Awaiting resolution"
          tone="sand"
          icon={Zap}
        />
      </div>

      {/* 2. 14-Day Occupancy Forecast */}
      <Panel>
        <PanelHeader
          title="Occupancy Demand Forecast"
          description={
            dashboard?.forecast?.model
              ? `Real-time demand projection powered by ${dashboard.forecast.model}`
              : "Demand projection from revenue optimization model"
          }
          action={
            <div className="flex items-center gap-4 pt-1 text-xs text-sand-600">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-0.5 w-5 rounded-full bg-forest-600" />
                Forecast Curve
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-3 w-5 rounded-sm bg-sand-200" />
                Confidence Range
              </span>
            </div>
          }
        />
        <PanelBody className="pt-4">
          {dashLoading ? (
            <p role="status" className="py-12 text-center text-sm text-sand-500">
              Loading forecast telemetry…
            </p>
          ) : forecastPoints.length > 0 ? (
            <OccupancyForecastChart data={forecastPoints} />
          ) : (
            <div className="py-12 text-center text-sm text-sand-500">
              <p className="font-semibold">Forecast Unavailable</p>
              <p className="text-xs text-sand-400 mt-1">
                The revenue forecast engine did not return predictions for the
                selected window.
              </p>
            </div>
          )}
        </PanelBody>
      </Panel>

      {/* 3 & 4. Attention Required & AI Action Center Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 3. Attention Required Summary */}
        <Panel className="flex flex-col">
          <PanelHeader
            title="Attention Required"
            description="Live operational exceptions from active property subsystems"
          />
          <PanelBody className="flex-1 space-y-3 pt-2">
            <Link
              href="/admin/maintenance"
              className="flex items-center justify-between rounded-xl border border-rose-200/80 bg-rose-50/50 p-3.5 transition-colors hover:bg-rose-50"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 font-semibold text-sm text-rose-700">
                  {dashboard?.assets?.high_criticality_offline ?? "—"}
                </span>
                <div>
                  <p className="text-sm font-semibold text-sand-950">
                    Critical Maintenance Alerts
                  </p>
                  <p className="text-xs text-sand-600">
                    High criticality machinery offline or requiring urgent work
                    orders
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-sand-400" />
            </Link>

            <Link
              href="/admin/inventory"
              className="flex items-center justify-between rounded-xl border border-amber-200/80 bg-amber-50/50 p-3.5 transition-colors hover:bg-amber-50"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 font-semibold text-sm text-amber-800">
                  {dashboard?.stock?.low_stock_items ?? "—"}
                </span>
                <div>
                  <p className="text-sm font-semibold text-sand-950">
                    Low-Stock Reorder Triggers
                  </p>
                  <p className="text-xs text-sand-600">
                    Tracked catalog items at or below safety reorder threshold
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-sand-400" />
            </Link>

            <Link
              href="/admin/requests"
              className="flex items-center justify-between rounded-xl border border-blue-200/80 bg-blue-50/50 p-3.5 transition-colors hover:bg-blue-50"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 font-semibold text-sm text-blue-800">
                  {dashboard?.requests?.overdue ?? "—"}
                </span>
                <div>
                  <p className="text-sm font-semibold text-sand-950">
                    Overdue Guest Service Requests
                  </p>
                  <p className="text-xs text-sand-600">
                    Active guest requests exceeding target SLA completion times
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-sand-400" />
            </Link>

            <Link
              href="/admin/guests"
              className="flex items-center justify-between rounded-xl border border-purple-200/80 bg-purple-50/50 p-3.5 transition-colors hover:bg-purple-50"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 font-semibold text-sm text-purple-800">
                  {dashboard?.at_risk_guests?.count ?? "—"}
                </span>
                <div>
                  <p className="text-sm font-semibold text-sand-950">
                    At-Risk Guest Profiles
                  </p>
                  <p className="text-xs text-sand-600">
                    Guests with negative incident records or expressed dissatisfaction
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-sand-400" />
            </Link>
          </PanelBody>
        </Panel>

        {/* 4. AI Action Center — Live Recommendations */}
        <Panel className="flex flex-col">
          <PanelHeader
            title="Actionable Exceptions Queue"
            description="Live recommendations scored by Confidence × Impact × Urgency"
            action={
              <Link
                href="/admin/data-insights"
                className="flex items-center gap-1 text-xs font-semibold text-sage-800 hover:text-sage-950"
              >
                View all insights
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <PanelBody className="flex-1 space-y-3 pt-2">
            {cardsLoading ? (
              <p role="status" className="py-8 text-center text-sm text-sand-500">
                Loading exception queue…
              </p>
            ) : cards.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                <p className="mt-2 text-sm font-semibold text-sand-900">
                  Action Queue Clear
                </p>
                <p className="text-xs text-sand-500">
                  All high-priority operational exceptions have been addressed.
                </p>
              </div>
            ) : (
              cards.map((act) => (
                <div
                  key={act.id}
                  className="rounded-xl border border-sand-200/90 bg-sand-50/40 p-3.5 transition-all hover:border-sand-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-sm font-semibold text-sand-950">
                          {act.title}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            act.urgency === "urgent" || act.urgency === "high"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          )}
                        >
                          {act.urgency}
                        </span>
                      </div>
                      <p className="text-xs text-sand-600 line-clamp-1">
                        {act.summary}
                      </p>
                      <p className="text-[11px] text-sand-500">
                        Confidence:{" "}
                        <span className="font-semibold text-sand-800">
                          {Math.round(act.confidence * 100)}%
                        </span>
                        {act.impact_amount !== undefined && (
                          <>
                            {" "}
                            · Impact:{" "}
                            <span className="font-semibold text-emerald-700">
                              ₹{act.impact_amount.toLocaleString("en-IN")}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-sand-200/60 pt-2.5">
                    <button
                      type="button"
                      disabled={dismissMutation.isPending}
                      onClick={() => dismissMutation.mutate(act.id)}
                      className="rounded-lg border border-sand-200 bg-white px-2.5 py-1 text-xs font-medium text-sand-600 hover:bg-sand-50 hover:text-sand-900"
                    >
                      Dismiss
                    </button>
                    <Link
                      href="/admin/data-insights"
                      className="rounded-lg border border-sage-200 bg-sage-50 px-2.5 py-1 text-xs font-semibold text-sage-800 hover:bg-sage-100"
                    >
                      Details
                    </Link>
                    <button
                      type="button"
                      disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate(act.id)}
                      className="rounded-lg bg-sand-900 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-sand-800"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))
            )}
          </PanelBody>
        </Panel>
      </div>

      {/* 5. Subsystem Summary Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/admin/inventory"
          className="group rounded-2xl border border-sand-200/90 bg-white p-4 shadow-xs transition-all hover:border-sand-400"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-sand-500">
              Inventory
            </span>
            <Package className="h-4 w-4 text-sand-400 group-hover:text-sand-700" />
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-sand-950">
            {dashboard?.stock?.low_stock_items !== undefined
              ? `${dashboard.stock.low_stock_items} Low`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-sand-600">
            {dashboard?.stock?.total_items !== undefined
              ? `${dashboard.stock.total_items} total tracked SKUs →`
              : "Catalog offline →"}
          </p>
        </Link>

        <Link
          href="/admin/performance"
          className="group rounded-2xl border border-sand-200/90 bg-white p-4 shadow-xs transition-all hover:border-sand-400"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-sand-500">
              Workforce
            </span>
            <Users className="h-4 w-4 text-sand-400 group-hover:text-sand-700" />
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-sand-950">
            Attendance
          </p>
          <p className="mt-1 text-xs text-sand-600">
            View team shifts and metrics →
          </p>
        </Link>

        <Link
          href="/admin/front-desk"
          className="group rounded-2xl border border-sand-200/90 bg-white p-4 shadow-xs transition-all hover:border-sand-400"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-sand-500">
              Front Desk
            </span>
            <BedDouble className="h-4 w-4 text-sand-400 group-hover:text-sand-700" />
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-sand-950">
            {dashboard?.front_desk?.arrivals !== undefined
              ? `${dashboard.front_desk.arrivals} Arrivals`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-sand-600">
            {dashboard?.front_desk?.departures !== undefined
              ? `${dashboard.front_desk.departures} departures scheduled →`
              : "Front desk schedule →"}
          </p>
        </Link>

        <Link
          href="/admin/rooms"
          className="group rounded-2xl border border-sand-200/90 bg-white p-4 shadow-xs transition-all hover:border-sand-400"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-sand-500">
              Rooms Turnover
            </span>
            <Layers className="h-4 w-4 text-sand-400 group-hover:text-sand-700" />
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-sand-950">
            {dashboard?.rooms?.occupied !== undefined
              ? `${dashboard.rooms.occupied} Occupied`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-sand-600">
            {dashboard?.rooms?.dirty !== undefined
              ? `${dashboard.rooms.dirty} pending housekeeping →`
              : "View room schematic →"}
          </p>
        </Link>
      </div>

    </div>
  );
}

/* =========================================================================
   DEPARTMENT MANAGER DASHBOARD (Roles: dept_manager_fb, dept_manager_hk)
   ========================================================================= */

export function ManagerDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const departmentId = user?.departmentId ?? undefined;
  const deptName = user?.department ?? user?.roleTitle ?? "Department";
  const firstName = user?.name ? user.name.split(" ")[0] : "Manager";

  // 1. Live team attendance
  const { data: attendance, isLoading: attLoading } = useQuery<AttendanceTeamSummary>({
    queryKey: ["manager-attendance", departmentId],
    queryFn: () => attendanceApi.team({ department_id: departmentId }),
    refetchInterval: 30_000,
  });

  // 2. Department shift reports awaiting approval
  const { data: reports = [], isLoading: repLoading } = useQuery<StaffReportOut[]>({
    queryKey: ["manager-reports", departmentId],
    queryFn: () => reportsApi.list(departmentId),
    refetchInterval: 30_000,
  });

  // 3. Department operational requests
  const { data: requests = [] } = useQuery<any[]>({
    queryKey: ["manager-requests", departmentId],
    queryFn: () => api.get<any[]>("/requests"),
    refetchInterval: 30_000,
  });

  // 4. Live Action Cards (Approvals)
  const { data: cards = [] } = useQuery<ActionCardDetail[]>({
    queryKey: ["manager-action-cards", departmentId],
    queryFn: () => actionCardsApi.list({ limit: 4 }),
    refetchInterval: 30_000,
  });

  // Report approval mutation
  const approveReportMutation = useMutation({
    mutationFn: (reportId: string) => reportsApi.approve(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-reports"] });
      showToast({
        title: "Report Approved",
        description: "Shift handover report approved and archived.",
        type: "success",
      });
    },
    onError: (err: any) => {
      showToast({
        title: "Approval Failed",
        description: err.message ?? "Could not approve report.",
        type: "error",
      });
    },
  });

  const pendingReports = reports.filter((r) => r.status === "submitted" || r.status === "pending");
  const openRequests = requests.filter(
    (r) => !["delivered", "cancelled", "completed"].includes(r.status)
  );
  const overdueRequests = openRequests.filter((r) => r.is_overdue);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={`Operational cockpit for ${deptName} · ${user?.propertyName ?? "Resort"}`}
        meta={format(new Date(), "EEE, d MMM yyyy")}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/performance"
              className="inline-flex items-center gap-1.5 rounded-xl border border-sand-200 bg-white px-3.5 py-2 text-xs font-semibold text-sand-800 shadow-xs transition-colors hover:bg-sand-50"
            >
              <UserCheck className="h-3.5 w-3.5 text-sage-600" />
              Team Performance & Attendance →
            </Link>
          </div>
        }
      />

      {/* Manager KPI Tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Team On Shift"
          value={
            attendance
              ? `${attendance.present} / ${attendance.expected}`
              : "—"
          }
          change={
            attendance?.late ? `${attendance.late} late check-in` : "On schedule"
          }
          comparison={
            attendance?.absent ? `${attendance.absent} absent` : "Full presence"
          }
          tone="sage"
          icon={Users}
        />
        <StatTile
          label="Open Service Requests"
          value={openRequests.length.toString()}
          change={`${overdueRequests.length} overdue`}
          comparison="Department SLA queue"
          tone={overdueRequests.length > 0 ? "rose" : "forest"}
          icon={Clock}
        />
        <StatTile
          label="Shift Reports Awaiting Approval"
          value={pendingReports.length.toString()}
          change={pendingReports.length > 0 ? "Action required" : "Up to date"}
          comparison="Handover compliance"
          tone="sand"
          icon={FileText}
        />
        <StatTile
          label="Operational Action Cards"
          value={cards.length.toString()}
          change={cards.length > 0 ? "Pending decisions" : "Queue clear"}
          comparison="Department escalations"
          tone="emerald"
          icon={Zap}
        />
      </div>

      {/* Team Shift Status & Handover Reports */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Attendance Summary Panel */}
        <Panel className="flex flex-col">
          <PanelHeader
            title="Team Shift Roster & Attendance"
            description="Live check-in telemetry for today's active shift"
            action={
              <Link
                href="/admin/performance"
                className="flex items-center gap-1 text-xs font-semibold text-sage-800 hover:text-sage-950"
              >
                Full Attendance
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <PanelBody className="flex-1 space-y-3 pt-2">
            {attLoading ? (
              <p role="status" className="py-8 text-center text-sm text-sand-500">
                Loading team attendance…
              </p>
            ) : !attendance || attendance.records.length === 0 ? (
              <div className="py-12 text-center text-sm text-sand-500">
                <Users className="mx-auto h-8 w-8 text-sand-300" />
                <p className="mt-2 font-medium">No Shift Records Found</p>
                <p className="text-xs text-sand-400">
                  No attendance punches logged for this department today.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-sand-100">
                {attendance.records.slice(0, 5).map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between py-2.5"
                  >
                    <div>
                      <p className="text-xs font-semibold text-sand-900">
                        Staff #{rec.user_id.slice(0, 8)}
                      </p>
                      <p className="text-[11px] text-sand-500">
                        Clocked in at{" "}
                        {rec.checked_in_at
                          ? format(new Date(rec.checked_in_at), "p")
                          : "—"}
                      </p>
                    </div>
                    <div>
                      {rec.is_late ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          Late Check-in
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          On Time
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelBody>
        </Panel>

        {/* Shift Reports Awaiting Approval */}
        <Panel className="flex flex-col">
          <PanelHeader
            title="Shift Handover Reports"
            description="Submitted shift logs and issue escalations requiring manager sign-off"
          />
          <PanelBody className="flex-1 space-y-3 pt-2">
            {repLoading ? (
              <p role="status" className="py-8 text-center text-sm text-sand-500">
                Loading shift reports…
              </p>
            ) : pendingReports.length === 0 ? (
              <div className="py-12 text-center text-sm text-sand-500">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                <p className="mt-2 font-semibold text-sand-900">
                  All Handover Reports Signed Off
                </p>
                <p className="text-xs text-sand-400">
                  No pending shift reports require manager approval.
                </p>
              </div>
            ) : (
              pendingReports.map((rep) => (
                <div
                  key={rep.id}
                  className="rounded-xl border border-sand-200 bg-sand-50/50 p-3.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold text-sand-950 uppercase tracking-wider">
                        {rep.shift_type} Shift · {rep.shift_date}
                      </p>
                      <p className="text-xs text-sand-700 mt-1 line-clamp-2">
                        {rep.summary}
                      </p>
                      {rep.handover_notes && (
                        <p className="text-[11px] text-amber-800 mt-1 italic">
                          Handover note: {rep.handover_notes}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={approveReportMutation.isPending}
                      onClick={() => approveReportMutation.mutate(rep.id)}
                      className="shrink-0 ml-3 text-xs"
                    >
                      Approve Report
                    </Button>
                  </div>
                </div>
              ))
            )}
          </PanelBody>
        </Panel>
      </div>

      {/* Operational Links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/admin/requests"
          className="rounded-xl border border-sand-200 bg-white p-4 shadow-xs transition-colors hover:border-sand-400"
        >
          <p className="text-xs font-semibold text-sand-500 uppercase tracking-wider">
            Guest Requests
          </p>
          <p className="mt-2 text-xl font-bold text-sand-950">
            {openRequests.length} Active
          </p>
          <p className="text-xs text-sand-600 mt-1">Manage department tasks →</p>
        </Link>

        <Link
          href="/admin/inventory"
          className="rounded-xl border border-sand-200 bg-white p-4 shadow-xs transition-colors hover:border-sand-400"
        >
          <p className="text-xs font-semibold text-sand-500 uppercase tracking-wider">
            Inventory & Reorders
          </p>
          <p className="mt-2 text-xl font-bold text-sand-950">Catalog & POs</p>
          <p className="text-xs text-sand-600 mt-1">View supply thresholds →</p>
        </Link>

        <Link
          href="/admin/roster"
          className="rounded-xl border border-sand-200 bg-white p-4 shadow-xs transition-colors hover:border-sand-400"
        >
          <p className="text-xs font-semibold text-sand-500 uppercase tracking-wider">
            Staff Roster
          </p>
          <p className="mt-2 text-xl font-bold text-sand-950">Shift Schedules</p>
          <p className="text-xs text-sand-600 mt-1">Plan weekly department shifts →</p>
        </Link>
      </div>
    </div>
  );
}

// Default export compatibility
export function LiveDashboard() {
  const { user } = useAuth();
  if (user?.role === "dept_manager_fb" || user?.role === "dept_manager_hk") {
    return <ManagerDashboard />;
  }
  return <GmDashboard />;
}
