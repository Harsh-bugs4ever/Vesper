"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { procurement } from "@/lib/api/procurement";

const errorText = (error: unknown) => error instanceof Error ? error.message : "Inventory is unavailable.";

export default function InventoryPage() {
  const { user, property, hasPermission } = useAuth();
  const scope = [user?.propertyId, user?.id, user?.departmentId];
  const permitted = Boolean(user && hasPermission("stock:read"));
  const items = useQuery({ queryKey: ["procurement", "items", ...scope], queryFn: procurement.items, enabled: permitted });
  const summary = useQuery({ queryKey: ["procurement", "summary", ...scope], queryFn: procurement.summary, enabled: permitted });
  const departments = useQuery({ queryKey: ["procurement", "departments", ...scope], queryFn: procurement.departments, enabled: permitted });
  const orders = useQuery({ queryKey: ["procurement", "orders", ...scope], queryFn: procurement.orders, enabled: permitted });
  const currency = property?.currency;
  const money = (value: number) => currency ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value) : String(value);
  const assignedDepartment = departments.data?.find((department) => department.id === user?.departmentId)?.name;

  if (!permitted) return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6">Inventory access requires stock:read permission from the backend.</div>;
  return <div className="space-y-6">
    <PageHeader title="Inventory" description={assignedDepartment ? `Live stock · ${assignedDepartment}` : "Live stock for your authorized departments"} actions={<Button variant="outline" onClick={() => { void items.refetch(); void summary.refetch(); void orders.refetch(); }}>Refresh</Button>} />
    {departments.data && <div className="flex flex-wrap gap-2" aria-label="Authorized departments">{departments.data.map((department) => <span key={department.id} className="rounded-full border border-sand-200 bg-white px-3 py-1 text-xs text-sand-700">{department.name}</span>)}</div>}
    {departments.isError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Department options unavailable: {errorText(departments.error)}</p>}
    {summary.isError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Stock summary unavailable: {errorText(summary.error)}</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {([ ["Stock items", summary.data?.total_items], ["Low stock", summary.data?.low_stock_items], ["Expiring", summary.data?.expiring_items], ["Stock value", summary.data ? money(summary.data.stock_value) : undefined], ["PO suggestions", summary.data?.pending_suggestions] ] as const).map(([label, value]) => <div key={label} className="rounded-xl border border-sand-200 bg-white p-5"><p className="text-sm text-sand-600">{label}</p><p className="mt-2 font-serif text-3xl text-sand-950">{value ?? "—"}</p></div>)}
    </div>
    <Panel><PanelBody className="space-y-4 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-serif text-xl">Stock on hand</h2><Link href="/admin/purchase-orders" className="text-sm font-medium text-sage-700 underline">Purchase orders</Link></div>
      {items.isPending ? <p role="status">Loading stock…</p> : items.isError ? <p role="alert" className="text-rose-700">{errorText(items.error)}</p> : items.data?.length === 0 ? <p>No stock items returned for your authorized scope.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b text-sand-500"><th className="py-2">Item</th><th>Category</th><th>On hand</th><th>Minimum</th><th>Status</th></tr></thead><tbody>{items.data?.map((item) => <tr key={item.id} className="border-b border-sand-100"><td className="py-3 font-medium">{item.name}<span className="block text-xs text-sand-500">{item.sku}</span></td><td>{item.category}</td><td>{item.quantity} {item.unit}</td><td>{item.minimum_quantity} {item.unit}</td><td>{item.is_low ? "Low stock" : item.days_to_expiry !== null && item.days_to_expiry <= 0 ? "Expired" : "Available"}</td></tr>)}</tbody></table></div>}
    </PanelBody></Panel>
    <Panel><PanelBody className="space-y-2 p-5"><h2 className="font-serif text-xl">Pending requisitions</h2><p className="text-sm text-sand-600">Unavailable: the backend does not provide requisition list, approval or rejection endpoints.</p></PanelBody></Panel>
    {user?.role === "general_manager" && <p className="text-sm text-sand-600">Department filtering needs department IDs in stock-item and purchase-order responses; the current API returns only backend-scoped lists.</p>}
    {orders.isError && <p role="alert" className="text-sm text-rose-700">Purchase-order status unavailable: {errorText(orders.error)}</p>}
  </div>;
}
