"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";
import { Panel, PanelBody } from "@/components/ui/panel";

type Issue = { id: string; summary: string; room_number: string | null; asset_id: string | null; status: string; severity: string; created_at: string };
type Order = { id: string; asset_id: string; title: string; status: string; priority: string; task_id: string | null; scheduled_for: string | null };
const errorText = (error: unknown) => error instanceof ApiError && error.status === 403 ? "The backend denied access to this department." : error instanceof Error ? error.message : "Data unavailable.";

export function MaintenancePanel() {
  const { user, hasPermission } = useAuth();
  const scope = [user?.propertyId, user?.id, user?.departmentId];
  const issues = useQuery({ queryKey: ["phase3", "issues", ...scope], queryFn: () => api.get<Issue[]>("/issues"), enabled: Boolean(user && hasPermission("issues:write")) });
  const orders = useQuery({ queryKey: ["phase3", "work-orders", ...scope], queryFn: () => api.get<Order[]>("/maintenance/work-orders"), enabled: Boolean(user && hasPermission("workorder:approve")) });
  return <Panel><PanelBody className="space-y-4 p-5"><div><h2 className="font-serif text-xl">Maintenance and room defects</h2><p className="text-sm text-sand-600">Reported defects and backend-authorized work orders.</p></div>
    {!hasPermission("issues:write") ? <p className="text-sm">Defect records are unavailable for your role.</p> : issues.isPending ? <p role="status">Loading defects…</p> : issues.isError ? <p role="alert" className="text-rose-700">{errorText(issues.error)}</p> : issues.data?.length === 0 ? <p>No defects reported.</p> : <div className="space-y-2">{issues.data?.map((issue) => <article key={issue.id} className="rounded-xl border border-sand-200 p-3"><p className="font-semibold">{issue.summary}</p><p className="text-xs text-sand-600">{issue.room_number ? `Room ${issue.room_number} · ` : ""}{issue.status} · {issue.severity}</p>{issue.asset_id && orders.data && <p className="text-xs text-sand-600">Linked work orders: {orders.data.filter((order) => order.asset_id === issue.asset_id).map((order) => `${order.title} (${order.status})`).join(", ") || "None returned"}</p>}</article>)}</div>}
    {!hasPermission("workorder:approve") ? <p className="text-sm text-sand-500">Engineering work orders require workorder:approve permission.</p> : orders.isPending ? <p role="status">Loading work orders…</p> : orders.isError ? <p role="alert" className="text-rose-700">{errorText(orders.error)}</p> : orders.data?.length === 0 ? <p>No work orders returned.</p> : <div className="space-y-2"><h3 className="font-semibold">Authorized work orders</h3>{orders.data?.map((order) => <article key={order.id} className="rounded-xl border border-sand-200 p-3"><p className="font-semibold">{order.title}</p><p className="text-xs text-sand-600">{order.status} · {order.priority}{order.scheduled_for ? ` · ${order.scheduled_for}` : ""}</p></article>)}</div>}
  </PanelBody></Panel>;
}
