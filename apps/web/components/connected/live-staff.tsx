"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { StaffRequisitions } from "@/components/connected/staff-requisitions";
import { StaffTaskLocation, type TaskLocation } from "@/components/connected/staff-task-location";

type Task = {
  id: string; title: string; description: string | null; assignee_id: string | null;
  room_id: string | null;
  status: string; priority: string; source: string; due_at: string | null; is_overdue: boolean;
  meta: Record<string, unknown>;
};
type Board = { tasks: Task[]; overdue: number };
type Attendance = { id: string; checked_in_at: string; checked_out_at: string | null; work_date: string; is_late: boolean };
type Room = { id: string; number: string };
type Tab = "mine" | "pool" | "attendance" | "report" | "requisitions";

function failure(error: unknown) {
  if (error instanceof ApiError && error.status === 409) return `${error.message} Refresh the queue to see its latest state.`;
  return error instanceof Error ? error.message : "The request failed.";
}

function TaskCard({ task, label, onAction, onShowLocation, busy, locationSelected }: { task: Task; label?: string; onAction?: () => void; onShowLocation?: () => void; busy: boolean; locationSelected?: boolean }) {
  const items = Array.isArray(task.meta?.items) ? task.meta.items : [];
  return <article className="rounded-xl border border-sand-200 bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h3 className="font-semibold">{task.title}</h3>
        {task.description && <p className="text-sm text-sand-700">{task.description}</p>}
        {items.length > 0 && <p className="text-sm text-sand-600">{items.length} requested item{items.length === 1 ? "" : "s"}</p>}
        <p className="text-xs text-sand-600">{task.source.replaceAll("_", " ")} · {task.priority} priority · {task.status.replaceAll("_", " ")}</p>
        {task.due_at && <p className={`text-xs ${task.is_overdue ? "font-semibold text-rose-700" : "text-sand-600"}`}>{task.is_overdue ? "Overdue · " : "Due "}{new Date(task.due_at).toLocaleString()}</p>}
        {task.room_id && onShowLocation && <button type="button" onClick={onShowLocation} aria-pressed={locationSelected} className="min-h-11 text-sm font-medium text-sage-800 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sage-700">{locationSelected ? "Location shown" : "Show room location"}</button>}
      </div>
      {label && onAction && <Button disabled={busy} onClick={onAction}>{label}</Button>}
    </div>
  </article>;
}

