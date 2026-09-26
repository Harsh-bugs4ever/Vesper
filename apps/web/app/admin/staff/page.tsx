"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";

type Task = { id: string; title: string; status: string; priority: string; assignee_id: string | null; department_id: string; is_overdue: boolean };
type TaskBoard = { counts: Record<string, number>; overdue: number; tasks: Task[] };
type Progress = { open_tasks: number; in_progress: number; done_today: number; overdue: number };
type Attendance = { expected: number; present: number; late: number; absent: number; still_on_shift: number };
type Person = { id: string; full_name: string; department_id: string | null; is_active: boolean };
const message = (error: unknown) => error instanceof ApiError && error.status === 403 ? "Access denied for this department." : error instanceof Error ? error.message : "Data unavailable.";

export default function ManagerStaffPage() {
  const { user, hasPermission } = useAuth();
  const client = useQueryClient();
  const { showToast } = useToast();
  const [assignees, setAssignees] = useState<Record<string, string>>({});
  const departmentId = user?.departmentId;
  const scope = [user?.propertyId, user?.id, departmentId];
  const canManage = hasPermission("tasks:assign");
  const tasks = useQuery({ queryKey: ["phase3", "manager-tasks", ...scope], queryFn: () => api.get<TaskBoard>("/tasks", { department_id: departmentId }), enabled: Boolean(user && canManage) });
  const progress = useQuery({ queryKey: ["phase3", "manager-progress", ...scope], queryFn: () => api.get<Progress>(`/tasks/progress/${departmentId}`), enabled: Boolean(user && canManage && departmentId) });
  const attendance = useQuery({ queryKey: ["phase3", "team-attendance", ...scope], queryFn: () => api.get<Attendance>("/attendance/team", { department_id: departmentId }), enabled: Boolean(user && departmentId && hasPermission("attendance:read_team")) });
  const people = useQuery({ queryKey: ["phase3", "assignees", ...scope], queryFn: () => api.get<Person[]>("/admin/users", { department_id: departmentId }), enabled: Boolean(user && departmentId && hasPermission("users:read")) });
  const assign = useMutation({ mutationFn: ({ taskId, assigneeId }: { taskId: string; assigneeId: string }) => api.put<Task>(`/tasks/${taskId}/assignee`, { assignee_id: assigneeId }), onSuccess: () => { void client.invalidateQueries({ queryKey: ["phase3"] }); showToast({ title: "Assignment saved", description: "The server updated the task.", type: "success" }); }, onError: (error) => showToast({ title: "Assignment failed", description: message(error), type: "error" }) });
  if (!user || !canManage) return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6">Manager task access is unavailable for this account.</div>;
  return <div className="space-y-6"><PageHeader title="Team operations" description={`Live work and attendance${user.department ? ` · ${user.department}` : ""}`} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{([ ["Open tasks", progress.data?.open_tasks], ["In progress", progress.data?.in_progress], ["Done today", progress.data?.done_today], ["Overdue", progress.data?.overdue] ] as const).map(([label, value]) => <div key={label} className="rounded-xl border border-sand-200 bg-white p-5"><p className="text-sm text-sand-600">{label}</p><p className="mt-2 font-serif text-3xl">{value ?? "—"}</p></div>)}</div>
    {progress.isPending && <p role="status">Loading progress…</p>}{progress.isError && <p role="alert" className="text-rose-700">{message(progress.error)}</p>}
    <Panel><PanelBody className="space-y-3 p-5"><h2 className="font-serif text-xl">Department work</h2>{tasks.isPending ? <p role="status">Loading tasks…</p> : tasks.isError ? <p role="alert" className="text-rose-700">{message(tasks.error)}</p> : tasks.data?.tasks.length === 0 ? <p>No department tasks returned.</p> : tasks.data?.tasks.map((task) => <article key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sand-200 p-4"><div><p className="font-semibold">{task.title}</p><p className="text-xs text-sand-600">{task.status} · {task.priority}{task.is_overdue ? " · Overdue" : ""}</p></div><div className="flex items-center gap-2"><label className="text-xs">Assign to <select aria-label={`Assign ${task.title}`} value={assignees[task.id] ?? task.assignee_id ?? ""} onChange={(event) => setAssignees((current) => ({ ...current, [task.id]: event.target.value }))} disabled={!people.data} className="ml-1 rounded-lg border p-2"><option value="">Select staff</option>{people.data?.filter((person) => person.is_active && person.department_id === task.department_id).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label><Button disabled={!assignees[task.id] || assign.isPending} onClick={() => assign.mutate({ taskId: task.id, assigneeId: assignees[task.id] })}>Save</Button></div></article>)}{!hasPermission("users:read") && <p className="text-sm text-sand-500">Staff assignment requires users:read to list eligible assignees.</p>}{people.isError && <p role="alert" className="text-rose-700">Eligible staff unavailable: {message(people.error)}</p>}</PanelBody></Panel>
    <Panel><PanelBody className="space-y-2 p-5"><h2 className="font-serif text-xl">Team attendance</h2>{attendance.isPending && attendance.fetchStatus !== "idle" ? <p role="status">Loading attendance…</p> : attendance.isError ? <p role="alert" className="text-rose-700">{message(attendance.error)}</p> : attendance.data ? <p>Present {attendance.data.present} · Late {attendance.data.late} · Still on shift {attendance.data.still_on_shift}</p> : <p>Attendance unavailable for this department.</p>}</PanelBody></Panel>
    <Panel><PanelBody className="p-5"><h2 className="font-serif text-xl">Staff reports and approvals</h2><p className="mt-2 text-sm text-sand-600">Unavailable: the backend does not provide staff-report submission, review or approval endpoints.</p></PanelBody></Panel>
  </div>;
}
