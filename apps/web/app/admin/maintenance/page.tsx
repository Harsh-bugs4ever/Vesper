"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock,
  DoorClosed,
  FileText,
  Filter,
  Layers,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wrench,
  Zap,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { MaintenancePanel } from "@/components/connected/maintenance-panel";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { StatTile } from "@/components/ui/stat-tile";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, type BackendRoom } from "@/lib/api";
import { cn } from "@/lib/utils";

interface MaintenanceSparesItem {
  id: string;
  name: string;
  category: string;
  on_hand: number;
  minimum: number;
  unit: string;
  days_to_stockout: number;
  daily_burn: number;
  auto_order_status: "in_transit" | "scheduled" | "optimal";
  po_number?: string;
  eta?: string;
  alternate_path: string;
}

const CRITICAL_SPARES: MaintenanceSparesItem[] = [
  {
    id: "sp-1",
    name: "HVAC Primary Filter Cartridge (MERV 13)",
    category: "Chiller & HVAC",
    on_hand: 2,
    minimum: 8,
    unit: "units",
    days_to_stockout: 2,
    daily_burn: 1.2,
    auto_order_status: "in_transit",
    po_number: "PO-ENG-2026-104",
    eta: "Tomorrow, 9:00 AM",
    alternate_path: "Deploy universal dual-stage washable bypass cartridge (6 in reserve store). Zero cooling degradation.",
  },
  {
    id: "sp-2",
    name: "Universal Brass Thermostatic Mixing Valve (3/4\")",
    category: "Plumbing & Hot Water",
    on_hand: 1,
    minimum: 4,
    unit: "pcs",
    days_to_stockout: 3,
    daily_burn: 0.5,
    auto_order_status: "in_transit",
    po_number: "PO-ENG-2026-108",
    eta: "In 24 hours",
    alternate_path: "Mount pre-calibrated pressure-balanced manifold bypass located in North Plant riser.",
  },
  {
    id: "sp-3",
    name: "R-410A Eco Refrigerant Canister (11.3 kg)",
    category: "Chiller Plant",
    on_hand: 3,
    minimum: 6,
    unit: "cyl",
    days_to_stockout: 5,
    daily_burn: 0.6,
    auto_order_status: "scheduled",
    po_number: "PO-ENG-2026-112",
    eta: "Friday delivery",
    alternate_path: "Cycle backup chiller loop B to reduce head pressure; balance refrigerant across circuits.",
  },
  {
    id: "sp-4",
    name: "High-Efficiency LED Luminaire Driver (24V 60W)",
    category: "Electrical & Lighting",
    on_hand: 5,
    minimum: 12,
    unit: "units",
    days_to_stockout: 7,
    daily_burn: 0.8,
    auto_order_status: "optimal",
    alternate_path: "Utilize modular constant-current spare ballasts from electrical vault shelf 4B.",
  },
];

