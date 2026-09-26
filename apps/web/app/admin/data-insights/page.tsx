"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Info,
  Lightbulb,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth/auth-context";
import {
  actionCardsApi,
  learningApi,
  sentiment,
  type ActionCardDetail,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const URGENCY_CONFIG: Record<string, { label: string; badge: string }> = {
  urgent: { label: "Urgent Action", badge: "border-rose-300 bg-rose-50 text-rose-800" },
  high: { label: "High Priority", badge: "border-amber-300 bg-amber-50 text-amber-800" },
  medium: { label: "Operational Review", badge: "border-sand-300 bg-sand-100 text-sand-800" },
  low: { label: "Advisory", badge: "border-sand-200 bg-white text-sand-600" },
};

export default function DataInsightsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const isGm = user?.role === "general_manager";
  const [selectedEngine, setSelectedEngine] = useState<string>("all");
  const [selectedCard, setSelectedCard] = useState<ActionCardDetail | null>(null);

  // 1. Fetch live action cards (real backend-generated insights & exceptions)
  const {
    data: cards = [],
    isLoading: cardsLoading,
    isError: cardsError,
    refetch: refetchCards,
  } = useQuery({
    queryKey: ["admin-action-insights", user?.propertyId, selectedEngine],
    enabled: isGm,
    queryFn: () =>
      actionCardsApi.list({
        engine: selectedEngine === "all" ? undefined : selectedEngine,
        include_decided: false,
        limit: 50,
      }),
  });

  // 2. Fetch learning readiness for engine status
  const { data: readiness } = useQuery({
    queryKey: ["admin-learning-readiness", user?.propertyId],
    enabled: isGm,
    queryFn: () => learningApi.readiness(),
  });

  // 3. Fetch sentiment overview
  const { data: sentimentData } = useQuery({
    queryKey: ["admin-sentiment-insights", user?.propertyId],
    enabled: isGm,
    queryFn: () => sentiment.summary(30),
  });

  // Card mutations
  const approveMutation = useMutation({
    mutationFn: (cardId: string) => actionCardsApi.approve(cardId),
    onSuccess: (card) => {
      queryClient.invalidateQueries({ queryKey: ["admin-action-insights"] });
      showToast({
        title: "Action Approved",
        description: `Executed: ${card.headline}. Safe revert window open for 10s.`,
        type: "success",
      });
      setSelectedCard(null);
    },
  });

  const dismissMutation = useMutation({
    mutationFn: ({ cardId, reason }: { cardId: string; reason: string }) =>
      actionCardsApi.dismiss(cardId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-action-insights"] });
      showToast({
        title: "Insight Dismissed",
        description: "Logged to engine learning loop as feedback.",
        type: "default",
      });
      setSelectedCard(null);
    },
  });

  if (!isGm) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Executive AI Insights"
          description="Synthesized operational patterns, anomaly detection, and predictive recommendations."
        />
        <div className="rounded-3xl border border-sand-200 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="mt-4 font-serif text-2xl font-bold text-sand-950">
            Executive Access Only
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-sand-600">
            Executive AI Insights & Analytics are restricted to the General Manager. Department operational logs and team tasks are accessible via your assigned department view.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive AI Insights & Priority Exceptions"
        description="Actionable operational patterns, SLA risks, and revenue opportunities identified by backend analytical engines."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetchCards()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sand-200 bg-white px-3.5 py-2 text-xs font-semibold text-sand-700 shadow-xs hover:bg-sand-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", cardsLoading && "animate-spin")} />
              <span>Refresh Telemetry</span>
            </button>
          </div>
        }
      />

      {/* Engine Readiness Banner */}
      {readiness && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sand-200 bg-sand-50/70 p-4 text-xs text-sand-700">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-sage-700" />
            <span className="font-semibold text-sand-950">Active Analytics Engines:</span>
            <span>{readiness.ready.length} verified calibrated</span>
            {readiness.warming.length > 0 && (
              <span className="text-amber-700">· {readiness.warming.length} warming up</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sand-500">Filter by Engine:</span>
            <select
              value={selectedEngine}
              onChange={(e) => setSelectedEngine(e.target.value)}
              className="rounded-lg border border-sand-300 bg-white px-2.5 py-1 text-xs text-sand-950 shadow-xs focus:border-sage-600 focus:outline-none"
            >
              <option value="all">All Engines</option>
              <option value="revenue">Dynamic Pricing Engine</option>
              <option value="maintenance">Predictive Maintenance BMS</option>
              <option value="guest_intel">Guest Sentiment & Retention</option>
              <option value="inventory">Inventory Par Auto-Reorder</option>
            </select>
          </div>
        </div>
      )}

      {/* Actionable Exceptions List */}
      <Panel>
        <PanelHeader
          title="Priority Algorithmic Exceptions & Action Items"
          description="Ranked by business urgency and model confidence. All items persist audit trails upon execution or dismissal."
        />
        <PanelBody className="space-y-4 p-6">
          {cardsLoading ? (
            <p role="status" className="py-12 text-center text-sm text-sand-500">
              Evaluating live resort telemetry…
            </p>
          ) : cardsError ? (
            <div className="py-12 text-center">
              <p role="alert" className="text-sm text-rose-700">
                Failed to retrieve action cards from the analytics engine.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchCards()}
                className="mt-3 text-xs"
              >
                Retry
              </Button>
            </div>
          ) : cards.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="mt-3 font-serif text-lg font-bold text-sand-950">
                All Operations Within Tolerance
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-sand-600">
                No active anomalies, pricing discrepancies, or unaddressed guest churn risks detected at this time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {cards.map((card) => {
                const urgency = URGENCY_CONFIG[card.urgency] ?? URGENCY_CONFIG.medium;
                const createdDate = new Date(card.created_at).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "numeric",
                  month: "short",
                });

                return (
                  <div
                    key={card.id}
                    className="relative overflow-hidden rounded-2xl border border-sand-200 bg-white p-5 shadow-xs transition hover:border-sand-300 hover:shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                              urgency.badge
                            )}
                          >
                            {urgency.label}
                          </span>
                          <span className="font-mono text-xs text-sand-500">
                            {Math.round(card.confidence * 100)}% Confidence
                          </span>
                          <span className="text-xs text-sand-400">·</span>
                          <span className="text-xs text-sand-500 capitalize">
                            Engine: {card.engine.replaceAll("_", " ")}
                          </span>
                        </div>
                        <h4 className="font-serif text-base font-bold text-sand-950 pt-1">
                          {card.headline}
                        </h4>
                        <p className="max-w-3xl text-xs text-sand-600 leading-relaxed">
                          {card.rationale}
                        </p>
                      </div>

                      <span className="text-[11px] text-sand-400 font-mono">
                        Freshness: {createdDate}
                      </span>
                    </div>

                    {/* Drivers Preview */}
                    {card.drivers && card.drivers.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-sand-100">
                        {card.drivers.map((d, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1 text-[11px] text-sand-700 font-mono"
                          >
                            <span className="font-semibold text-sand-900">{d.name}:</span>
                            <span>{String(d.value)}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action Execution Buttons */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-sand-100">
                      <button
                        type="button"
                        onClick={() => setSelectedCard(card)}
                        className="text-xs font-semibold text-sage-800 underline hover:text-sage-950"
                      >
                        Model Assumptions & Details →
                      </button>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={dismissMutation.isPending}
                          onClick={() =>
                            dismissMutation.mutate({ cardId: card.id, reason: "not_accurate" })
                          }
                          className="text-xs"
                        >
                          Dismiss
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          disabled={approveMutation.isPending}
                          onClick={() => approveMutation.mutate(card.id)}
                          className="bg-sage-800 text-xs font-semibold text-white hover:bg-sage-900"
                        >
                          Approve Recommendation
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PanelBody>
      </Panel>

      {/* Model Drilldown Drawer */}
      <Drawer
        open={Boolean(selectedCard)}
        onClose={() => setSelectedCard(null)}
        title={selectedCard?.headline ?? "Model Details"}
        description={selectedCard ? `Engine: ${selectedCard.engine} · Confidence: ${Math.round(selectedCard.confidence * 100)}%` : ""}
      >
        {selectedCard && (
          <div className="space-y-5 p-4">
            <div className="rounded-2xl border border-sand-200 bg-sand-50/60 p-4 space-y-2">
              <h5 className="font-semibold text-xs text-sand-950 uppercase tracking-wider">
                Full Algorithmic Rationale
              </h5>
              <p className="text-xs text-sand-700 leading-relaxed">{selectedCard.rationale}</p>
            </div>

            {selectedCard.drivers && selectedCard.drivers.length > 0 && (
              <div className="space-y-2">
                <h5 className="font-semibold text-xs text-sand-950 uppercase tracking-wider">
                  Signal Contributors & Drivers
                </h5>
                <div className="divide-y divide-sand-200 rounded-2xl border border-sand-200 bg-white">
                  {selectedCard.drivers.map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-3 text-xs">
                      <span className="font-medium text-sand-800">{d.name}</span>
                      <span className="font-mono text-sand-950">{String(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedCard.adjustments && Object.keys(selectedCard.adjustments).length > 0 && (
              <div className="space-y-2">
                <h5 className="font-semibold text-xs text-sand-950 uppercase tracking-wider">
                  Proposed Target Adjustments
                </h5>
                <pre className="rounded-xl border border-sand-200 bg-sand-50 p-3 font-mono text-[11px] text-sand-800 overflow-x-auto">
                  {JSON.stringify(selectedCard.adjustments, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
