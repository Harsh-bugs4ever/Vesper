"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Download,
  IndianRupee,
  Loader2,
  MoreHorizontal,
  Package,
  PackageSearch,
  Plus,
  Search,
  ShoppingCart,
  TrendingDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { FilterChips } from "@/components/ui/filter-chips";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AdminDepartmentRequisitions } from "@/components/connected/admin-department-requisitions";
import { AdminDepartmentBudgets } from "@/components/connected/admin-department-budgets";

export interface BackendStockItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unit_cost: number;
  on_hand: number;
  minimum: number;
  expires_on: string | null;
  department_id: string;
  supplier?: string | null;
  is_low: boolean;
  days_to_expiry?: number | null;
}

export interface InventorySummaryData {
  total_items: number;
  low_stock_items: number;
  expiring_items: number;
  total_valuation?: number;
}

const ITEMS_PER_PAGE = 10;
type SortField = "name" | "category" | "on_hand" | "minimum" | "expires_on" | "is_low";
type SortDirection = "asc" | "desc";

export default function InventoryPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("is_low");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Movement drawer state
  const [movement, setMovement] = useState<{
    item: BackendStockItem;
    direction: "in" | "out";
  } | null>(null);
  const [quantity, setQuantity] = useState("");
  const [activeTab, setActiveTab] = useState<"stock" | "requisitions" | "budgets">("stock");
  const [movementNote, setMovementNote] = useState("");

  // 1. Fetch live inventory summary
  const { data: summary, isLoading: sumLoading } = useQuery<InventorySummaryData>({
    queryKey: ["inventory-summary"],
    queryFn: () => api.get<InventorySummaryData>("/inventory/summary"),
    refetchInterval: 30_000,
  });

  // 2. Fetch live inventory items
  const {
    data: items = [],
    isLoading: itemsLoading,
    isError: itemsError,
    refetch: refetchItems,
  } = useQuery<BackendStockItem[]>({
    queryKey: [
      "inventory-items",
      categoryFilter,
      statusFilter === "low",
      statusFilter === "expiring",
    ],
    queryFn: () =>
      api.get<BackendStockItem[]>("/inventory/items", {
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        low_only: statusFilter === "low" ? true : undefined,
        expiring_only: statusFilter === "expiring" ? true : undefined,
      }),
    refetchInterval: 30_000,
  });

  // Movement mutation
  const movementMutation = useMutation({
    mutationFn: async (payload: {
      itemId: string;
      quantity: number;
      reason: string;
      note?: string;
    }) => {
      return api.post(`/inventory/items/${payload.itemId}/movements`, {
        quantity: payload.quantity,
        reason: payload.reason,
        note: payload.note,
      });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      setMovement(null);
      setQuantity("");
      setMovementNote("");
      showToast({
        title: "Stock Movement Recorded",
        description: `Successfully ${vars.quantity > 0 ? "received" : "issued"} ${Math.abs(vars.quantity)} units on server.`,
        type: "success",
      });
    },
    onError: (err: any) => {
      showToast({
        title: "Movement Failed",
        description: err.message ?? "The inventory service rejected this update.",
        type: "error",
      });
    },
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (statusFilter === "low" && !item.is_low) return false;
      if (statusFilter === "expiring" && (item.days_to_expiry === null || item.days_to_expiry === undefined || item.days_to_expiry > 7)) {
        return false;
      }
      if (
        q &&
        !item.name.toLowerCase().includes(q) &&
        !item.sku.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [items, categoryFilter, statusFilter, searchQuery]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "is_low") {
        cmp = (a.is_low ? 1 : 0) - (b.is_low ? 1 : 0);
      } else if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === "category") {
        cmp = a.category.localeCompare(b.category);
      } else if (sortField === "on_hand") {
        cmp = a.on_hand - b.on_hand;
      } else if (sortField === "minimum") {
        cmp = a.minimum - b.minimum;
      } else if (sortField === "expires_on") {
        const da = a.expires_on ? new Date(a.expires_on).getTime() : Infinity;
        const db = b.expires_on ? new Date(b.expires_on).getTime() : Infinity;
        cmp = da - db;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDirection]);

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sorted.slice(start, start + ITEMS_PER_PAGE);
  }, [sorted, currentPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const applyMovement = () => {
    if (!movement) return;
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      showToast({
        title: "Invalid Quantity",
        description: "Please enter a positive numeric quantity.",
        type: "warning",
      });
      return;
    }

    const delta = movement.direction === "in" ? qty : -qty;
    movementMutation.mutate({
      itemId: movement.item.id,
      quantity: delta,
      reason: movement.direction === "in" ? "delivered" : "issued",
      note: movementNote || undefined,
    });
  };

  const totalValue = items.reduce(
    (sum, item) => sum + item.on_hand * (item.unit_cost || 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory & Stock Controls"
        description="Real-time stock valuation, par levels, safety thresholds, and warehouse movements."
      />

      {/* Operations Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-sand-200/80 pb-3" role="tablist" aria-label="Inventory operations">
        {[
          ["stock", "Stock Levels & Ledger"],
          ["requisitions", "Department Requisitions"],
          ["budgets", "Department Budgets & Caps"],
        ].map(([key, label]) => (
          <Button
            key={key}
            variant={activeTab === key ? "default" : "outline"}
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => setActiveTab(key as "stock" | "requisitions" | "budgets")}
            className="text-xs"
          >
            {label}
          </Button>
        ))}
      </div>

      {activeTab === "stock" && (
        <>
          {/* KPI Tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Tracked Catalog SKUs"
          value={summary?.total_items !== undefined ? summary.total_items.toString() : "—"}
          change={`${items.length} loaded`}
          comparison="Central warehouse items"
          tone="sand"
          icon={Package}
        />
        <StatTile
          label="Below Par / Low Stock"
          value={summary?.low_stock_items !== undefined ? summary.low_stock_items.toString() : "—"}
          change={
            summary?.low_stock_items ? "Reorders required" : "All levels satisfied"
          }
          comparison="Below safety threshold"
          tone={summary?.low_stock_items ? "rose" : "forest"}
          icon={AlertTriangle}
        />
        <StatTile
          label="Expiring Within 7 Days"
          value={summary?.expiring_items !== undefined ? summary.expiring_items.toString() : "—"}
          change={summary?.expiring_items ? "Sweep required" : "Zero batch warnings"}
          comparison="Shelf life monitor"
          tone={summary?.expiring_items ? "amber" : "sage"}
          icon={CalendarX2}
        />
        <StatTile
          label="Catalog Valuation"
          value={
            summary?.total_valuation !== undefined
              ? `₹${Math.round(summary.total_valuation).toLocaleString("en-IN")}`
              : totalValue > 0
              ? `₹${Math.round(totalValue).toLocaleString("en-IN")}`
              : "—"
          }
          change="Cost basis"
          comparison="Current warehouse value"
          tone="emerald"
          icon={IndianRupee}
        />
      </div>

      {/* Main Stock Table Panel */}
      <Panel>
        <PanelHeader
          title="Warehouse Stock Items"
          description="Live stock ledger synchronized with backend /inventory/items."
          action={
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-sand-400" />
                <input
                  type="text"
                  placeholder="Search SKU or item…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-sand-200 bg-white py-1.5 pl-8 pr-3 text-xs text-sand-900 placeholder:text-sand-400"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-xs text-sand-800"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-xs text-sand-800"
              >
                <option value="all">All Statuses</option>
                <option value="low">Low Stock Only</option>
                <option value="expiring">Expiring Soon</option>
              </select>
            </div>
          }
        />

        <PanelBody className="pt-4">
          {itemsLoading ? (
            <p role="status" className="py-12 text-center text-sm text-sand-500">
              Loading inventory catalog…
            </p>
          ) : itemsError ? (
            <div className="py-12 text-center text-sm text-rose-600">
              <p className="font-semibold">Failed to load inventory</p>
              <button
                type="button"
                onClick={() => refetchItems()}
                className="mt-2 text-xs underline"
              >
                Retry Request
              </button>
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-16 text-center text-sm text-sand-500">
              <PackageSearch className="mx-auto h-8 w-8 text-sand-300" />
              <p className="mt-2 font-semibold text-sand-800">No Matching Stock Items</p>
              <p className="text-xs text-sand-400 mt-1">
                No inventory entries match your filter or search criteria.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-sand-200 text-sand-500">
                    <th
                      onClick={() => handleSort("name")}
                      className="cursor-pointer pb-2 font-medium hover:text-sand-900"
                    >
                      Item & SKU
                    </th>
                    <th
                      onClick={() => handleSort("category")}
                      className="cursor-pointer pb-2 font-medium hover:text-sand-900"
                    >
                      Category
                    </th>
                    <th
                      onClick={() => handleSort("on_hand")}
                      className="cursor-pointer pb-2 text-right font-medium hover:text-sand-900"
                    >
                      On Hand
                    </th>
                    <th
                      onClick={() => handleSort("minimum")}
                      className="cursor-pointer pb-2 text-right font-medium hover:text-sand-900"
                    >
                      Par / Min
                    </th>
                    <th className="pb-2 text-right font-medium">Unit Cost</th>
                    <th
                      onClick={() => handleSort("expires_on")}
                      className="cursor-pointer pb-2 font-medium hover:text-sand-900"
                    >
                      Expiry
                    </th>
                    <th
                      onClick={() => handleSort("is_low")}
                      className="cursor-pointer pb-2 font-medium hover:text-sand-900"
                    >
                      Status
                    </th>
                    <th className="pb-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {paginated.map((item) => (
                    <tr key={item.id} className="hover:bg-sand-50/50">
                      <td className="py-3">
                        <p className="font-semibold text-sand-900">{item.name}</p>
                        <p className="font-mono text-[10px] text-sand-500">{item.sku}</p>
                      </td>
                      <td className="py-3 capitalize text-sand-700">{item.category}</td>
                      <td className="py-3 text-right font-semibold text-sand-950">
                        {item.on_hand} <span className="font-normal text-sand-500">{item.unit}</span>
                      </td>
                      <td className="py-3 text-right text-sand-600">
                        {item.minimum} {item.unit}
                      </td>
                      <td className="py-3 text-right text-sand-800">
                        ₹{item.unit_cost.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 text-sand-600">
                        {item.expires_on ? item.expires_on : "—"}
                        {item.days_to_expiry !== null && item.days_to_expiry !== undefined && item.days_to_expiry <= 7 && (
                          <span className="ml-1.5 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                            {item.days_to_expiry}d
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        {item.is_low ? (
                          <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                            Low Stock
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setMovement({ item, direction: "in" })}
                            className="rounded border border-sand-200 bg-white px-2 py-1 text-[11px] font-medium text-sand-700 hover:bg-sand-50"
                          >
                            Receive (+)
                          </button>
                          <button
                            type="button"
                            onClick={() => setMovement({ item, direction: "out" })}
                            className="rounded border border-sand-200 bg-white px-2 py-1 text-[11px] font-medium text-sand-700 hover:bg-sand-50"
                          >
                            Issue (-)
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination bar */}
              <div className="flex items-center justify-between border-t border-sand-200 pt-3 text-xs text-sand-600">
                <span>
                  Showing {paginated.length} of {sorted.length} items
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="rounded border border-sand-200 bg-white p-1 text-sand-600 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="rounded border border-sand-200 bg-white p-1 text-sand-600 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </PanelBody>
      </Panel>

      {/* Record Movement Drawer */}
      <Drawer
        open={Boolean(movement)}
        onClose={() => setMovement(null)}
        title={movement?.direction === "in" ? "Receive Stock" : "Issue Stock"}
        description={
          movement
            ? `${movement.item.name} (${movement.item.sku}) · Current on hand: ${movement.item.on_hand} ${movement.item.unit}`
            : ""
        }
      >
        <div className="space-y-4 py-4">
          <div>
            <label className="block text-xs font-semibold text-sand-900">
              Quantity to {movement?.direction === "in" ? "Receive" : "Issue"} ({movement?.item.unit})
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 10"
              className="mt-1 w-full rounded-xl border border-sand-300 bg-white p-2.5 text-sm text-sand-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-sand-900">
              Audit Note / PO Reference (Optional)
            </label>
            <input
              type="text"
              value={movementNote}
              onChange={(e) => setMovementNote(e.target.value)}
              placeholder="e.g. PO-8921 delivery verified"
              className="mt-1 w-full rounded-xl border border-sand-300 bg-white p-2.5 text-sm text-sand-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-sand-200">
            <Button variant="outline" size="sm" onClick={() => setMovement(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={movementMutation.isPending || !quantity}
              onClick={applyMovement}
            >
              {movementMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save Movement to Backend"
              )}
            </Button>
          </div>
        </div>
      </Drawer>
        </>
      )}

      {activeTab === "requisitions" && <AdminDepartmentRequisitions />}
      {activeTab === "budgets" && <AdminDepartmentBudgets />}
    </div>
  );
}
