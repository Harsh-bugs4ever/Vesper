"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { AdminDepartmentBudgets } from "@/components/connected/admin-department-budgets";
import { CapitalPlan } from "@/components/connected/capital-plan";

export default function BudgetsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"budgets" | "capex">("budgets");
  const isAllowed = user?.role === "general_manager" || user?.role === "owner";

  if (!isAllowed) {
    return (
      <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Department budgets and allocation management are restricted to Property Owners, General Managers, and authorized finance oversight.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-sand-950">Budgets & CapEx</h1>
        <p className="mt-1 text-sm text-sand-600">Department spending controls and the capital project plan.</p>
      </div>
      <div className="flex gap-2 border-b border-sand-200">
        {([ ["budgets", "Department Budgets"], ["capex", "Capital Plan"] ] as const).map(([tab, label]) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`border-b-2 px-4 py-3 text-sm font-medium ${activeTab === tab ? "border-sage-700 text-sage-900" : "border-transparent text-sand-600 hover:text-sand-900"}`}>
            {label}
          </button>
        ))}
      </div>
      {activeTab === "budgets" ? <AdminDepartmentBudgets /> : <CapitalPlan />}
    </div>
  );
}

