"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";
import { procurement } from "@/lib/api/procurement";

export default function StaffSuppliesPage() {
  const { user, hasPermission, isReady, isConnected } = useAuth();
  const permitted = Boolean(user && hasPermission("stock:read"));
  const items = useQuery({ queryKey: ["procurement", "items", user?.propertyId, user?.id, user?.departmentId], queryFn: procurement.items, enabled: permitted });
  if (!isReady) return <p role="status" className="p-8">Restoring your session…</p>;
  if (!isConnected) return <p className="p-8">Please <Link href="/login" className="underline">sign in</Link> to view supplies.</p>;
  return <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8"><Link href="/staff" className="text-sm text-sage-700 underline">Back to staff workspace</Link><PageHeader title="Supplies" description="Your authorized stock catalogue and persisted requests" />
    <Panel><PanelBody className="space-y-3 p-5"><h2 className="font-serif text-xl">Request supplies</h2>{!permitted ? <p role="alert">Your account does not have stock:read permission. The backend must authorize item access before a request can be prepared.</p> : items.isPending ? <p role="status">Loading authorized items…</p> : items.isError ? <p role="alert" className="text-rose-700">{items.error instanceof Error ? items.error.message : "Items unavailable."}</p> : items.data?.length === 0 ? <p>No authorized inventory items returned.</p> : <ul className="grid gap-2 sm:grid-cols-2">{items.data?.map((item) => <li key={item.id} className="rounded-xl border border-sand-200 p-3"><span className="font-medium">{item.name}</span><span className="block text-xs text-sand-500">{item.sku} · {item.category}</span></li>)}</ul>}<p className="text-sm text-sand-600">Submission is unavailable: the backend has no supply-requisition creation endpoint. No request can be saved yet.</p></PanelBody></Panel>
    <Panel><PanelBody className="space-y-2 p-5"><h2 className="font-serif text-xl">My requests</h2><p className="text-sm text-sand-600">Unavailable: the backend has no authenticated endpoint for a staff member’s persisted supply requests.</p></PanelBody></Panel>
  </div>;
}
