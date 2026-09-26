"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";

type Order = { id: string; item_id: string; supplier: string | null; status: string; quantity: number; total_cost: number; expected_on: string | null; created_at: string };
type Item = { id: string; name: string; unit: string };

export function LivePurchaseOrders() {
  const { user, hasPermission, isConnected } = useAuth();
  const client = useQueryClient();
  const [filter, setFilter] = useState("all");
  const key = ["purchase-orders", user?.propertyId ?? "", user?.id ?? ""];
  const query = useQuery({ queryKey: key, enabled: isConnected && Boolean(user), queryFn: async () => {
    const [orders, items] = await Promise.all([api.get<Order[]>("/purchase-orders"), api.get<Item[]>("/inventory/items")]);
    return { orders, names: new Map(items.map((item) => [item.id, item.name])) };
  } });
  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "receive" | "cancel" }) => api.post<Order>(`/purchase-orders/${id}/${action}`, action === "approve" ? {} : undefined),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  const orders = query.data?.orders ?? [];
  const visible = orders.filter((order) => filter === "all" || order.status === filter);
  const canApprove = hasPermission("purchase:approve");
  const canReceive = hasPermission("stock:write");

  return <div className="space-y-6">
    <PageHeader title="Purchase orders" description="Approve suggestions and record deliveries against current stock." actions={<button type="button" onClick={() => query.refetch()} className="rounded-lg border border-sand-200 px-4 py-2 text-sm">Refresh</button>} />
    {!isConnected ? <Panel><PanelBody className="py-12 text-center text-sm text-sage-700">Sign in with a backend account to manage purchase orders.</PanelBody></Panel> : <>
      <div className="grid gap-4 sm:grid-cols-3">{[["Suggested", orders.filter((order) => order.status === "suggested").length], ["Approved", orders.filter((order) => order.status === "approved").length], ["Received", orders.filter((order) => order.status === "received").length]].map(([label, value]) => <div key={label} className="rounded-xl border border-sand-200 bg-white p-5"><p className="text-sm text-sage-700">{label}</p><p className="mt-2 font-serif text-3xl text-sage-950">{value}</p></div>)}</div>
      <Panel><PanelBody className="p-5 sm:p-6"><div role="group" aria-label="Filter purchase orders" className="mb-5 flex flex-wrap gap-2">{["all", "suggested", "approved", "ordered", "received", "cancelled"].map((value) => <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`rounded-full border px-3 py-1.5 text-xs capitalize ${filter === value ? "border-sage-700 bg-sage-700 text-white" : "border-sand-200 text-sage-700"}`}>{value}</button>)}</div>
        {query.isPending ? <p role="status" className="py-10 text-center text-sm">Loading orders…</p> : query.isError ? <p role="alert" className="py-10 text-center text-sm text-rose-700">{query.error instanceof Error ? query.error.message : "Could not load orders."}</p> : visible.length === 0 ? <p className="py-10 text-center text-sm text-sage-700">No purchase orders in this view.</p> : <ul className="space-y-3">{visible.map((order) => <li key={order.id} className="rounded-xl border border-sand-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-medium text-sage-950">{query.data?.names.get(order.item_id) ?? order.item_id}</p><p className="mt-1 text-sm text-sage-700">{Number(order.quantity).toLocaleString("en-IN")} units · {order.supplier || "Supplier not assigned"} · ₹{Number(order.total_cost).toLocaleString("en-IN")}</p><p className="mt-2 text-xs capitalize text-sage-600">{order.status} · Expected {order.expected_on ? new Date(`${order.expected_on}T00:00:00`).toLocaleDateString("en-IN") : "date not set"}</p></div><div className="flex flex-wrap gap-2">{order.status === "suggested" && canApprove && <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: order.id, action: "approve" })} className="rounded-lg bg-sage-700 px-3 py-2 text-xs text-white disabled:opacity-50">Approve</button>}{["approved", "ordered"].includes(order.status) && canReceive && <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: order.id, action: "receive" })} className="rounded-lg border border-sage-300 px-3 py-2 text-xs text-sage-800 disabled:opacity-50">Receive stock</button>}{["suggested", "approved", "ordered"].includes(order.status) && canApprove && <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: order.id, action: "cancel" })} className="rounded-lg border border-rose-200 px-3 py-2 text-xs text-rose-700 disabled:opacity-50">Cancel</button>}</div></div></li>)}</ul>}
        {mutation.isError && <p role="alert" className="mt-4 text-sm text-rose-700">{mutation.error instanceof Error ? mutation.error.message : "Could not update order."}</p>}
      </PanelBody></Panel>
    </>}
  </div>;
}
