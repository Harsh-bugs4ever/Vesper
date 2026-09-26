"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  FileCheck2,
  FileX2,
  History,
  Package,
  RefreshCw,
  XCircle,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import {
  inventory,
  requisitions,
  type RequisitionOut,
  type StockItemOut,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export function AdminDepartmentRequisitions() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [statusFilter, setStatusFilter] = useState("all");

  // Decision Modal State
  const [decisionTarget, setDecisionTarget] = useState<{
    req: RequisitionOut;
    type: "approve" | "reject";
  } | null>(null);
  const [decisionReason, setDecisionReason] = useState("");

  // Audit History Drawer State
  const [auditTarget, setAuditTarget] = useState<RequisitionOut | null>(null);

  const key = ["admin-requisitions", user?.propertyId, user?.departmentId];

  const {
    data: reqList = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: key,
    queryFn: () => requisitions.list(),
    enabled: Boolean(user),
  });

  const { data: stockItems = [] } = useQuery({
    queryKey: ["inventory", "items", user?.propertyId],
    queryFn: () => inventory.items(),
    enabled: Boolean(user),
  });

  const itemMap = new Map(stockItems.map((i) => [i.id, i]));

  const decideMutation = useMutation({
    mutationFn: async ({
      id,
      approve,
      reason,
    }: {
      id: string;
      approve: boolean;
      reason: string;
    }) => {
      if (!reason || reason.trim().length < 3) {
        throw new Error("Please provide a decision rationale of at least 3 characters.");
      }
      return approve
        ? requisitions.approve(id, reason.trim())
        : requisitions.reject(id, reason.trim());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      showToast({
        title: variables.approve ? "Requisition Approved" : "Requisition Rejected",
        description: variables.approve
          ? "Approved request converted to purchase orders and committed to budget."
          : "Requisition marked as rejected with reason recorded.",
        type: variables.approve ? "success" : "default",
      });
      setDecisionTarget(null);
      setDecisionReason("");
    },
    onError: (err: unknown) => {
      showToast({
        title: "Decision Failed",
        description: err instanceof Error ? err.message : "Could not complete decision.",
        type: "error",
      });
    },
  });

  const canApprove = hasPermission("requisition:approve");

  const visible = reqList.filter((req) => {
    if (statusFilter === "all") return true;
    return req.status === statusFilter;
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            <Clock className="h-3 w-3" /> Submitted
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
            <CheckCircle2 className="h-3 w-3" /> Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-800">
            <XCircle className="h-3 w-3" /> Rejected
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-sand-700">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full border border-sand-200 bg-sand-50 px-2.5 py-0.5 text-xs font-medium text-sand-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl font-semibold text-sand-950">
            Department Staff Requisitions
          </h2>
          <p className="mt-1 text-sm text-sand-600">
            Review and authorize departmental supply requests. Approved requests create purchase orders idempotently against the department budget.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-sand-200/80 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-sand-600">Pending Review</p>
          <p className="mt-2 font-serif text-3xl font-semibold text-amber-700">
            {reqList.filter((r) => r.status === "submitted").length}
          </p>
        </div>
        <div className="rounded-xl border border-sand-200/80 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-sand-600">Approved</p>
          <p className="mt-2 font-serif text-3xl font-semibold text-emerald-700">
            {reqList.filter((r) => r.status === "approved").length}
          </p>
        </div>
        <div className="rounded-xl border border-sand-200/80 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-sand-600">Rejected</p>
          <p className="mt-2 font-serif text-3xl font-semibold text-rose-700">
            {reqList.filter((r) => r.status === "rejected").length}
          </p>
        </div>
        <div className="rounded-xl border border-sand-200/80 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-sand-600">Total Requests</p>
          <p className="mt-2 font-serif text-3xl font-semibold text-sand-950">
            {reqList.length}
          </p>
        </div>
      </div>

      <Panel>
        <PanelBody className="p-5 sm:p-6">
          {/* Status Filter Tabs */}
          <div className="mb-5 flex flex-wrap gap-2">
            {["all", "submitted", "approved", "rejected", "cancelled"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  statusFilter === st
                    ? "border-sage-700 bg-sage-700 text-white"
                    : "border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
                )}
              >
                {st}
              </button>
            ))}
          </div>

          {isLoading ? (
            <p role="status" className="py-12 text-center text-sm text-sand-500">
              Loading requisitions…
            </p>
          ) : isError ? (
            <p role="alert" className="py-12 text-center text-sm text-rose-700">
              {error instanceof Error ? error.message : "Failed to load requisitions."}
            </p>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-sand-200 p-8 text-center text-sand-500 text-sm">
              No requisitions in this view.
            </div>
          ) : (
            <div className="space-y-4">
              {visible.map((req) => {
                const totalCost = req.lines.reduce(
                  (sum, line) => sum + Number(line.quantity) * Number(line.unit_cost),
                  0
                );

                const isResponsibleManager =
                  canApprove && (user?.id === req.responsible_manager_id || user?.role === "general_manager");

                return (
                  <article
                    key={req.id}
                    className="rounded-xl border border-sand-200/80 bg-white p-5 shadow-xs transition-colors hover:border-sand-300"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-semibold text-sand-700">
                            Req #{req.id.slice(0, 8)}
                          </span>
                          {statusBadge(req.status)}
                          <span className="text-xs text-sand-500">
                            {new Date(req.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {req.reason && (
                          <p className="mt-2 text-sm font-medium text-sand-900">
                            "{req.reason}"
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap gap-4 text-xs text-sand-600">
                          <span>Requester: <strong className="text-sand-900">{req.requested_by.slice(0, 8)}…</strong></span>
                          <span>Manager: <strong className="text-sand-900">{req.responsible_manager_id.slice(0, 8)}…</strong></span>
                          <span>Currency: <strong className="text-sand-900">{req.currency}</strong></span>
                        </div>

                        {req.decision_reason && (
                          <div className="mt-2.5 rounded-lg bg-sand-50 p-2.5 text-xs text-sand-700">
                            <span className="font-semibold text-sand-900">
                              Decision Note ({req.decided_by ? req.decided_by.slice(0, 8) : "Manager"}):
                            </span>{" "}
                            {req.decision_reason}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAuditTarget(req)}
                        >
                          <History className="h-3.5 w-3.5" />
                          Audit Log ({req.history.length})
                        </Button>

                        {req.status === "submitted" && isResponsibleManager && (
                          <>
                            <Button
                              size="sm"
                              onClick={() =>
                                setDecisionTarget({ req, type: "approve" })
                              }
                              className="bg-sage-700 text-white hover:bg-sage-800"
                            >
                              <FileCheck2 className="h-3.5 w-3.5" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setDecisionTarget({ req, type: "reject" })
                              }
                              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            >
                              <FileX2 className="h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Requested items breakdown */}
                    <div className="mt-4 border-t border-sand-100 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-sand-500">
                        Line Items ({req.lines.length})
                      </p>
                      <ul className="mt-2 divide-y divide-sand-50 text-xs">
                        {req.lines.map((line) => {
                          const item = itemMap.get(line.item_id);
                          const name = item ? `${item.name} (${item.sku})` : `Item #${line.item_id.slice(0, 8)}`;
                          const lineTotal = Number(line.quantity) * Number(line.unit_cost);

                          return (
                            <li
                              key={line.id}
                              className="flex flex-wrap items-center justify-between py-2"
                            >
                              <div>
                                <span className="font-medium text-sand-900">{name}</span>
                                <span className="ml-2 text-sand-600">— {line.reason}</span>
                              </div>
                              <div className="text-right tabular-nums">
                                <span className="font-semibold text-sand-900">
                                  {line.quantity} units
                                </span>
                                <span className="ml-2 text-sand-500">
                                  @ ₹{Number(line.unit_cost).toFixed(2)} (₹{lineTotal.toFixed(2)})
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="mt-2 flex justify-end border-t border-sand-100 pt-2 text-xs">
                        <span className="font-medium text-sand-600">Total Commitment:</span>
                        <span className="ml-2 font-bold text-sand-950">
                          ₹{totalCost.toFixed(2)} {req.currency}
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

      {/* Decision Drawer Modal */}
      <Drawer
        open={decisionTarget !== null}
        onOpenChange={(open) => !open && setDecisionTarget(null)}
        title={
          decisionTarget?.type === "approve"
            ? "Approve Department Requisition"
            : "Reject Department Requisition"
        }
        description={
          decisionTarget
            ? `Deciding Requisition #${decisionTarget.req.id.slice(0, 8)}`
            : undefined
        }
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDecisionTarget(null)}
              disabled={decideMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className={
                decisionTarget?.type === "approve"
                  ? "bg-sage-700 text-white hover:bg-sage-800"
                  : "bg-rose-600 text-white hover:bg-rose-700"
              }
              onClick={() => {
                if (decisionTarget) {
                  decideMutation.mutate({
                    id: decisionTarget.req.id,
                    approve: decisionTarget.type === "approve",
                    reason: decisionReason,
                  });
                }
              }}
              disabled={decideMutation.isPending}
            >
              {decideMutation.isPending
                ? "Processing…"
                : decisionTarget?.type === "approve"
                ? "Confirm Approval & Create PO"
                : "Confirm Rejection"}
            </Button>
          </>
        }
      >
        {decisionTarget && (
          <div className="space-y-4">
            <p className="text-xs text-sand-600">
              {decisionTarget.type === "approve"
                ? "Approving this requisition will verify budget availability, commit funds against the department budget, and create purchase orders idempotently."
                : "Rejecting this requisition will mark it as rejected and notify the staff member."}
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-sand-700">
                Decision Rationale (Required)
              </label>
              <Input
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder={
                  decisionTarget.type === "approve"
                    ? "e.g. Approved after reviewing linen stock and occupancy forecast"
                    : "e.g. Current stock adequate or budget threshold reached"
                }
                className="mt-1.5"
              />
            </div>
          </div>
        )}
      </Drawer>

      {/* Audit History Drawer */}
      <Drawer
        open={auditTarget !== null}
        onOpenChange={(open) => !open && setAuditTarget(null)}
        title="Requisition Audit History"
        description={
          auditTarget
            ? `Immutable audit events for Requisition #${auditTarget.id.slice(0, 8)}`
            : undefined
        }
        footer={
          <Button size="sm" onClick={() => setAuditTarget(null)}>
            Close
          </Button>
        }
      >
        {auditTarget && (
          <div className="space-y-4">
            <div className="relative pl-6 before:absolute before:bottom-0 before:left-2.5 before:top-2 before:w-0.5 before:bg-sand-200">
              {auditTarget.history.map((item, idx) => (
                <div key={idx} className="relative mb-5 last:mb-0">
                  <span className="absolute -left-6 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sand-400 ring-4 ring-white" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold capitalize text-sand-900 text-xs">
                        Action: {item.action}
                      </span>
                      <span className="text-[11px] text-sand-500">
                        {new Date(item.created_at).toLocaleString("en-IN")}
                      </span>
                    </div>
                    {item.reason && (
                      <p className="mt-1 text-xs text-sand-600 bg-sand-50 p-2 rounded-lg">
                        {item.reason}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-sand-400">
                      Actor: {item.actor_id}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
