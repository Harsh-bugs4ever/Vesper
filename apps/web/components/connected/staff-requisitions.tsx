"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FilePlus2,
  Package,
  Plus,
  RefreshCw,
  Trash2,
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

interface LineDraft {
  item_id: string;
  quantity: string;
  reason: string;
}

export function StaffRequisitions() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<RequisitionOut | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [viewHistory, setViewHistory] = useState<RequisitionOut | null>(null);

  // Form draft state
  const [requestReason, setRequestReason] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([
    { item_id: "", quantity: "1", reason: "" },
  ]);

  const queryKey = ["requisitions", "mine", user?.propertyId, user?.id];

  const {
    data: myRequisitions = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey,
    queryFn: () => requisitions.mine(),
    enabled: Boolean(user),
  });

  const { data: stockItems = [] } = useQuery({
    queryKey: ["inventory", "items", user?.propertyId],
    queryFn: () => inventory.items(),
    enabled: Boolean(user && isCreateOpen),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (lines.length === 0) {
        throw new Error("Add at least one item line to submit.");
      }
      const validLines = lines.map((l) => {
        const qty = parseFloat(l.quantity);
        if (!l.item_id) throw new Error("Please select a stock item for all lines.");
        if (isNaN(qty) || qty <= 0) throw new Error("Quantity must be greater than zero.");
        if (!l.reason || l.reason.trim().length < 3)
          throw new Error("Please provide a reason (at least 3 characters) for each item.");
        return {
          item_id: l.item_id,
          quantity: qty,
          reason: l.reason.trim(),
        };
      });

      return requisitions.submit({
        reason: requestReason.trim() || undefined,
        items: validLines,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      showToast({
        title: "Requisition Submitted",
        description: "Your inventory request has been routed to your department manager.",
        type: "success",
      });
      setIsCreateOpen(false);
      setRequestReason("");
      setLines([{ item_id: "", quantity: "1", reason: "" }]);
    },
    onError: (err: unknown) => {
      showToast({
        title: "Submission Failed",
        description: err instanceof Error ? err.message : "Could not submit requisition.",
        type: "error",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return requisitions.cancel(id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      showToast({
        title: "Requisition Cancelled",
        description: "Your pending request has been cancelled.",
        type: "default",
      });
      setCancelTarget(null);
      setCancelReason("");
    },
    onError: (err: unknown) => {
      showToast({
        title: "Cancellation Failed",
        description: err instanceof Error ? err.message : "Could not cancel requisition.",
        type: "error",
      });
    },
  });

  const addLine = () => {
    setLines([...lines, { item_id: "", quantity: "1", reason: "" }]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof LineDraft, value: string) => {
    setLines(
      lines.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    );
  };

  const canSubmit = hasPermission("requisition:write");

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
          <h2 className="font-serif text-2xl font-semibold text-sand-950">
            Department Requisitions
          </h2>
          <p className="mt-1 text-sm text-sand-600">
            Submit inventory supply requests to your department manager and track live approval status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
          {canSubmit && (
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="gap-1.5"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              New Requisition
            </Button>
          )}
        </div>
      </div>

      <Panel>
        <PanelHeader
          title="My Requisition History"
          description={`Showing ${myRequisitions.length} request(s) submitted for your authenticated department.`}
        />
        <PanelBody className="space-y-4 p-5 sm:p-6">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-sand-500">
              Loading requisitions…
            </div>
          ) : isError ? (
            <div className="py-12 text-center text-sm text-rose-700">
              Failed to load requisitions.
            </div>
          ) : myRequisitions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-sand-200 p-8 text-center">
              <Package className="mx-auto h-8 w-8 text-sand-400" />
              <p className="mt-2 text-sm font-medium text-sand-800">
                No requisitions yet
              </p>
              <p className="mt-1 text-xs text-sand-500">
                Need supplies for your shift? Submit a request with items and quantities.
              </p>
              {canSubmit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-4"
                >
                  Create Requisition
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {myRequisitions.map((req) => {
                const totalCost = req.lines.reduce(
                  (sum, line) => sum + Number(line.quantity) * Number(line.unit_cost),
                  0
                );

                return (
                  <article
                    key={req.id}
                    className="rounded-xl border border-sand-200/80 bg-white p-5 shadow-xs transition-colors hover:border-sand-300"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-semibold text-sand-700">
                            #{req.id.slice(0, 8)}
                          </span>
                          {statusBadge(req.status)}
                          <span className="text-xs text-sand-500">
                            Submitted on {new Date(req.created_at).toLocaleDateString("en-IN", {
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
                        {req.decision_reason && (
                          <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-sand-50 p-2.5 text-xs text-sand-700">
                            <span className="font-semibold text-sand-900">
                              Manager Note:
                            </span>
                            <span>{req.decision_reason}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewHistory(req)}
                        >
                          Audit History ({req.history.length})
                        </Button>
                        {req.status === "submitted" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => {
                              setCancelTarget(req);
                              setCancelReason("");
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 border-t border-sand-100 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-sand-500">
                        Requested Items ({req.lines.length})
                      </p>
                      <ul className="mt-2 divide-y divide-sand-50">
                        {req.lines.map((line) => (
                          <li
                            key={line.id}
                            className="flex flex-wrap items-center justify-between py-2 text-xs"
                          >
                            <div>
                              <span className="font-medium text-sand-900">
                                Item SKU / ID: {line.item_id.slice(0, 8)}…
                              </span>
                              <span className="ml-2 text-sand-600">
                                — {line.reason}
                              </span>
                            </div>
                            <div className="text-right tabular-nums">
                              <span className="font-semibold text-sand-900">
                                {line.quantity} units
                              </span>
                              <span className="ml-2 text-sand-500">
                                @ ₹{Number(line.unit_cost).toFixed(2)} (₹
                                {(Number(line.quantity) * Number(line.unit_cost)).toFixed(2)})
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex justify-end border-t border-sand-100 pt-2 text-xs">
                        <span className="font-medium text-sand-600">Estimated Total:</span>
                        <span className="ml-2 font-semibold text-sand-950">
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

      {/* New Requisition Drawer Modal */}
      <Drawer
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="Submit Inventory Requisition"
        description="Raise a supply order for items needed by your department."
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              disabled={submitMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "Submitting…" : "Submit to Manager"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-sand-700">
              General Requisition Reason (Optional)
            </label>
            <Input
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              placeholder="e.g. Weekend linen replenishment for 4th floor"
              className="mt-1.5"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-sand-700">
                Supply Items & Quantities
              </label>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 text-xs font-medium text-sage-700 hover:text-sage-900"
              >
                <Plus className="h-3.5 w-3.5" /> Add Item
              </button>
            </div>

            <div className="mt-3 space-y-4">
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-sand-200 bg-sand-50/50 p-3 text-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sand-700">
                      Line #{idx + 1}
                    </span>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="text-sand-400 hover:text-rose-600"
                        title="Remove line"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="block text-sand-600">Stock Item</label>
                      <select
                        value={line.item_id}
                        onChange={(e) => updateLine(idx, "item_id", e.target.value)}
                        className="mt-1 w-full rounded-lg border border-sand-200 bg-white p-2 text-xs text-sand-900 focus:border-sage-500 focus:outline-none"
                      >
                        <option value="">Select an available item…</option>
                        {stockItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.sku}) · ₹{Number(item.unit_cost).toFixed(2)} / {item.unit}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sand-600">Quantity</label>
                      <Input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                        className="mt-1 h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sand-600">Item Justification Reason</label>
                    <Input
                      value={line.reason}
                      onChange={(e) => updateLine(idx, "reason", e.target.value)}
                      placeholder="e.g. Current stock worn or damaged"
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Drawer>

      {/* Cancel Requisition Confirmation Drawer */}
      <Drawer
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel Pending Requisition"
        description={
          cancelTarget
            ? `Requisition #${cancelTarget.id.slice(0, 8)} will be cancelled.`
            : undefined
        }
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCancelTarget(null)}
              disabled={cancelMutation.isPending}
            >
              Back
            </Button>
            <Button
              size="sm"
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                if (cancelTarget) {
                  cancelMutation.mutate({
                    id: cancelTarget.id,
                    reason: cancelReason.trim() || "Cancelled by requester",
                  });
                }
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling…" : "Confirm Cancel"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-sand-600">
            You may cancel this requisition because it has not yet been decided by your department manager. Please state a reason for the audit log:
          </p>
          <Input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g. Items sourced from alternative store room"
          />
        </div>
      </Drawer>

      {/* Audit History Timeline Drawer */}
      <Drawer
        open={viewHistory !== null}
        onOpenChange={(open) => !open && setViewHistory(null)}
        title="Requisition Audit History"
        description={
          viewHistory
            ? `Tracking audit events for Requisition #${viewHistory.id.slice(0, 8)}`
            : undefined
        }
        footer={
          <Button size="sm" onClick={() => setViewHistory(null)}>
            Close
          </Button>
        }
      >
        {viewHistory && (
          <div className="space-y-4">
            <div className="relative pl-6 before:absolute before:bottom-0 before:left-2.5 before:top-2 before:w-0.5 before:bg-sand-200">
              {viewHistory.history.map((event, idx) => (
                <div key={idx} className="relative mb-5 last:mb-0">
                  <span className="absolute -left-6 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sand-400 ring-4 ring-white" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold capitalize text-sand-900 text-xs">
                        Action: {event.action}
                      </span>
                      <span className="text-[11px] text-sand-500">
                        {new Date(event.created_at).toLocaleString("en-IN")}
                      </span>
                    </div>
                    {event.reason && (
                      <p className="mt-1 text-xs text-sand-600 bg-sand-50 p-2 rounded-lg">
                        {event.reason}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-sand-400">
                      Actor ID: {event.actor_id}
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
