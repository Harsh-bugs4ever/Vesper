"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  DollarSign,
  HelpCircle,
  IndianRupee,
  Layers,
  Plus,
  RefreshCw,
  Sliders,
  Wallet,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import {
  budgets,
  departments,
  type BudgetOut,
  type DepartmentOut,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export function AdminDepartmentBudgets() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [selectedDept, setSelectedDept] = useState("all");
  const [showRules, setShowRules] = useState(false);

  // GM Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newDeptId, setNewDeptId] = useState("");
  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodEnd, setNewPeriodEnd] = useState("");
  const [newCurrency, setNewCurrency] = useState("INR");
  const [newAllocated, setNewAllocated] = useState("100000");

  const [adjustTarget, setAdjustTarget] = useState<BudgetOut | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");

  const key = ["admin-budgets", user?.propertyId, selectedDept];

  const {
    data: budgetList = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: key,
    queryFn: () =>
      budgets.list(selectedDept === "all" ? undefined : { department_id: selectedDept }),
    enabled: Boolean(user),
  });

  const { data: deptList = [] } = useQuery({
    queryKey: ["property-departments", user?.propertyId],
    queryFn: () => departments.list(),
    enabled: Boolean(user),
  });

  const deptMap = new Map(deptList.map((d) => [d.id, d]));

  const canManage =
    hasPermission("budget:manage") || user?.role === "general_manager" || user?.role === "gm";

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newDeptId) throw new Error("Select a department.");
      if (!newPeriodStart || !newPeriodEnd)
        throw new Error("Start and end dates are required.");
      const amt = parseFloat(newAllocated);
      if (isNaN(amt) || amt < 0)
        throw new Error("Allocation amount must be a positive number.");

      return budgets.create({
        department_id: newDeptId,
        period_start: newPeriodStart,
        period_end: newPeriodEnd,
        currency: newCurrency.toUpperCase(),
        allocated: amt,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-budgets"] });
      showToast({
        title: "Budget Created",
        description: "New departmental allocation is now active.",
        type: "success",
      });
      setIsCreateOpen(false);
      setNewDeptId("");
      setNewPeriodStart("");
      setNewPeriodEnd("");
    },
    onError: (err: unknown) => {
      showToast({
        title: "Creation Failed",
        description: err instanceof Error ? err.message : "Could not create budget.",
        type: "error",
      });
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async ({ id, allocated }: { id: string; allocated: number }) => {
      return budgets.updateAllocation(id, allocated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-budgets"] });
      showToast({
        title: "Allocation Updated",
        description: "Department budget allocation was updated successfully.",
        type: "success",
      });
      setAdjustTarget(null);
      setAdjustAmount("");
    },
    onError: (err: unknown) => {
      showToast({
        title: "Adjustment Failed",
        description:
          err instanceof Error
            ? err.message
            : "Could not update allocation. Allocation cannot fall below committed + spent.",
        type: "error",
      });
    },
  });

  // Aggregated property totals across all viewed budgets
  const totalAllocated = budgetList.reduce((acc, b) => acc + Number(b.allocated), 0);
  const totalCommitted = budgetList.reduce((acc, b) => acc + Number(b.committed), 0);
  const totalSpent = budgetList.reduce((acc, b) => acc + Number(b.spent), 0);
  const totalRemaining = budgetList.reduce((acc, b) => acc + Number(b.remaining), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl font-semibold text-sand-950">
            Departmental Budgets & Accounting
          </h2>
          <p className="mt-1 text-sm text-sand-600">
            Period budget encumbrances, committed purchase orders, realized spend, and remaining departmental liquidity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRules(!showRules)}
            className="gap-1.5"
          >
            <BookOpen className="h-3.5 w-3.5" />
            {showRules ? "Hide Rules" : "Accounting Rules"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Refresh
          </Button>

          {canManage && (
            <Button
              size="sm"
              onClick={() => {
                setIsCreateOpen(true);
                if (deptList.length > 0 && !newDeptId) {
                  setNewDeptId(deptList[0].id);
                }
              }}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              New Budget Period
            </Button>
          )}
        </div>
      </div>

      {/* Accounting Rules Explainer Box */}
      {showRules && (
        <div className="rounded-2xl border border-sage-200 bg-sage-50/70 p-5 text-xs text-sand-800">
          <div className="flex items-center gap-2 font-semibold text-sage-950 text-sm">
            <HelpCircle className="h-4 w-4 text-sage-700" />
            Documented Financial Accounting Rules
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white p-3.5 border border-sage-100 shadow-2xs">
              <span className="font-semibold text-sage-900 block">1. Allocated</span>
              <p className="mt-1 text-sand-600 text-[11px]">
                The authorized budget cap set by the General Manager for the specific date window and property currency.
              </p>
            </div>
            <div className="rounded-xl bg-white p-3.5 border border-sage-100 shadow-2xs">
              <span className="font-semibold text-sage-900 block">2. Committed</span>
              <p className="mt-1 text-sand-600 text-[11px]">
                Unreceived cost of approved, ordered, or partially received POs: <code className="bg-sand-100 px-1 py-0.5 rounded">total_cost - rounded(received × unit_cost)</code>.
              </p>
            </div>
            <div className="rounded-xl bg-white p-3.5 border border-sage-100 shadow-2xs">
              <span className="font-semibold text-sage-900 block">3. Spent</span>
              <p className="mt-1 text-sand-600 text-[11px]">
                Realized expenditure: <code className="bg-sand-100 px-1 py-0.5 rounded">rounded((received - returned) × unit_cost)</code>. Returns immediately lower spent without double-counting.
              </p>
            </div>
            <div className="rounded-xl bg-white p-3.5 border border-sage-100 shadow-2xs">
              <span className="font-semibold text-sage-900 block">4. Remaining</span>
              <p className="mt-1 text-sand-600 text-[11px]">
                Available funds: <code className="bg-sand-100 px-1 py-0.5 rounded">allocated - committed - spent</code>. New requisition approvals lock and abort if estimate exceeds remaining.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Aggregate Overview Tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-sand-200/80 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-sand-600">Total Allocated</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-sand-950 tabular-nums">
            ₹{totalAllocated.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-[11px] text-sand-500">All departments</span>
        </div>

        <div className="rounded-xl border border-sand-200/80 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-amber-700">Committed (Encumbered)</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-amber-900 tabular-nums">
            ₹{totalCommitted.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-[11px] text-amber-700/80">Pending deliveries</span>
        </div>

        <div className="rounded-xl border border-sand-200/80 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-sage-700">Realized Spent</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-sage-950 tabular-nums">
            ₹{totalSpent.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-[11px] text-sage-700/80">Net delivered stock</span>
        </div>

        <div className="rounded-xl border border-sand-200/80 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-sand-600">Available Remaining</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-emerald-700 tabular-nums">
            ₹{totalRemaining.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-[11px] text-emerald-700/80">Unencumbered funds</span>
        </div>
      </div>

      <Panel>
        <PanelBody className="p-5 sm:p-6 space-y-5">
          {/* Department Filter Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold text-sand-700 uppercase tracking-wider">
              Department Filter:
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-xs text-sand-900 focus:border-sage-500 focus:outline-none"
            >
              <option value="all">All Authorized Departments</option>
              {deptList.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <p role="status" className="py-12 text-center text-sm text-sand-500">
              Loading department budgets…
            </p>
          ) : isError ? (
            <p role="alert" className="py-12 text-center text-sm text-rose-700">
              {error instanceof Error ? error.message : "Failed to load department budgets."}
            </p>
          ) : budgetList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-sand-200 p-8 text-center text-sand-500 text-sm">
              No budgets found for this selection.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {budgetList.map((b) => {
                const dept = deptMap.get(b.department_id);
                const deptName = dept?.name ?? `Department #${b.department_id.slice(0, 8)}`;

                const allocated = Number(b.allocated);
                const committed = Number(b.committed);
                const spent = Number(b.spent);
                const remaining = Number(b.remaining);

                const utilized = committed + spent;
                const percentUtilized =
                  allocated > 0 ? Math.min(100, (utilized / allocated) * 100) : 0;
                const percentSpent =
                  allocated > 0 ? Math.min(100, (spent / allocated) * 100) : 0;
                const percentCommitted =
                  allocated > 0 ? Math.min(100 - percentSpent, (committed / allocated) * 100) : 0;

                const isNearLimit = percentUtilized >= 80;
                const isOverdrawn = remaining <= 0;

                return (
                  <article
                    key={b.id}
                    className="rounded-2xl border border-sand-200/90 bg-white p-5 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sand-950 text-base">
                              {deptName}
                            </span>
                            <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-semibold text-sand-700 uppercase">
                              {b.currency}
                            </span>
                          </div>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-sand-500">
                            <Calendar className="h-3 w-3" />
                            {new Date(b.period_start).toLocaleDateString("en-IN")} –{" "}
                            {new Date(b.period_end).toLocaleDateString("en-IN")}
                          </p>
                        </div>

                        {canManage && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAdjustTarget(b);
                              setAdjustAmount(b.allocated.toString());
                            }}
                            className="gap-1 text-xs"
                          >
                            <Sliders className="h-3 w-3" />
                            Adjust
                          </Button>
                        )}
                      </div>

                      {/* Financial Bar */}
                      <div className="mt-5 space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-sand-600">
                            Budget Encumbrance:{" "}
                            <strong className="text-sand-900">
                              {percentUtilized.toFixed(1)}%
                            </strong>
                          </span>
                          <span
                            className={cn(
                              "font-medium",
                              isOverdrawn
                                ? "text-rose-600"
                                : isNearLimit
                                ? "text-amber-600"
                                : "text-emerald-700"
                            )}
                          >
                            {isOverdrawn
                              ? "Budget Exhausted"
                              : isNearLimit
                              ? "Near Allocation Limit"
                              : "Healthy Balance"}
                          </span>
                        </div>

                        {/* Segmented Progress Bar */}
                        <div className="h-3 w-full overflow-hidden rounded-full bg-sand-100 flex">
                          <div
                            style={{ width: `${percentSpent}%` }}
                            className="bg-sage-600 transition-all"
                            title={`Spent: ₹${spent.toFixed(2)} (${percentSpent.toFixed(1)}%)`}
                          />
                          <div
                            style={{ width: `${percentCommitted}%` }}
                            className="bg-amber-400 transition-all"
                            title={`Committed: ₹${committed.toFixed(2)} (${percentCommitted.toFixed(1)}%)`}
                          />
                        </div>

                        <div className="flex items-center gap-4 text-[10px] text-sand-500 pt-1">
                          <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-sage-600" /> Spent
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-amber-400" /> Committed
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-sand-200" /> Remaining
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown Matrix */}
                    <div className="mt-5 grid grid-cols-4 gap-2 border-t border-sand-100 pt-4 text-center">
                      <div>
                        <span className="block text-[11px] text-sand-500">Allocated</span>
                        <span className="text-xs font-semibold text-sand-900 tabular-nums">
                          ₹{allocated.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] text-sand-500">Committed</span>
                        <span className="text-xs font-semibold text-amber-700 tabular-nums">
                          ₹{committed.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] text-sand-500">Spent</span>
                        <span className="text-xs font-semibold text-sage-800 tabular-nums">
                          ₹{spent.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] text-sand-500">Remaining</span>
                        <span
                          className={cn(
                            "text-xs font-bold tabular-nums",
                            remaining > 0 ? "text-emerald-700" : "text-rose-600"
                          )}
                        >
                          ₹{remaining.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </PanelBody>
      </Panel>

      {/* Adjust Allocation Modal */}
      <Drawer
        open={adjustTarget !== null}
        onOpenChange={(open) => !open && setAdjustTarget(null)}
        title="Adjust Department Allocation"
        description={
          adjustTarget
            ? `Update period limit for ${
                deptMap.get(adjustTarget.department_id)?.name ?? "Department"
              }`
            : undefined
        }
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAdjustTarget(null)}
              disabled={adjustMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!adjustTarget) return;
                const amt = parseFloat(adjustAmount);
                if (isNaN(amt) || amt < 0) {
                  showToast({
                    title: "Invalid Amount",
                    description: "Please enter a non-negative allocation number.",
                    type: "warning",
                  });
                  return;
                }
                const minAllowed =
                  Number(adjustTarget.committed) + Number(adjustTarget.spent);
                if (amt < minAllowed) {
                  showToast({
                    title: "Allocation Conflict",
                    description: `Allocation cannot fall below committed plus spent (₹${minAllowed.toFixed(
                      2
                    )}).`,
                    type: "error",
                  });
                  return;
                }
                adjustMutation.mutate({
                  id: adjustTarget.id,
                  allocated: amt,
                });
              }}
              disabled={adjustMutation.isPending}
            >
              {adjustMutation.isPending ? "Updating…" : "Save Allocation"}
            </Button>
          </>
        }
      >
        {adjustTarget && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl bg-sand-50 p-3 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-sand-600">Currently Committed:</span>
                <span className="font-semibold text-sand-900">
                  ₹{Number(adjustTarget.committed).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sand-600">Realized Spent:</span>
                <span className="font-semibold text-sand-900">
                  ₹{Number(adjustTarget.spent).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t border-sand-200 pt-1 text-sand-800 font-medium">
                <span>Minimum Allowed Allocation:</span>
                <span className="font-bold text-amber-900">
                  ₹
                  {(
                    Number(adjustTarget.committed) + Number(adjustTarget.spent)
                  ).toFixed(2)}
                </span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-sand-700">
                New Allocated Amount ({adjustTarget.currency})
              </label>
              <Input
                type="number"
                min={
                  Number(adjustTarget.committed) + Number(adjustTarget.spent)
                }
                step="100"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        )}
      </Drawer>

      {/* New Budget Period Modal */}
      <Drawer
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="Create Department Budget Period"
        description="Establish an authorized allocation period for a department."
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create Budget"}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-sand-700">Department</label>
            <select
              value={newDeptId}
              onChange={(e) => setNewDeptId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-sand-200 bg-white p-2 text-xs text-sand-900 focus:border-sage-500 focus:outline-none"
            >
              {deptList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-sand-700">Period Start</label>
              <Input
                type="date"
                value={newPeriodStart}
                onChange={(e) => setNewPeriodStart(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="block font-semibold text-sand-700">Period End</label>
              <Input
                type="date"
                value={newPeriodEnd}
                onChange={(e) => setNewPeriodEnd(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-sand-700">Currency</label>
              <Input
                maxLength={3}
                value={newCurrency}
                onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
                className="mt-1 font-mono uppercase"
              />
            </div>
            <div>
              <label className="block font-semibold text-sand-700">Allocation Amount</label>
              <Input
                type="number"
                min="0"
                step="1000"
                value={newAllocated}
                onChange={(e) => setNewAllocated(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
