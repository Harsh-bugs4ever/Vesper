"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, Camera, CheckCircle2, ClipboardCheck, Clock3, ImagePlus, Package, RefreshCw, Sparkles, Users } from "lucide-react";
import { API_URL, api, staffTasksApi } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { StaffRequisitions } from "@/components/connected/staff-requisitions";
import { StaffTaskLocation, type TaskLocation } from "@/components/connected/staff-task-location";
import { StaffTeam } from "@/components/connected/staff-team";

type Task = {
  id: string; title: string; description: string | null; assignee_id: string | null;
  room_id: string | null;
  status: string; priority: string; source: string; due_at: string | null; is_overdue: boolean;
  meta: Record<string, unknown>;
};
type Attendance = { id: string; checked_in_at: string; checked_out_at: string | null; work_date: string; is_late: boolean };
type TaskEvidence = { url: string; verification: "approved" | "rejected" | "needs_review"; verifier?: "ai" | "demo_sample" | "manager_review"; note: string; uploaded_at: string };
type Room = { id: string; number: string };
type Tab = "mine" | "pool" | "team" | "attendance" | "report" | "requisitions";

function failure(error: unknown) {
  return error instanceof Error ? error.message : "The request failed.";
}

function TaskCard({ task, label, onAction, onShowLocation, busy, locationSelected }: { task: Task; label?: string; onAction?: () => void; onShowLocation?: () => void; busy: boolean; locationSelected?: boolean }) {
  const items = Array.isArray(task.meta?.items) ? task.meta.items : [];
  const priority = task.priority.toLowerCase();
  const status = task.status.replaceAll("_", " ");
  const completed = ["done", "completed"].includes(task.status.toLowerCase());
  const dueLabel = task.due_at
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(task.due_at))
    : null;
  const evidence = Array.isArray(task.meta?.completion_evidence) ? task.meta.completion_evidence as TaskEvidence[] : [];
  const latestEvidence = evidence.at(-1);
  const evidenceImage = latestEvidence?.url ? `${API_URL}${latestEvidence.url}` : null;

  return (
    <article className="group rounded-2xl border border-sand-200/80 bg-white p-4 shadow-[0_8px_24px_-22px_rgba(35,57,45,.7)] transition-all hover:-translate-y-0.5 hover:border-sage-300 hover:shadow-[0_16px_30px_-22px_rgba(35,57,45,.55)] sm:p-5">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${task.is_overdue ? "bg-rose-50 text-rose-700" : completed ? "bg-emerald-50 text-emerald-700" : "bg-sage-50 text-sage-700"}`}>
          {task.is_overdue ? <AlertTriangle className="h-4 w-4" /> : completed ? <CheckCircle2 className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-sage-950 sm:text-base">{task.title}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${task.is_overdue ? "bg-rose-50 text-rose-700" : priority === "high" || priority === "urgent" ? "bg-amber-50 text-amber-800" : completed ? "bg-emerald-50 text-emerald-700" : "bg-sand-100 text-sand-600"}`}>
              {task.is_overdue ? "Overdue" : priority}
            </span>
          </div>
          {task.description && <p className="mt-1.5 text-sm leading-relaxed text-sand-600">{task.description}</p>}
          {items.length > 0 && <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-sand-50 px-2.5 py-1 text-xs text-sand-600"><Package className="h-3.5 w-3.5" />{items.length} requested item{items.length === 1 ? "" : "s"}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-sand-500">
            {dueLabel && <span className={`inline-flex items-center gap-1 ${task.is_overdue ? "font-semibold text-rose-700" : ""}`}><Clock3 className="h-3.5 w-3.5" />{task.is_overdue ? "Past due" : "Due"} {dueLabel}</span>}
            <span className="capitalize">{task.source.replaceAll("_", " ")}</span>
            <span className="capitalize">{status}</span>
          </div>
          {task.room_id && onShowLocation && <button type="button" onClick={onShowLocation} aria-pressed={locationSelected} className="mt-3 min-h-11 text-sm font-medium text-sage-800 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sage-700">{locationSelected ? "Location shown" : "Show room location"}</button>}
        </div>
        {label && onAction && <Button disabled={busy} onClick={onAction} className="shrink-0 self-center">{label}</Button>}
      </div>
      {latestEvidence && <div className="mt-4 flex items-start gap-3 rounded-xl border border-sand-200 bg-sand-50/70 p-3">
        {evidenceImage && <img src={evidenceImage} alt="Uploaded task completion evidence" className="h-16 w-16 rounded-lg object-cover" />}
        <div className="min-w-0"><p className="text-xs font-semibold capitalize text-sage-900">Photo · {latestEvidence.verification.replaceAll("_", " ")}{latestEvidence.verifier === "demo_sample" ? " (demo sample)" : ""}</p><p className="mt-1 text-xs leading-relaxed text-sand-600">{latestEvidence.note}</p></div>
      </div>}
      {!completed && task.status !== "cancelled" && <TaskEvidenceAction task={task} />}
    </article>
  );
}

