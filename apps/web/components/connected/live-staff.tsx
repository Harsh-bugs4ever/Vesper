"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";

type Task = { id: string; title: string; description: string | null; status: string; priority: string; due_at: string | null; is_overdue: boolean };
type Attendance = { id: string; work_date: string; checked_in_at: string; checked_out_at: string | null; worked_minutes: number };

export function LiveStaff() {
  const { user, hasPermission } = useAuth();
  const client = useQueryClient();
  const key = ["staff-tasks", user.propertyId, user.id];
  const tasks = useQuery({ queryKey: key, queryFn: () => api.get<Task[]>("/tasks/mine", { include_done: true }), refetchInterval: 30_000 });
  const attendance = useQuery({ queryKey: ["staff-attendance", user.id], queryFn: () => api.get<Attendance[]>("/attendance/me", { days: 14 }) });
  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "claim" | "in_progress" | "done" }) => action === "claim" ? api.post<Task>(`/tasks/${id}/claim`) : api.put<Task>(`/tasks/${id}/status`, { status: action }),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  const current = tasks.data ?? [];

  return <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
    <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description="Your assigned work and recent attendance from the resort system." actions={<button type="button" onClick={() => { tasks.refetch(); attendance.refetch(); }} className="rounded-lg border border-sand-200 px-4 py-2 text-sm">Refresh</button>} />
    <div className="grid gap-4 sm:grid-cols-3">{[["Open tasks", current.filter((task) => !["done", "cancelled"].includes(task.status)).length], ["Overdue", current.filter((task) => task.is_overdue && task.status !== "done").length], ["Completed", current.filter((task) => task.status === "done").length]].map(([label, count]) => <div key={label} className="rounded-xl border border-sand-200 bg-white p-5"><p className="text-sm text-sage-700">{label}</p><p className="mt-2 font-serif text-3xl text-sage-950">{count}</p></div>)}</div>
    <Panel><PanelBody className="p-5 sm:p-6"><h2 className="font-serif text-2xl text-sage-950">My tasks</h2>
      {tasks.isPending ? <p role="status" className="py-8 text-sm">Loading tasks…</p> : tasks.isError ? <p role="alert" className="py-8 text-sm text-rose-700">{tasks.error instanceof Error ? tasks.error.message : "Could not load tasks."}</p> : current.length === 0 ? <p className="py-8 text-sm text-sage-700">No tasks assigned right now.</p> : <ul className="mt-4 space-y-3">{current.map((task) => <li key={task.id} className={`rounded-xl border p-4 ${task.is_overdue && task.status !== "done" ? "border-rose-200 bg-rose-50" : "border-sand-200"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-sage-950">{task.title}</p>{task.description && <p className="mt-1 text-sm text-sage-700">{task.description}</p>}<p className="mt-2 text-xs capitalize text-sage-600">{task.priority} priority · {task.status.replaceAll("_", " ")}{task.due_at ? ` · Due ${new Date(task.due_at).toLocaleString("en-IN")}` : ""}</p></div><div className="flex gap-2">{["open", "assigned"].includes(task.status) && hasPermission("tasks:complete") && <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: task.id, action: "in_progress" })} className="rounded-lg bg-sage-700 px-3 py-2 text-xs text-white disabled:opacity-50">Start</button>}{task.status === "in_progress" && hasPermission("tasks:complete") && <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: task.id, action: "done" })} className="rounded-lg bg-sage-700 px-3 py-2 text-xs text-white disabled:opacity-50">Complete</button>}</div></div></li>)}</ul>}
      {mutation.isError && <p role="alert" className="mt-4 text-sm text-rose-700">{mutation.error instanceof Error ? mutation.error.message : "Could not update task."}</p>}
    </PanelBody></Panel>
    <Panel><PanelBody className="p-5 sm:p-6"><h2 className="font-serif text-2xl text-sage-950">Recent attendance</h2><p className="mt-1 text-xs text-sage-600">Check-in requires the signed wall QR or an approved location fix.</p>{attendance.isPending ? <p role="status" className="py-8 text-sm">Loading attendance…</p> : attendance.isError ? <p role="alert" className="py-8 text-sm text-rose-700">{attendance.error instanceof Error ? attendance.error.message : "Could not load attendance."}</p> : attendance.data?.length ? <ul className="mt-4 divide-y divide-sand-200">{attendance.data.map((record) => <li key={record.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><span>{new Date(`${record.work_date}T00:00:00`).toLocaleDateString("en-IN")}</span><span>{new Date(record.checked_in_at).toLocaleTimeString("en-IN")} – {record.checked_out_at ? new Date(record.checked_out_at).toLocaleTimeString("en-IN") : "On shift"}</span><span>{(record.worked_minutes / 60).toFixed(1)} hours</span></li>)}</ul> : <p className="py-8 text-sm text-sage-700">No attendance records in the last 14 days.</p>}</PanelBody></Panel>
  </div>;
}
