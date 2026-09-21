"use client";

import React, { useMemo, useState } from "react";
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
  MoreHorizontal,
  PackageSearch,
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
import { PeriodSelect } from "@/components/ui/period-select";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { formatLakh } from "@/lib/chart-theme";
import {
  STOCK_CATEGORIES,
  SUPPLIER_FILTERS,
  categoryTint,
  stock as seedStock,
  stockStatus,
  stockStatusMeta,
  type StockCategory,
  type StockItem,
  type StockStatus,
} from "@/lib/demo/inventory";
import { cn } from "@/lib/utils";

type CategoryFilter = StockCategory | "all";
const STATUS_OPTIONS = ["All Statuses", "In Stock", "Low Stock", "Expiring Soon", "Out of Stock"];
const ITEMS_PER_PAGE = 10;

type SortField = "name" | "category" | "onHand" | "minimum" | "expiresOn" | "status" | "lastUpdated";
type SortDirection = "asc" | "desc";

export default function InventoryPage() {
  const { showToast, showUndoToast } = useToast();

  const [stock, setStock] = useState<StockItem[]>(seedStock);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<string>("All Statuses");
  const [supplierFilter, setSupplierFilter] = useState<string>(SUPPLIER_FILTERS[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("status");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [movement, setMovement] = useState<{ item: StockItem; direction: "in" | "out" } | null>(null);
  const [quantity, setQuantity] = useState("");

  // One "today" for the whole render, so every expiry is judged against the same instant.
  const today = useMemo(() => new Date(), []);

  const withStatus = useMemo(
    () => stock.map((item) => ({ item, status: stockStatus(item, today) })),
    [stock, today]
  );

  const needsAttention = withStatus.filter(
    (row) => row.status === "low" || row.status === "out"
  ).length;
  const expiring = withStatus.filter((row) => row.status === "expiring").length;
  const stockValue = stock.reduce((sum, item) => sum + item.onHand * item.unitCost, 0);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return withStatus.filter(({ item, status }) => {
      if (category !== "all" && item.category !== category) return false;
      if (supplierFilter !== "All Suppliers" && item.supplier !== supplierFilter) return false;
      if (statusFilter !== "All Statuses" && stockStatusMeta[status].label !== statusFilter)
        return false;
      if (
        query &&
        !item.name.toLowerCase().includes(query) &&
        !item.sku.toLowerCase().includes(query) &&
        !item.supplier.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [withStatus, category, supplierFilter, statusFilter, searchQuery]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortField === "status") {
        const rank: Record<StockStatus, number> = { out: 0, low: 1, expiring: 2, ok: 3 };
        comparison = rank[a.status] - rank[b.status];
      } else if (sortField === "name") {
        comparison = a.item.name.localeCompare(b.item.name);
      } else if (sortField === "category") {
        comparison = a.item.category.localeCompare(b.item.category);
      } else if (sortField === "onHand") {
        comparison = a.item.onHand - b.item.onHand;
      } else if (sortField === "minimum") {
        comparison = a.item.minimum - b.item.minimum;
      } else if (sortField === "expiresOn") {
        const dateA = a.item.expiresOn ? new Date(a.item.expiresOn).getTime() : Infinity;
        const dateB = b.item.expiresOn ? new Date(b.item.expiresOn).getTime() : Infinity;
        comparison = dateA - dateB;
      } else if (sortField === "lastUpdated") {
        comparison = a.item.lastUpdated.localeCompare(b.item.lastUpdated);
      }
      return sortDirection === "asc" ? comparison : -comparison;
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

    const amount = Number(quantity);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast({
        title: "Enter a quantity",
        description: "The movement needs a positive number of units.",
        type: "warning",
      });
      return;
    }

    const { item, direction } = movement;
    const delta = direction === "in" ? amount : -amount;
    const before = item.onHand;

    setStock((current) =>
      current.map((row) =>
        row.sku === item.sku ? { ...row, onHand: Math.max(0, row.onHand + delta) } : row
      )
    );
    setMovement(null);
    setQuantity("");

    showUndoToast(
      `${item.name} · ${direction === "in" ? "received" : "issued"} ${amount} ${item.unit}`,
      `On hand ${before} → ${Math.max(0, before + delta)} ${item.unit}.`,
      () =>
        setStock((current) =>
          current.map((row) => (row.sku === item.sku ? { ...row, onHand: before } : row))
        ),
      10
    );
  };

  // Day 5 End-of-Day scenario: "A room service order lowers stock; low stock alert triggers"
  const simulateRoomServiceOrder = () => {
    const targetSkus = ["FNB-003", "FNB-005", "TOI-002"]; // Chicken, Coffee, Soap
    const previousStock = [...stock];

    setStock((current) =>
      current.map((item) => {
        if (item.sku === "FNB-003") return { ...item, onHand: Math.max(0, item.onHand - 3) }; // drops to 5 (min 15 -> low)
        if (item.sku === "FNB-005") return { ...item, onHand: Math.max(0, item.onHand - 2) }; // drops to 2 (min 5 -> low)
        if (item.sku === "TOI-002") return { ...item, onHand: Math.max(0, item.onHand - 10) }; // drops to 25 (min 60 -> low)
        return item;
      })
    );

    showUndoToast(
      "Room Service Order #RS-402 Executed",
      "Deducted 3kg Chicken, 2kg Coffee Beans, 10 soaps. F&B inventory dropped below minimum threshold.",
      () => setStock(previousStock),
      10
    );

    showToast({
      title: "Low Stock Alert",
      description: "Organic Coffee Beans and Chicken Breast are now critically below minimum levels!",
      type: "warning",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rooms & Inventory"
        description="Store room levels for food, linen, beds, toiletries, and parts."
        meta={format(today, "EEE, d MMM yyyy")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={simulateRoomServiceOrder}
              className="border-gold-300 bg-gold-50/40 text-gold-900 hover:bg-gold-100"
            >
              <ShoppingCart className="h-3.5 w-3.5 text-gold-700" />
              Simulate Room Service Order
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                showToast({
                  title: "Purchase list drafted",
                  description: `${needsAttention} items below minimum added to a draft order.`,
                  type: "success",
                })
              }
            >
              Draft purchase order
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                showToast({
                  title: "Inventory exported",
                  description: `${stock.length} items exported to CSV.`,
                  type: "default",
                })
              }
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </div>
        }
      />

      {/* 4 Value-First Stat Tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          variant="value-first"
          label="Total Tracked Items"
          value={stock.length}
          change="5 categories"
          intent="neutral"
          comparison="across store rooms"
          tone="sage"
          icon={PackageSearch}
        />
        <StatTile
          variant="value-first"
          label="Low in Stock"
          value={needsAttention}
          change="+2"
          intent="bad"
          comparison="below minimum safety level"
          tone="rose"
          icon={TrendingDown}
          trend={[1, 2, 2, 3, 2, 3, needsAttention]}
        />
        <StatTile
          variant="value-first"
          label="Expiring Soon"
          value={expiring}
          change="use first"
          intent="neutral"
          comparison="within 30-day window"
          tone="sand"
          icon={CalendarX2}
        />
        <StatTile
          variant="value-first"
          label="Total Stock Value"
          value={formatLakh(stockValue)}
          change="-4%"
          direction="down"
          intent="neutral"
          comparison="vs. last week"
          tone="forest"
          icon={IndianRupee}
          trend={[3.6, 3.7, 3.5, 3.4, 3.5, 3.3, 3.2]}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Stock Levels"
          description="Live inventory with low stock and expiry tracking across all departments."
        />
        <PanelBody className="space-y-4 pt-4">
          {/* Category Filter Chips */}
          <FilterChips
            options={[
              { value: "all" as const, label: "All categories", count: stock.length },
              ...STOCK_CATEGORIES.map((cat) => ({
                value: cat,
                label: cat,
                count: stock.filter((row) => row.category === cat).length,
              })),
            ]}
            value={category}
            onChange={(value) => {
              setCategory(value as CategoryFilter);
              setCurrentPage(1);
            }}
          />

          {/* Search and Dropdown Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-400" />
              <input
                type="text"
                placeholder="Search items, SKU, or supplier..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-sand-200 bg-white py-2 pl-9 pr-4 text-sm text-sand-900 placeholder:text-sand-400 focus:border-sage-500 focus:outline-none focus:ring-1 focus:ring-sage-500"
              />
            </div>

            <PeriodSelect
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
              options={STATUS_OPTIONS}
            />

            <PeriodSelect
              value={supplierFilter}
              onChange={(val) => {
                setSupplierFilter(val);
                setCurrentPage(1);
              }}
              options={SUPPLIER_FILTERS as unknown as string[]}
            />
          </div>

          {/* Table */}
          <Table>
            <THead>
              <tr>
                <TH>
                  <button
                    onClick={() => handleSort("name")}
                    className="inline-flex items-center gap-1 font-medium hover:text-sand-900"
                  >
                    Item & SKU
                    {sortField === "name" ? (
                      sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-sand-400" />
                    )}
                  </button>
                </TH>
                <TH>
                  <button
                    onClick={() => handleSort("category")}
                    className="inline-flex items-center gap-1 font-medium hover:text-sand-900"
                  >
                    Category
                    {sortField === "category" ? (
                      sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-sand-400" />
                    )}
                  </button>
                </TH>
                <TH align="right">
                  <button
                    onClick={() => handleSort("onHand")}
                    className="inline-flex items-center gap-1 font-medium hover:text-sand-900"
                  >
                    On Hand
                    {sortField === "onHand" ? (
                      sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-sand-400" />
                    )}
                  </button>
                </TH>
                <TH align="right">
                  <button
                    onClick={() => handleSort("minimum")}
                    className="inline-flex items-center gap-1 font-medium hover:text-sand-900"
                  >
                    Min Level
                    {sortField === "minimum" ? (
                      sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-sand-400" />
                    )}
                  </button>
                </TH>
                <TH align="right">
                  <button
                    onClick={() => handleSort("expiresOn")}
                    className="inline-flex items-center gap-1 font-medium hover:text-sand-900"
                  >
                    Expiry
                    {sortField === "expiresOn" ? (
                      sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-sand-400" />
                    )}
                  </button>
                </TH>
                <TH align="right">
                  <button
                    onClick={() => handleSort("status")}
                    className="inline-flex items-center gap-1 font-medium hover:text-sand-900"
                  >
                    Status
                    {sortField === "status" ? (
                      sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-sand-400" />
                    )}
                  </button>
                </TH>
                <TH align="right">Stock Movement</TH>
              </tr>
            </THead>
            <TBody>
              {paginated.length === 0 ? (
                <TR>
                  <TD colSpan={7} className="py-12 text-center text-sm text-sand-500">
                    No items found matching your filters.
                  </TD>
                </TR>
              ) : (
                paginated.map(({ item, status }) => {
                  const Icon = item.icon;
                  const isLow = status === "low" || status === "out";

                  return (
                    <TR key={item.sku}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sand-200/60",
                              categoryTint[item.category]
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <div>
                            <span className="block font-medium text-sand-900">{item.name}</span>
                            <span className="block text-xs text-sand-500">
                              {item.sku} · {item.supplier}
                            </span>
                          </div>
                        </div>
                      </TD>
                      <TD className="text-sand-600">{item.category}</TD>
                      <TD align="right">
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            isLow ? "text-rose-600" : "text-sand-900"
                          )}
                        >
                          {item.onHand} {item.unit}
                        </span>
                        {isLow && (
                          <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
                        )}
                      </TD>
                      <TD align="right" className="text-sand-600 tabular-nums">
                        {item.minimum} {item.unit}
                      </TD>
                      <TD align="right" className="text-sand-600">
                        {item.expiresOn ? (
                          <span
                            className={cn(
                              "tabular-nums",
                              status === "expiring" && "font-medium text-sand-800"
                            )}
                          >
                            {format(new Date(item.expiresOn), "d MMM yyyy")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TD>
                      <TD align="right">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            stockStatusMeta[status].chip
                          )}
                        >
                          {stockStatusMeta[status].label}
                        </span>
                      </TD>
                      <TD align="right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setMovement({ item, direction: "in" });
                              setQuantity("");
                            }}
                          >
                            In
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setMovement({ item, direction: "out" });
                              setQuantity("");
                            }}
                          >
                            Out
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>

          {/* Pagination Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-sand-200/80 pt-4 text-xs text-sand-600">
            <span>
              Showing {sorted.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}–
              {Math.min(currentPage * ITEMS_PER_PAGE, sorted.length)} of {sorted.length} items
            </span>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-sand-200 bg-white p-1.5 text-sand-600 transition-colors hover:bg-sand-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    "h-7 w-7 rounded-lg text-xs font-medium transition-colors",
                    page === currentPage
                      ? "bg-sage-600 text-white"
                      : "border border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
                  )}
                >
                  {page}
                </button>
              ))}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-sand-200 bg-white p-1.5 text-sand-600 transition-colors hover:bg-sand-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </PanelBody>
      </Panel>

      {/* Stock In / Out Modal Drawer */}
      <Drawer
        open={movement !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMovement(null);
            setQuantity("");
          }
        }}
        title={movement ? (movement.direction === "in" ? "Receive stock" : "Issue stock") : ""}
        description={movement ? `${movement.item.name} · SKU: ${movement.item.sku}` : undefined}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setMovement(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={applyMovement}>
              {movement?.direction === "in" ? "Add to stock" : "Issue from stock"}
            </Button>
          </>
        }
      >
        {movement && (
          <div className="space-y-5">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sand-600">Currently on hand</dt>
                <dd className="font-medium tabular-nums text-sand-900">
                  {movement.item.onHand} {movement.item.unit}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sand-600">Minimum level</dt>
                <dd className="font-medium tabular-nums text-sand-900">
                  {movement.item.minimum} {movement.item.unit}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sand-600">Unit cost</dt>
                <dd className="font-medium tabular-nums text-sand-900">
                  ₹{movement.item.unitCost.toLocaleString("en-IN")}
                </dd>
              </div>
            </dl>

            <div>
              <label
                htmlFor="stock-quantity"
                className="mb-1.5 block text-sm font-medium text-sand-800"
              >
                Quantity ({movement.item.unit})
              </label>
              <Input
                id="stock-quantity"
                type="number"
                min={1}
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="0"
              />
            </div>

            <p className="rounded-xl bg-sand-50 p-4 text-xs text-sand-600">
              Last movement — {movement.item.lastUpdated}
            </p>
          </div>
        )}
      </Drawer>
    </div>
  );
}
