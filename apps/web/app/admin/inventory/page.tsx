"use client";

import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarX2, IndianRupee, PackageSearch, TrendingDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { FilterChips } from "@/components/ui/filter-chips";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { formatLakh } from "@/lib/chart-theme";
import {
  STOCK_CATEGORIES,
  stock as seedStock,
  stockStatus,
  stockStatusMeta,
  type StockCategory,
  type StockItem,
} from "@/lib/demo/inventory";
import { cn } from "@/lib/utils";

type CategoryFilter = StockCategory | "all";

export default function InventoryPage() {
  const { showToast, showUndoToast } = useToast();

  const [stock, setStock] = useState<StockItem[]>(seedStock);
  const [category, setCategory] = useState<CategoryFilter>("all");
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

  const visible = useMemo(
    () =>
      withStatus
        .filter((row) => category === "all" || row.item.category === category)
        // Trouble first: out of stock, then below minimum, then expiring, then the rest.
        .sort((a, b) => {
          const rank = { out: 0, low: 1, expiring: 2, ok: 3 } as const;
          return rank[a.status] - rank[b.status];
        }),
    [withStatus, category]
  );

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
        row.id === item.id ? { ...row, onHand: Math.max(0, row.onHand + delta) } : row
      )
    );
    setMovement(null);
    setQuantity("");

    showUndoToast(
      `${item.name} · ${direction === "in" ? "received" : "issued"} ${amount} ${item.unit}`,
      `On hand ${before} → ${Math.max(0, before + delta)} ${item.unit}.`,
      () =>
        setStock((current) =>
          current.map((row) => (row.id === item.id ? { ...row, onHand: before } : row))
        ),
      10
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rooms & Inventory"
        description="Store room levels for food, linen, toiletries, furniture and spare parts."
        meta={format(today, "EEE, d MMM yyyy")}
        actions={
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
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Items Tracked"
          value={stock.length}
          change="5 categories"
          intent="neutral"
          comparison="across the store room"
          tone="sage"
          icon={PackageSearch}
        />
        <StatTile
          label="Below Minimum"
          value={needsAttention}
          change="+2"
          intent="bad"
          comparison="since this morning"
          tone="rose"
          icon={TrendingDown}
          trend={[1, 2, 2, 3, 2, 3, needsAttention]}
        />
        <StatTile
          label="Expiring This Week"
          value={expiring}
          change="use first"
          intent="neutral"
          comparison="within seven days"
          tone="sand"
          icon={CalendarX2}
        />
        <StatTile
          label="Stock Value"
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
          description="Room service completions deduct from these counts automatically."
        />
        <PanelBody className="space-y-4 pt-4">
          <FilterChips
            options={[
              { value: "all" as const, label: "All categories", count: stock.length },
              ...STOCK_CATEGORIES.map((item) => ({
                value: item,
                label: item,
                count: stock.filter((row) => row.category === item).length,
              })),
            ]}
            value={category}
            onChange={(value) => setCategory(value as CategoryFilter)}
          />

          <Table>
            <THead>
              <tr>
                <TH>Item</TH>
                <TH>Category</TH>
                <TH align="right">On hand</TH>
                <TH align="right">Minimum</TH>
                <TH align="right">Expires</TH>
                <TH align="right">Status</TH>
                <TH align="right">Movement</TH>
              </tr>
            </THead>
            <TBody>
              {visible.map(({ item, status }) => (
                <TR key={item.id}>
                  <TD>
                    <span className="block font-medium text-sand-900">{item.name}</span>
                    <span className="block text-xs text-sand-500">
                      {item.id} · {item.supplier}
                    </span>
                  </TD>
                  <TD className="text-sand-600">{item.category}</TD>
                  <TD align="right" className="font-medium text-sand-900">
                    {item.onHand} {item.unit}
                  </TD>
                  <TD align="right" className="text-sand-600">
                    {item.minimum}
                  </TD>
                  <TD align="right" className="text-sand-600">
                    {item.expiresOn ? format(new Date(item.expiresOn), "d MMM") : "—"}
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
              ))}
            </TBody>
          </Table>
        </PanelBody>
      </Panel>

      <Drawer
        open={movement !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMovement(null);
            setQuantity("");
          }
        }}
        title={movement ? (movement.direction === "in" ? "Receive stock" : "Issue stock") : ""}
        description={movement ? `${movement.item.name} · ${movement.item.id}` : undefined}
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
              Last movement — {movement.item.lastMovement}
            </p>
          </div>
        )}
      </Drawer>
    </div>
  );
}