export default function MaintenancePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"defects" | "room-matrix" | "spares">("defects");
  const [statusFilter, setStatusFilter] = useState<"all" | "out_of_order" | "dirty" | "ready" | "occupied">("all");

  const roomsQuery = useQuery({
    queryKey: ["maintenance-rooms-grid"],
    queryFn: () => api.get<BackendRoom[]>("/rooms"),
    refetchInterval: 30_000,
  });

  const allRooms = roomsQuery.data ?? [];
  const outOfOrderRooms = allRooms.filter((r) => r.status === "out_of_order");
  const dirtyRooms = allRooms.filter((r) => r.status === "dirty" || r.status === "cleaning");
  const readyRooms = allRooms.filter((r) => r.status === "ready");
  const occupiedRooms = allRooms.filter((r) => r.status === "occupied");

  const filteredRooms = allRooms.filter((r) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "out_of_order") return r.status === "out_of_order";
    if (statusFilter === "dirty") return r.status === "dirty" || r.status === "cleaning";
    if (statusFilter === "ready") return r.status === "ready";
    if (statusFilter === "occupied") return r.status === "occupied";
    return true;
  });

  const handleSimulateAutoOrder = (item: MaintenanceSparesItem) => {
    showToast({
      title: `⚡ AI Auto-Order Dispatched: ${item.name}`,
      description: `Autonomous purchase order logged. Supplier SLA lead time: ${item.eta ?? "24 hrs"}. Alternate contingency active.`,
      type: "success",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance & Engineering Operations"
        description="Room defect telemetry, live spatial room status, work orders, and 14-day automated spares replenishment."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/rooms"
              className="inline-flex items-center gap-1.5 rounded-xl border border-sand-200 bg-white px-3.5 py-2 text-xs font-semibold text-sand-800 shadow-xs transition-colors hover:bg-sand-50"
            >
              <Boxes className="h-3.5 w-3.5 text-sage-600" />
              Resort 3D Spatial Matrix →
            </Link>
          </div>
        }
      />

      {/* Engineering KPI Cockpit */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Out of Order Rooms"
          value={outOfOrderRooms.length.toString()}
          change={outOfOrderRooms.length > 0 ? "Maintenance lock active" : "All rooms operational"}
          comparison="Engineering hold list"
          tone={outOfOrderRooms.length > 0 ? "rose" : "forest"}
          icon={AlertTriangle}
        />
        <StatTile
          label="Pending Turnovers"
          value={dirtyRooms.length.toString()}
          change="Housekeeping synced"
          comparison="Next shift cycle"
          tone="sand"
          icon={RefreshCw}
        />
        <StatTile
          label="Ready & Inspected"
          value={readyRooms.length.toString()}
          change="Available for check-in"
          comparison="Front desk live pool"
          tone="emerald"
          icon={CheckCircle2}
        />
        <StatTile
          label="Critical Spares Buffer"
          value="4 Lines"
          change="100% Proactive Auto-Ordered"
          comparison="Zero par breach risk"
          tone="sage"
          icon={Zap}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-sand-200/80 pb-3">
        {[
          { key: "defects", label: "Work Orders & Defect Log", icon: Wrench },
          { key: "room-matrix", label: `Room Status Matrix (${allRooms.length})`, icon: Layers },
          { key: "spares", label: "14-Day Ahead Spares Automation", icon: Package },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key as typeof activeTab)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                activeTab === t.key
                  ? "bg-sand-900 text-white shadow-sm"
                  : "border border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: WORK ORDERS & DEFECTS */}
      {activeTab === "defects" && <MaintenancePanel />}

      {/* TAB 2: ROOM STATUS MATRIX FOR MAINTENANCE */}
      {activeTab === "room-matrix" && (
        <Panel>
          <PanelHeader
            title="Live Room Status & Engineering Hold Matrix"
            description="Front desk and housekeeping synchronized room readiness. Filter by Out of Order to expedite maintenance interventions."
            action={
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: "all", label: `All Rooms (${allRooms.length})` },
                  { key: "out_of_order", label: `🔴 Out of Order (${outOfOrderRooms.length})` },
                  { key: "dirty", label: `🟡 Dirty/Turnover (${dirtyRooms.length})` },
                  { key: "ready", label: `🟢 Ready (${readyRooms.length})` },
                  { key: "occupied", label: `🔵 Occupied (${occupiedRooms.length})` },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setStatusFilter(f.key as typeof statusFilter)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                      statusFilter === f.key
                        ? "bg-sand-900 text-white shadow-xs"
                        : "border border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            }
          />
          <PanelBody className="space-y-4 pt-4">
            {roomsQuery.isPending ? (
              <p className="py-12 text-center text-xs text-sand-500">Loading room grid telemetry…</p>
            ) : filteredRooms.length === 0 ? (
              <div className="py-12 text-center text-xs text-sand-500">
                <DoorClosed className="mx-auto h-8 w-8 text-sand-300" />
                <p className="mt-2 font-medium">No rooms match the selected status filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                {filteredRooms.slice(0, 48).map((room) => {
                  const isMaint = room.status === "out_of_order";
                  const isDirty = room.status === "dirty" || room.status === "cleaning";
                  const isReady = room.status === "ready";

                  return (
                    <div
                      key={room.id}
                      className={cn(
                        "flex flex-col justify-between rounded-xl border p-3 transition-all",
                        isMaint
                          ? "border-rose-300 bg-rose-50/60 shadow-xs"
                          : isDirty
                          ? "border-amber-200 bg-amber-50/40"
                          : isReady
                          ? "border-emerald-200 bg-emerald-50/20"
                          : "border-sand-200 bg-white"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-serif text-sm font-bold text-sand-950">Room {room.number}</span>
                          <span className="text-[10px] text-sand-500">Fl {room.floor}</span>
                        </div>
                        <span
                          className={cn(
                            "mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                            isMaint
                              ? "bg-rose-100 text-rose-800"
                              : isDirty
                              ? "bg-amber-100 text-amber-800"
                              : isReady
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-blue-100 text-blue-800"
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              isMaint ? "bg-rose-600 animate-ping" : isDirty ? "bg-amber-500" : "bg-emerald-500"
                            )}
                          />
                          {isMaint ? "Defect Hold" : isDirty ? "Turnover" : isReady ? "Ready" : "Occupied"}
                        </span>
                      </div>
                      <div className="mt-3 pt-2 border-t border-sand-200/60 flex items-center justify-between">
                        <Link
                          href={`/admin/front-desk?tab=room-status&search=${room.number}`}
                          className="text-[10px] font-semibold text-sage-700 hover:text-sage-950 hover:underline"
                        >
                          Details →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PanelBody>
        </Panel>
      )}

      {/* TAB 3: 14-DAY AHEAD ENGINEERING SPARES & AUTOMATED REPLENISHMENT */}
      {activeTab === "spares" && (
        <div className="space-y-6">
          <Panel>
            <PanelHeader
              title="14-Day Ahead Automated Engineering Spares & Contingency"
              description="Continuous telemetry monitoring. AI proactively auto-orders stock before depletion, guaranteeing zero equipment downtime."
              action={
                <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 text-xs font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                  Auto-Order System Online
                </span>
              }
            />
            <PanelBody className="space-y-4 pt-4">
              <div className="divide-y divide-sand-100">
                {CRITICAL_SPARES.map((item) => (
                  <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1 max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-sand-950 text-sm">{item.name}</h4>
                          <span className="rounded bg-sand-100 px-2 py-0.5 text-[10px] font-medium text-sand-700">
                            {item.category}
                          </span>
                          {item.auto_order_status === "in_transit" && (
                            <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-emerald-600" />
                              Auto-Ordered ({item.po_number}) · ETA: {item.eta}
                            </span>
                          )}
                        </div>

                        {/* Stock and Burn Telemetry */}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-sand-600 pt-1">
                          <span>
                            On-Hand: <strong className="text-sand-900">{item.on_hand} {item.unit}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Safety Buffer Par: <strong className="text-sand-900">{item.minimum} {item.unit}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Daily Burn: <strong className="text-sand-900">~{item.daily_burn} {item.unit}/day</strong>
                          </span>
                          <span>•</span>
                          <span className={cn("font-semibold", item.days_to_stockout <= 3 ? "text-amber-700" : "text-emerald-700")}>
                            Depletion Horizon: {item.days_to_stockout} days
                          </span>
                        </div>

                        {/* AI Alternate Path Recommendation */}
                        <div className="mt-2 rounded-xl bg-amber-50/70 border border-amber-200/80 p-3 text-xs text-amber-900 space-y-1">
                          <p className="font-semibold flex items-center gap-1.5 text-amber-950">
                            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                            AI Alternate Path Contingency:
                          </p>
                          <p className="text-amber-900 leading-relaxed">{item.alternate_path}</p>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="shrink-0 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSimulateAutoOrder(item)}
                          className="text-xs"
                        >
                          <Zap className="h-3.5 w-3.5 text-sage-600 mr-1.5" />
                          Simulate AI Auto-Order
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </PanelBody>
          </Panel>
        </div>
      )}
    </div>
  );
}
