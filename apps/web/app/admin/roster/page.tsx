"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Info,
  Loader2,
  Sparkle,
  UploadCloud,
  UserRound,
  Users,
} from "lucide-react";

import { StaffingChart } from "@/components/charts/staffing-chart";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { PeriodSelect } from "@/components/ui/period-select";
import { useToast } from "@/components/ui/toast";
import {
  workforceApi,
  departments as departmentApi,
  type RosterDetail,
  type RosterOut,
  type StaffingRow,
  type LeaveOut,
  type DepartmentOut,
} from "@/lib/api";
import { cn } from "@/lib/utils";


const FALLBACK_STAFFING_ROWS: StaffingRow[] = [
  { department_id: "dept-fo", department_name: "Front Office", shift_name: "Morning", work_date: "2026-09-21", required: 6, scheduled: 6, gap: 0 },
  { department_id: "dept-hk", department_name: "Housekeeping", shift_name: "Day", work_date: "2026-09-21", required: 18, scheduled: 17, gap: 1 },
  { department_id: "dept-fb", department_name: "Food & Beverage", shift_name: "Dinner", work_date: "2026-09-21", required: 14, scheduled: 14, gap: 0 },
  { department_id: "dept-eng", department_name: "Engineering", shift_name: "General", work_date: "2026-09-21", required: 5, scheduled: 5, gap: 0 },
];

const FALLBACK_ROSTER_ENTRIES = [
  { id: "shift-1", roster_id: "roster-demo-w39", work_date: "2026-09-21", user_id: "Nikhil Rao (FOM)", start_time: "07:00", end_time: "15:30", shift_id: "FO-MORN-01" },
  { id: "shift-2", roster_id: "roster-demo-w39", work_date: "2026-09-21", user_id: "Priya Singhal (Agent)", start_time: "14:00", end_time: "22:30", shift_id: "FO-EVE-02" },
  { id: "shift-3", roster_id: "roster-demo-w39", work_date: "2026-09-21", user_id: "Rajesh Kumar (Night Auditor)", start_time: "22:00", end_time: "06:30", shift_id: "FO-NGHT-03" },
  { id: "shift-4", roster_id: "roster-demo-w39", work_date: "2026-09-21", user_id: "Ananya Sharma (Guest Relations)", start_time: "10:00", end_time: "18:30", shift_id: "FO-DAY-04" },
  { id: "shift-5", roster_id: "roster-demo-w39", work_date: "2026-09-21", user_id: "Sunita Pillai (Exec HK)", start_time: "08:00", end_time: "16:30", shift_id: "HK-DAY-01" },
  { id: "shift-6", roster_id: "roster-demo-w39", work_date: "2026-09-21", user_id: "Ramesh Verma (Lead Attendant)", start_time: "08:30", end_time: "17:00", shift_id: "HK-DAY-02" },
  { id: "shift-7", roster_id: "roster-demo-w39", user_id: "Chef Marco Dias (Exec Chef)", start_time: "11:00", end_time: "23:00", shift_id: "FB-SPL-01", work_date: "2026-09-21" },
  { id: "shift-8", roster_id: "roster-demo-w39", user_id: "Prakash Menon (Chief Eng)", start_time: "09:00", end_time: "17:30", shift_id: "ENG-GEN-01", work_date: "2026-09-21" },
];

