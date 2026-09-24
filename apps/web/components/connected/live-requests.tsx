"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";

type Request = {
  id: string;
  kind: string;
  status: string;
  room_number: string;
  note: string | null;
  total_amount: number;
  sla_minutes: number;
  due_at: string;
  created_at: string;
  is_overdue: boolean;
};

const closed = new Set(["delivered", "cancelled"]);

export function LiveRequests() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("open");
  const key = ["requests", user.propertyId, user.id];
  const query = useQuery({ queryKey: key, queryFn: () => api.get<Request[]>("/requests"), refetchInterval: 30_000 });
  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "in_progress" | "delivered" }) =>
      action === "accept" ? api.post<Request>(`/requests/${id}/accept`) : api.put<Request>(`/requests/${id}/status`, { status: action }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const requests = query.data ?? [];
  const visible = requests.filter((request) => filter === "all" || (filter === "open" ? !closed.has(request.status) : filter === "overdue" ? request.is_overdue && !closed.has(request.status) : request.status === filter));
  const canAct = hasPermission("requests:accept");

  return <div className="space-y-6">
    <PageHeader title="Guest requests" description="Live requests from occupied rooms, updated every 30 seconds." actions={<button type="button" onClick={() => query.refetch()} className="rounded-lg border border-sand-200 px-4 py-2 text-sm">Refresh</button>} />
    <div className="grid gap-4 sm:grid-cols-3">
      {[["Open", requests.filter((request) => !closed.has(request.status)).length], ["Overdue", requests.filter((request) => request.is_overdue && !closed.has(request.status)).length], ["Delivered", requests.filter((request) => request.status === "delivered").length]].map(([label, count]) => <div key={label} className="rounded-xl border border-sand-200 bg-white p-5"><p className="text-sm text-sage-700">{label}</p><p className="mt-2 font-serif text-3xl text-sage-950">{count}</p></div>)}
    </div>
    <Panel><PanelBody className="p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter requests">
        {["open", "overdue", "raised", "accepted", "in_progress", "delivered", "all"].map((value) => <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`rounded-full border px-3 py-1.5 text-xs capitalize ${filter === value ? "border-sage-700 bg-sage-700 text-white" : "border-sand-200 text-sage-700"}`}>{value.replaceAll("_", " ")}</button>)}
      </div>
      {query.isPending ? <p role="status" className="py-10 text-center text-sm">Loading requests…</p> : query.isError ? <p role="alert" className="py-10 text-center text-sm text-rose-700">{query.error instanceof Error ? query.error.message : "Could not load requests."}</p> : visible.length === 0 ? <p className="py-10 text-center text-sm text-sage-700">No requests in this view.</p> : <ul className="space-y-3">{visible.map((request) => <li key={request.id} className={`rounded-xl border p-4 ${request.is_overdue && !closed.has(request.status) ? "border-rose-200 bg-rose-50" : "border-sand-200 bg-white"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-medium capitalize text-sage-950">Room {request.room_number} · {request.kind.replaceAll("_", " ")}</p><p className="mt-1 text-sm text-sage-700">{request.note || "No special instructions"}</p><p className="mt-2 text-xs text-sage-600">{new Date(request.created_at).toLocaleString("en-IN")} · Due {new Date(request.due_at).toLocaleString("en-IN")} · {request.sla_minutes} min target</p><p className="mt-1 text-xs capitalize text-sage-700">{request.status.replaceAll("_", " ")}{request.is_overdue && !closed.has(request.status) ? " · Overdue" : ""}{Number(request.total_amount) > 0 ? ` · ₹${Number(request.total_amount).toLocaleString("en-IN")}` : ""}</p></div>
        {canAct && !closed.has(request.status) && <div className="flex flex-wrap gap-2">{request.status === "raised" && <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: request.id, action: "accept" })} className="rounded-lg bg-sage-700 px-3 py-2 text-xs text-white disabled:opacity-50">Accept</button>}{request.status === "accepted" && <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: request.id, action: "in_progress" })} className="rounded-lg border border-sage-300 px-3 py-2 text-xs text-sage-800 disabled:opacity-50">Start work</button>}{["accepted", "in_progress"].includes(request.status) && <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: request.id, action: "delivered" })} className="rounded-lg border border-sage-300 px-3 py-2 text-xs text-sage-800 disabled:opacity-50">Mark delivered</button>}</div>}
        </div>
      </li>)}</ul>}
      {mutation.isError && <p role="alert" className="mt-4 text-sm text-rose-700">{mutation.error instanceof Error ? mutation.error.message : "Could not update request."}</p>}
    </PanelBody></Panel>
  </div>;
}
