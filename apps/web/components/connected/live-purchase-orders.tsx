"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { procurement, type PurchaseOrder } from "@/lib/api/procurement";

const errorText = (error: unknown) => error instanceof ApiError && error.status === 409 ? `Conflict: ${error.message} Refresh the order before trying again.` : error instanceof ApiError && error.status === 403 ? "The backend denied this action for your department." : error instanceof Error ? error.message : "Purchase-order action failed.";

export function LivePurchaseOrders() {
  const { user, property, hasPermission } = useAuth();
  const client = useQueryClient();
  const { showToast } = useToast();
  const [filter, setFilter] = useState("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const scope = [user?.propertyId, user?.id, user?.departmentId];
  const permitted = Boolean(user && hasPermission("stock:read"));
  const orders = useQuery({ queryKey: ["procurement", "orders", ...scope], queryFn: procurement.orders, enabled: permitted });
  const items = useQuery({ queryKey: ["procurement", "items", ...scope], queryFn: procurement.items, enabled: permitted });
  const itemNames = new Map(items.data?.map((item) => [item.id, item.name]) ?? []);
  const currency = property?.currency;
  const formatMoney = (value: string | number) => currency ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value)) : `${value} (currency unavailable)`;
  const change = useMutation({
    mutationFn: ({ order, action }: { order: PurchaseOrder; action: "approve" | "receive" }) => action === "approve" ? procurement.approve(order.id) : procurement.receive(order.id),
    onSuccess: (saved, variables) => {
      setActionError(null);
      void client.invalidateQueries({ queryKey: ["procurement"] });
      showToast({ title: variables.action === "approve" ? "Order approved" : "Receipt recorded", description: `Server returned ${saved.status}.`, type: "success" });
    },
    onError: (error) => setActionError(errorText(error)),
  });
  const visible = orders.data?.filter((order) => filter === "all" || order.status === filter);

  if (!permitted) return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6">Purchase orders require stock:read permission from the backend.</div>;
  return <div className="space-y-6">
    <PageHeader title="Purchase orders" description="Approve suggested orders and record receipts against live stock." actions={<Button variant="outline" onClick={() => { void orders.refetch(); void items.refetch(); }}>Refresh</Button>} />
    {actionError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{actionError}</p>}
    <Panel><PanelBody className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter orders">{["all", "suggested", "approved", "ordered", "received", "cancelled"].map((status) => <Button key={status} variant={status === filter ? "default" : "outline"} size="sm" aria-pressed={status === filter} onClick={() => setFilter(status)} className="capitalize">{status}</Button>)}</div>
      {orders.isPending ? <p role="status">Loading orders…</p> : orders.isError ? <p role="alert" className="text-rose-700">{errorText(orders.error)}</p> : visible?.length === 0 ? <p>No purchase orders in this view.</p> : <ul className="space-y-3">{visible?.map((order) => <li key={order.id} className="rounded-xl border border-sand-200 p-4"><div className="flex flex-wrap justify-between gap-4"><div className="space-y-1"><h2 className="font-semibold text-sand-950">{itemNames.get(order.item_id) ?? `Item ${order.item_id}`}</h2><p className="text-sm text-sand-700">{order.quantity} · {formatMoney(order.total_cost)} · {order.supplier ?? "Supplier unavailable"}</p><p className="text-xs text-sand-500">{order.status} · Created {new Date(order.created_at).toLocaleString()}{order.expected_on ? ` · Expected ${order.expected_on}` : ""}</p><p className="text-xs text-sand-500">Approved {order.approved_at ? new Date(order.approved_at).toLocaleString() : "not yet"} · Received {order.received_at ? new Date(order.received_at).toLocaleString() : "not yet"}</p>{Object.keys(order.rationale).length > 0 && <div className="text-xs text-sand-600"><span className="font-semibold">Rationale: </span>{Object.entries(order.rationale).map(([key, value]) => `${key}: ${typeof value === "string" || typeof value === "number" ? value : JSON.stringify(value)}`).join(" · ")}</div>}</div><div className="flex items-start gap-2">{order.status === "suggested" && hasPermission("purchase:approve") && <Button size="sm" disabled={change.isPending} onClick={() => change.mutate({ order, action: "approve" })}>Approve</Button>}{["approved", "ordered"].includes(order.status) && hasPermission("stock:write") && <Button size="sm" variant="outline" disabled={change.isPending} onClick={() => change.mutate({ order, action: "receive" })}>Record receipt</Button>}</div></div></li>)}</ul>}
      {items.isError && <p role="alert" className="text-sm text-rose-700">Item names unavailable: {errorText(items.error)}</p>}
    </PanelBody></Panel>
    <Panel><PanelBody className="space-y-2 p-5"><h2 className="font-serif text-xl">Requisition decisions</h2><p className="text-sm text-sand-600">Rejection is unavailable because there is no requisition rejection endpoint that accepts a reason. Purchase-order cancellation is a different operation.</p><p className="text-sm text-sand-600">Requester, requisition items and decision history are unavailable in the current purchase-order response.</p></PanelBody></Panel>
  </div>;
}
