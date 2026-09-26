"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Info,
  Lightbulb,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useAuth } from "@/components/auth/auth-context";
import { revenueApi, type SimulateResult } from "@/lib/api";
import { cn } from "@/lib/utils";

function money(amount: number): string {
  if (Math.abs(amount) >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (Math.abs(amount) >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)} L`;
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export default function SimulatorPage() {
  const { user } = useAuth();
  const isGm = user?.role === "general_manager";

  // Simulation parameters
  const [rateChange, setRateChange] = useState<number>(0);
  const [staffingChange, setStaffingChange] = useState<number>(0);
  const [promoDiscount, setPromoDiscount] = useState<number>(0);
  const [days, setDays] = useState<number>(30);

  // Live simulation query against the backend revenue service
  const {
    data: simulation,
    isLoading: simLoading,
    isError: simError,
    refetch: runSimulate,
  } = useQuery({
    queryKey: [
      "revenue-simulate",
      user?.propertyId,
      rateChange,
      staffingChange,
      promoDiscount,
      days,
    ],
    enabled: isGm,
    queryFn: () =>
      revenueApi.simulate({
        rate_change_pct: rateChange,
        staffing_change_pct: staffingChange,
        promo_discount_pct: promoDiscount,
        days,
      }),
  });

  const handleReset = () => {
    setRateChange(0);
    setStaffingChange(0);
    setPromoDiscount(0);
  };

  if (!isGm) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Revenue & Demand Simulator"
          description="Price elasticity simulation and what-if scenario forecasting."
        />
        <div className="rounded-3xl border border-sand-200 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="mt-4 font-serif text-2xl font-bold text-sand-950">
            Executive Access Required
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-sand-600">
            The Revenue & Elasticity Simulator is an executive decision tool restricted strictly to the General Manager.
          </p>
        </div>
      </div>
    );
  }

  const baselineRev = simulation?.baseline_revenue ?? 0;
  const projectedRev = simulation?.projected_revenue ?? 0;
  const deltaRev = simulation?.revenue_delta ?? 0;
  const baselineOcc = simulation ? Math.round(simulation.baseline_occupancy * 100) : 0;
  const projectedOcc = simulation ? Math.round(simulation.projected_occupancy * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue & Elasticity Simulator"
        description="Simulate what-if pricing and staffing scenarios computed directly against live property demand models."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-xs"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset Sliders
            </Button>
          </div>
        }
      />

      {/* Simulator Inputs & Results Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Scenario Sliders */}
        <div className="space-y-6 lg:col-span-1">
          <Panel>
            <PanelHeader
              title="Scenario Variables"
              description="Adjust levers to evaluate demand elasticity"
            />
            <PanelBody className="space-y-6 p-6">
              {/* Levers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-sand-950">ADR Rate Adjustment</span>
                  <span className="font-mono font-bold text-sage-800">
                    {rateChange > 0 ? `+${rateChange}%` : `${rateChange}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-25"
                  max="35"
                  step="5"
                  value={rateChange}
                  onChange={(e) => setRateChange(Number(e.target.value))}
                  className="w-full accent-sage-700"
                />
                <div className="flex justify-between text-[10px] text-sand-400">
                  <span>-25% discount</span>
                  <span>Baseline</span>
                  <span>+35% surge</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-sand-950">Staffing Level</span>
                  <span className="font-mono font-bold text-sage-800">
                    {staffingChange > 0 ? `+${staffingChange}%` : `${staffingChange}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="30"
                  step="5"
                  value={staffingChange}
                  onChange={(e) => setStaffingChange(Number(e.target.value))}
                  className="w-full accent-sage-700"
                />
                <div className="flex justify-between text-[10px] text-sand-400">
                  <span>Lean (-20%)</span>
                  <span>Rostered</span>
                  <span>Full Overtime (+30%)</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-sand-950">Marketing & Promo Discount</span>
                  <span className="font-mono font-bold text-sage-800">{promoDiscount}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="5"
                  value={promoDiscount}
                  onChange={(e) => setPromoDiscount(Number(e.target.value))}
                  className="w-full accent-sage-700"
                />
                <div className="flex justify-between text-[10px] text-sand-400">
                  <span>0% standard</span>
                  <span>10% OTA flash</span>
                  <span>25% seasonal</span>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-sand-100">
                <label className="block text-xs font-semibold text-sand-950">
                  Forecast Horizon:
                  <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="mt-1 block w-full rounded-lg border border-sand-300 bg-white px-3 py-1.5 text-xs text-sand-950 shadow-xs focus:border-sage-600 focus:outline-none"
                  >
                    <option value={14}>Next 14 Days</option>
                    <option value={30}>Next 30 Days (Standard Month)</option>
                    <option value={60}>Next 60 Days</option>
                    <option value={90}>Next 90 Days (Quarter)</option>
                  </select>
                </label>
              </div>
            </PanelBody>
          </Panel>
        </div>

        {/* Projected Outcomes */}
        <div className="space-y-6 lg:col-span-2">
          <Panel>
            <PanelHeader
              title={`Simulated Projection · Next ${days} Days`}
              description="Calculated from real booking velocity and learned demand curves."
            />
            <PanelBody className="p-6">
              {simLoading ? (
                <div className="py-12 text-center text-sm text-sand-500">
                  <RefreshCw className="mx-auto h-6 w-6 animate-spin text-sage-600" />
                  <p className="mt-2">Computing elasticity models against live reservations…</p>
                </div>
              ) : simError ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-rose-700">
                    Failed to run revenue simulator. Ensure revenue service is responding.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runSimulate()}
                    className="mt-3 text-xs"
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Headline Delta Cards */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-sand-200 bg-sand-50/50 p-5">
                      <span className="text-xs text-sand-500 font-medium">Projected Revenue</span>
                      <p className="mt-1 font-mono text-2xl font-bold text-sand-950">
                        {money(projectedRev)}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-xs">
                        {deltaRev >= 0 ? (
                          <span className="inline-flex items-center text-emerald-800 font-semibold">
                            <TrendingUp className="mr-1 h-3.5 w-3.5" />
                            +{money(deltaRev)} vs baseline
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-rose-700 font-semibold">
                            <TrendingDown className="mr-1 h-3.5 w-3.5" />
                            {money(deltaRev)} vs baseline
                          </span>
                        )}
                        <span className="text-sand-400">({money(baselineRev)})</span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-sand-200 bg-sand-50/50 p-5">
                      <span className="text-xs text-sand-500 font-medium">Projected Occupancy</span>
                      <p className="mt-1 font-mono text-2xl font-bold text-sage-800">
                        {projectedOcc}%
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-xs">
                        <span className="text-sand-700 font-medium">
                          Baseline: {baselineOcc}%
                        </span>
                        <span className="text-sand-400">·</span>
                        <span
                          className={cn(
                            "font-semibold",
                            projectedOcc >= baselineOcc ? "text-emerald-800" : "text-rose-700"
                          )}
                        >
                          {projectedOcc >= baselineOcc
                            ? `+${projectedOcc - baselineOcc}%`
                            : `${projectedOcc - baselineOcc}%`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Backend Assumptions Callout */}
                  {simulation?.assumptions && (
                    <div className="rounded-2xl border border-sand-200 bg-white p-5 space-y-2">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-sage-700" />
                        <h4 className="font-semibold text-xs text-sand-950 uppercase tracking-wider">
                          Backend Model Assumptions
                        </h4>
                      </div>
                      <p className="text-xs text-sand-600">
                        Simulated figures are generated server-side using current inventory availability and historic price response coefficients.
                      </p>
                      <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
                        {Object.entries(simulation.assumptions).map(([key, val]) => (
                          <div key={key} className="rounded-lg bg-sand-50 p-2 text-xs">
                            <span className="block text-[10px] text-sand-500 capitalize">
                              {key.replaceAll("_", " ")}
                            </span>
                            <span className="font-mono font-semibold text-sand-900">
                              {String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  );
}
