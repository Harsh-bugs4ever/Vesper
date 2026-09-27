"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Package, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { inventory } from "@/lib/api";

export function StaffRequisitions() {
  const { user } = useAuth();
  const stock = useQuery({
    queryKey: ["staff", "department-inventory", user?.propertyId, user?.departmentId],
    queryFn: () => inventory.items(),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });
  const rows = stock.data ?? [];
  const lowCount = rows.filter((item) => item.is_low).length;

  return (
    <Panel>
      <PanelHeader
        title="Department inventory"
        description="Live on-hand quantities for stock assigned to your department. Low items are replenished automatically."
        action={<Button variant="outline" size="sm" onClick={() => void stock.refetch()} disabled={stock.isFetching}><RefreshCw className={`h-3.5 w-3.5 ${stock.isFetching ? "animate-spin" : ""}`} />Refresh</Button>}
      />
      <PanelBody className="space-y-4 p-5 sm:p-6">
        {!stock.isPending && !stock.isError && <div className="flex flex-wrap items-center gap-3 rounded-xl bg-sand-50 px-4 py-3 text-sm">
          <span className="font-semibold text-sage-950">{rows.length} stocked items</span>
          <span className="text-sand-300">·</span>
          <span className={lowCount ? "inline-flex items-center gap-1.5 font-medium text-amber-800" : "font-medium text-emerald-800"}>{lowCount > 0 && <AlertTriangle className="h-3.5 w-3.5" />}{lowCount} below minimum</span>
          <span className="ml-auto text-[11px] text-sand-500">Updated automatically</span>
        </div>}
        {stock.isPending ? <p role="status" className="py-10 text-center text-sm text-sand-500">Loading department inventory…</p>
          : stock.isError ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Could not load department inventory.</p>
            : rows.length === 0 ? <div className="rounded-xl border border-dashed border-sand-200 p-8 text-center"><Package className="mx-auto h-8 w-8 text-sand-400" /><p className="mt-2 text-sm font-medium text-sand-800">No inventory assigned to this department</p><p className="mt-1 text-xs text-sand-500">Department stock will appear here when it is added to the inventory ledger.</p></div>
              : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map((item) => {
                const fill = item.minimum_quantity > 0 ? Math.min(100, Number(item.quantity) / Number(item.minimum_quantity) * 100) : 100;
                return <article key={item.id} className="rounded-xl border border-sand-200/80 bg-white p-4">
                  <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-sage-950">{item.name}</p><p className="mt-1 font-mono text-[10px] text-sand-500">{item.sku} · {item.category.replaceAll("_", " ")}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${item.is_low ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>{item.is_low ? "Low stock" : "Available"}</span></div>
                  <div className="mt-4 flex items-baseline justify-between"><span className="font-serif text-2xl font-semibold tabular-nums text-sage-950">{Number(item.quantity).toLocaleString("en-IN")}</span><span className="text-xs text-sand-500">{item.unit} on hand</span></div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand-100"><div className={`h-full rounded-full ${item.is_low ? "bg-amber-500" : "bg-sage-600"}`} style={{ width: `${fill}%` }} /></div>
                  <p className="mt-2 text-[10px] text-sand-500">Minimum level: {Number(item.minimum_quantity).toLocaleString("en-IN")} {item.unit}</p>
                </article>;
              })}</div>}
      </PanelBody>
    </Panel>
  );
}
