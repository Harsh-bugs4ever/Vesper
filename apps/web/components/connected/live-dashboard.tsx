"use client";

import React from "react";
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
  TrendingUp,
  UserCheck,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import {
  dashboardApi,
  actionCardsApi,
  attendanceApi,
  reportsApi,
  api,
  type ActionCardDetail,
  type DashboardData,
  type AttendanceTeamSummary,
  type StaffReportOut,
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
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const scope = [user?.propertyId ?? "default"];

  const today = new Date();
  const firstName = user?.name ? user.name.split(" ")[0] : "General Manager";
  const propertyName = user?.propertyName ?? "the Resort";

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
        description: `Recommendation applied: ${card.title}. Undo window open for 60s.`,
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
      actionCardsApi.dismiss(cardId, "dismissed_from_cockpit"),
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greetingFor(today)}, ${firstName}`}
        description={`Executive governance cockpit for ${propertyName}.`}
        meta={format(today, "EEE, d MMM yyyy")}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/simulator"
              className="inline-flex items-center gap-1.5 rounded-xl border border-sand-200 bg-white px-3.5 py-2 text-xs font-semibold text-sand-800 shadow-xs transition-colors hover:bg-sand-50 hover:text-sand-950"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-sage-600" />
              Open Revenue Simulator →
            </Link>
          </div>
        }
      />

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
            dashboard?.sentiment?.average_score
              ? `${dashboard.sentiment.average_score.toFixed(1)} / 5`
              : dashboard?.sentiment?.positive_pct
              ? `${Math.round(dashboard.sentiment.positive_pct * 100)}% Pos`
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
                        {act.explanation}
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

      {/* 6. AI System Readiness & Audit Activity Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sand-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                (dashboard?.engines?.ready?.length ?? 0) > 0
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-amber-500"
              )}
            />
            <span className="font-semibold text-sand-950">AI Engine Readiness:</span>
            <span className="text-sand-700">
              {dashboard?.engines?.ready?.length ?? 0} Ready ·{" "}
              {dashboard?.engines?.warming?.length ?? 0} Warming ·{" "}
              {dashboard?.engines?.cold?.length ?? 0} Cold
            </span>
          </div>

          <div className="flex items-center gap-2 border-l border-sand-200 pl-6">
            <Activity className="h-3.5 w-3.5 text-sage-600" />
            <span className="font-semibold text-sand-950">Actions Resolved:</span>
            <span className="text-sand-700">
              {dashboard?.action_queue?.approved ?? 0} Approved ·{" "}
              {dashboard?.action_queue?.dismissed ?? 0} Dismissed
            </span>
            {dashboard?.generated_at && (
              <span className="text-sand-400">
                · Fresh as of {format(new Date(dashboard.generated_at), "HH:mm:ss")}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link
            href="/admin/users"
            className="flex items-center gap-1 font-semibold text-sage-800 hover:text-sage-950"
          >
            <Shield className="h-3.5 w-3.5" />
            Role Directory
          </Link>
          <span className="text-sand-300">|</span>
          <Link
            href="/admin/training"
            className="flex items-center gap-1 font-semibold text-sage-800 hover:text-sage-950"
          >
            Model Governance
          </Link>
        </div>
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
