"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Gauge,
  GraduationCap,
  RefreshCw,
  Rocket,
  Shield,
  ShieldAlert,
  Snowflake,
  Sun,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useAuth } from "@/components/auth/auth-context";
import { learningApi, type LearningEngineReport, type ReadinessData } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; bg: string; border: string; text: string; dot: string }
> = {
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
};

export default function TrainingPage() {
  const { user } = useAuth();
  const isGm = user?.role === "general_manager";

  // 1. Fetch live learning engine accuracy & calibration
  const {
    data: engineReports = [],
    isLoading: reportsLoading,
    isError: reportsError,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ["admin-learning-reports", user?.propertyId],
    enabled: isGm,
    queryFn: () => learningApi.list(),
  });

  // 2. Fetch readiness threshold statuses
  const { data: readiness, isLoading: readinessLoading } = useQuery({
    queryKey: ["admin-learning-readiness", user?.propertyId],
    enabled: isGm,
    queryFn: () => learningApi.readiness(),
  });

  if (!isGm) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Model Training & Calibration"
          description="Algorithmic feedback loops, accuracy verification, and engine shadow mode controls."
        />
        <div className="rounded-3xl border border-sand-200 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="mt-4 font-serif text-2xl font-bold text-sand-950">
            Executive Access Required
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-sand-600">
            Engine calibration, accuracy verification, and autonomous feedback loop controls are restricted strictly to General Management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Model Training & Learning Loops"
        description="Continuous reinforcement from GM approvals, overrides, and guest feedback telemetry."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetchReports()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sand-200 bg-white px-3.5 py-2 text-xs font-semibold text-sand-700 shadow-xs hover:bg-sand-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", reportsLoading && "animate-spin")} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        }
      />

      {/* Readiness Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
            <span>Production Ready</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold text-emerald-950">
            {readinessLoading ? "…" : readiness?.ready.length ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-emerald-700">
            Sufficient decision history to recommend autonomously
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
            <span>Warming Up</span>
            <Sun className="h-4 w-4 text-amber-700" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold text-amber-950">
            {readinessLoading ? "…" : readiness?.warming.length ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-amber-700">
            Building history under human review threshold
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
            <span>Cold Start</span>
            <Snowflake className="h-4 w-4 text-blue-700" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold text-blue-950">
            {readinessLoading ? "…" : readiness?.cold.length ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-blue-700">
            Awaiting initial sample set from live operations
          </p>
        </div>
      </div>

      {/* Engine Accuracy Table */}
      <Panel>
        <PanelHeader
          title="Algorithmic Decision Calibration"
          description="Per-engine accuracy tracking calculated from human approvals versus post-execution outcomes."
        />
        <PanelBody className="p-6">
          {reportsLoading ? (
            <p role="status" className="py-12 text-center text-sm text-sand-500">
              Querying engine verification records…
            </p>
          ) : reportsError ? (
            <div className="py-12 text-center">
              <p role="alert" className="text-sm text-rose-700">
                Could not retrieve engine learning reports from action-service.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchReports()}
                className="mt-3 text-xs"
              >
                Retry
              </Button>
            </div>
          ) : engineReports.length === 0 ? (
            <div className="py-12 text-center text-sm text-sand-600">
              No engine accuracy records registered for this property yet.
            </div>
          ) : (
            <div className="space-y-4">
              {engineReports.map((report) => {
                const cfg = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.warming;
                const Icon = cfg.icon;

                return (
                  <div
                    key={report.engine}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sand-200 bg-white p-4 shadow-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-base font-bold text-sand-950">
                          {report.display_name ?? report.engine.replaceAll("_", " ").toUpperCase()}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            cfg.bg,
                            cfg.border,
                            cfg.text
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-sand-500">
                        Total Recommendations: {report.cards_created} · Approved: {report.approved} · Dismissed: {report.dismissed}
                      </p>
                    </div>

                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <span className="text-[11px] text-sand-500">Accuracy Rate</span>
                        <p className="font-mono text-lg font-bold text-sand-950">
                          {Math.round(report.accuracy_pct)}%
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-sand-500">Mean Confidence</span>
                        <p className="font-mono text-lg font-bold text-sage-800">
                          {Math.round(report.average_confidence * 100)}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
