"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Gauge,
  LineChart as LineChartIcon,
  Percent,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useAuth } from "@/components/auth/auth-context";
import { learningApi, revenueApi, type LearningEngineReport } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function ModelPerformancePage() {
  const { user } = useAuth();
  const isGm = user?.role === "general_manager";

  // 1. Fetch live engine learning statistics
  const {
    data: engineReports = [],
    isLoading: learningLoading,
    isError: learningError,
    refetch: refetchLearning,
  } = useQuery({
    queryKey: ["admin-model-perf", user?.propertyId],
    enabled: isGm,
    queryFn: () => learningApi.list(),
  });

  // 2. Fetch live revenue forecast to inspect model name & confidence
  const { data: forecastData = [], isLoading: forecastLoading } = useQuery({
    queryKey: ["admin-forecast-meta", user?.propertyId],
    enabled: isGm,
    queryFn: () => revenueApi.forecast(30),
  });

  const activeForecast = forecastData[0];

  if (!isGm) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="AI Model Performance"
          description="Verification metrics, forecast confidence, and Bayesian drift monitoring."
        />
        <div className="rounded-3xl border border-sand-200 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="mt-4 font-serif text-2xl font-bold text-sand-950">
            Executive Access Required
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-sand-600">
            Detailed statistical performance indicators and model calibration metrics are restricted strictly to General Management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Model Performance & Calibration"
        description="Factual accuracy tracking from backend decision scoring and Prophet/XGBoost revenue modeling."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetchLearning()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sand-200 bg-white px-3.5 py-2 text-xs font-semibold text-sand-700 shadow-xs hover:bg-sand-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", learningLoading && "animate-spin")} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        }
      />

      {/* Model Overview Summary Tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-xs">
          <span className="text-xs text-sand-500 font-medium">Revenue Forecast Model</span>
          <p className="mt-1 font-serif text-xl font-bold text-sand-950">
            {forecastLoading ? "…" : activeForecast?.model_name ?? "Prophet + XGBoost"}
          </p>
          <p className="mt-1 text-xs text-sand-500">
            Horizon: 30 days · Confidence:{" "}
            <span className="font-mono font-semibold text-sage-800">
              {activeForecast ? `${Math.round(activeForecast.confidence * 100)}%` : "—"}
            </span>
          </p>
        </div>

        <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-xs">
          <span className="text-xs text-sand-500 font-medium">Monitored Decision Engines</span>
          <p className="mt-1 font-mono text-2xl font-bold text-sage-800">
            {learningLoading ? "…" : engineReports.length}
          </p>
          <p className="mt-1 text-xs text-sand-500">Active autonomous recommenders</p>
        </div>

        <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-xs">
          <span className="text-xs text-sand-500 font-medium">Average Engine Accuracy</span>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-700">
            {learningLoading
              ? "…"
              : engineReports.length > 0
              ? `${Math.round(
                  engineReports.reduce((s, r) => s + r.accuracy_pct, 0) / engineReports.length
                )}%`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-sand-500">Verified by post-execution outcome scoring</p>
        </div>
      </div>

      {/* Engine Metrics Table */}
      <Panel>
        <PanelHeader
          title="Engine Accuracy & Acceptance Telemetry"
          description="Live metrics computed directly by the learning service."
        />
        <PanelBody className="p-0">
          {learningLoading ? (
            <p role="status" className="p-8 text-center text-sm text-sand-500">
              Loading model performance telemetry…
            </p>
          ) : learningError ? (
            <div className="p-8 text-center">
              <p role="alert" className="text-sm text-rose-700">
                Failed to load engine performance records.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchLearning()}
                className="mt-3 text-xs"
              >
                Retry
              </Button>
            </div>
          ) : engineReports.length === 0 ? (
            <p className="p-8 text-center text-sm text-sand-500">
              No engine telemetry records available for this property yet.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Engine</TH>
                  <TH className="text-center">Recommendations</TH>
                  <TH className="text-center">Approved</TH>
                  <TH className="text-center">Dismissed</TH>
                  <TH className="text-center">Acceptance Rate</TH>
                  <TH className="text-center">Accuracy</TH>
                  <TH className="text-center">Mean Confidence</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {engineReports.map((report) => {
                  const acceptancePct =
                    report.cards_created > 0
                      ? Math.round((report.approved / report.cards_created) * 100)
                      : 0;

                  return (
                    <TR key={report.engine}>
                      <TD className="font-semibold text-sand-950">
                        {report.display_name ?? report.engine.replaceAll("_", " ").toUpperCase()}
                      </TD>
                      <TD className="text-center font-mono text-xs tabular-nums">
                        {report.cards_created}
                      </TD>
                      <TD className="text-center font-mono text-xs tabular-nums text-emerald-800">
                        {report.approved}
                      </TD>
                      <TD className="text-center font-mono text-xs tabular-nums text-sand-500">
                        {report.dismissed}
                      </TD>
                      <TD className="text-center font-mono text-xs font-semibold tabular-nums">
                        {acceptancePct}%
                      </TD>
                      <TD className="text-center font-mono text-xs font-semibold tabular-nums text-sage-950">
                        {Math.round(report.accuracy_pct)}%
                      </TD>
                      <TD className="text-center font-mono text-xs tabular-nums">
                        {Math.round(report.average_confidence * 100)}%
                      </TD>
                      <TD>
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                            report.status === "ready"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-amber-200 bg-amber-50 text-amber-800"
                          )}
                        >
                          {report.status}
                        </span>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
