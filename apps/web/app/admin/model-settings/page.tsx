"use client";

import React, { useState } from "react";
import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Gauge,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Snowflake,
  ToggleLeft,
  ToggleRight,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface EngineConfig {
  id: string;
  name: string;
  description: string;
  shadowMode: boolean;
  autonomyLevel: "full" | "supervised" | "manual";
  confidenceThreshold: number;
  coldStartReady: boolean;
  retrainingCadence: string;
  lastRetrained: string;
  status: "active" | "warming" | "cold";
}

const INITIAL_ENGINES: EngineConfig[] = [
  {
    id: "eng_prophet",
    name: "Prophet Demand Forecaster",
    description: "14–90 day occupancy demand prediction",
    shadowMode: false,
    autonomyLevel: "full",
    confidenceThreshold: 85,
    coldStartReady: true,
    retrainingCadence: "Weekly (Auto)",
    lastRetrained: "3 days ago",
    status: "active",
  },
  {
    id: "eng_xgboost",
    name: "XGBoost ADR Optimizer",
    description: "Dynamic room rate pricing engine",
    shadowMode: false,
    autonomyLevel: "supervised",
    confidenceThreshold: 82,
    coldStartReady: true,
    retrainingCadence: "Weekly (Auto)",
    lastRetrained: "1 day ago",
    status: "active",
  },
  {
    id: "eng_cpsat",
    name: "CP-SAT Roster Solver",
    description: "Constraint-satisfaction staff scheduling",
    shadowMode: false,
    autonomyLevel: "supervised",
    confidenceThreshold: 90,
    coldStartReady: true,
    retrainingCadence: "Daily (02:00 IST)",
    lastRetrained: "6 hours ago",
    status: "active",
  },
  {
    id: "eng_sentiment",
    name: "Guest Sentiment NLP",
    description: "Feedback & review satisfaction analysis",
    shadowMode: true,
    autonomyLevel: "manual",
    confidenceThreshold: 75,
    coldStartReady: false,
    retrainingCadence: "Every 3 days",
    lastRetrained: "12 hours ago",
    status: "warming",
  },
  {
    id: "eng_bms",
    name: "BMS Anomaly Detector",
    description: "Chiller & sensor predictive maintenance",
    shadowMode: false,
    autonomyLevel: "full",
    confidenceThreshold: 88,
    coldStartReady: true,
    retrainingCadence: "Weekly (Auto)",
    lastRetrained: "2 days ago",
    status: "active",
  },
  {
    id: "eng_inventory",
    name: "Inventory Auto-Reorder",
    description: "Par-level breach detection & PO generation",
    shadowMode: true,
    autonomyLevel: "manual",
    confidenceThreshold: 80,
    coldStartReady: false,
    retrainingCadence: "Pending data",
    lastRetrained: "Never",
    status: "cold",
  },
];

