"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";
import { procurement } from "@/lib/api/procurement";

export default function BudgetsPage() {
  const { user, property } = useAuth();
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const isGM = user?.role === "general_manager";
  const departments = useQuery({ queryKey: ["procurement", "departments", user?.propertyId, user?.id, user?.departmentId], queryFn: procurement.departments, enabled: Boolean(user && isGM) });
  if (!isGM) return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6">Department budgets are restricted to the General Manager.</div>;
  return <div className="space-y-6"><PageHeader title="Department budgets" description="Allocated, committed, spent and remaining amounts by period" />
    <label className="block max-w-xs text-sm text-sand-700">Period<input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1 block w-full rounded-xl border border-sand-200 bg-white px-3 py-2" /></label>
    <Panel><PanelBody className="space-y-4 p-5"><p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Budget amounts are unavailable. The backend has no budget endpoint for the selected period; a stock valuation or purchase-order total is not a budget allocation.</p><p className="text-sm text-sand-600">Currency: {property?.currency ?? "unavailable"}</p>
      {departments.isPending ? <p role="status">Loading departments…</p> : departments.isError ? <p role="alert" className="text-rose-700">{departments.error instanceof Error ? departments.error.message : "Departments unavailable."}</p> : departments.data?.length === 0 ? <p>No authorized departments returned.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b text-sand-500"><th className="py-2">Department</th><th>Allocated</th><th>Committed</th><th>Spent</th><th>Remaining</th></tr></thead><tbody>{departments.data?.map((department) => <tr key={department.id} className="border-b border-sand-100"><td className="py-3 font-medium">{department.name}</td><td>Unavailable</td><td>Unavailable</td><td>Unavailable</td><td>Unavailable</td></tr>)}</tbody></table></div>}
    </PanelBody></Panel>
  </div>;
}
