"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Clock,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Truck,
  XCircle,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import {
  inventory,
  purchaseOrders,
  type PurchaseOrderOut,
  type StockItemOut,
} from "@/lib/api";
import { cn } from "@/lib/utils";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function LivePurchaseOrders() {
  const { user, hasPermission, isConnected } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [filter, setFilter] = useState("all");

  // Modals state
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrderOut | null>(null);
  const [receiveQty, setReceiveQty] = useState("");
  const [isPartialReceipt, setIsPartialReceipt] = useState(false);

  const [returnTarget, setReturnTarget] = useState<PurchaseOrderOut | null>(null);
  const [returnQty, setReturnQty] = useState("");
  const [returnReason, setReturnReason] = useState("");

  const [cancelTarget, setCancelTarget] = useState<PurchaseOrderOut | null>(null);

  const key = ["purchase-orders", user?.propertyId ?? "", user?.id ?? ""];

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: key,
    enabled: isConnected && Boolean(user),
    queryFn: async () => {
      const [orders, items] = await Promise.all([
        purchaseOrders.list(),
        inventory.items(),
      ]);
      const itemMap = new Map(items.map((i) => [i.id, i]));
      return { orders, itemMap };
    },
  });

  const orders = data?.orders ?? [];
  const itemMap = data?.itemMap ?? new Map<string, StockItemOut>();

  const approveMutation = useMutation({
    mutationFn: (id: string) => purchaseOrders.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      showToast({
        title: "Purchase Order Approved",
        description: "The order is authorized and funds have been committed against the department budget.",
        type: "success",
      });
    },
    onError: (err: unknown) => {
      showToast({
        title: "Approval Failed",
        description: err instanceof Error ? err.message : "Could not approve purchase order.",
        type: "error",
      });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: async ({
      id,
      quantity,
      operation_id,
    }: {
      id: string;
      quantity?: number;
      operation_id?: string;
    }) => {
      return purchaseOrders.receive(id, { quantity, operation_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      showToast({
        title: "Goods Received",
        description: "Stock ledger and department budget expenditure have been updated.",
        type: "success",
      });
      setReceiveTarget(null);
      setReceiveQty("");
    },
    onError: (err: unknown) => {
      showToast({
        title: "Receipt Failed",
        description: err instanceof Error ? err.message : "Could not receive stock.",
        type: "error",
      });
    },
  });

  const returnMutation = useMutation({
    mutationFn: async ({
      id,
      quantity,
      operation_id,
      reason,
    }: {
      id: string;
      quantity: number;
      operation_id: string;
      reason: string;
    }) => {
      return purchaseOrders.returnOrder(id, { quantity, operation_id, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      showToast({
        title: "Stock Returned",
        description: "Return stock movement recorded and department budget spent adjusted.",
        type: "default",
      });
      setReturnTarget(null);
      setReturnQty("");
      setReturnReason("");
    },
    onError: (err: unknown) => {
      showToast({
        title: "Return Failed",
        description: err instanceof Error ? err.message : "Could not return stock.",
        type: "error",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => purchaseOrders.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      showToast({
        title: "Order Cancelled",
        description: "Unreceived commitments have been released back to available budget.",
        type: "default",
      });
      setCancelTarget(null);
    },
    onError: (err: unknown) => {
      showToast({
        title: "Cancel Failed",
        description: err instanceof Error ? err.message : "Could not cancel order.",
        type: "error",
      });
    },
  });

  const canApprove = hasPermission("purchase:approve");
  const canReceive = hasPermission("stock:write");

  const visible = orders.filter((order) => {
    if (filter === "all") return true;
    return order.status === filter;
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "suggested":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            <Clock className="h-3 w-3" /> Suggested
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800">
            <CheckCircle2 className="h-3 w-3" /> Approved
          </span>
        );
      case "ordered":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
            <Truck className="h-3 w-3" /> Ordered
          </span>
        );
      case "partially_received":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-800">
            <Boxes className="h-3 w-3" /> Partially Received
          </span>
        );
      case "received":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
            <PackageCheck className="h-3 w-3" /> Fully Received
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-sand-700">
            <XCircle className="h-3 w-3" /> Cancelled
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
      <PageHeader
        title="Purchase Orders"
        description="Authorize replenishment orders, track idempotent stock deliveries, and handle returns without budget double-counting."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {!isConnected ? (
        <Panel>
          <PanelBody className="py-12 text-center text-sm text-sand-600">
            Sign in with an authorized manager or general manager account to access purchase orders.
          </PanelBody>
        </Panel>
      ) : (
        <>
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-sand-200/80 bg-white p-5 shadow-xs">
              <p className="text-xs font-medium text-sand-600">Suggested</p>
              <p className="mt-2 font-serif text-3xl font-semibold text-sand-950">
                {orders.filter((o) => o.status === "suggested").length}
              </p>
            </div>
            <div className="rounded-xl border border-sand-200/80 bg-white p-5 shadow-xs">
              <p className="text-xs font-medium text-sand-600">Approved / Open</p>
              <p className="mt-2 font-serif text-3xl font-semibold text-sand-950">
                {
                  orders.filter((o) =>
                    ["approved", "ordered", "partially_received"].includes(o.status)
                  ).length
                }
              </p>
            </div>
            <div className="rounded-xl border border-sand-200/80 bg-white p-5 shadow-xs">
              <p className="text-xs font-medium text-sand-600">Fully Received</p>
              <p className="mt-2 font-serif text-3xl font-semibold text-emerald-800">
                {orders.filter((o) => o.status === "received").length}
              </p>
            </div>
            <div className="rounded-xl border border-sand-200/80 bg-white p-5 shadow-xs">
              <p className="text-xs font-medium text-sand-600">Cancelled</p>
              <p className="mt-2 font-serif text-3xl font-semibold text-sand-600">
                {orders.filter((o) => o.status === "cancelled").length}
              </p>
            </div>
          </div>

          <Panel>
            <PanelBody className="p-5 sm:p-6">
              {/* Filter Pills */}
              <div
                role="group"
                aria-label="Filter purchase orders"
                className="mb-5 flex flex-wrap gap-2"
              >
                {[
                  "all",
                  "suggested",
                  "approved",
                  "partially_received",
                  "received",
                  "cancelled",
                ].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFilter(val)}
                    aria-pressed={filter === val}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                      filter === val
                        ? "border-sage-700 bg-sage-700 text-white"
                        : "border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
                    )}
                  >
                    {val.replaceAll("_", " ")}
                  </button>
                ))}
              </div>

              {isLoading ? (
                <p role="status" className="py-12 text-center text-sm text-sand-500">
                  Loading purchase orders…
                </p>
              ) : isError ? (
                <p role="alert" className="py-12 text-center text-sm text-rose-700">
                  {error instanceof Error ? error.message : "Could not load purchase orders."}
                </p>
              ) : visible.length === 0 ? (
                <p className="py-12 text-center text-sm text-sand-500">
                  No purchase orders found matching this filter.
                </p>
              ) : (
                <div className="space-y-4">
                  {visible.map((order) => {
                    const item = itemMap.get(order.item_id);
                    const itemName = item?.name ?? `Item #${order.item_id.slice(0, 8)}`;
                    const itemUnit = item?.unit ?? "units";

                    const qtyOrdered = Number(order.quantity);
                    const qtyReceived = Number(order.received_quantity);
                    const qtyReturned = Number(order.returned_quantity);
                    const netReceived = Math.max(0, qtyReceived - qtyReturned);
                    const unreceived = Math.max(0, qtyOrdered - qtyReceived);

                    const canReceiveThis =
                      canReceive &&
                      ["approved", "ordered", "partially_received"].includes(order.status) &&
                      unreceived > 0;

                    const canReturnThis =
                      canReceive && netReceived > 0 && order.status !== "cancelled";

                    const canCancelThis =
                      canApprove &&
                      ["suggested", "approved", "ordered", "partially_received"].includes(
                        order.status
                      );

                    return (
                      <article
                        key={order.id}
                        className="rounded-xl border border-sand-200/80 bg-white p-5 shadow-xs transition-colors hover:border-sand-300"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono text-xs font-semibold text-sand-600">
                                PO #{order.id.slice(0, 8)}
                              </span>
                              {statusBadge(order.status)}
                              {order.request_line_id && (
                                <span className="rounded bg-sand-100 px-2 py-0.5 text-[10px] font-medium text-sand-700">
                                  From Requisition Line
                                </span>
                              )}
                            </div>

                            <h3 className="mt-1.5 font-medium text-sand-950">
                              {itemName}
                            </h3>
                            <p className="mt-0.5 text-xs text-sand-500">
                              Supplier: {order.supplier || "Standard Vendor"} · Currency:{" "}
                              {order.currency}
                              {order.expected_on &&
                                ` · Expected: ${new Date(
                                  order.expected_on
                                ).toLocaleDateString("en-IN")}`}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {order.status === "suggested" && canApprove && (
                              <Button
                                size="sm"
                                onClick={() => approveMutation.mutate(order.id)}
                                disabled={approveMutation.isPending}
                                className="bg-sage-700 text-white hover:bg-sage-800"
                              >
                                Approve PO
                              </Button>
                            )}

                            {canReceiveThis && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setReceiveTarget(order);
                                  setReceiveQty(unreceived.toString());
                                  setIsPartialReceipt(false);
                                }}
                                className="border-sage-300 text-sage-900 hover:bg-sage-50"
                              >
                                <ArrowDownLeft className="h-3.5 w-3.5" />
                                Receive Stock
                              </Button>
                            )}

                            {canReturnThis && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setReturnTarget(order);
                                  setReturnQty("");
                                  setReturnReason("");
                                }}
                                className="border-amber-300 text-amber-900 hover:bg-amber-50"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Return
                              </Button>
                            )}

                            {canCancelThis && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setCancelTarget(order)}
                                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Quantities & Financials Ledger */}
                        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-sand-100 pt-3 text-xs sm:grid-cols-4">
                          <div>
                            <span className="block text-sand-500">Ordered Quantity</span>
                            <span className="font-semibold text-sand-900 tabular-nums">
                              {qtyOrdered} {itemUnit}
                            </span>
                          </div>
                          <div>
                            <span className="block text-sand-500">Gross Received</span>
                            <span className="font-semibold text-emerald-700 tabular-nums">
                              {qtyReceived} {itemUnit}
                            </span>
                          </div>
                          <div>
                            <span className="block text-sand-500">Returned Units</span>
                            <span className="font-semibold text-amber-700 tabular-nums">
                              {qtyReturned} {itemUnit}
                            </span>
                          </div>
                          <div>
                            <span className="block text-sand-500">Financial Value</span>
                            <span className="font-semibold text-sand-950 tabular-nums">
                              ₹{Number(order.total_cost).toFixed(2)} (@ ₹
                              {Number(order.unit_cost).toFixed(2)})
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
        </>
      )}

      {/* Receive Stock Drawer Modal */}
      <Drawer
        open={receiveTarget !== null}
        onOpenChange={(open) => !open && setReceiveTarget(null)}
        title="Receive Purchase Order Items"
        description={
          receiveTarget
            ? `Recording delivery for PO #${receiveTarget.id.slice(0, 8)}`
            : undefined
        }
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReceiveTarget(null)}
              disabled={receiveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!receiveTarget) return;
                const qty = isPartialReceipt ? parseFloat(receiveQty) : undefined;
                if (isPartialReceipt && (isNaN(qty!) || qty! <= 0)) {
                  showToast({
                    title: "Invalid Quantity",
                    description: "Please enter a valid positive quantity for partial receipt.",
                    type: "warning",
                  });
                  return;
                }
                receiveMutation.mutate({
                  id: receiveTarget.id,
                  quantity: qty,
                  operation_id: generateUUID(),
                });
              }}
              disabled={receiveMutation.isPending}
            >
              {receiveMutation.isPending ? "Recording…" : "Confirm Receipt"}
            </Button>
          </>
        }
      >
        {receiveTarget && (
          <div className="space-y-4">
            <div className="rounded-xl bg-sand-50 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-sand-600">Total Ordered:</span>
                <span className="font-semibold">{receiveTarget.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sand-600">Already Received:</span>
                <span className="font-semibold">{receiveTarget.received_quantity}</span>
              </div>
              <div className="flex justify-between border-t border-sand-200 pt-1">
                <span className="text-sand-700 font-medium">Unreceived Balance:</span>
                <span className="font-bold text-sage-800">
                  {Math.max(
                    0,
                    Number(receiveTarget.quantity) - Number(receiveTarget.received_quantity)
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="partial-check"
                checked={isPartialReceipt}
                onChange={(e) => setIsPartialReceipt(e.target.checked)}
                className="h-4 w-4 rounded border-sand-300 text-sage-600 focus:ring-sage-500"
              />
              <label htmlFor="partial-check" className="text-xs font-medium text-sand-800">
                Record partial delivery (custom quantity)
              </label>
            </div>

            {isPartialReceipt && (
              <div>
                <label className="block text-xs font-semibold text-sand-700">
                  Received Quantity This Delivery
                </label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  max={Math.max(
                    0,
                    Number(receiveTarget.quantity) - Number(receiveTarget.received_quantity)
                  )}
                  value={receiveQty}
                  onChange={(e) => setReceiveQty(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            <p className="text-[11px] text-sand-500">
              Deliveries automatically increment stock balance, decrease committed budget, and increase actual spent without double-counting.
            </p>
          </div>
        )}
      </Drawer>

      {/* Return Stock Drawer Modal */}
      <Drawer
        open={returnTarget !== null}
        onOpenChange={(open) => !open && setReturnTarget(null)}
        title="Return Stock to Supplier"
        description={
          returnTarget
            ? `Return delivered goods for PO #${returnTarget.id.slice(0, 8)}`
            : undefined
        }
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReturnTarget(null)}
              disabled={returnMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => {
                if (!returnTarget) return;
                const qty = parseFloat(returnQty);
                const maxReturn =
                  Number(returnTarget.received_quantity) -
                  Number(returnTarget.returned_quantity);
                if (isNaN(qty) || qty <= 0 || qty > maxReturn) {
                  showToast({
                    title: "Invalid Return Quantity",
                    description: `Quantity must be between 0.1 and ${maxReturn}.`,
                    type: "warning",
                  });
                  return;
                }
                if (!returnReason.trim()) {
                  showToast({
                    title: "Reason Required",
                    description: "Please specify why the goods are being returned.",
                    type: "warning",
                  });
                  return;
                }
                returnMutation.mutate({
                  id: returnTarget.id,
                  quantity: qty,
                  operation_id: generateUUID(),
                  reason: returnReason.trim(),
                });
              }}
              disabled={returnMutation.isPending}
            >
              {returnMutation.isPending ? "Processing…" : "Confirm Return"}
            </Button>
          </>
        }
      >
        {returnTarget && (
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-50/60 p-3 text-xs space-y-1 text-amber-900 border border-amber-200/60">
              <div className="flex justify-between">
                <span>Maximum returnable net received:</span>
                <span className="font-bold">
                  {Math.max(
                    0,
                    Number(returnTarget.received_quantity) -
                      Number(returnTarget.returned_quantity)
                  )}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-sand-700">
                Quantity to Return
              </label>
              <Input
                type="number"
                min="0.1"
                step="0.1"
                max={
                  Number(returnTarget.received_quantity) -
                  Number(returnTarget.returned_quantity)
                }
                value={returnQty}
                onChange={(e) => setReturnQty(e.target.value)}
                placeholder="Enter quantity"
                className="mt-1"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-sand-700">
                Return Reason
              </label>
              <Input
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="e.g. Damaged packaging or incorrect specification"
                className="mt-1"
              />
            </div>

            <p className="text-[11px] text-sand-500">
              A negative stock movement will deduct the returned quantity and reduce the department's budget spent amount accordingly.
            </p>
          </div>
        )}
      </Drawer>

      {/* Cancel Order Confirmation Drawer */}
      <Drawer
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel Purchase Order"
        description={
          cancelTarget
            ? `Cancel PO #${cancelTarget.id.slice(0, 8)}`
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
                  cancelMutation.mutate(cancelTarget.id);
                }
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling…" : "Confirm Cancel"}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-sand-600">
          <p>
            Cancelling this order will immediately release any unreceived committed funds back to the department's budget remaining balance.
          </p>
          {cancelTarget && Number(cancelTarget.received_quantity) > 0 && (
            <p className="rounded-lg bg-amber-50 p-2 text-amber-800 border border-amber-200">
              Note: This order was partially received ({cancelTarget.received_quantity} units). Realized spending on already-received items will remain recorded.
            </p>
          )}
        </div>
      </Drawer>
    </div>
  );
}
