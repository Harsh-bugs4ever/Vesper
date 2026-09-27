"use client";

import { useQuery } from "@tanstack/react-query";
import { Package, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody } from "@/components/ui/panel";
import { inventory, requisitions } from "@/lib/api";

export function AdminDepartmentRequisitions() {
  const { user } = useAuth();
  const queryKey = ["admin-stock-requests", user?.propertyId, user?.departmentId];
  const requests = useQuery({ queryKey, queryFn: () => requisitions.list(), enabled: Boolean(user), refetchInterval: 60_000 });
  const stock = useQuery({ queryKey: ["inventory", "items", user?.propertyId, user?.departmentId], queryFn: () => inventory.items(), enabled: Boolean(user) });
  const itemNames = new Map((stock.data ?? []).map((item) => [item.id, `${item.name} (${item.sku})`]));
  const rows = requests.data ?? [];

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-xl font-semibold text-sand-950">Department stock requests</h2><p className="mt-1 text-sm text-sand-600">Automated replenishment requests for your department. Stock levels are monitored and requests are generated automatically.</p></div><Button variant="outline" size="sm" onClick={() => void requests.refetch()} disabled={requests.isFetching}><RefreshCw className={`h-3.5 w-3.5 ${requests.isFetching ? "animate-spin" : ""}`} />Refresh</Button></div>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-sand-200 bg-white p-4"><p className="text-xs text-sand-500">Requests</p><p className="mt-1 font-serif text-2xl font-semibold text-sage-950">{rows.length}</p></div><div className="rounded-xl border border-sand-200 bg-white p-4"><p className="text-xs text-sand-500">Open</p><p className="mt-1 font-serif text-2xl font-semibold text-amber-800">{rows.filter((row) => ["submitted", "open"].includes(row.status)).length}</p></div><div className="rounded-xl border border-sand-200 bg-white p-4"><p className="text-xs text-sand-500">Items requested</p><p className="mt-1 font-serif text-2xl font-semibold text-sage-950">{rows.reduce((sum, row) => sum + row.lines.length, 0)}</p></div></div>
    {requests.isPending ? <p role="status" className="py-10 text-center text-sm text-sand-500">Loading department stock requests…</p> : requests.isError ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Could not load stock requests.</p> : rows.length === 0 ? <div className="rounded-xl border border-dashed border-sand-200 p-8 text-center"><Package className="mx-auto h-8 w-8 text-sand-400" /><p className="mt-2 text-sm font-medium text-sand-800">No stock requests yet</p><p className="mt-1 text-xs text-sand-500">Automatic replenishment requests will appear here when department stock is low.</p></div> : <div className="space-y-3">{rows.map((request) => <article key={request.id} className="rounded-2xl border border-sand-200/80 bg-white p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-sage-950">{request.reason || "Automatic stock replenishment"}</p><p className="mt-1 text-xs text-sand-500">{new Date(request.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${["submitted", "open"].includes(request.status) ? "bg-amber-50 text-amber-800" : request.status === "approved" ? "bg-emerald-50 text-emerald-800" : "bg-sand-100 text-sand-700"}`}>{request.status === "submitted" ? "Open request" : request.status.replaceAll("_", " ")}</span></div><ul className="mt-3 divide-y divide-sand-100 border-t border-sand-100">{request.lines.map((line) => <li key={line.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"><span className="font-medium text-sand-800">{itemNames.get(line.item_id) ?? "Department stock item"}</span><span className="tabular-nums text-sand-600">{Number(line.quantity).toLocaleString("en-IN")} units</span></li>)}</ul></article>)}</div>}
  </div>;
}
