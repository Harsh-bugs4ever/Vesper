"use client";

import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarClock, CircleAlert, ListChecks, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { attendanceMeta, DEPARTMENTS, staff, type Department } from "@/lib/demo/staff";
import { cn } from "@/lib/utils";

type DeptFilter = Department | "all";

export default function StaffPage() {
  const { showToast } = useToast();
  const [department, setDepartment] = useState<DeptFilter>("all");

  const onShift = staff.filter((person) => person.state === "on_shift" || person.state === "on_break");
  const expected = staff.filter((person) => person.state !== "off_duty");
  const turnout = Math.round((onShift.length / expected.length) * 100);

  const tasksAssigned = staff.reduce((sum, person) => sum + person.tasksAssigned, 0);
  const tasksDone = staff.reduce((sum, person) => sum + person.tasksDone, 0);
  const flagged = staff.filter((person) => person.state === "late" || person.state === "absent");

  const visible = useMemo(
    () => (department === "all" ? staff : staff.filter((person) => person.department === department)),
    [department]
  );

  const byDepartment = useMemo(
    () =>
      DEPARTMENTS.map((dept) => {
        const people = staff.filter((person) => person.department === dept);
        const done = people.reduce((sum, person) => sum + person.tasksDone, 0);
        const assigned = people.reduce((sum, person) => sum + person.tasksAssigned, 0);
        return { dept, done, assigned, pct: assigned === 0 ? 0 : Math.round((done / assigned) * 100) };
      }),
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description="Attendance and task progress across every department on shift today."
        meta={format(new Date(), "EEE, d MMM yyyy")}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              showToast({
                title: "Shift handover exported",
                description: "Attendance and open tasks sent to the duty manager.",
                type: "success",
              })
            }
          >
            Export handover
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="On Duty"
          value={`${onShift.length} / ${expected.length}`}
          change={`${turnout}%`}
          comparison="turnout this shift"
          intent="neutral"
          tone="sage"
          icon={Users}
          trend={[8, 9, 10, 9, 10, 11, onShift.length]}
        />
        <StatTile
          label="Tasks Completed"
          value={`${tasksDone} / ${tasksAssigned}`}
          change={`${Math.round((tasksDone / tasksAssigned) * 100)}%`}
          comparison="of today's assignments"
          tone="forest"
          icon={ListChecks}
          trend={[21, 30, 39, 45, 52, 61, tasksDone]}
        />
        <StatTile
          label="Late or Absent"
          value={flagged.length}
          change={`+${flagged.length - 2}`}
          intent="bad"
          comparison="vs. yesterday"
          tone="rose"
          icon={CircleAlert}
          trend={[1, 2, 1, 3, 2, 2, flagged.length]}
        />
        <StatTile
          label="Next Shift Starts"
          value="14:00"
          change="9 staff"
          intent="neutral"
          comparison="evening shift rostered"
          tone="sand"
          icon={CalendarClock}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Team Attendance"
          description="Check-in times come from the QR post at the staff entrance."
        />
        <PanelBody className="space-y-4 pt-4">
          <FilterChips
            options={[
              { value: "all" as const, label: "All departments", count: staff.length },
              ...DEPARTMENTS.map((dept) => ({
                value: dept,
                label: dept,
                count: staff.filter((person) => person.department === dept).length,
              })),
            ]}
            value={department}
            onChange={(value) => setDepartment(value as DeptFilter)}
          />

          <Table>
            <THead>
              <tr>
                <TH>Staff</TH>
                <TH>Department</TH>
                <TH>Shift</TH>
                <TH align="right">Checked in</TH>
                <TH align="right">Tasks</TH>
                <TH align="right">Status</TH>
              </tr>
            </THead>
            <TBody>
              {visible.map((person) => (
                <TR key={person.id}>
                  <TD>
                    <span className="block font-medium text-sand-900">{person.name}</span>
                    <span className="block text-xs text-sand-500">{person.role}</span>
                  </TD>
                  <TD className="text-sand-600">{person.department}</TD>
                  <TD className="tabular-nums text-sand-600">{person.shift}</TD>
                  <TD align="right" className="text-sand-700">
                    {person.checkIn ?? "—"}
                  </TD>
                  <TD align="right" className="text-sand-700">
                    {person.tasksAssigned === 0
                      ? "—"
                      : `${person.tasksDone}/${person.tasksAssigned}`}
                  </TD>
                  <TD align="right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        attendanceMeta[person.state].chip
                      )}
                    >
                      <span
                        className={cn("h-1.5 w-1.5 rounded-full", attendanceMeta[person.state].dot)}
                      />
                      {attendanceMeta[person.state].label}
                    </span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Task Progress by Department"
          description="Completed against assigned for the current shift."
        />
        <PanelBody className="grid grid-cols-1 gap-5 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {byDepartment.map((row) => (
            <div key={row.dept}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-sand-900">{row.dept}</span>
                <span className="shrink-0 text-xs tabular-nums text-sand-500">
                  {row.done}/{row.assigned}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand-100">
                <div
                  className={cn(
                    "h-full rounded-full",
                    row.pct >= 75 ? "bg-sage-600" : row.pct >= 45 ? "bg-gold-500" : "bg-rose-400"
                  )}
                  style={{ width: `${row.pct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-sand-500">{row.pct}% complete</p>
            </div>
          ))}
        </PanelBody>
      </Panel>
    </div>
  );
}
