"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";

type Task = { id: string; title: string; description: string | null; department_id: string; assignee_id: string | null; status: string; priority: string; due_at: string | null; is_overdue: boolean };
type TaskBoard = { counts: Record<string, number>; overdue: number; tasks: Task[] };
type Attendance = { id: string; checked_in_at: string; checked_out_at: string | null; work_date: string; worked_minutes: number };
type Room = { id: string; number: string; status: string };

function failure(error: unknown) {
  if (error instanceof ApiError && error.status === 403) return "Access denied by the backend for this department or action.";
  return error instanceof Error ? error.message : "The request failed.";
}

export function LiveStaff() {
  const { user, hasPermission } = useAuth();
  const client = useQueryClient();
  const { showToast } = useToast();
  const [tab, setTab] = useState<"mine" | "pool" | "attendance" | "report">("mine");
  const [summary, setSummary] = useState("");
  const [roomId, setRoomId] = useState("");
  const scope = [user?.propertyId, user?.id, user?.departmentId];
  const canRead = Boolean(user && hasPermission("tasks:read"));
  const mine = useQuery({ queryKey: ["phase3", "mine", ...scope], queryFn: () => api.get<Task[]>("/tasks/mine", { include_done: true }), enabled: canRead });
  const pool = useQuery({ queryKey: ["phase3", "pool", ...scope], queryFn: () => api.get<TaskBoard>("/tasks", { status: "open" }), enabled: canRead });
  const attendance = useQuery({ queryKey: ["phase3", "attendance", ...scope], queryFn: () => api.get<Attendance[]>("/attendance/me", { days: 14 }), enabled: Boolean(user) });
  const rooms = useQuery({ queryKey: ["phase3", "rooms", ...scope], queryFn: () => api.get<Room[]>("/rooms"), enabled: Boolean(user && hasPermission("issues:write")) });
  const refresh = () => client.invalidateQueries({ queryKey: ["phase3"] });
  const taskAction = useMutation({ mutationFn: ({ id, action }: { id: string; action: "claim" | "in_progress" | "done" }) => action === "claim" ? api.post<Task>(`/tasks/${id}/claim`) : api.put<Task>(`/tasks/${id}/status`, { status: action }), onSuccess: () => { void refresh(); showToast({ title: "Task updated", description: "The server saved the change.", type: "success" }); }, onError: (error) => showToast({ title: "Task update failed", description: failure(error), type: "error" }) });
  const attendanceAction = useMutation({ mutationFn: (action: "in" | "out") => action === "in" ? api.post<Attendance>("/attendance/check-in", { method: "qr" }) : api.post<Attendance>("/attendance/check-out", {}), onSuccess: () => { void refresh(); showToast({ title: "Attendance saved", description: "The server recorded your attendance.", type: "success" }); }, onError: (error) => showToast({ title: "Attendance failed", description: failure(error), type: "error" }) });
  const issueAction = useMutation({ mutationFn: () => api.post("/issues", { summary: summary.trim(), room_id: roomId || null }), onSuccess: () => { setSummary(""); setRoomId(""); void refresh(); showToast({ title: "Defect reported", description: "The server recorded the issue.", type: "success" }); }, onError: (error) => showToast({ title: "Report failed", description: failure(error), type: "error" }) });
  const onDuty = attendance.data?.some((row) => !row.checked_out_at);
  const claimable = pool.data?.tasks.filter((task) => !task.assignee_id) ?? [];

  if (!user || !canRead) return <div role="alert" className="m-6 rounded-xl border border-amber-200 bg-amber-50 p-5">Your account does not have access to staff tasks.</div>;
  return <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
    <PageHeader title={`Welcome, ${user.name}`} description={[user.roleTitle, user.department].filter(Boolean).join(" · ")} />
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Staff workspace">{([ ["mine", "My tasks"], ["pool", "Claimable work"], ["attendance", "Attendance"], ["report", "Report defect"] ] as const).map(([key, label]) => <Button key={key} variant={tab === key ? "default" : "outline"} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</Button>)}</div>
    {tab === "mine" && <Panel><PanelBody className="space-y-3 p-5"><h2 className="font-serif text-xl">My tasks</h2>{mine.isPending ? <p role="status">Loading tasks…</p> : mine.isError ? <p role="alert" className="text-rose-700">{failure(mine.error)}</p> : mine.data?.length === 0 ? <p>No tasks assigned.</p> : mine.data?.map((task) => <article key={task.id} className="rounded-xl border border-sand-200 p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{task.title}</h3><p className="text-sm text-sand-600">{task.description}</p><p className="text-xs">{task.status} · {task.priority}{task.due_at ? ` · Due ${new Date(task.due_at).toLocaleString()}` : ""}{task.is_overdue ? " · Overdue" : ""}</p></div><div className="flex gap-2">{["open", "assigned"].includes(task.status) && <Button disabled={!hasPermission("tasks:complete") || taskAction.isPending} onClick={() => taskAction.mutate({ id: task.id, action: "in_progress" })}>Start</Button>}{task.status === "in_progress" && <Button disabled={!hasPermission("tasks:complete") || taskAction.isPending} onClick={() => taskAction.mutate({ id: task.id, action: "done" })}>Complete</Button>}</div></div></article>)}</PanelBody></Panel>}
    {tab === "pool" && <Panel><PanelBody className="space-y-3 p-5"><h2 className="font-serif text-xl">Claimable work</h2>{pool.isPending ? <p role="status">Loading work…</p> : pool.isError ? <p role="alert" className="text-rose-700">{failure(pool.error)}</p> : claimable.length === 0 ? <p>No claimable tasks returned for your department.</p> : claimable.map((task) => <article key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sand-200 p-4"><span>{task.title}</span><Button disabled={taskAction.isPending} onClick={() => taskAction.mutate({ id: task.id, action: "claim" })}>Claim</Button></article>)}</PanelBody></Panel>}
    {tab === "attendance" && <Panel><PanelBody className="space-y-4 p-5"><h2 className="font-serif text-xl">Attendance</h2>{attendance.isPending ? <p role="status">Loading attendance…</p> : attendance.isError ? <p role="alert" className="text-rose-700">{failure(attendance.error)}</p> : <><p>{attendance.data?.length ? (onDuty ? "On shift" : "Off duty") : "No attendance records returned."}</p><Button disabled={!hasPermission("attendance:mark") || attendanceAction.isPending} onClick={() => attendanceAction.mutate(onDuty ? "out" : "in")}>{onDuty ? "Check out" : "Check in"}</Button><ul>{attendance.data?.map((row) => <li key={row.id} className="border-b py-2 text-sm">{row.work_date}: {new Date(row.checked_in_at).toLocaleTimeString()} – {row.checked_out_at ? new Date(row.checked_out_at).toLocaleTimeString() : "on shift"}</li>)}</ul></>}</PanelBody></Panel>}
    {tab === "report" && <Panel><PanelBody className="space-y-4 p-5"><h2 className="font-serif text-xl">Report a room defect</h2>{!hasPermission("issues:write") ? <p role="alert">Your role cannot submit issue reports.</p> : <form onSubmit={(event) => { event.preventDefault(); issueAction.mutate(); }} className="space-y-3"><label className="block text-sm">Room<select value={roomId} onChange={(event) => setRoomId(event.target.value)} className="mt-1 block w-full rounded-lg border p-2"><option value="">No room</option>{rooms.data?.map((room) => <option key={room.id} value={room.id}>{room.number} · {room.status}</option>)}</select></label>{rooms.isError && <p role="alert" className="text-rose-700">{failure(rooms.error)}</p>}<label className="block text-sm">Defect summary<input required minLength={3} maxLength={160} value={summary} onChange={(event) => setSummary(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label><Button type="submit" disabled={issueAction.isPending || summary.trim().length < 3 || rooms.isError}>Submit report</Button></form>}<p className="text-sm text-sand-500">Staff report submission is unavailable until the backend provides a staff-report endpoint.</p></PanelBody></Panel>}
  </div>;
}
