"use client";

import React, { useMemo, useState } from "react";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Info,
  Sparkle,
  UserRound,
} from "lucide-react";

import { StaffingChart } from "@/components/charts/staffing-chart";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { PeriodSelect } from "@/components/ui/period-select";
import { useToast } from "@/components/ui/toast";
import {
  SHIFTS,
  WEEK,
  alerts,
  roster,
  shiftTone,
  staffing,
  type ShiftName,
} from "@/lib/demo/roster";
import { cn } from "@/lib/utils";

const WEEKS = [
  "17 Nov 2026 – 23 Nov 2026",
  "24 Nov 2026 – 30 Nov 2026",
  "1 Dec 2026 – 7 Dec 2026",
] as const;

const DEPARTMENT_OPTIONS = ["All Departments", ...staffing.map((row) => row.department)];

export default function RosterPage() {
  const { showToast } = useToast();

  const [week, setWeek] = useState<string>(WEEKS[0]);
  const [department, setDepartment] = useState<string>(DEPARTMENT_OPTIONS[0]);
  const [shift, setShift] = useState<string>(SHIFTS[0]);
  const [byPerson, setByPerson] = useState(false);

  const scheduledTotal = staffing.reduce((sum, row) => sum + row.scheduled, 0);
  const requiredTotal = staffing.reduce((sum, row) => sum + row.required, 0);
  const coverage = Math.round((scheduledTotal / requiredTotal) * 100);

  const visible = useMemo(
    () =>
      roster.filter((row) => department === "All Departments" || row.department === department),
    [department]
  );

  /** Count per department, for the label under each row name. */
  const counts = useMemo(
    () => new Map(staffing.map((row) => [row.department, row])),
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Roster"
        description="Plan the right people, in the right place, at the right time."
        actions={
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-sand-200 bg-white p-2 text-sand-500 transition-colors hover:bg-sand-50"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 rounded-xl border border-sand-200 bg-white py-1 pl-3 pr-1">
              <CalendarRange className="h-4 w-4 shrink-0 text-sand-500" />
              <PeriodSelect
                value={week}
                onChange={setWeek}
                options={WEEKS}
                className="[&>select]:border-0 [&>select]:bg-transparent"
              />
            </div>
            <Button
              size="sm"
              onClick={() =>
                showToast({
                  title: "Roster generated",
                  description:
                    "Solver filled 4 unassigned shifts within leave and rest-period rules. Review before publishing.",
                  type: "success",
                })
              }
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Generate Roster
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <Panel>
          <PanelHeader
            title="Staffing Overview"
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
            <StaffingChart data={staffing} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Alerts & Insights"
            action={
              <button className="pt-1 text-xs font-medium text-sage-700 hover:text-sage-900">
                View all
              </button>
            }
          />
          <PanelBody className="space-y-3 pt-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3.5",
                  alert.severity === "warning"
                    ? "border-gold-200 bg-gold-50/50"
                    : "border-sage-200 bg-sage-50/50"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                    alert.severity === "warning"
                      ? "bg-gold-100 text-gold-800"
                      : "bg-sage-100 text-sage-800"
                  )}
                >
                  {alert.severity === "warning" ? (
                    <CircleAlert className="h-3.5 w-3.5" />
                  ) : (
                    <Info className="h-3.5 w-3.5" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug text-sand-950">{alert.title}</p>
                  <p className="mt-0.5 text-xs text-sand-600">{alert.detail}</p>
                </div>

                {alert.severity === "warning" && (
                  <button
                    onClick={() =>
                      showToast({
                        title: alert.title,
                        description:
                          "Opening the gap against forecast demand and available staff.",
                        type: "default",
                      })
                    }
                    className="shrink-0 rounded-lg bg-gold-100 px-3 py-1 text-xs font-medium text-gold-900 transition-colors hover:bg-gold-200"
                  >
                    Review
                  </button>
                )}
              </div>
            ))}

            <div className="rounded-xl border border-sand-200 bg-sand-50/60 p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-sand-600">Coverage this week</span>
                <span className="font-sans text-lg font-semibold text-sand-950 tabular-nums">{coverage}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand-200">
                <div
                  className={cn(
                    "h-full rounded-full",
                    coverage >= 98 ? "bg-sage-600" : coverage >= 90 ? "bg-gold-500" : "bg-rose-400"
                  )}
                  style={{ width: `${coverage}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-sand-500">
                {scheduledTotal} scheduled against {requiredTotal} required
              </p>
            </div>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Weekly Roster"
          action={
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <PeriodSelect value={department} onChange={setDepartment} options={DEPARTMENT_OPTIONS} />
              <PeriodSelect value={shift} onChange={setShift} options={SHIFTS} />
              <button
                onClick={() => setByPerson((current) => !current)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  byPerson
                    ? "border-sage-600 bg-sage-600 text-white"
                    : "border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
                )}
              >
                <UserRound className="h-3.5 w-3.5" />
                View by Person
              </button>
            </div>
          }
        />

        <PanelBody className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-44 px-2 pb-2 text-left text-xs font-medium text-sand-500">
                    Department
                  </th>
                  {WEEK.map((day) => (
                    <th key={day.label} className="min-w-[130px] px-2 pb-2 text-center">
                      <span className="block text-sm font-semibold text-sand-900">{day.label}</span>
                      <span className="block text-xs text-sand-500">{day.date}</span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {visible.map((row) => {
                  const count = counts.get(row.department);
                  const short = count ? count.scheduled < count.required : false;

                  return (
                    <tr key={row.department}>
                      <th className="rounded-xl bg-sand-50/70 px-3 py-3 text-left align-middle">
                        <span className="block text-sm font-medium text-sand-950">
                          {row.department}
                        </span>
                        {count && (
                          <span
                            className={cn(
                              "block text-xs tabular-nums",
                              short ? "font-semibold text-rose-600" : "text-sand-500"
                            )}
                          >
                            {count.scheduled} / {count.required}
                          </span>
                        )}
                      </th>

                      {row.days.map((day, index) => {
                        // A shift filter hides cells that do not match rather than
                        // removing the row: the week's shape stays readable.
                        const dimmed = shift !== "All Shifts" && day.shift !== shift;

                        return (
                          <td key={index} className="align-middle">
                            <div
                              className={cn(
                                "rounded-xl border px-3 py-2.5 transition-opacity",
                                shiftTone[day.shift as ShiftName],
                                dimmed && "opacity-25"
                              )}
                            >
                              <span className="block text-xs font-medium">
                                {day.person === null ? "—" : day.shift}
                              </span>
                              <span
                                className={cn(
                                  "block truncate text-sm",
                                  day.person === null ? "font-medium" : "text-sand-800"
                                )}
                              >
                                {day.person ?? "Unassigned"}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-4 flex items-center gap-2 text-xs text-sand-500">
            <Sparkle className="h-3.5 w-3.5 text-sand-400" />
            Generated rosters respect leave, weekly rest periods and maximum consecutive
            nights. Unassigned shifts are left blank rather than filled with someone who
            would breach one.
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