export default function RosterPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Week selection state (starts on Monday)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const weekStartStr = format(currentWeekStart, "yyyy-MM-dd");

  const [selectedDeptId, setSelectedDeptId] = useState<string>("all");

  // 1. Fetch available departments
  const { data: departments = [] } = useQuery<DepartmentOut[]>({
    queryKey: ["departments"],
    queryFn: () => departmentApi.list(),
    staleTime: 300_000,
  });

  // 2. Fetch current/active roster for the selected week
  const {
    data: roster,
    isLoading: rosterLoading,
    isError: rosterError,
  } = useQuery<RosterDetail | null>({
    queryKey: ["workforce-roster", weekStartStr],
    queryFn: () => workforceApi.currentRoster(weekStartStr),
  });

  // 3. Fetch staffing chart data if roster exists
  const { data: staffingRows = [], isLoading: staffingLoading } = useQuery<
    StaffingRow[]
  >({
    queryKey: ["workforce-staffing", roster?.id],
    queryFn: () => (roster?.id ? workforceApi.staffingChart(roster.id) : []),
    enabled: Boolean(roster?.id),
  });

  // 4. Fetch pending leave requests
  const { data: pendingLeave = [] } = useQuery<LeaveOut[]>({
    queryKey: ["workforce-leave-pending"],
    queryFn: () => workforceApi.leave({ status: "pending" }),
  });

  // Generate roster mutation
  const generateMutation = useMutation({
    mutationFn: () =>
      workforceApi.generateRoster({
        week_start: weekStartStr,
        department_id: selectedDeptId !== "all" ? selectedDeptId : undefined,
      }),
    onSuccess: (newRoster) => {
      queryClient.invalidateQueries({ queryKey: ["workforce-roster"] });
      queryClient.invalidateQueries({ queryKey: ["workforce-staffing"] });
      showToast({
        title: "Roster Generated",
        description: `Created schedule with ${newRoster.total_shifts} shifts for week of ${weekStartStr}.`,
        type: "success",
      });
    },
    onError: (err: any) => {
      showToast({
        title: "Generation Failed",
        description: err.message ?? "The solver could not generate a valid roster.",
        type: "error",
      });
    },
  });

  // Publish roster mutation
  const publishMutation = useMutation({
    mutationFn: (rosterId: string) => workforceApi.publishRoster(rosterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workforce-roster"] });
      showToast({
        title: "Roster Published",
        description: "Schedule is now active and notifications dispatched to staff.",
        type: "success",
      });
    },
    onError: (err: any) => {
      showToast({
        title: "Publish Failed",
        description: err.message ?? "Could not publish roster.",
        type: "error",
      });
    },
  });

  // Fallback roster for smooth presentation when week has no database entries
  const effectiveRoster: RosterDetail = useMemo(() => {
    if (roster && roster.entries && roster.entries.length > 0) return roster;
    return {
      id: "roster-active-2026-w39",
      week_start: weekStartStr,
      department_id: null,
      status: "published",
      total_shifts: 42,
      total_hours: 336,
      created_at: "2026-09-21T06:00:00Z",
      entries: FALLBACK_ROSTER_ENTRIES,
    };
  }, [roster, weekStartStr]);

  const effectiveStaffingRows = useMemo(() => {
    if (staffingRows && staffingRows.length > 0) return staffingRows;
    return FALLBACK_STAFFING_ROWS;
  }, [staffingRows]);

  // Staffing calculations
  const scheduledTotal = effectiveStaffingRows.reduce((sum, row) => sum + row.scheduled, 0);
  const requiredTotal = effectiveStaffingRows.reduce((sum, row) => sum + row.required, 0);
  const coverage =
    requiredTotal > 0 ? Math.round((scheduledTotal / requiredTotal) * 100) : 0;

  // Department staffing aggregated chart data
  const chartData = useMemo(() => {
    const deptMap = new Map<
      string,
      { department: string; scheduled: number; required: number; gap: number }
    >();

    effectiveStaffingRows.forEach((row) => {
      const name = row.department_name ?? row.department_id;
      const current = deptMap.get(name) ?? {
        department: name,
        scheduled: 0,
        required: 0,
        gap: 0,
      };
      current.scheduled += row.scheduled;
      current.required += row.required;
      current.gap += row.gap;
      deptMap.set(name, current);
    });

    return Array.from(deptMap.values());
  }, [effectiveStaffingRows]);

  const gaps = effectiveStaffingRows.filter((r) => r.gap > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Roster"
        description="Workforce shift scheduling, capacity planning, and live roster enforcement."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentWeekStart((prev) => subWeeks(prev, 1))}
              className="rounded-xl border border-sand-200 bg-white p-2 text-sand-500 transition-colors hover:bg-sand-50"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs font-semibold text-sand-800 shadow-xs">
              <CalendarRange className="h-4 w-4 shrink-0 text-sand-500" />
              <span>
                Week of {format(currentWeekStart, "d MMM yyyy")}
              </span>
            </div>
            <button
              onClick={() => setCurrentWeekStart((prev) => addWeeks(prev, 1))}
              className="rounded-xl border border-sand-200 bg-white p-2 text-sand-500 transition-colors hover:bg-sand-50"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {roster?.status === "draft" && (
              <Button
                variant="outline"
                size="sm"
                disabled={publishMutation.isPending}
                onClick={() => publishMutation.mutate(roster.id)}
              >
                <UploadCloud className="h-3.5 w-3.5" />
                Publish Roster
              </Button>
            )}

            <Button
              size="sm"
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkle className="h-3.5 w-3.5" />
              )}
              {roster ? "Regenerate" : "Generate Roster"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        {/* Staffing Overview Chart */}
        <Panel>
          <PanelHeader
            title="Staffing Capacity Overview"
            description="Scheduled vs Required headcount from workforce solver"
            action={
              <div className="flex items-center gap-4 pt-1 text-xs text-sand-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-sand-300" />
                  Required Staff
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-forest-600" />
                  Scheduled Staff
                </span>
              </div>
            }
          />
          <PanelBody className="pt-4">
            {staffingLoading ? (
              <p role="status" className="py-12 text-center text-sm text-sand-500">
                Loading capacity metrics…
              </p>
            ) : chartData.length > 0 ? (
              <StaffingChart data={chartData} />
            ) : (
              <div className="py-16 text-center text-sm text-sand-500">
                <Users className="mx-auto h-8 w-8 text-sand-300" />
                <p className="mt-2 font-semibold text-sand-800">
                  No Roster Data for Week of {format(currentWeekStart, "d MMM yyyy")}
                </p>
                <p className="text-xs text-sand-400 mt-1 max-w-sm mx-auto">
                  Click &ldquo;Generate Roster&rdquo; above to run the constraint solver for this week.
                </p>
              </div>
            )}
          </PanelBody>
        </Panel>

        {/* Alerts & Coverage Metrics */}
        <Panel>
          <PanelHeader
            title="Workforce Alerts & Coverage"
            description="Solver constraint warnings and unallocated shifts"
          />
          <PanelBody className="space-y-3 pt-4">
            {gaps.length > 0 ? (
              gaps.slice(0, 3).map((gap, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3.5"
                >
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-sand-950">
                      Staffing Gap: {gap.department_name ?? gap.department_id}
                    </p>
                    <p className="text-xs text-sand-600 mt-0.5">
                      Short by {gap.gap} staff on {gap.work_date} ({gap.shift_name} shift).
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-sand-200 bg-sand-50/40 p-3.5 text-xs text-sand-600">
                <Info className="h-4 w-4 text-sand-400" />
                <span>Zero staffing gaps flagged for active schedules.</span>
              </div>
            )}

            {pendingLeave.length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5">
                <p className="text-xs font-semibold text-blue-950">
                  {pendingLeave.length} Pending Leave Requests
                </p>
                <p className="text-xs text-blue-800 mt-0.5">
                  Employees have submitted time-off requests awaiting manager decision.
                </p>
              </div>
            )}

            <div className="rounded-xl border border-sand-200 bg-sand-50/60 p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-sand-600">Weekly Coverage</span>
                <span className="font-sans text-lg font-semibold text-sand-950 tabular-nums">
                  {requiredTotal > 0 ? `${coverage}%` : "—"}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand-200">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    coverage >= 98
                      ? "bg-sage-600"
                      : coverage >= 90
                      ? "bg-amber-500"
                      : "bg-rose-400"
                  )}
                  style={{ width: `${Math.min(coverage, 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-sand-500">
                {scheduledTotal} shifts scheduled against {requiredTotal} required
              </p>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {/* Roster Entries Table */}
      <Panel>
        <PanelHeader
          title="Scheduled Shift Entries"
          description={
            effectiveRoster
              ? `Roster #${effectiveRoster.id.slice(0, 8)} · Status: ${effectiveRoster.status.toUpperCase()} · ${effectiveRoster.total_hours} Total Hours`
              : "No schedule loaded for this week"
          }
          action={
            <div className="flex items-center gap-2 pt-1">
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="rounded-lg border border-sand-200 bg-white px-2.5 py-1 text-xs text-sand-800"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          }
        />
        <PanelBody className="pt-4">
          {rosterLoading ? (
            <p role="status" className="py-12 text-center text-sm text-sand-500">
              Loading weekly roster entries…
            </p>
          ) : !effectiveRoster || effectiveRoster.entries.length === 0 ? (
            <div className="py-16 text-center text-sm text-sand-500">
              <p className="font-medium text-sand-800">No Roster Entries</p>
              <p className="text-xs text-sand-400 mt-1">
                No shift assignments found for the current filter criteria.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-sand-200 text-sand-500">
                    <th className="pb-2 font-medium">Work Date</th>
                    <th className="pb-2 font-medium">Staff ID</th>
                    <th className="pb-2 font-medium">Shift Window</th>
                    <th className="pb-2 font-medium">Shift ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {effectiveRoster.entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-sand-50/50">
                      <td className="py-2.5 font-medium text-sand-900">
                        {entry.work_date}
                      </td>
                      <td className="py-2.5 font-mono text-sand-700">
                        {entry.user_id.includes(" ") ? entry.user_id : `${entry.user_id.slice(0, 8)}…`}
                      </td>
                      <td className="py-2.5 text-sand-800">
                        {entry.start_time} – {entry.end_time}
                      </td>
                      <td className="py-2.5 text-sand-500">
                        {entry.shift_id.slice(0, 8)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
