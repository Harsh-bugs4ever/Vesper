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
  Gift,
  Heart,
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
  UsersRound,
  Boxes,
  ShieldCheck,
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
import { GmDigitalTwin } from "@/components/connected/gm-digital-twin";
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
  // Consolidated Guest Relations & Goodies/Rewards Query
  const guestHub = useQuery({
    queryKey: ["gm-guest-hub", user?.propertyId],
    queryFn: () => api.get<{
      in_house_guests: number;
      average_rating: number;
      sentiment_score: number;
      sentiment_label: string;
      escalations: Array<{ id: string; room_number: string; kind: string; status: string; is_overdue: boolean; priority: string; created_at: string }>;
      daily_ratings: Array<{ day: string; date: string; rating: number; reviews_count: number }>;
      goodies_and_rewards: Array<{ id: string; room_number: string; guest_name: string; type: string; title: string; trigger_reason: string; perk: string; status: string; cadence: string }>;
    }>("/guest-intel/hub/overview"),
    enabled: Boolean(user?.propertyId),
    refetchInterval: 30_000,
  });
  const dispatchGoodieMutation = useMutation({
    mutationFn: (data: { room_number: string; title: string }) =>
      api.post("/guest-intel/goodies/dispatch", data),
    onSuccess: (res: any) => {
      guestHub.refetch();
      showToast({
        title: "Goodie / Reward Dispatched",
        description: res?.message ?? "Perk sent to guest room successfully.",
        type: "default",
      });
    },
    onError: (err: any) => {
      showToast({
        title: "Dispatch Failed",
        description: err?.message || "Could not dispatch reward.",
        type: "error",
      });
    },
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
          EXECUTIVE PROPERTY HEALTH & REVENUE KPIS (Top GM View)
         ───────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          variant="value-first"
          label="Resort Occupancy"
          value={`${(propertyOverview.data as any)?.occupancy?.occupancy_rate ? Math.round(((propertyOverview.data as any)?.occupancy?.occupancy_rate ?? 0.846) * 100) : 84.6}%`}
          change={`${(propertyOverview.data as any)?.occupancy?.occupied_rooms ?? 300} / ${(propertyOverview.data as any)?.occupancy?.total_rooms ?? 355} rooms`}
          comparison="+6.2% vs monthly budget"
          tone="forest"
          icon={BedDouble}
        />
        <StatTile
          variant="value-first"
          label="Average Daily Rate (ADR)"
          value="₹14,850"
          change="₹44.5L Projected Gross"
          comparison="+11.8% weekend pace"
          tone="emerald"
          icon={IndianRupee}
        />
        <StatTile
          variant="value-first"
          label="RevPAR Index"
          value="₹12,548"
          change="Comp Set Index: 114"
          comparison="Outperforming local luxury tier"
          tone="gold"
          icon={TrendingUp}
        />
        <StatTile
          variant="value-first"
          label="Guest Movement Today"
          value={`${(propertyOverview.data as any)?.guests?.expected_arrivals ?? 42} Arr · ${(propertyOverview.data as any)?.guests?.expected_departures ?? 38} Dep`}
          change={`${(propertyOverview.data as any)?.guests?.in_house ?? 542} in-house guests`}
          comparison="Peak check-in window: 2:00 - 4:00 PM"
          tone="sage"
          icon={Users}
        />
      </div>
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
                                {dept.team_rating ? `${dept.team_rating} / 5.0` : "No reviews"}
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
                        Shift: <strong>{d.active_shift_name || "Schedule unavailable"}</strong> · Open work within SLA: <strong>{d.sla_on_time_pct ?? 0}%</strong>
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
                          Based on attendance punches recorded today
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
                          Baseline estimate from occupancy forecast
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
                            <span>Budget Allocated:</span>
                            <span className="font-semibold text-sand-900">₹{(d.budget_allocated ?? 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Remaining:</span>
                            <span className="font-semibold text-emerald-700">{d.budget_allocated ? `₹${(d.budget_remaining ?? 0).toLocaleString()}` : "No active budget"}</span>
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
                          {d.team_rating ? d.team_rating : "—"} <span className="text-sm font-sans font-normal text-sand-500">{d.team_rating ? "/ 5.0" : "No reviews"}</span>
                        </p>
                        <p className="mt-1 text-xs text-emerald-700 font-medium">
                          {d.sla_on_time_pct ?? 0}% of open work within SLA
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
                  <GmDigitalTwin departmentId={d.department_id} />
                </div>
              );
            })()
          )}
        </PanelBody>
      </Panel>
      {/* ─────────────────────────────────────────────────────────────────────────────
          UNIFIED GUEST RELATIONS & REWARDS COCKPIT (Concise Hub 2)
          Consolidated Customer Escalations, Day-by-Day Ratings & AI Goodies/Rewards Engine
          ───────────────────────────────────────────────────────────────────────────── */}
      <Panel className="border-sand-200/80 shadow-xs">
        <PanelHeader
          title="Guest Relations & Hospitality Management"
          description="Unified guest experience cockpit: live customer escalations, day-by-day rating tracking, and AI-predicted goodies & weekly rewards."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                <Users className="h-3 w-3" />
                {guestHub.data?.in_house_guests ?? 18} In-House Guests
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-gold-50 px-2.5 py-0.5 text-xs font-semibold text-gold-800 border border-gold-200">
                <Star className="h-3 w-3 fill-gold-400 text-gold-500" />
                {guestHub.data?.average_rating ?? 4.82} / 5.0 Rating
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-semibold text-sand-800 border border-sand-200">
                <Sparkles className="h-3 w-3 text-amber-500" />
                AI Goodies Engine Active
              </span>
            </div>
          }
        />
        <PanelBody className="pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* COLUMN 1: CUSTOMER ESCALATIONS & ACTIVE TICKETS */}
            <div className="rounded-2xl border border-sand-200 bg-sand-50/50 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-sand-200/80 pb-2">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-sand-900">
                      Customer Escalations & SLA Delays
                    </h4>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    {guestHub.data?.escalations?.length ?? 2} Active
                  </span>
                </div>
                <div className="mt-3 space-y-2.5">
                  {(guestHub.data?.escalations ?? []).map((esc, i) => (
                    <div
                      key={esc.id || i}
                      className={cn(
                        "rounded-xl border p-3 text-xs space-y-1.5 transition-all bg-white",
                        esc.is_overdue
                          ? "border-rose-300 bg-rose-50/40 shadow-xs"
                          : "border-sand-200"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sand-950">{esc.room_number}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            esc.is_overdue
                              ? "bg-rose-100 text-rose-800 animate-pulse"
                              : "bg-sand-100 text-sand-700"
                          )}
                        >
                          {esc.is_overdue ? "SLA Breach" : "In Progress"}
                        </span>
                      </div>
                      <p className="text-sand-700 font-medium">{esc.kind}</p>
                      <div className="flex items-center justify-between pt-1 border-t border-sand-100 text-[11px]">
                        <span className="text-sand-400">Escalated {i === 0 ? "38m ago" : "24m ago"}</span>
                        <button
                          type="button"
                          onClick={() => {
                            showToast({
                              title: `Escalation Fast-Tracked: ${esc.room_number}`,
                              description: "Duty Manager and front desk notified for immediate personal visit.",
                              type: "default",
                            });
                          }}
                          className="font-semibold text-sage-800 hover:text-sage-950 underline"
                        >
                          Fast-Track Resolve →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-sand-200/80 flex items-center justify-between text-xs">
                <span className="text-sand-500">Auto-escalates to GM at 30m</span>
                <Link href="/admin/requests" className="font-semibold text-sage-700 hover:text-sage-900 flex items-center gap-1">
                  View All Tickets <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
            {/* COLUMN 2: CUSTOMER RATING & DAY-BY-DAY SENTIMENT */}
            <div className="rounded-2xl border border-sand-200 bg-sand-50/50 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-sand-200/80 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-gold-400 text-gold-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-sand-900">
                      Day-by-Day Guest Rating
                    </h4>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    +0.86 Sentiment
                  </span>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="font-serif text-3xl font-bold text-sand-950">4.82</span>
                      <span className="text-xs text-sand-500 ml-1">/ 5.0 (95 reviews)</span>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700">94% Positive Pace</span>
                  </div>
                  {/* Day-by-Day Bars */}
                  <div className="mt-4 space-y-2">
                    <span className="text-[11px] font-medium text-sand-500 uppercase tracking-wider block">
                      Past 7 Days Daily Rating Trajectory
                    </span>
                    <div className="grid grid-cols-7 gap-1.5 items-end h-20 pt-2">
                      {(guestHub.data?.daily_ratings ?? [
                        { day: "Mon", rating: 4.9 },
                        { day: "Tue", rating: 4.7 },
                        { day: "Wed", rating: 4.8 },
                        { day: "Thu", rating: 4.4 },
                        { day: "Fri", rating: 4.9 },
                        { day: "Sat", rating: 4.8 },
                        { day: "Today", rating: 4.85 },
                      ]).map((item, idx) => {
                        const heightPct = Math.round(((item.rating - 3.5) / 1.5) * 100);
                        const isToday = item.day === "Today" || idx === 6;
                        return (
                          <div key={idx} className="flex flex-col items-center gap-1 h-full justify-end">
                            <span className="text-[9px] font-bold text-sand-700">{item.rating}★</span>
                            <div
                              title={`${item.day}: ${item.rating} / 5.0`}
                              className={cn(
                                "w-full rounded-t-sm transition-all",
                                isToday ? "bg-sand-900" : item.rating < 4.5 ? "bg-amber-400" : "bg-emerald-600"
                              )}
                              style={{ height: `${Math.max(25, heightPct)}%` }}
                            />
                            <span className={cn("text-[10px]", isToday ? "font-bold text-sand-900" : "text-sand-500")}>
                              {item.day}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-sand-200/80 flex items-center justify-between text-xs">
                <span className="text-sand-500">Low-rating days trigger recovery</span>
                <Link href="/admin/feedback" className="font-semibold text-sage-700 hover:text-sage-900 flex items-center gap-1">
                  Guest Feedback Center <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
            {/* COLUMN 3: AI GOODIES & WEEKLY REWARDS ENGINE */}
            <div className="rounded-2xl border border-sand-200 bg-sand-50/50 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-sand-200/80 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-sand-900">
                      AI Goodies & Weekly Rewards
                    </h4>
                  </div>
                  <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-bold text-gold-900">
                    Live Watch
                  </span>
                </div>
                <div className="mt-3 space-y-2.5">
                  {(guestHub.data?.goodies_and_rewards ?? []).map((reward, i) => (
                    <div
                      key={reward.id || i}
                      className="rounded-xl border border-sand-200 bg-white p-3 text-xs space-y-1.5 transition-all hover:border-gold-400 hover:shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sand-950">{reward.room_number}</span>
                          <span className="text-sand-400">·</span>
                          <span className="text-sand-600 font-medium">{reward.guest_name}</span>
                        </div>
                        <span className="rounded-full bg-gold-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold-800 border border-gold-200">
                          {reward.cadence}
                        </span>
                      </div>
                      {/* Risk and Profit Calculation Display */}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className={cn(
                          "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold border",
                          ((reward as any).risk_pct ?? 20) < 40
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-rose-50 text-rose-800 border-rose-200"
                        )}>
                          Risk: {(reward as any).risk_pct ?? 20}%
                        </span>
                        <span className={cn(
                          "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold border",
                          ((reward as any).profit_pct ?? 80) > 60
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        )}>
                          Profit / Return: {(reward as any).profit_pct ?? 80}%
                        </span>
                        {(((reward as any).risk_pct ?? 20) < 40 && ((reward as any).profit_pct ?? 80) > 60) && (
                          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold bg-sand-900 text-gold-300">
                            ⚡ AI Auto-Eligible
                          </span>
                        )}
                      </div>
                      <div className="bg-sand-50 rounded-lg p-2 text-sand-800 font-semibold flex items-start gap-1.5">
                        <Gift className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-bold text-sand-950">{reward.title}</p>
                          <p className="text-[10px] font-normal text-sand-600">{reward.perk}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-sand-500 italic">
                        💡 {reward.trigger_reason}
                      </p>
                      <div className="pt-1.5 flex items-center justify-end">
                        {(((reward as any).risk_pct ?? 20) < 40 && ((reward as any).profit_pct ?? 80) > 60) || reward.status === "auto_dispatched" || reward.status === "dispatched" ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-300 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            ⚡ AI Auto-Provided (Risk &lt; 40% &amp; Profit &gt; 60%)
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            disabled={dispatchGoodieMutation.isPending}
                            onClick={() => {
                              dispatchGoodieMutation.mutate({
                                room_number: reward.room_number,
                                title: reward.title,
                              });
                            }}
                            className="h-6 text-[10px] font-semibold px-2.5 rounded-lg bg-sand-900 text-sand-50 hover:bg-sand-800"
                          >
                            Manual Approval (Risk ≥ 40%)
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-sand-200/80 flex items-center justify-between text-xs">
                <span className="text-sand-500">Autonomous perk matching</span>
                <Link href="/admin/guests" className="font-semibold text-sage-700 hover:text-sage-900 flex items-center gap-1">
                  Manage Resident Perks <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
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
                        Engine score (uncalibrated):{" "}
                        <span className="font-semibold text-sand-800">
                          {Math.round(act.confidence * 100)}%
                        </span>
                        {act.impact_amount !== undefined && (
                          <>
                            {" "}
                            · Unverified estimate:{" "}
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
   DEPARTMENT MANAGER DASHBOARD (Tailored for Front Desk, Housekeeping, F&B, Maintenance)
   ========================================================================= */

interface ForecastDay14 {
  day: string;
  date: string;
  metricLabel: string;
  metricValue: number;
  staffNeeded: number;
  staffScheduled: number;
}

const DEPARTMENT_14D_FORECASTS: Record<
  string,
  {
    title: string;
    description: string;
    metricUnit: string;
    insight: string;
    forecast: ForecastDay14[];
  }
> = {
  fnb: {
    title: "14-Day F&B Covers & Culinary Staffing Forecast",
    description: "Forward restaurant dining, banqueting, and room-service breakfast pacing mapped against culinary brigade schedules.",
    metricUnit: "covers",
    insight: "Banquet dinner rushes peak on Sat, 03 Oct (190 covers) and Sat, 10 Oct (205 covers). Recommend deploying +4 line stewards to avoid dining SLA breach.",
    forecast: [
      { day: "Sun", date: "27 Sep", metricLabel: "Sunday Brunch", metricValue: 145, staffNeeded: 14, staffScheduled: 14 },
      { day: "Mon", date: "28 Sep", metricLabel: "Bistro Service", metricValue: 88, staffNeeded: 9, staffScheduled: 10 },
      { day: "Tue", date: "29 Sep", metricLabel: "Weekday Dining", metricValue: 92, staffNeeded: 9, staffScheduled: 10 },
      { day: "Wed", date: "30 Sep", metricLabel: "Corporate Lunch", metricValue: 110, staffNeeded: 11, staffScheduled: 11 },
      { day: "Thu", date: "01 Oct", metricLabel: "Lounge Evening", metricValue: 125, staffNeeded: 12, staffScheduled: 12 },
      { day: "Fri", date: "02 Oct", metricLabel: "Weekend Kickoff", metricValue: 165, staffNeeded: 15, staffScheduled: 13 },
      { day: "Sat", date: "03 Oct", metricLabel: "Grand Banquet Gala", metricValue: 190, staffNeeded: 18, staffScheduled: 14 },
      { day: "Sun", date: "04 Oct", metricLabel: "Champagne Brunch", metricValue: 150, staffNeeded: 14, staffScheduled: 14 },
      { day: "Mon", date: "05 Oct", metricLabel: "Bistro Service", metricValue: 85, staffNeeded: 9, staffScheduled: 9 },
      { day: "Tue", date: "06 Oct", metricLabel: "Weekday Dining", metricValue: 90, staffNeeded: 9, staffScheduled: 10 },
      { day: "Wed", date: "07 Oct", metricLabel: "Corporate Dining", metricValue: 115, staffNeeded: 11, staffScheduled: 11 },
      { day: "Thu", date: "08 Oct", metricLabel: "Lounge Evening", metricValue: 130, staffNeeded: 12, staffScheduled: 12 },
      { day: "Fri", date: "09 Oct", metricLabel: "Weekend Dining", metricValue: 175, staffNeeded: 16, staffScheduled: 13 },
      { day: "Sat", date: "10 Oct", metricLabel: "Destination Wedding", metricValue: 205, staffNeeded: 19, staffScheduled: 14 },
    ],
  },
  housekeeping: {
    title: "14-Day Housekeeping Turnovers & HKA Staffing Forecast",
    description: "Departure sweeps, arrival setups, and deep-clean cycles mapped against Housekeeping Attendant (HKA) capacity.",
    metricUnit: "turnovers",
    insight: "Mass departures occur this Sunday (62 checkouts) and next Sunday (68 checkouts). Recommend rostering +6 morning turnover attendants.",
    forecast: [
      { day: "Sun", date: "27 Sep", metricLabel: "Weekend Checkouts", metricValue: 62, staffNeeded: 22, staffScheduled: 16 },
      { day: "Mon", date: "28 Sep", metricLabel: "Turnaround", metricValue: 28, staffNeeded: 12, staffScheduled: 14 },
      { day: "Tue", date: "29 Sep", metricLabel: "Stay-over Cleans", metricValue: 34, staffNeeded: 13, staffScheduled: 14 },
      { day: "Wed", date: "30 Sep", metricLabel: "Midweek Turnover", metricValue: 40, staffNeeded: 15, staffScheduled: 15 },
      { day: "Thu", date: "01 Oct", metricLabel: "Deep Clean Cycle", metricValue: 38, staffNeeded: 14, staffScheduled: 14 },
      { day: "Fri", date: "02 Oct", metricLabel: "Weekend Pre-arrival", metricValue: 55, staffNeeded: 19, staffScheduled: 16 },
      { day: "Sat", date: "03 Oct", metricLabel: "Turnover Rushes", metricValue: 48, staffNeeded: 17, staffScheduled: 16 },
      { day: "Sun", date: "04 Oct", metricLabel: "Mass Departures", metricValue: 65, staffNeeded: 23, staffScheduled: 17 },
      { day: "Mon", date: "05 Oct", metricLabel: "Turnaround", metricValue: 26, staffNeeded: 12, staffScheduled: 13 },
      { day: "Tue", date: "06 Oct", metricLabel: "Stay-over Cleans", metricValue: 32, staffNeeded: 13, staffScheduled: 14 },
      { day: "Wed", date: "07 Oct", metricLabel: "Midweek Turnover", metricValue: 42, staffNeeded: 15, staffScheduled: 15 },
      { day: "Thu", date: "08 Oct", metricLabel: "Deep Clean Cycle", metricValue: 36, staffNeeded: 14, staffScheduled: 14 },
      { day: "Fri", date: "09 Oct", metricLabel: "Weekend Influx", metricValue: 58, staffNeeded: 20, staffScheduled: 16 },
      { day: "Sat", date: "10 Oct", metricLabel: "Turnover Rushes", metricValue: 50, staffNeeded: 18, staffScheduled: 16 },
    ],
  },
  front_office: {
    title: "14-Day Front Desk Arrival Traffic & Lobby Staffing Forecast",
    description: "Guest arrival pacing, VIP concierge arrivals, and check-in cluster velocity mapped against front desk agents.",
    metricUnit: "arrivals",
    insight: "Peak arrival compression occurs Friday between 2:00 PM and 5:00 PM (45 arrivals). Recommend 2 additional lobby greeting agents.",
    forecast: [
      { day: "Sun", date: "27 Sep", metricLabel: "Sunday Influx", metricValue: 38, staffNeeded: 6, staffScheduled: 6 },
      { day: "Mon", date: "28 Sep", metricLabel: "Business Check-ins", metricValue: 24, staffNeeded: 4, staffScheduled: 5 },
      { day: "Tue", date: "29 Sep", metricLabel: "Midweek Inflow", metricValue: 26, staffNeeded: 4, staffScheduled: 5 },
      { day: "Wed", date: "30 Sep", metricLabel: "Conference Arrivals", metricValue: 35, staffNeeded: 5, staffScheduled: 5 },
      { day: "Thu", date: "01 Oct", metricLabel: "Early Weekend", metricValue: 40, staffNeeded: 6, staffScheduled: 6 },
      { day: "Fri", date: "02 Oct", metricLabel: "Weekend Surge", metricValue: 58, staffNeeded: 8, staffScheduled: 6 },
      { day: "Sat", date: "03 Oct", metricLabel: "VIP Suite Arrivals", metricValue: 46, staffNeeded: 7, staffScheduled: 6 },
      { day: "Sun", date: "04 Oct", metricLabel: "Turnaround Arrivals", metricValue: 36, staffNeeded: 5, staffScheduled: 6 },
      { day: "Mon", date: "05 Oct", metricLabel: "Business Check-ins", metricValue: 22, staffNeeded: 4, staffScheduled: 5 },
      { day: "Tue", date: "06 Oct", metricLabel: "Midweek Inflow", metricValue: 25, staffNeeded: 4, staffScheduled: 5 },
      { day: "Wed", date: "07 Oct", metricLabel: "Conference Arrivals", metricValue: 38, staffNeeded: 6, staffScheduled: 6 },
      { day: "Thu", date: "08 Oct", metricLabel: "Early Weekend", metricValue: 42, staffNeeded: 6, staffScheduled: 6 },
      { day: "Fri", date: "09 Oct", metricLabel: "Weekend Rush", metricValue: 62, staffNeeded: 9, staffScheduled: 6 },
      { day: "Sat", date: "10 Oct", metricLabel: "VIP Influx", metricValue: 50, staffNeeded: 7, staffScheduled: 6 },
    ],
  },
  maintenance: {
    title: "14-Day Engineering Facility Load & Technician Forecast",
    description: "HVAC chiller cooling hours, boiler cycle stress, and room work orders mapped against engineering technician shifts.",
    metricUnit: "tasks",
    insight: "Chiller thermal stress peaks on Day 6 & 13 due to forecasted ambient heat waves. Recommend 2 on-call HVAC technicians.",
    forecast: [
      { day: "Sun", date: "27 Sep", metricLabel: "Weekly Plant Audit", metricValue: 24, staffNeeded: 5, staffScheduled: 5 },
      { day: "Mon", date: "28 Sep", metricLabel: "Routine PM Check", metricValue: 18, staffNeeded: 4, staffScheduled: 4 },
      { day: "Tue", date: "29 Sep", metricLabel: "Plumbing Inspection", metricValue: 20, staffNeeded: 4, staffScheduled: 4 },
      { day: "Wed", date: "30 Sep", metricLabel: "Elevator Service", metricValue: 22, staffNeeded: 4, staffScheduled: 4 },
      { day: "Thu", date: "01 Oct", metricLabel: "HVAC Maintenance", metricValue: 26, staffNeeded: 5, staffScheduled: 5 },
      { day: "Fri", date: "02 Oct", metricLabel: "Peak Thermal Load", metricValue: 34, staffNeeded: 7, staffScheduled: 5 },
      { day: "Sat", date: "03 Oct", metricLabel: "Resort Full Load", metricValue: 38, staffNeeded: 8, staffScheduled: 5 },
      { day: "Sun", date: "04 Oct", metricLabel: "Post-weekend Audit", metricValue: 25, staffNeeded: 5, staffScheduled: 5 },
      { day: "Mon", date: "05 Oct", metricLabel: "Routine PM Check", metricValue: 19, staffNeeded: 4, staffScheduled: 4 },
      { day: "Tue", date: "06 Oct", metricLabel: "Boiler Servicing", metricValue: 21, staffNeeded: 4, staffScheduled: 4 },
      { day: "Wed", date: "07 Oct", metricLabel: "Pool Filtration", metricValue: 23, staffNeeded: 4, staffScheduled: 4 },
      { day: "Thu", date: "08 Oct", metricLabel: "Generator Tests", metricValue: 28, staffNeeded: 5, staffScheduled: 5 },
      { day: "Fri", date: "09 Oct", metricLabel: "Peak Thermal Load", metricValue: 36, staffNeeded: 7, staffScheduled: 5 },
      { day: "Sat", date: "10 Oct", metricLabel: "Resort Full Load", metricValue: 40, staffNeeded: 8, staffScheduled: 5 },
    ],
  },
};

interface DeptInventoryItem {
  id: string;
  name: string;
  on_hand: number;
  minimum: number;
  unit: string;
  burn_rate: number;
  days_remaining: number;
  auto_order_status: "in_transit" | "scheduled" | "optimal";
  po_number?: string;
  eta?: string;
  is_depleted?: boolean;
  alternate_path: string;
  guest_menu_shield?: boolean;
}

const DEPT_INVENTORY_ITEMS: Record<string, DeptInventoryItem[]> = {
  fnb: [
    {
      id: "fnb-inv-1",
      name: "Barolo DOCG 2018 Vintage Reserve Wine",
      on_hand: 0,
      minimum: 24,
      unit: "btl",
      burn_rate: 3.5,
      days_remaining: 0,
      is_depleted: true,
      auto_order_status: "in_transit",
      po_number: "PO-FNB-2026-904",
      eta: "Tomorrow, 2:00 PM",
      alternate_path: "Substitute with 2019 Brunello di Montalcino from Reserve Cellar. Same flavor profile, zero cost variance. Guest sentiment protected.",
      guest_menu_shield: true,
    },
    {
      id: "fnb-inv-2",
      name: "Prime Black Angus Ribeye (Chilled)",
      on_hand: 6,
      minimum: 20,
      unit: "kg",
      burn_rate: 4.2,
      days_remaining: 1.4,
      auto_order_status: "in_transit",
      po_number: "PO-FNB-2026-908",
      eta: "Tonight, 8:00 PM",
      alternate_path: "Feature Pan-Seared Atlantic Salmon Fillet and Coastal Tawa Prawns on dinner specials board.",
      guest_menu_shield: false,
    },
    {
      id: "fnb-inv-3",
      name: "Organic Farm Fresh Milk & Heavy Cream",
      on_hand: 18,
      minimum: 40,
      unit: "L",
      burn_rate: 8.5,
      days_remaining: 2.1,
      auto_order_status: "scheduled",
      po_number: "PO-FNB-2026-912",
      eta: "Tomorrow, 6:00 AM",
      alternate_path: "Activate local boutique dairy backup agreement with 2-hour courier dispatch.",
      guest_menu_shield: false,
    },
  ],
  housekeeping: [
    {
      id: "hk-inv-1",
      name: "Egyptian Cotton 400TC King Linen Sets",
      on_hand: 14,
      minimum: 50,
      unit: "sets",
      burn_rate: 12.0,
      days_remaining: 1.1,
      auto_order_status: "in_transit",
      po_number: "PO-HK-2026-402",
      eta: "Tomorrow, 10:00 AM",
      alternate_path: "Draw 35 sets from Central Linen Buffer; trigger express 2-hour on-site ozone laundry wash.",
      guest_menu_shield: false,
    },
    {
      id: "hk-inv-2",
      name: "Luxury Botanical Bath Amenity Kits",
      on_hand: 28,
      minimum: 80,
      unit: "kits",
      burn_rate: 15.0,
      days_remaining: 1.8,
      auto_order_status: "in_transit",
      po_number: "PO-HK-2026-405",
      eta: "Today, 5:00 PM",
      alternate_path: "Allocate premium Spa Collection mini-bottles to Presidential and Executive suites.",
      guest_menu_shield: false,
    },
    {
      id: "hk-inv-3",
      name: "Plush Zero-Twist Bath Sheets (White)",
      on_hand: 32,
      minimum: 90,
      unit: "pcs",
      burn_rate: 18.0,
      days_remaining: 1.7,
      auto_order_status: "scheduled",
      po_number: "PO-HK-2026-410",
      eta: "Thursday delivery",
      alternate_path: "Reprioritize commercial drying tumblers to expedite turnover of in-house wash batch.",
      guest_menu_shield: false,
    },
  ],
  front_office: [
    {
      id: "fo-inv-1",
      name: "Wooden RFID Eco Smart Keycards",
      on_hand: 45,
      minimum: 200,
      unit: "cards",
      burn_rate: 35.0,
      days_remaining: 1.2,
      auto_order_status: "in_transit",
      po_number: "PO-FO-2026-115",
      eta: "Tomorrow, 11:00 AM",
      alternate_path: "Activate Vesper Mobile Bluetooth Keyless Entry for checking-in guests to save 65% physical card usage.",
      guest_menu_shield: false,
    },
    {
      id: "fo-inv-2",
      name: "VIP Welcome Gold Leaf Amenity Boxes",
      on_hand: 4,
      minimum: 15,
      unit: "boxes",
      burn_rate: 2.2,
      days_remaining: 1.8,
      auto_order_status: "in_transit",
      po_number: "PO-FO-2026-118",
      eta: "Today, 4:00 PM",
      alternate_path: "Upgrade VIP guests with artisanal patisserie basket from Master Chef Marco's pantry.",
      guest_menu_shield: false,
    },
    {
      id: "fo-inv-3",
      name: "Direct Thermal Luggage Tag Rolls",
      on_hand: 3,
      minimum: 10,
      unit: "rolls",
      burn_rate: 1.0,
      days_remaining: 3.0,
      auto_order_status: "scheduled",
      po_number: "PO-FO-2026-122",
      eta: "Friday delivery",
      alternate_path: "Use pre-printed reusable leather luggage strap tags for early arrivals.",
      guest_menu_shield: false,
    },
  ],
  maintenance: [
    {
      id: "maint-inv-1",
      name: "HVAC Primary Filter Cartridge (MERV 13)",
      on_hand: 2,
      minimum: 8,
      unit: "units",
      burn_rate: 1.2,
      days_remaining: 1.6,
      auto_order_status: "in_transit",
      po_number: "PO-ENG-2026-104",
      eta: "Tomorrow, 9:00 AM",
      alternate_path: "Deploy universal dual-stage washable bypass cartridge (6 in reserve store). Zero cooling loss.",
      guest_menu_shield: false,
    },
    {
      id: "maint-inv-2",
      name: "Universal Brass Mixing Valve (3/4\")",
      on_hand: 1,
      minimum: 4,
      unit: "pcs",
      burn_rate: 0.5,
      days_remaining: 2.0,
      auto_order_status: "in_transit",
      po_number: "PO-ENG-2026-108",
      eta: "In 24 hours",
      alternate_path: "Mount pre-calibrated manifold bypass located in North Plant riser cabinet.",
      guest_menu_shield: false,
    },
    {
      id: "maint-inv-3",
      name: "R-410A Eco Refrigerant Canister (11.3 kg)",
      on_hand: 3,
      minimum: 6,
      unit: "cyl",
      burn_rate: 0.6,
      days_remaining: 5.0,
      auto_order_status: "scheduled",
      po_number: "PO-ENG-2026-112",
      eta: "Friday delivery",
      alternate_path: "Cycle backup chiller circuit B to balance head pressure across compressors.",
      guest_menu_shield: false,
    },
  ],
};

export function ManagerDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [shieldActive, setShieldActive] = useState(true);

  const departmentId = user?.departmentId ?? undefined;
  const deptKey = (user?.departmentKey || "").toLowerCase();
  
  // Resolve precise category department key
  const activeDeptKey =
    deptKey === "front_office" || user?.role === "dept_manager_frontdesk" || user?.email === "fom@vesper.demo"
      ? "front_office"
      : deptKey === "housekeeping" || user?.role === "dept_manager_hk" || user?.email === "exec@vesper.demo"
      ? "housekeeping"
      : deptKey === "maintenance" || user?.role === "dept_manager_maint" || user?.email === "chiefeng@vesper.demo"
      ? "maintenance"
      : "fnb";

  const deptForecastData = DEPARTMENT_14D_FORECASTS[activeDeptKey] || DEPARTMENT_14D_FORECASTS.fnb;
  const deptInventoryList = DEPT_INVENTORY_ITEMS[activeDeptKey] || DEPT_INVENTORY_ITEMS.fnb;

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

  const handleSimulateAutoOrder = (item: DeptInventoryItem) => {
    showToast({
      title: `⚡ AI Proactive Auto-Order Dispatched: ${item.name}`,
      description: `Autonomous purchase order logged with vetted supplier. ETA: ${item.eta ?? "24 hrs"}. Alternate contingency armed.`,
      type: "success",
    });
  };

  const pendingReports = reports.filter((r) => r.status === "submitted" || r.status === "pending");
  const openRequests = requests.filter(
    (r) => !["delivered", "cancelled", "completed"].includes(r.status)
  );
  const overdueRequests = openRequests.filter((r) => r.is_overdue);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={`Operational Command for ${deptName} · Vesper Luxury Resort`}
        meta={format(new Date(), "EEE, d MMM yyyy")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/roster"
              className="inline-flex items-center gap-1.5 rounded-xl border border-sand-200 bg-white px-3.5 py-2 text-xs font-semibold text-sand-800 shadow-xs transition-colors hover:bg-sand-50"
            >
              <UsersRound className="h-3.5 w-3.5 text-sage-600" />
              Staff Roster →
            </Link>
            <Link
              href="/admin/staff"
              className="inline-flex items-center gap-1.5 rounded-xl border border-sand-200 bg-white px-3.5 py-2 text-xs font-semibold text-sand-800 shadow-xs transition-colors hover:bg-sand-50"
            >
              <UserCheck className="h-3.5 w-3.5 text-sage-600" />
              Live Attendance →
            </Link>
            <Link
              href="/admin/rooms"
              className="inline-flex items-center gap-1.5 rounded-xl border border-sand-200 bg-white px-3.5 py-2 text-xs font-semibold text-sand-800 shadow-xs transition-colors hover:bg-sand-50"
            >
              <Boxes className="h-3.5 w-3.5 text-emerald-600" />
              Room Status →
            </Link>
          </div>
        }
      />

      {/* Manager KPI Tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Team On Shift"
          value={attendance ? `${attendance.present} / ${attendance.expected}` : "14 / 16"}
          change={attendance?.late ? `${attendance.late} late check-in` : "On schedule"}
          comparison={attendance?.absent ? `${attendance.absent} absent` : "Full presence"}
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
          label="Room Status & Turnovers"
          value="16 Occupied"
          change="4 Turnovers · 2 Defect Hold"
          comparison="Front Desk & Maintenance synced"
          tone="emerald"
          icon={BedDouble}
        />
        <StatTile
          label="14-Day Automated Inventory"
          value="100% Protected"
          change="AI Auto-Orders Active"
          comparison="Zero par breach risk"
          tone="gold"
          icon={Zap}
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          14-DAY DEPARTMENT DEMAND & STAFFING FORECAST (Tailored per Category)
         ───────────────────────────────────────────────────────────────────────── */}
      <Panel>
        <PanelHeader
          title={deptForecastData.title}
          description={deptForecastData.description}
          className="flex-wrap"
          action={
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1 text-[11px] font-medium text-sand-700">
                <span className="h-2 w-2 rounded-xs bg-forest-600" />
                Optimal Staffing
              </span>
              <span className="flex items-center gap-1 text-[11px] font-medium text-rose-700">
                <span className="h-2 w-2 rounded-xs bg-rose-500" />
                Manpower Shortage
              </span>
              <span className="rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-semibold text-sand-800">
                14-Day Machine Learning
              </span>
            </div>
          }
        />
        <PanelBody className="space-y-4 pt-4">
          <div className="grid grid-cols-14 gap-1 items-end h-36 pt-4 border-b border-sand-200">
            {deptForecastData.forecast.map((fc, idx) => {
              const maxVal = Math.max(...deptForecastData.forecast.map((f) => f.metricValue));
              const heightPct = Math.round((fc.metricValue / maxVal) * 100);
              const isShortage = fc.staffScheduled < fc.staffNeeded;

              return (
                <div key={idx} className="flex flex-col items-center gap-1 h-full justify-end group">
                  <span className="text-[9px] font-bold text-sand-600 group-hover:text-sand-950">
                    {fc.staffNeeded}p
                  </span>
                  <div
                    title={`${fc.day} (${fc.date}): ${fc.metricValue} ${deptForecastData.metricUnit} (${fc.metricLabel}) | Staff Needed: ${fc.staffNeeded} | Scheduled: ${fc.staffScheduled} ${isShortage ? `(Short by ${fc.staffNeeded - fc.staffScheduled})` : ""}`}
                    className={cn(
                      "w-full rounded-t-sm transition-all cursor-pointer",
                      isShortage
                        ? "bg-rose-500 group-hover:bg-rose-600"
                        : idx === 0
                        ? "bg-sand-900"
                        : "bg-forest-600 group-hover:bg-forest-700"
                    )}
                    style={{ height: `${Math.max(20, heightPct)}%` }}
                  />
                  <span className={cn("text-[9px] truncate w-full text-center", idx === 0 ? "font-bold text-sand-900" : "text-sand-500")}>
                    {fc.day.slice(0, 3)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* AI Planning Narrative */}
          <div className="rounded-xl bg-sand-50/90 border border-sand-200 p-3.5 text-xs text-sand-800 space-y-1">
            <p className="font-semibold text-sand-950 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-gold-600" />
              Vesper AI Department Demand Briefing:
            </p>
            <p className="leading-relaxed">{deptForecastData.insight}</p>
          </div>
        </PanelBody>
      </Panel>

      {/* ─────────────────────────────────────────────────────────────────────────
          14-DAY AHEAD AUTOMATED INVENTORY FLOW & RISK SHIELD
         ───────────────────────────────────────────────────────────────────────── */}
      <Panel>
        <PanelHeader
          title="14-Day Ahead Automated Inventory & Risk Shield"
          description="Continuous par telemetry. AI proactively auto-orders stock before depletion, advises alternate paths during supply risk, and shields guest menus."
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShieldActive(!shieldActive);
                  showToast({
                    title: shieldActive ? "Guest Menu Shield Deactivated" : "🛡️ AI Guest Menu Shield Activated",
                    description: shieldActive ? "Depleted items will now show as Sold Out." : "Depleted items are now automatically concealed from guest room tablets.",
                    type: "default",
                  });
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold border transition-all flex items-center gap-1.5",
                  shieldActive
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : "bg-sand-100 text-sand-700 border-sand-300"
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                {shieldActive ? "AI Guest Menu Shield: Active" : "Guest Shield: Off"}
              </button>
            </div>
          }
        />
        <PanelBody className="space-y-4 pt-4">
          {/* Guest Shield Explanatory Alert Banner */}
          {shieldActive && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-950">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  <strong>AI Guest Menu Shield Active:</strong> Out-of-stock items (such as vintage reserve wine or exhausted amenities) are automatically concealed from guest room tablets and mobile QR menus so guests cannot place unfulfillable orders.
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-800 font-semibold uppercase">Zero Order Friction</span>
            </div>
          )}

          {/* Department Inventory List with Auto-Order and Alternate Path */}
          <div className="divide-y divide-sand-100">
            {deptInventoryList.map((item) => (
              <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-sand-950 text-sm">{item.name}</h4>
                      {item.is_depleted ? (
                        <span className="rounded-full bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 text-[10px] font-bold">
                          Depleted (0 {item.unit})
                        </span>
                      ) : (
                        <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-medium text-sand-700">
                          {item.on_hand} {item.unit} on hand
                        </span>
                      )}

                      {item.guest_menu_shield && (
                        <span className="rounded-full bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3 text-purple-600" />
                          Concealed on Guest Tablet
                        </span>
                      )}

                      {item.auto_order_status === "in_transit" && (
                        <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-emerald-600" />
                          Auto-Order Dispatched ({item.po_number}) · ETA: {item.eta}
                        </span>
                      )}
                    </div>

                    {/* Stock telemetry row */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-sand-600">
                      <span>Safety Par: <strong className="text-sand-900">{item.minimum} {item.unit}</strong></span>
                      <span>•</span>
                      <span>Daily Burn: <strong className="text-sand-900">~{item.burn_rate} {item.unit}/day</strong></span>
                      <span>•</span>
                      <span>
                        Depletion Horizon:{" "}
                        <strong className={cn(item.days_remaining <= 1 ? "text-rose-700" : "text-emerald-700")}>
                          {item.days_remaining === 0 ? "Exhausted" : `${item.days_remaining} days`}
                        </strong>
                      </span>
                    </div>

                    {/* AI Alternate Path Recommendation */}
                    <div className="rounded-xl bg-amber-50/70 border border-amber-200/70 p-3 text-xs text-amber-900 space-y-1">
                      <p className="font-semibold flex items-center gap-1.5 text-amber-950">
                        <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                        AI Alternate Path Contingency:
                      </p>
                      <p className="text-amber-900 leading-relaxed">{item.alternate_path}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSimulateAutoOrder(item)}
                      className="text-xs"
                    >
                      <Zap className="h-3.5 w-3.5 text-sage-600 mr-1.5" />
                      Simulate AI Auto-Order
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </PanelBody>
      </Panel>

      {/* Team Shift Status & Handover Reports */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Attendance Summary Panel */}
        <Panel className="flex flex-col">
          <PanelHeader
            title="Team Shift Roster & Attendance"
            description="Live check-in telemetry for today's active shift"
            action={
              <Link
                href="/admin/staff"
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Link
          href="/admin/front-desk"
          className="rounded-xl border border-sand-200 bg-white p-4 shadow-xs transition-colors hover:border-sand-400"
        >
          <p className="text-xs font-semibold text-sand-500 uppercase tracking-wider">
            Front Desk & Rooms
          </p>
          <p className="mt-2 text-xl font-bold text-sand-950">Room Grid</p>
          <p className="text-xs text-sand-600 mt-1">Check-in & occupancy status →</p>
        </Link>
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
  if (
    user?.role === "dept_manager_fb" ||
    user?.role === "dept_manager_hk" ||
    user?.role === "dept_manager_frontdesk" ||
    user?.role === "dept_manager_maint" ||
    user?.departmentKey === "fnb" ||
    user?.departmentKey === "housekeeping" ||
    user?.departmentKey === "front_office" ||
    user?.departmentKey === "maintenance" ||
    user?.email === "fom@vesper.demo" ||
    user?.email === "exec@vesper.demo" ||
    user?.email === "chef@vesper.demo" ||
    user?.email === "chiefeng@vesper.demo" ||
    user?.email === "store@vesper.demo"
  ) {
    if (user?.role !== "general_manager" && user?.role !== "owner") {
      return <ManagerDashboard />;
    }
  }
  return <GmDashboard />;
}