function TaskEvidenceAction({ task }: { task: Task }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const { showToast } = useToast();
  const demoImageUrl = typeof task.meta?.demo_image_url === "string" ? task.meta.demo_image_url : null;
  const upload = useMutation({
    mutationFn: (file: File) => staffTasksApi.submitEvidence(task.id, file),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: ["staff", "mine"] });
      const approved = result.ai_status === "approved";
      showToast({
        title: approved ? result.verifier === "demo_sample" ? "Demo photo verified · task complete" : "AI verified · task complete" : result.ai_status === "rejected" ? "Photo doesn’t show completion yet" : "Photo saved for review",
        description: `${result.ai_note}${result.next_task ? ` Next task assigned: ${result.next_task.title}.` : approved ? " No more tasks are waiting in your department queue." : ""}`,
        type: approved ? "success" : "default",
      });
    },
    onError: (error) => showToast({ title: "Photo upload failed", description: error instanceof Error ? error.message : "Choose a JPEG, PNG or WebP photo and try again.", type: "error" }),
  });

  const useSamplePhoto = async () => {
    if (!demoImageUrl) return;
    try {
      const response = await fetch(demoImageUrl);
      if (!response.ok) throw new Error("The demo photo could not be loaded.");
      const blob = await response.blob();
      upload.mutate(new File([blob], "housekeeping-completion-demo.png", { type: blob.type || "image/png" }));
    } catch (error) {
      showToast({ title: "Demo photo unavailable", description: error instanceof Error ? error.message : "Try uploading a photo from your device.", type: "error" });
    }
  };

  return <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-sand-100 pt-3">
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file); event.target.value = ""; }} />
    <Button variant="outline" size="sm" disabled={upload.isPending} onClick={() => inputRef.current?.click()} className="rounded-xl"><Camera className="h-3.5 w-3.5" />{upload.isPending ? "Checking photo…" : "Attach completion photo"}</Button>
    {demoImageUrl && <Button variant="ghost" size="sm" disabled={upload.isPending} onClick={() => void useSamplePhoto()} className="rounded-xl"><ImagePlus className="h-3.5 w-3.5" />Try demo photo</Button>}
    <span className="text-[10px] text-sand-500">AI checks the photo when connected; unclear checks go to your manager.</span>
  </div>;
}