const AUTONOMY_CONFIG = {
  full: {
    label: "Full Autonomy",
    description: "Auto-executes above confidence threshold",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  supervised: {
    label: "Supervised",
    description: "Suggests actions, requires human approval",
    color: "bg-sage-50 text-sage-800 border-sage-200",
  },
  manual: {
    label: "Manual Only",
    description: "Provides data; all actions require explicit trigger",
    color: "bg-sand-100 text-sand-800 border-sand-300",
  },
} as const;

export default function ModelSettingsPage() {
  const { showToast } = useToast();
  const [engines, setEngines] = useState<EngineConfig[]>(INITIAL_ENGINES);
  const [globalShadow, setGlobalShadow] = useState(false);

  const updateEngine = (id: string, patch: Partial<EngineConfig>) => {
    setEngines((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const toggleGlobalShadow = () => {
    const newVal = !globalShadow;
    setGlobalShadow(newVal);
    setEngines((prev) => prev.map((e) => ({ ...e, shadowMode: newVal })));
    showToast({
      title: `Global Shadow Mode ${newVal ? "Enabled" : "Disabled"}`,
      description: newVal
        ? "All engines will log suggestions without executing. Safe for demo and evaluation."
        : "Engines will auto-execute based on their individual autonomy level and confidence threshold.",
      type: newVal ? "default" : "success",
    });
  };

  const handleSave = () => {
    showToast({
      title: "Model Settings Saved",
      description: "Shadow mode, autonomy levels, and confidence thresholds updated across all engines.",
      type: "success",
    });
  };

  const activeEngines = engines.filter((e) => e.status === "active").length;
  const shadowEngines = engines.filter((e) => e.shadowMode).length;
  const coldEngines = engines.filter((e) => !e.coldStartReady).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Model Settings"
        description="Configure shadow mode, autonomy levels, confidence thresholds, and retraining cadence for each AI engine."
        actions={
          <Button size="sm" onClick={handleSave}>
            <Save className="h-3.5 w-3.5" />
            Save All Settings
          </Button>
        }
      />

      {/* Global shadow mode toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50/60 via-white to-sand-50/40 p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <span className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-xs transition-colors",
            globalShadow ? "bg-purple-500 text-white" : "bg-sand-200 text-sand-600"
          )}>
            {globalShadow ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </span>
          <div>
            <p className="font-serif text-base font-semibold text-sand-950">
              Global Shadow Mode
            </p>
            <p className="text-xs text-sand-600">
              {globalShadow
                ? "All engines are in shadow mode — suggestions logged but never executed."
                : "Engines operate according to their individual autonomy levels."}
            </p>
          </div>
        </div>
        <button
          onClick={toggleGlobalShadow}
          className={cn(
            "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all",
            globalShadow
              ? "border-purple-400 bg-purple-100 text-purple-800 hover:bg-purple-200"
              : "border-sand-300 bg-white text-sand-700 hover:bg-sand-50"
          )}
        >
          {globalShadow ? (
            <>
              <ToggleRight className="h-5 w-5" />
              Shadow Mode ON
            </>
          ) : (
            <>
              <ToggleLeft className="h-5 w-5" />
              Shadow Mode OFF
            </>
          )}
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Panel className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Zap className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-sand-600">Active Engines</p>
              <p className="font-serif text-2xl font-semibold text-sand-950">{activeEngines} / {engines.length}</p>
            </div>
          </div>
        </Panel>
        <Panel className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-700">
              <Eye className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-sand-600">In Shadow Mode</p>
              <p className="font-serif text-2xl font-semibold text-sand-950">{shadowEngines}</p>
            </div>
          </div>
        </Panel>
        <Panel className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
              <Snowflake className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-sand-600">Cold Start Pending</p>
              <p className="font-serif text-2xl font-semibold text-sand-950">{coldEngines}</p>
            </div>
          </div>
        </Panel>
      </div>

      {/* Engine settings cards */}
      <div className="space-y-4">
        <h2 className="font-serif text-lg font-semibold text-sand-950">Engine Configuration</h2>

        {engines.map((engine) => {
          const autonomy = AUTONOMY_CONFIG[engine.autonomyLevel];
          return (
            <Panel key={engine.id} className="overflow-hidden">
              <PanelBody className="space-y-4">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      engine.status === "active" ? "bg-sage-50 text-sage-700" :
                      engine.status === "warming" ? "bg-amber-50 text-amber-700" :
                      "bg-blue-50 text-blue-700"
                    )}>
                      <BrainCircuit className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-serif text-base font-semibold text-sand-950">{engine.name}</h3>
                      <p className="text-xs text-sand-600">{engine.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!engine.coldStartReady && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                        <Snowflake className="h-3 w-3" />
                        Cold Start
                      </span>
                    )}
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
                      engine.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
                      engine.status === "warming" ? "border-amber-200 bg-amber-50 text-amber-800" :
                      "border-blue-200 bg-blue-50 text-blue-800"
                    )}>
                      <span className={cn(
                        "h-2 w-2 rounded-full",
                        engine.status === "active" ? "bg-emerald-500" :
                        engine.status === "warming" ? "bg-amber-500 animate-pulse" :
                        "bg-blue-500"
                      )} />
                      {engine.status === "active" ? "Active" : engine.status === "warming" ? "Warming" : "Cold"}
                    </span>
                  </div>
                </div>

                {/* Controls grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Shadow mode toggle */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-sand-700">Shadow Mode</label>
                    <button
                      onClick={() => updateEngine(engine.id, { shadowMode: !engine.shadowMode })}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all",
                        engine.shadowMode
                          ? "border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100"
                          : "border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
                      )}
                    >
                      {engine.shadowMode ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {engine.shadowMode ? "Shadow ON" : "Shadow OFF"}
                    </button>
                  </div>

                  {/* Autonomy level */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-sand-700">Autonomy Level</label>
                    <select
                      value={engine.autonomyLevel}
                      onChange={(e) =>
                        updateEngine(engine.id, {
                          autonomyLevel: e.target.value as EngineConfig["autonomyLevel"],
                        })
                      }
                      className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2.5 text-xs font-medium text-sand-900 focus:outline-none focus:ring-1 focus:ring-sage-500"
                    >
                      <option value="full">Full Autonomy</option>
                      <option value="supervised">Supervised</option>
                      <option value="manual">Manual Only</option>
                    </select>
                  </div>

                  {/* Confidence threshold */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-sand-700">Confidence Threshold</label>
                      <span className="font-mono text-xs font-bold text-sage-800">{engine.confidenceThreshold}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="98"
                      value={engine.confidenceThreshold}
                      onChange={(e) =>
                        updateEngine(engine.id, { confidenceThreshold: Number(e.target.value) })
                      }
                      className="w-full accent-sage-600 cursor-pointer"
                    />
                  </div>

                  {/* Retraining cadence */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-sand-700">Retraining Cadence</label>
                    <div className="flex items-center gap-2 rounded-xl border border-sand-200 bg-sand-50/60 px-3 py-2.5">
                      <RefreshCw className="h-3.5 w-3.5 text-sand-500" />
                      <span className="text-xs font-medium text-sand-900">{engine.retrainingCadence}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom info row */}
                <div className="flex flex-wrap items-center gap-4 border-t border-sand-200/80 pt-3 text-[11px] text-sand-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last trained: {engine.lastRetrained}
                  </span>
                  <span className={cn(
                    "rounded-full border px-2 py-0.5 font-semibold",
                    autonomy.color
                  )}>
                    {autonomy.label}
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Cold-start: {engine.coldStartReady ? "Ready" : "Pending"}
                  </span>
                </div>
              </PanelBody>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
