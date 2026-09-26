"use client";

import React, { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Info,
  MessageSquareQuote,
  Minus,
  Star,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { StarRating } from "@/components/ui/star-rating";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  api,
  attendanceApi,
  departments as departmentsApi,
  type AttendanceRecord,
  type AttendanceTeamSummary,
  type DepartmentOut,
} from "@/lib/api";
import {
  usePerformanceBoard,
  useStaffReviews,
  type StaffPerformance,
  type Tier,
} from "@/lib/hooks/use-performance";
import { useAuth } from "@/components/auth/auth-context";
import { cn } from "@/lib/utils";

interface UserItem {
  id: string;
  full_name: string;
  department_id: string | null;
  role: string;
}

const TIER_META: Record<string, { label: string; chip: string }> = {
  top: { label: "Top Performer", chip: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  exceptional: { label: "Exceptional", chip: "border-sage-300 bg-sage-50 text-sage-800" },
  solid: { label: "Solid", chip: "border-sand-200 bg-sand-100 text-sand-700" },
  steady: { label: "Steady", chip: "border-sand-200 bg-sand-100 text-sand-700" },
  developing: { label: "Developing", chip: "border-amber-200 bg-amber-50 text-amber-800" },
  needs_support: { label: "Needs Support", chip: "border-rose-200 bg-rose-50 text-rose-700" },
  unranked: { label: "Unranked", chip: "border-sand-200 bg-white text-sand-500" },
};

const PERIOD_OPTIONS = [
  { value: "7", label: "Last 7 Days" },
  { value: "14", label: "Last 14 Days" },
  { value: "30", label: "Last 30 Days" },
  { value: "90", label: "Last 90 Days" },
];

export default function PerformancePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"performance" | "attendance">("performance");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("30");
  const [selectedStaffDetail, setSelectedStaffDetail] = useState<StaffPerformance | null>(null);

  // 1. Fetch authorized departments
  const { data: deptList = [], isLoading: deptsLoading } = useQuery({
    queryKey: ["admin-departments", user?.propertyId],
    queryFn: () => departmentsApi.list(),
  });

  // 2. Fetch staff directory for dropdown
  const { data: userList = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users-list", user?.propertyId],
    queryFn: () => api.get<UserItem[]>("/admin/users").catch(() => [] as UserItem[]),
  });

  // Filter employees matching selected department
  const filteredUsers = useMemo(() => {
    if (selectedDeptId === "all") return userList;
    return userList.filter((u) => u.department_id === selectedDeptId);
  }, [userList, selectedDeptId]);

  // Reset employee selection if incompatible when department changes
  useEffect(() => {
    if (selectedEmployeeId !== "all") {
      const stillValid = filteredUsers.some((u) => u.id === selectedEmployeeId);
      if (!stillValid) {
        setSelectedEmployeeId("all");
      }
    }
  }, [selectedDeptId, filteredUsers, selectedEmployeeId]);

  // 3. Fetch real performance board
  const {
    data: board,
    isLoading: boardLoading,
    isError: boardError,
    refetch: refetchBoard,
  } = usePerformanceBoard(selectedDeptId === "all" ? undefined : selectedDeptId);

  // 4. Fetch team attendance summary
  const todayDate = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const {
    data: teamAttendance,
    isLoading: attendanceLoading,
    isError: attendanceError,
    refetch: refetchAttendance,
  } = useQuery({
    queryKey: ["team-attendance", user?.propertyId, selectedDeptId, todayDate],
    queryFn: () =>
      attendanceApi.team({
        department_id: selectedDeptId === "all" ? undefined : selectedDeptId,
        work_date: todayDate,
      }),
  });

  // 5. Staff reviews drawer for selected staff member
  const { reviews: staffReviews, isLoading: reviewsLoading } = useStaffReviews(
    selectedStaffDetail?.staffId ?? null
  );

  const { ranked, unranked, houseAverage, minimumReviews } = board;

  // Filter by selected employee if chosen
  const visibleRanked = useMemo(() => {
    if (selectedEmployeeId === "all") return ranked;
    return ranked.filter((p) => p.staffId === selectedEmployeeId);
  }, [ranked, selectedEmployeeId]);

  const visibleUnranked = useMemo(() => {
    if (selectedEmployeeId === "all") return unranked;
    return unranked.filter((p) => p.staffId === selectedEmployeeId);
  }, [unranked, selectedEmployeeId]);

  const totalReviews =
    ranked.reduce((sum, p) => sum + p.reviewCount, 0) +
    unranked.reduce((sum, p) => sum + p.reviewCount, 0);

  const recognised = ranked.filter((p) => p.deservesRecognition);
  const conversations = ranked.filter((p) => p.meritsAConversation);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Operations & Performance"
        description="Factual attendance tracking and Bayesian guest feedback evaluation for hotel staff."
        meta={format(new Date(), "EEE, d MMM yyyy")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* View Switcher */}
            <div className="inline-flex rounded-xl border border-sand-200 bg-sand-100/60 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab("performance")}
                className={cn(
                  "rounded-lg px-3 py-1.5 transition",
                  activeTab === "performance"
                    ? "bg-white text-sage-950 shadow-xs"
                    : "text-sand-600 hover:text-sand-900"
                )}
              >
                Guest Performance
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("attendance")}
                className={cn(
                  "rounded-lg px-3 py-1.5 transition",
                  activeTab === "attendance"
                    ? "bg-white text-sage-950 shadow-xs"
                    : "text-sand-600 hover:text-sand-900"
                )}
              >
                Shift Attendance
              </button>
            </div>
          </div>
        }
      />

      {/* Backend-Authorized Dropdown Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sand-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sand-500">
          <Filter className="h-3.5 w-3.5 text-sage-700" />
          <span>Filters:</span>
        </div>

        {/* Department Dropdown */}
        <label className="flex items-center gap-2 text-xs text-sand-700">
          <span className="font-medium">Department:</span>
          <select
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            disabled={deptsLoading}
            className="rounded-lg border border-sand-300 bg-white px-3 py-1.5 text-xs text-sand-950 shadow-xs focus:border-sage-600 focus:outline-none"
          >
            <option value="all">All Departments</option>
            {deptList.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </label>

        {/* Employee Dropdown (Filtered by Department, Auto-resets on change) */}
        <label className="flex items-center gap-2 text-xs text-sand-700">
          <span className="font-medium">Employee:</span>
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            disabled={usersLoading}
            className="rounded-lg border border-sand-300 bg-white px-3 py-1.5 text-xs text-sand-950 shadow-xs focus:border-sage-600 focus:outline-none"
          >
            <option value="all">All Staff Members ({filteredUsers.length})</option>
            {filteredUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.role})
              </option>
            ))}
          </select>
        </label>

        {/* Period Filter */}
        <label className="flex items-center gap-2 text-xs text-sand-700">
          <span className="font-medium">Period:</span>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="rounded-lg border border-sand-300 bg-white px-3 py-1.5 text-xs text-sand-950 shadow-xs focus:border-sage-600 focus:outline-none"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {(selectedDeptId !== "all" || selectedEmployeeId !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSelectedDeptId("all");
              setSelectedEmployeeId("all");
            }}
            className="ml-auto text-xs text-sand-500 underline hover:text-sand-800"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* TAB 1: GUEST-RATED PERFORMANCE */}
      {activeTab === "performance" && (
        <div className="space-y-6">
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              variant="value-first"
              label="Reviews Collected"
              value={boardLoading ? "…" : totalReviews}
              change={`Last ${selectedPeriod} days`}
              tone="sage"
              icon={Star}
            />
            <StatTile
              variant="value-first"
              label="House Average"
              value={boardLoading ? "…" : houseAverage > 0 ? houseAverage.toFixed(2) : "—"}
              change="Benchmark score"
              tone="forest"
              icon={Users}
            />
            <StatTile
              variant="value-first"
              label="Recognition Merited"
              value={boardLoading ? "…" : recognised.length}
              change="Consistently high praise"
              tone="emerald"
              icon={Award}
            />
            <StatTile
              variant="value-first"
              label="Coaching Review"
              value={boardLoading ? "…" : conversations.length}
              change="Service recovery opportunity"
              tone={conversations.length > 0 ? "rose" : "sand"}
              icon={MessageSquareQuote}
            />
          </div>

          {/* Ranked Staff Performance Table */}
          <Panel>
            <PanelHeader
              title="Calibrated Staff Performance Board"
              description={`Recency-weighted and severity-corrected scores. Requires at least ${minimumReviews} guest reviews to rank.`}
            />
            <PanelBody className="p-0">
              {boardLoading ? (
                <p role="status" className="p-8 text-center text-sm text-sand-500">
                  Loading performance board…
                </p>
              ) : boardError ? (
                <div className="p-8 text-center">
                  <p role="alert" className="text-sm text-rose-700">
                    Failed to load performance metrics from guest-intel service.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchBoard()}
                    className="mt-3"
                  >
                    Retry
                  </Button>
                </div>
              ) : visibleRanked.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-sand-600">
                    No staff members currently meet the {minimumReviews}-review minimum threshold for calibrated scoring in this selection.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Staff Member</TH>
                        <TH>Department</TH>
                        <TH className="text-center">Reviews</TH>
                        <TH className="text-center">Avg Rating</TH>
                        <TH className="text-center">Bayesian Score</TH>
                        <TH>Tier</TH>
                        <TH>Signal Reasons</TH>
                        <TH className="text-right">Action</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {visibleRanked.map((person) => {
                        const meta = TIER_META[person.tier] ?? TIER_META.unranked;
                        return (
                          <TR key={person.staffId}>
                            <TD className="font-medium text-sage-950">
                              {person.name}
                              {person.thinEvidence && (
                                <span className="ml-2 inline-flex items-center text-[10px] text-amber-700">
                                  (Thin evidence)
                                </span>
                              )}
                            </TD>
                            <TD className="text-xs text-sand-600">{person.department}</TD>
                            <TD className="text-center font-mono text-xs tabular-nums">
                              {person.reviewCount}
                            </TD>
                            <TD className="text-center font-mono text-xs tabular-nums">
                              {person.meanRating !== null ? person.meanRating.toFixed(2) : "—"}
                            </TD>
                            <TD className="text-center font-mono text-sm font-semibold text-sage-950 tabular-nums">
                              {person.score !== null ? person.score.toFixed(2) : "—"}
                            </TD>
                            <TD>
                              <span
                                className={cn(
                                  "inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                                  meta.chip
                                )}
                              >
                                {meta.label}
                              </span>
                            </TD>
                            <TD>
                              <div className="flex flex-wrap gap-1">
                                {person.reasons.length > 0 ? (
                                  person.reasons.map((r, i) => (
                                    <span
                                      key={i}
                                      className="rounded bg-sand-100 px-1.5 py-0.5 text-[10px] text-sand-700"
                                    >
                                      {r}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[11px] text-sand-400">Standard</span>
                                )}
                              </div>
                            </TD>
                            <TD className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedStaffDetail(person)}
                                className="text-xs"
                              >
                                View Feedback
                              </Button>
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                </div>
              )}
            </PanelBody>
          </Panel>

          {/* Unranked Staff Section */}
          {visibleUnranked.length > 0 && (
            <Panel>
              <PanelHeader
                title="Unranked Staff (Insufficient Sample Size)"
                description={`Staff members with fewer than ${minimumReviews} verified guest reviews are withheld from ranking to prevent unrepresentative scores.`}
              />
              <PanelBody className="p-0">
                <Table>
                  <THead>
                    <TR>
                      <TH>Staff Member</TH>
                      <TH>Department</TH>
                      <TH className="text-center">Reviews Logged</TH>
                      <TH className="text-center">Raw Average</TH>
                      <TH>Status</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {visibleUnranked.map((person) => (
                      <TR key={person.staffId}>
                        <TD className="font-medium text-sand-800">{person.name}</TD>
                        <TD className="text-xs text-sand-600">{person.department}</TD>
                        <TD className="text-center font-mono text-xs tabular-nums">
                          {person.reviewCount} / {minimumReviews}
                        </TD>
                        <TD className="text-center font-mono text-xs tabular-nums">
                          {person.meanRating !== null ? `${person.meanRating.toFixed(1)} ★` : "—"}
                        </TD>
                        <TD className="text-xs text-sand-500">
                          Collecting ratings ({minimumReviews - person.reviewCount} more needed)
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </PanelBody>
            </Panel>
          )}
        </div>
      )}

      {/* TAB 2: SHIFT ATTENDANCE */}
      {activeTab === "attendance" && (
        <div className="space-y-6">
          {/* Attendance Stat Tiles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              variant="value-first"
              label="Present Today"
              value={attendanceLoading ? "…" : teamAttendance?.present ?? "—"}
              change={`Out of ${teamAttendance?.expected ?? 0} expected`}
              tone="emerald"
              icon={UserCheck}
            />
            <StatTile
              variant="value-first"
              label="Late Check-Ins"
              value={attendanceLoading ? "…" : teamAttendance?.late ?? "—"}
              change="Shift grace timer elapsed"
              tone={(teamAttendance?.late ?? 0) > 0 ? "amber" : "sand"}
              icon={Clock}
            />
            <StatTile
              variant="value-first"
              label="Absent / Unlogged"
              value={attendanceLoading ? "…" : teamAttendance?.absent ?? "—"}
              change="No punch-in recorded"
              tone={(teamAttendance?.absent ?? 0) > 0 ? "rose" : "sand"}
              icon={UserX}
            />
            <StatTile
              variant="value-first"
              label="Currently on Floor"
              value={attendanceLoading ? "…" : teamAttendance?.still_on_shift ?? teamAttendance?.present ?? "—"}
              change="Active on shift"
              tone="forest"
              icon={Users}
            />
          </div>

          {/* Attendance Log Table */}
          <Panel>
            <PanelHeader
              title={`Shift Attendance Log · ${format(new Date(), "d MMMM yyyy")}`}
              description="Timestamped GPS & roster-verified punch records for staff members."
            />
            <PanelBody className="p-0">
              {attendanceLoading ? (
                <p role="status" className="p-8 text-center text-sm text-sand-500">
                  Loading attendance records…
                </p>
              ) : attendanceError ? (
                <div className="p-8 text-center">
                  <p role="alert" className="text-sm text-rose-700">
                    Could not load team attendance. Ensure you have the attendance:read_team permission.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchAttendance()}
                    className="mt-3"
                  >
                    Retry
                  </Button>
                </div>
              ) : (teamAttendance?.records ?? []).length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-sand-600">
                    No attendance records logged for today in this department scope yet.
                  </p>
                </div>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Employee</TH>
                      <TH>Work Date</TH>
                      <TH>Check-In Time</TH>
                      <TH>Check-Out Time</TH>
                      <TH className="text-center">Hours Worked</TH>
                      <TH>Punctuality</TH>
                      <TH>Notes</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {teamAttendance!.records.map((rec) => {
                      const emp = userList.find((u) => u.id === rec.user_id);
                      const hours = (rec.worked_minutes / 60).toFixed(1);
                      return (
                        <TR key={rec.id}>
                          <TD className="font-medium text-sage-950">
                            {emp?.full_name ?? `User ${rec.user_id.slice(0, 8)}`}
                          </TD>
                          <TD className="text-xs text-sand-600">{rec.work_date}</TD>
                          <TD className="font-mono text-xs text-sand-900">
                            {rec.checked_in_at
                              ? new Date(rec.checked_in_at).toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </TD>
                          <TD className="font-mono text-xs text-sand-900">
                            {rec.checked_out_at
                              ? new Date(rec.checked_out_at).toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Still active"}
                          </TD>
                          <TD className="text-center font-mono text-xs tabular-nums">
                            {hours} hrs
                          </TD>
                          <TD>
                            {rec.is_late ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                <Clock className="h-3 w-3" /> Late Check-in
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                <CheckCircle2 className="h-3 w-3" /> On Time
                              </span>
                            )}
                          </TD>
                          <TD className="text-xs text-sand-600">{rec.notes ?? "—"}</TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              )}
            </PanelBody>
          </Panel>
        </div>
      )}

      {/* Staff Review Details Drawer */}
      <Drawer
        open={Boolean(selectedStaffDetail)}
        onClose={() => setSelectedStaffDetail(null)}
        title={selectedStaffDetail ? `${selectedStaffDetail.name} · Feedback Log` : "Feedback"}
        description={selectedStaffDetail ? `${selectedStaffDetail.department} · Score: ${selectedStaffDetail.score?.toFixed(2) ?? "—"}` : ""}
      >
        <div className="space-y-4 p-4">
          {reviewsLoading ? (
            <p className="text-sm text-sand-500">Loading guest reviews…</p>
          ) : staffReviews.length === 0 ? (
            <p className="text-sm text-sand-500">No review comments recorded for this staff member.</p>
          ) : (
            <div className="space-y-3">
              {staffReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-xl border border-sand-200 bg-sand-50/50 p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-sand-900">{rev.rating} ★ Rating</span>
                    <span className="text-[11px] text-sand-500">{rev.when}</span>
                  </div>
                  {rev.comment && <p className="text-xs text-sand-700 italic">"{rev.comment}"</p>}
                  {rev.duringComplaint && (
                    <span className="inline-block rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                      Logged during service complaint
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
}
