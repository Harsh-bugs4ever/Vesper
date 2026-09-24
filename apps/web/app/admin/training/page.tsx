"use client";

import React, { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  Eye,
  EyeOff,
  Gauge,
  GraduationCap,
  Loader2,
  RefreshCw,
  Rocket,
  Shield,
  Snowflake,
  Sun,
  TrendingUp,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { engines, recentTrainingEvents, type EngineStatus } from "@/lib/demo/learning";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  ready: {
    label: "Production Ready",
    icon: CheckCircle2,
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    dot: "bg-emerald-500",
  },
  warming: {
    label: "Warming Up",
    icon: Sun,
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    dot: "bg-amber-500",
  },
  cold: {
    label: "Cold Start",
    icon: Snowflake,
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    dot: "bg-blue-500",
  },
  shadow: {
    label: "Shadow Mode",
    icon: Eye,
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-800",
    dot: "bg-purple-500",
  },
} as const;

const EVENT_TYPE_CONFIG = {
  retrain: { label: "Retrain", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  calibration: { label: "Calibration", color: "bg-sage-100 text-sage-800 border-sage-200" },
  cold_start: { label: "Cold Start", color: "bg-blue-100 text-blue-800 border-blue-200" },
  data_ingestion: { label: "Data Ingestion", color: "bg-amber-100 text-amber-800 border-amber-200" },
} as const;

function EngineCard({
  engine,
  onToggleShadow,
}: {
  engine: EngineStatus;
  onToggleShadow: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const effectiveStatus = engine.shadowMode ? "shadow" : engine.status;
  const cfg = STATUS_CONFIG[effectiveStatus === "shadow" ? "shadow" : engine.status];
  const Icon = cfg.icon;
  const progress = Math.min(100, Math.round((engine.dataPointsIngested / engine.dataPointsRequired) * 100));

  return (
    <Panel className="overflow-hidden transition-all duration-200 hover:shadow-card">
      <PanelBody className="space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", cfg.bg, cfg.text)}>
              <BrainCircuit className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-serif text-base font-semibold text-sand-950 leading-tight">{engine.name}</h3>
              <p className="mt-0.5 text-xs text-sand-600 line-clamp-2">{engine.description}</p>
            </div>
          </div>
          <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", cfg.bg, cfg.border, cfg.text)}>
            <span className={cn("h-2 w-2 rounded-full", cfg.dot, engine.status === "warming" && "animate-pulse")} />
            {cfg.label}
          </span>
        </div>

        {/* Cold-start banner */}
        {engine.status === "cold" && (
          <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
            <Snowflake className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div>
              <p className="text-xs font-semibold text-blue-900">Cold Start — Awaiting Data</p>
              <p className="mt-0.5 text-xs text-blue-700">
                This engine needs {(engine.dataPointsRequired - engine.dataPointsIngested).toLocaleString("en-IN")} more
                data points before it can begin its first training run. It will operate in shadow mode until ready.
              </p>
            </div>
          </div>
        )}

        {/* Warming banner */}
        {engine.status === "warming" && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-600" />
            <div>
              <p className="text-xs font-semibold text-amber-900">Warming Up — Learning in Progress</p>
              <p className="mt-0.5 text-xs text-amber-700">
                This engine is accumulating data and refining its model. Currently in shadow mode —
                suggestions are logged but not executed.
              </p>
            </div>
          </div>
        )}

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-sand-200/80 bg-sand-50/60 p-3">
            <p className="text-[11px] text-sand-500">Accuracy</p>
            <p className="mt-0.5 font-sans text-lg font-semibold text-sand-950 tabular-nums">
              {engine.accuracy > 0 ? `${engine.accuracy}%` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-sand-200/80 bg-sand-50/60 p-3">
            <p className="text-[11px] text-sand-500">Confidence</p>
            <p className="mt-0.5 font-sans text-lg font-semibold text-sand-950 tabular-nums">{engine.confidenceThreshold}%</p>
          </div>
          <div className="rounded-xl border border-sand-200/80 bg-sand-50/60 p-3">
            <p className="text-[11px] text-sand-500">Last Trained</p>
            <p className="mt-0.5 text-sm font-semibold text-sand-950">{engine.lastRetrained}</p>
          </div>
          <div className="rounded-xl border border-sand-200/80 bg-sand-50/60 p-3">
            <p className="text-[11px] text-sand-500">Next Training</p>
            <p className="mt-0.5 text-sm font-semibold text-sand-950">{engine.nextRetraining}</p>
          </div>
        </div>

        {/* Data ingestion progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-sand-700">
              <Database className="h-3.5 w-3.5 text-sand-500" />
              Data Ingested
            </span>
            <span className="font-semibold text-sand-900">
              {engine.dataPointsIngested.toLocaleString("en-IN")} / {engine.dataPointsRequired.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-sand-100">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                progress >= 100 ? "bg-emerald-500" : progress >= 50 ? "bg-sage-500" : "bg-amber-500"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] text-sand-500">
            {progress}% of minimum data threshold reached
          </p>
        </div>

        {/* Shadow mode toggle & expand */}
        <div className="flex items-center justify-between gap-3 border-t border-sand-200/80 pt-3">
          <button
            onClick={() => onToggleShadow(engine.id)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
              engine.shadowMode
                ? "border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100"
                : "border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
            )}
          >
            {engine.shadowMode ? (
              <>
                <Eye className="h-3.5 w-3.5" />
                Shadow Mode On
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                Shadow Mode Off
              </>
            )}
          </button>

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium text-sage-700 transition-colors hover:text-sage-900"
          >
            {expanded ? "Less" : "Details"}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="space-y-3 rounded-xl border border-sand-200/80 bg-sand-50/40 p-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-sand-600">Engine ID</span>
              <span className="font-mono text-sand-800">{engine.id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sand-600">Shadow Mode</span>
              <span className={cn("font-semibold", engine.shadowMode ? "text-purple-700" : "text-emerald-700")}>
                {engine.shadowMode ? "Active — suggestions logged, not executed" : "Inactive — auto-executing above threshold"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sand-600">Auto-Execution Threshold</span>
              <span className="font-semibold text-sand-900">≥ {engine.confidenceThreshold}% confidence</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sand-600">Retraining Cadence</span>
              <span className="font-semibold text-sand-900">Weekly (auto)</span>
            </div>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

export default function LearningPage() {
  const { showToast } = useToast();
  const [engineStates, setEngineStates] = useState(engines);

  const toggleShadow = (id: string) => {
    setEngineStates((prev) =>
      prev.map((e) => (e.id === id ? { ...e, shadowMode: !e.shadowMode } : e))
    );
    const engine = engineStates.find((e) => e.id === id);
    if (engine) {
      showToast({
        title: `${engine.name} — Shadow Mode ${engine.shadowMode ? "Disabled" : "Enabled"}`,
        description: engine.shadowMode
          ? "This engine will now auto-execute suggestions above the confidence threshold."
          : "Suggestions will be logged but not executed until you disable shadow mode.",
        type: engine.shadowMode ? "success" : "default",
      });
    }
  };

  const readyCount = engineStates.filter((e) => e.status === "ready" && !e.shadowMode).length;
  const shadowCount = engineStates.filter((e) => e.shadowMode).length;
  const coldCount = engineStates.filter((e) => e.status === "cold").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Learning & Readiness"
        description="Monitor cold-start status, data ingestion progress, shadow mode, and retraining cadence for every ML engine."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              showToast({
                title: "Training Pipeline Refreshed",
                description: "All engine metrics and ingestion counters have been recalculated.",
                type: "success",
              })
            }
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Status
          </Button>
        }
      />

      {/* Global cold-start banner (if any engine is cold) */}
      {coldCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/80 via-white to-sage-50/40 p-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white shadow-xs">
              <Snowflake className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-serif text-base font-semibold text-sand-950">
                  Cold Start Active · {coldCount} {coldCount === 1 ? "Engine" : "Engines"} Awaiting Data
                </span>
              </div>
              <p className="text-xs text-sand-600">
                Some engines haven't ingested enough data for their first training run. They operate in shadow mode until ready.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline">
            <Database className="h-3.5 w-3.5" />
            View Data Pipeline
          </Button>
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Rocket className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-sand-600">Production Ready</p>
              <p className="font-sans text-2xl font-semibold text-sand-950 tabular-nums">{readyCount}</p>
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
              <p className="font-sans text-2xl font-semibold text-sand-950 tabular-nums">{shadowCount}</p>
            </div>
          </div>
        </Panel>
        <Panel className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
              <Snowflake className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-sand-600">Cold Start</p>
              <p className="font-sans text-2xl font-semibold text-sand-950 tabular-nums">{coldCount}</p>
            </div>
          </div>
        </Panel>
        <Panel className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-50 text-sage-700">
              <Gauge className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-sand-600">Avg. Accuracy</p>
              <p className="font-sans text-2xl font-semibold text-sand-950 tabular-nums">
                {Math.round(
                  engineStates.filter((e) => e.accuracy > 0).reduce((sum, e) => sum + e.accuracy, 0) /
                    engineStates.filter((e) => e.accuracy > 0).length
                )}%
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {/* Engine cards */}
      <div>
        <h2 className="mb-4 font-serif text-lg font-semibold text-sand-950">AI Engines ({engineStates.length})</h2>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {engineStates.map((engine) => (
            <EngineCard key={engine.id} engine={engine} onToggleShadow={toggleShadow} />
          ))}
        </div>
      </div>

      {/* Recent training events */}
      <Panel>
        <PanelHeader
          title="Recent Training Events"
          description="Model retraining, calibration, and data ingestion activity log"
          action={
            <span className="text-xs text-sand-500">Last 7 days</span>
          }
        />
        <PanelBody className="divide-y divide-sand-200/80 pt-2">
          {recentTrainingEvents.map((event) => {
            const evtCfg = EVENT_TYPE_CONFIG[event.type];
            return (
              <div key={event.id} className="flex items-start gap-3 py-3.5 first:pt-2 last:pb-2">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage-50 text-sage-700">
                  {event.type === "retrain" && <RefreshCw className="h-4 w-4" />}
                  {event.type === "calibration" && <Activity className="h-4 w-4" />}
                  {event.type === "cold_start" && <Snowflake className="h-4 w-4" />}
                  {event.type === "data_ingestion" && <Database className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-sand-950">{event.engine}</span>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", evtCfg.color)}>
                      {evtCfg.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-sand-600">{event.description}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-sand-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {event.timestamp}
                    </span>
                    {event.durationMs > 0 && (
                      <span>{(event.durationMs / 1000).toFixed(1)}s</span>
                    )}
                    <span className="flex items-center gap-1 font-semibold text-emerald-700">
                      <TrendingUp className="h-3 w-3" />
                      {event.metricsImprovement}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </PanelBody>
      </Panel>
    </div>
  );
}
