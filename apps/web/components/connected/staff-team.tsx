"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody } from "@/components/ui/panel";
import { workforceApi, type TeamRosterOut } from "@/lib/api";

function propertyDate(weekOffset: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  const date = new Date(`${part("year")}-${part("month")}-${part("day")}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + weekOffset * 7);
  return date.toISOString().slice(0, 10);
}

function displayDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "Asia/Kolkata" }).format(new Date(`${value}T12:00:00Z`));
}

export function StaffTeam() {
  const { user } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const [search, setSearch] = useState("");
  const roster = useQuery<TeamRosterOut>({
    queryKey: ["staff", "my-team", user?.propertyId, user?.departmentId, weekOffset],
    queryFn: () => workforceApi.myTeam(weekOffset === 0 ? undefined : propertyDate(weekOffset)),
    enabled: Boolean(user?.departmentId),
    staleTime: 30_000,
  });

  const visibleMembers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const members = roster.data?.members ?? [];
    return needle
      ? members.filter((member) => member.full_name.toLowerCase().includes(needle) || member.role_title.toLowerCase().includes(needle))
      : members;
  }, [roster.data?.members, search]);

  const weekEnd = roster.data?.week_start ? (() => {
    const end = new Date(`${roster.data.week_start}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    return end.toISOString().slice(0, 10);
  })() : null;

  if (!user?.departmentId) {
    return <div role="status" className="rounded-2xl border border-dashed border-sand-300 bg-white p-8 text-center text-sm text-sand-600">Your account is not assigned to a department team.</div>;
  }

  return (
    <Panel className="overflow-hidden rounded-3xl shadow-[0_14px_40px_-32px_rgba(35,57,45,.65)]">
      <PanelBody className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-sage-700"><Users className="h-3.5 w-3.5" /> Department roster</p>
            <h2 className="mt-1 font-serif text-2xl text-sage-950">My team{roster.data?.department_name ? ` · ${roster.data.department_name}` : ""}</h2>
            <p className="mt-1 text-sm text-sand-500">Team members and shifts from your department only.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-sand-200 bg-sand-50 p-1">
              <Button variant="ghost" size="icon" aria-label="Previous week" onClick={() => setWeekOffset((offset) => offset - 1)} className="h-8 w-8 rounded-lg"><ChevronLeft className="h-4 w-4" /></Button>
              <span className="inline-flex min-w-36 items-center justify-center gap-1.5 px-2 text-xs font-semibold text-sage-900"><CalendarDays className="h-3.5 w-3.5 text-sage-600" />{roster.data?.week_start && weekEnd ? `${displayDate(roster.data.week_start, { day: "numeric", month: "short" })} – ${displayDate(weekEnd, { day: "numeric", month: "short" })}` : "This week"}</span>
              <Button variant="ghost" size="icon" aria-label="Next week" disabled={weekOffset >= 4} onClick={() => setWeekOffset((offset) => Math.min(offset + 1, 4))} className="h-8 w-8 rounded-lg"><ChevronRight className="h-4 w-4" /></Button>
            </div>
            {roster.data?.roster_status === "published" ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-800">Published roster</span> : roster.data?.roster_status === "draft" ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-semibold text-amber-800">Draft · awaiting manager</span> : <span className="rounded-full border border-sand-200 bg-sand-50 px-2.5 py-1.5 text-[10px] font-semibold text-sand-600">No published roster</span>}
          </div>
        </div>

        {roster.data?.roster_status === "draft" && <p className="rounded-xl border border-amber-200/70 bg-amber-50/70 px-3.5 py-3 text-xs leading-relaxed text-amber-900">This is a draft schedule. Follow your manager’s published roster for your confirmed shift.</p>}

        <div className="flex flex-col gap-3 border-y border-sand-100 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-sand-500"><span className="font-semibold text-sage-900">{roster.data?.members.length ?? 0}</span> people on your team <span className="mx-1 text-sand-300">·</span> <span className="font-semibold text-sage-900">{roster.data?.members.reduce((sum, member) => sum + member.shifts.length, 0) ?? 0}</span> scheduled shifts</p>
          <label className="relative block sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a teammate" aria-label="Search team members" className="h-10 w-full rounded-xl border border-sand-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100" />
          </label>
        </div>

        {roster.isPending ? <div role="status" className="grid gap-3 sm:grid-cols-2"><div className="h-24 animate-pulse rounded-2xl bg-sand-100" /><div className="h-24 animate-pulse rounded-2xl bg-sand-100" /><div className="h-24 animate-pulse rounded-2xl bg-sand-100" /></div>
          : roster.isError ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Couldn’t load your team roster. Refresh and try again.</div>
          : visibleMembers.length === 0 ? <div className="rounded-2xl border border-dashed border-sage-200 bg-sage-50/50 px-5 py-10 text-center"><Users className="mx-auto h-6 w-6 text-sage-600" /><p className="mt-3 font-serif text-lg text-sage-950">{search ? "No teammates match that search" : "No team members found"}</p><p className="mt-1 text-sm text-sand-600">{search ? "Try a different name or role." : "Your department roster will appear here when staff are assigned."}</p></div>
          : <div className="grid gap-3 xl:grid-cols-2">{visibleMembers.map((member) => <article key={member.user_id} className="rounded-2xl border border-sand-200/80 bg-white p-4 transition-colors hover:border-sage-300 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage-50 text-xs font-bold text-sage-800">{member.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-sage-950">{member.full_name}</h3>{member.user_id === user.id && <span className="rounded-full bg-sage-100 px-2 py-0.5 text-[9px] font-semibold text-sage-800">You</span>}</div>
                <p className="mt-0.5 text-xs text-sand-500">{member.role_title}{member.employee_code ? ` · ${member.employee_code}` : ""}</p>
                {member.shifts.length ? <div className="mt-3 flex flex-wrap gap-1.5">{member.shifts.map((shift) => <span key={`${member.user_id}-${shift.work_date}-${shift.shift_key}`} className="inline-flex items-center gap-1.5 rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5 text-[10px] text-sand-700"><span className="font-semibold text-sage-900">{displayDate(shift.work_date, { weekday: "short", day: "numeric" })}</span><span>{shift.shift_name}</span>{shift.starts_at && shift.ends_at && <span className="text-sand-500">{shift.starts_at.slice(0, 5)}–{shift.ends_at.slice(0, 5)}</span>}</span>)}</div> : <p className="mt-3 rounded-lg bg-sand-50 px-2.5 py-2 text-[11px] text-sand-500">No shift assigned this week</p>}
              </div>
            </div>
          </article>)}</div>}
      </PanelBody>
    </Panel>
  );
}