export function LiveStaff() {
  const { user, hasPermission } = useAuth();
  const client = useQueryClient();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("mine");
  const [category, setCategory] = useState<"room_defect" | "supplies" | "general">("room_defect");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [roomId, setRoomId] = useState("");
  const [severity, setSeverity] = useState<"low" | "normal" | "high">("normal");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const scope = [user?.propertyId, user?.id, user?.departmentId];
  const canRead = Boolean(user && hasPermission("tasks:read"));
  const canClaim = hasPermission("tasks:pool_read");
  const mine = useQuery({ queryKey: ["staff", "mine", ...scope], queryFn: () => api.get<Task[]>("/tasks/mine", { include_done: true }), enabled: canRead, refetchInterval: 15000 });
  const pool = useQuery({ queryKey: ["staff", "pool", ...scope], queryFn: () => api.get<Board>("/tasks", { status: "open", department_id: user?.departmentId }), enabled: canRead && canClaim, refetchInterval: 15000 });
  const attendance = useQuery({ queryKey: ["staff", "attendance", ...scope], queryFn: () => api.get<Attendance[]>("/attendance/me", { days: 14 }), enabled: Boolean(user), refetchInterval: 30000 });
  const rooms = useQuery({ queryKey: ["staff", "rooms", user?.propertyId], queryFn: () => api.get<Room[]>("/rooms"), enabled: Boolean(user && tab === "report" && category === "room_defect") });
  const refresh = () => client.invalidateQueries({ queryKey: ["staff"] });
  const taskAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "claim" | "in_progress" | "done" }) => action === "claim"
      ? api.post<Task>(`/tasks/${id}/claim`) : api.put<Task>(`/tasks/${id}/status`, { status: action }),
    onSuccess: () => { void refresh(); showToast({ title: "Task saved", description: "The server recorded the change.", type: "success" }); },
    onError: (error) => { void refresh(); showToast({ title: "Task update failed", description: failure(error), type: "error" }); },
  });
  const attendanceAction = useMutation({
    mutationFn: (action: "in" | "out") => action === "in"
      ? api.post<Attendance>("/attendance/check-in", { method: "manual" })
      : api.post<Attendance>("/attendance/check-out", {}),
    onSuccess: () => { void refresh(); showToast({ title: "Attendance saved", description: "The server recorded your attendance.", type: "success" }); },
    onError: (error) => showToast({ title: "Attendance failed", description: failure(error), type: "error" }),
  });
  const reportAction = useMutation({
    mutationFn: () => api.post("/reports", {
      department_id: user?.departmentId, category, summary: summary.trim(),
      description: description.trim() || null, severity,
      room_id: category === "room_defect" ? roomId || null : null,
    }),
    onSuccess: () => { setSummary(""); setDescription(""); setRoomId(""); showToast({ title: "Report saved", description: "The server recorded your report.", type: "success" }); },
    onError: (error) => showToast({ title: "Report failed", description: failure(error), type: "error" }),
  });
  const activeAttendance = attendance.data?.find((row) => !row.checked_out_at);
  const claimable = pool.data?.tasks.filter((task) => !task.assignee_id && task.status === "open") ?? [];
  const visibleTasks = tab === "mine" ? mine.data ?? [] : tab === "pool" ? claimable : [];
  const selectedTask = visibleTasks.find((task) => task.id === selectedTaskId && task.room_id)
    ?? visibleTasks.find((task) => task.room_id);
  const location = useQuery({
    queryKey: ["staff", "task-location", user?.propertyId, selectedTask?.id],
    queryFn: () => api.get<TaskLocation>(`/tasks/${selectedTask?.id}/location`),
    enabled: Boolean(user && selectedTask && (tab === "mine" || tab === "pool")),
  });
  if (!user || !canRead) return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5">Your account does not have access to staff tasks.</div>;

  return <div className="mx-auto max-w-5xl space-y-5 py-4">
    <PageHeader title={`Welcome, ${user.name}`} description={[user.roleTitle, user.department].filter(Boolean).join(" · ")} />
    <nav className="flex gap-2 overflow-x-auto pb-2" aria-label="Staff workspace">
      {([["mine", "My tasks"], ["pool", "Claimable"], ["attendance", "Attendance"], ["report", "Report"], ["requisitions", "Supplies"]] as const)
        .filter(([key]) => key !== "pool" || canClaim)
        .map(([key, label]) => <Button key={key} variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)}>{label}</Button>)}
    </nav>
    <div className="flex justify-end"><Button variant="outline" onClick={() => void refresh()}>Refresh</Button></div>
    {(tab === "mine" || tab === "pool") && selectedTask && (
      location.isPending ? <p role="status" className="px-4 text-sm text-sand-700">Loading task location…</p>
        : location.isError ? <p role="alert" className="rounded-xl border border-rose-200 bg-white p-4 text-sm text-rose-700">Room location unavailable: {failure(location.error)}</p>
          : location.data && <StaffTaskLocation location={location.data} title={selectedTask.title} />
    )}
    {tab === "mine" && <Panel><PanelBody className="space-y-3 p-4 sm:p-5">
      <h2 className="font-serif text-xl">My tasks</h2>
      {mine.isPending ? <p role="status">Loading tasks…</p> : mine.isError ? <p role="alert">{failure(mine.error)}</p> : mine.data?.length === 0 ? <p>No tasks assigned.</p> : mine.data?.map((task) =>
        <TaskCard key={task.id} task={task} busy={taskAction.isPending}
          locationSelected={selectedTask?.id === task.id} onShowLocation={() => setSelectedTaskId(task.id)}
          label={task.status === "assigned" ? "Start" : task.status === "in_progress" ? "Complete" : undefined}
          onAction={hasPermission("tasks:complete") ? () => taskAction.mutate({ id: task.id, action: task.status === "assigned" ? "in_progress" : "done" }) : undefined} />)}
    </PanelBody></Panel>}
    {tab === "pool" && <Panel><PanelBody className="space-y-3 p-4 sm:p-5">
      <h2 className="font-serif text-xl">Claimable work</h2>
      {pool.isPending ? <p role="status">Loading work…</p> : pool.isError ? <p role="alert">{failure(pool.error)}</p> : claimable.length === 0 ? <p>No claimable tasks in your department.</p> : claimable.map((task) =>
        <TaskCard key={task.id} task={task} busy={taskAction.isPending} locationSelected={selectedTask?.id === task.id} onShowLocation={() => setSelectedTaskId(task.id)} label="Claim" onAction={() => taskAction.mutate({ id: task.id, action: "claim" })} />)}
    </PanelBody></Panel>}
    {tab === "attendance" && <Panel><PanelBody className="space-y-4 p-4 sm:p-5">
      <h2 className="font-serif text-xl">Attendance</h2>
      {attendance.isPending ? <p role="status">Loading attendance…</p> : attendance.isError ? <p role="alert">{failure(attendance.error)}</p> : <>
        <p>{activeAttendance ? `On shift since ${new Date(activeAttendance.checked_in_at).toLocaleTimeString()}` : "Off duty"}</p>
        <Button disabled={!hasPermission("attendance:mark") || attendanceAction.isPending} onClick={() => attendanceAction.mutate(activeAttendance ? "out" : "in")}>{activeAttendance ? "Check out" : "Check in"}</Button>
        <p className="text-sm text-sand-600">Break tracking is not available in attendance records yet.</p>
        <ul>{attendance.data?.map((row) => <li key={row.id} className="border-b py-2 text-sm">{row.work_date}: {new Date(row.checked_in_at).toLocaleTimeString()} – {row.checked_out_at ? new Date(row.checked_out_at).toLocaleTimeString() : "on shift"}{row.is_late ? " · late" : ""}</li>)}</ul>
      </>}
    </PanelBody></Panel>}
    {tab === "report" && <Panel><PanelBody className="space-y-4 p-4 sm:p-5">
      <h2 className="font-serif text-xl">Report an issue or shortage</h2>
      {!hasPermission("reports:write") || !user.departmentId ? <p role="alert">Your account cannot submit department reports.</p> : <form onSubmit={(event) => { event.preventDefault(); reportAction.mutate(); }} className="space-y-3">
        <label className="block text-sm">Type<select value={category} onChange={(event) => setCategory(event.target.value as typeof category)} className="mt-1 block w-full rounded-lg border p-2"><option value="room_defect">Room defect</option><option value="supplies">Supply shortage</option><option value="general">Other issue</option></select></label>
        {category === "room_defect" && <label className="block text-sm">Room<select required value={roomId} onChange={(event) => setRoomId(event.target.value)} className="mt-1 block w-full rounded-lg border p-2"><option value="">Select room</option>{rooms.data?.map((room) => <option key={room.id} value={room.id}>{room.number}</option>)}</select></label>}
        {rooms.isError && category === "room_defect" && <p role="alert">{failure(rooms.error)}</p>}
        <label className="block text-sm">Summary<input required minLength={3} maxLength={160} value={summary} onChange={(event) => setSummary(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
        <label className="block text-sm">Details<textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
        <label className="block text-sm">Severity<select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)} className="mt-1 block w-full rounded-lg border p-2"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
        <Button type="submit" disabled={reportAction.isPending || summary.trim().length < 3 || (category === "room_defect" && (!roomId || rooms.isError))}>Submit report</Button>
      </form>}
    </PanelBody></Panel>}
    {tab === "requisitions" && <StaffRequisitions />}
  </div>;
}
