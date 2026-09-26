"use client";

import { useAuth } from "@/components/auth/auth-context";
import { AdminDepartmentBudgets } from "@/components/connected/admin-department-budgets";

export default function BudgetsPage() {
  const { user } = useAuth();
  const isGM = user?.role === "general_manager";
  
  if (!isGM) {
    return (
      <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Department budgets and allocation management are restricted to General Managers and authorized finance oversight.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminDepartmentBudgets />
    </div>
  );
}