export function LiveStaff() {
  const { user, hasPermission } = useAuth();
  const client = useQueryClient();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("mine");
  const [category, setCategory] = useState<"room_defect" | "service" | "safety" | "general">("room_defect");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [roomId, setRoomId] = useState("");
  const [severity, setSeverity] = useState<"low" | "normal" | "high">("normal");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const scope = [user?.propertyId, user?.id, user?.departmentId];
  const canRead = Boolean(user && hasPermission("tasks:read"));
  const mine = useQuery({ queryKey: ["staff", "mine", ...scope], queryFn: () => api.get<Task[]>("/tasks/mine", { include_done: true }), enabled: canRead, refetchInterval: 15000 });
  const pool = useQuery({
    queryKey: ["staff", "pool", ...scope],
    queryFn: () => api.get<{ tasks: Task[] }>("/tasks", { department_id: user?.departmentId }),
    enabled: Boolean(canRead && user?.departmentId && hasPermission("tasks:pool_read") && tab === "pool"),
    refetchInterval: 15000,
  });
  const attendance = useQuery({ queryKey: ["staff", "attendance", ...scope], queryFn: () => api.get<Attendance[]>("/attendance/me", { days: 14 }), enabled: Boolean(user), refetchInterval: 30000 });
  const rooms = useQuery({ queryKey: ["staff", "rooms", user?.propertyId], queryFn: () => api.get<Room[]>("/rooms"), enabled: Boolean(user && tab === "report" && category === "room_defect") });
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: ["staff"] }),
    client.invalidateQueries({ queryKey: ["staff-header-attendance", user?.id] }),
  ]);
  const taskAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "claim" | "in_progress" }) => action === "claim"
      ? api.post<Task>(`/tasks/${id}/claim`) : api.put<Task>(`/tasks/${id}/status`, { status: action }),
    onSuccess: () => { void refresh(); showToast({ title: "Task saved", description: "The server recorded the change.", type: "success" }); },
    onError: (error) => { void refresh(); showToast({ title: "Task update failed", description: failure(error), type: "error" }); },
  });
  const attendanceAction = useMutation({
    mutationFn: (action: "in" | "out") => action === "in"
      ? api.post<Attendance>("/attendance/check-in", { method: "manual" })
      : api.post<Attendance>("/attendance/check-out", {}),
    onSuccess: (_data, action) => { void refresh(); showToast({ title: action === "in" ? "You’re on shift" : "You’re off shift", description: action === "in" ? "Your shift status has been updated." : "Your check-out has been recorded.", type: "success" }); },
    onError: (error) => { void refresh(); showToast({ title: "Attendance failed", description: failure(error), type: "error" }); },
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
  const openTasks = mine.data?.filter((task) => !["done", "completed"].includes(task.status.toLowerCase())) ?? [];
  const overdueTasks = openTasks.filter((task) => task.is_overdue).length;
  const firstName = user?.name.split(" ")[0] ?? "there";
  if (!user || !canRead) return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5">Your account does not have access to staff tasks.</div>;

  const tabs = [
    { id: "mine" as const, label: "My tasks", icon: ClipboardCheck, count: openTasks.length },
    ...(user.departmentId && hasPermission("tasks:pool_read") ? [{ id: "pool" as const, label: "Claimable", icon: Users, count: claimable.length }] : []),
    ...(user.departmentId ? [{ id: "team" as const, label: "My team", icon: Users }] : []),
    { id: "attendance" as const, label: "Attendance", icon: Clock3 },
    { id: "report" as const, label: "Report issue", icon: AlertTriangle },
    { id: "requisitions" as const, label: "Supplies", icon: Package },
  ];
  const fieldClass = "mt-1.5 block w-full rounded-xl border border-sand-200 bg-white px-3.5 py-3 text-sm text-sand-900 shadow-sm outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100";

  return <div className="mx-auto max-w-6xl space-y-6 pb-10">
    <section className="relative isolate overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#173a2d] via-[#244c3a] to-[#355b46] px-5 py-6 text-white shadow-[0_24px_60px_-35px_rgba(23,58,45,.8)] sm:px-8 sm:py-8 lg:px-10">
      <div aria-hidden="true" className="absolute -right-20 -top-32 -z-10 h-80 w-80 rounded-full border border-white/10 bg-white/[0.035]" />
      <div aria-hidden="true" className="absolute -bottom-36 right-24 -z-10 h-64 w-64 rounded-full border border-gold-200/10" />
      <div className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-200"><Sparkles className="h-3.5 w-3.5" /> Your team workspace</p>
          <h1 className="mt-4 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">Welcome in, {firstName}.</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">A clear view of your shift, the work that needs you, and the team requests you can move forward.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/75">
            {user.roleTitle && <span className="rounded-lg border border-white/15 bg-white/[0.08] px-2.5 py-1.5">{user.roleTitle}</span>}
            {user.department && <span className="rounded-lg border border-white/15 bg-white/[0.08] px-2.5 py-1.5">{user.department}</span>}
          </div>
        </div>
        <div className="flex min-w-[220px] items-center justify-between gap-4 rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm sm:min-w-[240px]">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">Your shift</p><p className="mt-1.5 flex items-center gap-2 text-base font-semibold"><span className={`h-2 w-2 rounded-full ${activeAttendance ? "bg-emerald-300 shadow-[0_0_0_4px_rgba(110,231,183,.12)]" : "bg-white/45"}`} />{attendance.isPending ? "Checking in…" : activeAttendance ? "You're on duty" : "Not checked in"}</p></div>
          <Button variant="gold" size="sm" onClick={() => setTab("attendance")} className="shrink-0 rounded-xl">{activeAttendance ? "View shift" : "Check in"}</Button>
        </div>
      </div>
    </section>

    <section aria-label="Shift summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[
        { label: "Open tasks", value: mine.isPending ? "—" : openTasks.length, detail: "Assigned to you", icon: ClipboardCheck, tone: "sage" },
        { label: "Need attention", value: mine.isPending ? "—" : overdueTasks, detail: overdueTasks ? "Past the target time" : "You're on track", icon: AlertTriangle, tone: overdueTasks ? "rose" : "sage" },
        { label: "Shift status", value: attendance.isPending ? "…" : activeAttendance ? "On duty" : "Off duty", detail: activeAttendance ? "Attendance is active" : "Check in when ready", icon: Clock3, tone: "sage" },
      ].map(({ label, value, detail, icon: Icon, tone }) => (
        <div key={label} className="rounded-2xl border border-sand-200/80 bg-white p-4 shadow-[0_8px_28px_-25px_rgba(35,57,45,.8)] sm:p-5">
          <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-medium text-sand-500">{label}</p><p className="mt-2 font-serif text-2xl font-semibold leading-none text-sage-950">{value}</p></div><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone === "rose" ? "bg-rose-50 text-rose-700" : tone === "gold" ? "bg-gold-50 text-gold-700" : "bg-sage-50 text-sage-700"}`}><Icon className="h-4 w-4" /></span></div>
          <p className="mt-3 text-[11px] text-sand-500">{detail}</p>
        </div>
      ))}
    </section>

    <div className="flex flex-col gap-3 border-b border-sand-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
      <nav className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1" aria-label="Staff work sections">
        {tabs.map(({ id, label, icon: Icon, count }) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${tab === id ? "bg-sage-800 text-white shadow-sm" : "text-sand-600 hover:bg-white hover:text-sage-900"}`}><Icon className="h-4 w-4" />{label}{count !== undefined && <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === id ? "bg-white/15 text-white" : "bg-sand-100 text-sand-600"}`}>{count}</span>}</button>)}
      </nav>
      <Button variant="outline" onClick={() => void refresh()} className="self-end rounded-xl sm:self-auto"><RefreshCw className="h-4 w-4" /> Refresh</Button>
    </div>

    {(tab === "mine" || tab === "pool") && selectedTask && (
      location.isPending ? <p role="status" className="px-4 text-sm text-sand-700">Loading task location…</p>
        : location.isError ? <p role="alert" className="rounded-2xl border border-rose-200 bg-white p-4 text-sm text-rose-700">Room location unavailable: {failure(location.error)}</p>
          : location.data && <StaffTaskLocation location={location.data} title={selectedTask.title} />
    )}

    {tab === "mine" && <Panel className="overflow-hidden rounded-3xl shadow-[0_14px_40px_-32px_rgba(35,57,45,.65)]"><PanelBody className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-serif text-2xl text-sage-950">Your tasks</h2><p className="mt-1 text-sm text-sand-500">Work assigned to you, updated automatically.</p></div>{overdueTasks > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"><AlertTriangle className="h-3.5 w-3.5" />{overdueTasks} need attention</span>}</div>
      {mine.isPending ? <div role="status" className="space-y-3"><div className="h-24 animate-pulse rounded-2xl bg-sand-100" /><div className="h-24 animate-pulse rounded-2xl bg-sand-100" /></div> : mine.isError ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{failure(mine.error)}</div> : mine.data?.length === 0 ? <div className="rounded-2xl border border-dashed border-sage-200 bg-sage-50/50 px-5 py-10 text-center"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sage-700 shadow-sm"><CheckCircle2 className="h-5 w-5" /></span><p className="mt-3 font-serif text-lg text-sage-950">You're all caught up</p><p className="mt-1 text-sm text-sand-600">New tasks will appear here when they are assigned.</p></div> : <div className="grid gap-3 lg:grid-cols-2">{mine.data?.map((task) => <TaskCard key={task.id} task={task} busy={taskAction.isPending} locationSelected={selectedTask?.id === task.id} onShowLocation={() => setSelectedTaskId(task.id)} label={task.status === "assigned" ? "Start task" : undefined} onAction={task.status === "assigned" && hasPermission("tasks:complete") ? () => taskAction.mutate({ id: task.id, action: "in_progress" }) : undefined} />)}</div>}
    </PanelBody></Panel>}

    {tab === "pool" && <Panel className="overflow-hidden rounded-3xl shadow-[0_14px_40px_-32px_rgba(35,57,45,.65)]"><PanelBody className="space-y-4 p-4 sm:p-6">
      <div><h2 className="font-serif text-2xl text-sage-950">Claimable work</h2><p className="mt-1 text-sm text-sand-500">Open tasks available to your department.</p></div>
      {pool.isPending ? <p role="status" className="text-sm text-sand-600">Loading claimable tasks…</p> : pool.isError ? <p role="alert" className="text-sm text-rose-700">{failure(pool.error)}</p> : claimable.length === 0 ? <p className="text-sm text-sand-500">No claimable tasks in your department.</p> : <div className="grid gap-3 lg:grid-cols-2">{claimable.map((task) => <TaskCard key={task.id} task={task} busy={taskAction.isPending} locationSelected={selectedTask?.id === task.id} onShowLocation={() => setSelectedTaskId(task.id)} label="Claim" onAction={() => taskAction.mutate({ id: task.id, action: "claim" })} />)}</div>}
    </PanelBody></Panel>}

    {tab === "team" && <StaffTeam />}

    {tab === "attendance" && <Panel className="overflow-hidden rounded-3xl shadow-[0_14px_40px_-32px_rgba(35,57,45,.65)]"><PanelBody className="space-y-5 p-4 sm:p-6">
      <div><h2 className="font-serif text-2xl text-sage-950">Your attendance</h2><p className="mt-1 text-sm text-sand-500">Check in and review your recent shift record.</p></div>
      {attendance.isPending ? <p role="status" className="rounded-2xl bg-sand-50 p-6 text-sm text-sand-600">Loading your attendance…</p> : attendance.isError ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{failure(attendance.error)}</div> : <>
        <div className={`flex flex-col justify-between gap-4 rounded-2xl p-5 sm:flex-row sm:items-center ${activeAttendance ? "bg-emerald-50" : "bg-sand-50"}`}><div className="flex items-center gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${activeAttendance ? "bg-white text-emerald-700" : "bg-white text-sand-500"}`}><Clock3 className="h-5 w-5" /></span><div><p className="text-xs font-medium text-sand-500">Current status</p><p className="mt-0.5 font-serif text-xl font-semibold text-sage-950">{activeAttendance ? "You're on duty" : "Off duty"}</p>{activeAttendance && <p className="mt-0.5 text-xs text-sand-600">Started {new Intl.DateTimeFormat("en-IN", { timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(activeAttendance.checked_in_at))}</p>}</div></div><Button disabled={!hasPermission("attendance:mark") || attendanceAction.isPending} onClick={() => attendanceAction.mutate(activeAttendance ? "out" : "in")} className="rounded-xl">{attendanceAction.isPending ? "Saving…" : activeAttendance ? "Check out" : "Check in"}</Button></div>
        <div className="overflow-hidden rounded-2xl border border-sand-200"><div className="flex items-center gap-2 border-b border-sand-200 bg-sand-50/70 px-4 py-3"><CalendarDays className="h-4 w-4 text-sage-700" /><h3 className="text-sm font-semibold text-sage-950">Recent shifts</h3><span className="ml-auto text-[11px] text-sand-500">Last 14 days</span></div>{attendance.data?.length ? <ul className="divide-y divide-sand-100">{attendance.data.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><span className="font-medium text-sand-800">{row.work_date}</span><span className="text-xs text-sand-600">{new Intl.DateTimeFormat("en-IN", { timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(row.checked_in_at))} – {row.checked_out_at ? new Intl.DateTimeFormat("en-IN", { timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(row.checked_out_at)) : "On shift"}</span>{row.is_late && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Late check-in</span>}</li>)}</ul> : <p className="px-4 py-7 text-center text-sm text-sand-500">No attendance entries yet.</p>}</div>
      </>}
    </PanelBody></Panel>}

    {tab === "report" && <Panel className="overflow-hidden rounded-3xl shadow-[0_14px_40px_-32px_rgba(35,57,45,.65)]"><PanelBody className="space-y-5 p-4 sm:p-6">
      <div><h2 className="font-serif text-2xl text-sage-950">Report an issue</h2><p className="mt-1 text-sm text-sand-500">Flag a room defect, safety concern, service issue, or other item that needs attention.</p></div>
      {!hasPermission("reports:write") || !user.departmentId ? <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Your account cannot submit department reports.</p> : <form onSubmit={(event) => { event.preventDefault(); reportAction.mutate(); }} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-semibold text-sand-700">Report type<select value={category} onChange={(event) => setCategory(event.target.value as typeof category)} className={fieldClass}><option value="room_defect">Room defect</option><option value="service">Service issue</option><option value="safety">Safety concern</option><option value="general">Other issue</option></select></label>{category === "room_defect" && <label className="block text-xs font-semibold text-sand-700">Room<select required value={roomId} onChange={(event) => setRoomId(event.target.value)} className={fieldClass}><option value="">Select a room</option>{rooms.data?.map((room) => <option key={room.id} value={room.id}>{room.number}</option>)}</select></label>}</div>
        {rooms.isError && category === "room_defect" && <p role="alert" className="text-sm text-rose-700">{failure(rooms.error)}</p>}
        <label className="block text-xs font-semibold text-sand-700">Short summary<input required minLength={3} maxLength={160} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="e.g. Bathroom tap is leaking" className={fieldClass} /></label>
        <label className="block text-xs font-semibold text-sand-700">Details <span className="font-normal text-sand-400">(optional)</span><textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add anything that will help the team resolve this quickly." className={fieldClass} /></label>
        <div className="flex flex-wrap items-end justify-between gap-3"><label className="block min-w-[180px] text-xs font-semibold text-sand-700">Urgency<select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)} className={fieldClass}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label><Button type="submit" disabled={reportAction.isPending || summary.trim().length < 3 || (category === "room_defect" && (!roomId || rooms.isError))} className="rounded-xl">{reportAction.isPending ? "Sending report…" : "Submit report"}</Button></div>
      </form>}
    </PanelBody></Panel>}

    {tab === "requisitions" && <div className="rounded-3xl border border-sand-200/80 bg-white p-4 shadow-[0_14px_40px_-32px_rgba(35,57,45,.65)] sm:p-6"><StaffRequisitions /></div>}
  </div>;
}
