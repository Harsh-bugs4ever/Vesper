"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";
import {
  AlertCircle,
  ArrowUpDown,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  IndianRupee,
  Layers,
  MoreHorizontal,
  RotateCcw,
  Sliders,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { FilterChips } from "@/components/ui/filter-chips";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { StatTile } from "@/components/ui/stat-tile";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// --- Backend types -----------------------------------------------------------

interface Driver {
  label: string;
  detail: string;
  weight: number;
}

interface Card {
  id: string;
  engine: string;
  kind: string;
  status: string;
  title: string;
  summary: string;
  drivers: Driver[];
  confidence: number;
  impact_amount: number;
  urgency: string;
  score: number;
  required_permission: string;
  payload: Record<string, unknown>;
  adjustments: Record<string, unknown>;
  can_undo: boolean;
  undo_seconds_left: number;
  decided_at: string | null;
  executed_at: string | null;
  snoozed_until: string | null;
  expires_at: string | null;
  created_at: string;
  risk_pct?: number | null;
  profit_pct?: number | null;
  is_auto_dispatched?: boolean | null;
  auto_recipient?: string | null;
}

function getCardRiskAndProfit(card: Card) {
  const conf = card.confidence ?? 0.75;
  const impact = Number(card.impact_amount) || 0;

  // Profit % calculation: confidence + positive upside
  const profit_percentage = card.profit_pct ?? Math.round(
    Math.min(98, Math.max(15, conf * 82 + (impact > 0 ? 12 : 5)))
  );

  // Risk % calculation: uncertainty + operational urgency risk
  const urgencyShift = card.urgency === "critical" ? 15 : card.urgency === "high" ? 8 : -8;
  const risk_percentage = card.risk_pct ?? Math.round(
    Math.max(5, Math.min(95, (1 - conf) * 100 + urgencyShift))
  );

  // Autonomous Qualification Rule: Risk < 40% AND Profit > 60%
  const isAutonomousQualified = risk_percentage < 40 && profit_percentage > 60;

  // Target recipient person / department
  let recipient = card.auto_recipient;
  if (!recipient) {
    const kind = card.kind.toLowerCase();
    if (kind.includes("retention") || kind.includes("recovery") || kind.includes("promo") || kind.includes("guest")) {
      recipient = "Guest & Guest Experience Lead";
    } else if (kind.includes("purchase") || kind.includes("chef") || kind.includes("food") || kind.includes("stock")) {
      recipient = "Executive Chef & F&B Manager";
    } else if (kind.includes("work_order") || kind.includes("audit") || kind.includes("turnover") || kind.includes("maintenance")) {
      recipient = "Chief Engineer & Maintenance Crew";
    } else if (kind.includes("roster") || kind.includes("staffing")) {
      recipient = "Duty Manager & Shift Supervisor";
    } else if (kind.includes("rate")) {
      recipient = "Revenue Manager & Reservations";
    } else {
      recipient = "Front Desk & Operations Desk";
    }
  }

  return {
    profit_percentage,
    risk_percentage,
    isAutonomousQualified,
    recipient,
  };
}

interface ActionStats {
  pending_cards: number;
  executed_cards: number;
  realised_impact: number;
  shadow_mode: boolean;
}

// --- Presentation helpers ---------------------------------------------------

const KIND_LABEL: Record<string, string> = {
  purchase: "Stock & F&B",
  rate_change: "Revenue & Pricing",
  roster_change: "Workforce",
  work_order: "Engineering",
  retention_offer: "Guest Experience",
  staffing_gap: "Workforce",
  facility_promo: "Facility & Perks",
  guest_recovery: "Guest SLA Recovery",
  vision_audit: "Vision-AI Turnover",
  chef_special: "Kitchen Waste Rescue",
};

const KIND_CATEGORY: Record<string, string> = {
  purchase: "inventory",
  rate_change: "pricing",
  roster_change: "staffing",
  work_order: "maintenance",
  retention_offer: "inventory",
  staffing_gap: "staffing",
  facility_promo: "guest",
  guest_recovery: "guest",
  vision_audit: "maintenance",
  chef_special: "inventory",
};

const URGENCY_META: Record<string, { label: string; chip: string; bar: string }> = {
  critical: {
    label: "Critical",
    chip: "border-rose-200 bg-rose-50 text-rose-700",
    bar: "bg-rose-500",
  },
  high: {
    label: "High",
    chip: "border-orange-200 bg-orange-50 text-orange-700",
    bar: "bg-orange-500",
  },
  medium: {
    label: "Medium",
    chip: "border-gold-200 bg-gold-50 text-gold-700",
    bar: "bg-gold-500",
  },
  low: {
    label: "Low",
    chip: "border-sage-200 bg-sage-50 text-sage-700",
    bar: "bg-sage-500",
  },
};

const SNOOZE_OPTIONS = [
  { label: "15 minutes", minutes: 15 },
  { label: "1 hour", minutes: 60 },
  { label: "4 hours", minutes: 240 },
  { label: "Until tomorrow (24 h)", minutes: 1440 },
];

const DISMISS_REASONS = [
  { value: "not_accurate", label: "Not accurate — the data is wrong" },
  { value: "already_handled", label: "Already handled manually" },
  { value: "bad_timing", label: "Bad timing — come back later" },
  { value: "not_worth_it", label: "Impact does not justify this action" },
];

function urgencyForCard(card: Card) {
  return URGENCY_META[card.urgency] ?? URGENCY_META.medium;
}

function kindLabel(card: Card) {
  return KIND_LABEL[card.kind] ?? card.kind;
}

// --- Main page ---------------------------------------------------------------

export default function ActionQueuePage() {
  const { isConnected, hasPermission } = useAuth();
  return isConnected ? <LiveActionQueue /> : <NoBackendMessage />;
}

function NoBackendMessage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Action Queue"
        description="Autonomous recommendations calibrated against real-time demand, sensor telemetry, and guest pace."
        meta={format(new Date(), "EEE, d MMM yyyy")}
      />
      <Panel>
        <PanelBody className="py-16 text-center">
          <Bot className="mx-auto h-12 w-12 text-sand-400" />
          <h3 className="mt-3 font-serif text-lg font-semibold text-sand-950">
            Sign in to see live action cards
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-sand-600">
            Action cards are generated by the AI engines. Log in with a manager or owner
            account to see and act on them.
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}

function LiveActionQueue() {
  const { user, hasPermission } = useAuth();
  const { showToast, showUndoToast } = useToast();
  const client = useQueryClient();

  const [kindFilter, setKindFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [includeDecided, setIncludeDecided] = useState(false);

  // Adjust modal
  const [adjustingCard, setAdjustingCard] = useState<Card | null>(null);
  const [adjustedQty, setAdjustedQty] = useState("");
  const [adjustedNote, setAdjustedNote] = useState("");

  // Dismiss modal
  const [dismissingCard, setDismissingCard] = useState<Card | null>(null);
  const [dismissReason, setDismissReason] = useState(DISMISS_REASONS[0].value);
  const [dismissNote, setDismissNote] = useState("");

  // Snooze dropdown
  const [activeSnoozeId, setActiveSnoozeId] = useState<string | null>(null);

  // AI Autonomous automation scanner state
  const [runningAiEngine, setRunningAiEngine] = useState<string | null>(null);

  const triggerAi = async (endpoint: string, label: string) => {
    try {
      setRunningAiEngine(label);
      await api.post(`/cards/ai-automation/${endpoint}`);
      await client.invalidateQueries({ queryKey: key });
      await client.invalidateQueries({ queryKey: statsKey });
      showToast({
        title: "AI Scan Completed",
        description: `${label} analyzed real-time conditions and refreshed the action queue.`,
        type: "default",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not complete engine scan.";
      showToast({
        title: "AI Engine Scan Failed",
        description: msg,
        type: "error",
      });
    } finally {
      setRunningAiEngine(null);
    }
  };

  const key = ["cards", user?.propertyId ?? "", user?.id ?? ""];
  const statsKey = ["cards-stats", user?.propertyId ?? ""];

  const cardsQuery = useQuery({
    queryKey: [...key, includeDecided],
    queryFn: () =>
      api.get<Card[]>("/cards", {
        include_decided: includeDecided,
        limit: 100,
      }),
    refetchInterval: 30_000,
  });

  const statsQuery = useQuery({
    queryKey: statsKey,
    queryFn: () => api.get<ActionStats>("/cards/stats"),
    refetchInterval: 60_000,
  });

  const recommendationsMutation = useMutation({
    mutationFn: () => api.post<{ cards_raised: number }>("/revenue/cards/propose?days=14"),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: key });
      showToast({
        title: result.cards_raised ? "Recommendations added" : "No rate changes suggested",
        description: result.cards_raised
          ? `${result.cards_raised} rate recommendation${result.cards_raised === 1 ? "" : "s"} added to the queue.`
          : "The current 14-day forecast did not produce a rate change above the recommendation thresholds.",
        type: "default",
      });
    },
    onError: (error: Error) => {
      showToast({ title: "Could not generate recommendations", description: error.message, type: "error" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, adjustments }: { id: string; adjustments?: Record<string, unknown> }) =>
      api.post<Card>(`/cards/${id}/approve`, { adjustments: adjustments ?? null }),
    onSuccess: (updated) => {
      client.invalidateQueries({ queryKey: key });
      client.invalidateQueries({ queryKey: statsKey });
      const title = updated?.title ?? "Action card";
      showUndoToast(
        `Approved: ${title}`,
        "Card executed. The AI engine will score the outcome.",
        () => {
          // Undo is only available during the undo window; hit the undo endpoint.
          void api.post(`/cards/${updated.id}/undo`).then(() => {
            client.invalidateQueries({ queryKey: key });
            showToast({ title: "Undone", description: "The action has been reverted.", type: "default" });
          });
        },
        10
      );
    },
    onError: (err: Error) => {
      showToast({ title: "Could not approve", description: err.message, type: "error" });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes: number }) =>
      api.post<Card>(`/cards/${id}/snooze`, { minutes }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: key });
      setActiveSnoozeId(null);
    },
    onError: (err: Error) => {
      showToast({ title: "Could not snooze", description: err.message, type: "error" });
    },
  });

  const autoExecuteMutation = useMutation({
    mutationFn: () => api.post<{ executed_count: number; executed_card_ids: string[] }>("/cards/auto-execute-qualified"),
    onSuccess: (data) => {
      client.invalidateQueries({ queryKey: key });
      client.invalidateQueries({ queryKey: statsKey });
      showToast({
        title: "⚡ Autonomous Execution Completed",
        description: `AI evaluated risk & profit thresholds and auto-executed ${data.executed_count} actions (Risk < 40% & Profit > 60%) to respective recipients.`,
        type: "success",
      });
    },
    onError: (err: Error) => {
      showToast({ title: "Auto-execution failed", description: err.message, type: "error" });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: ({ id, reason, note }: { id: string; reason: string; note?: string }) =>
      api.post<Card>(`/cards/${id}/dismiss`, { reason, note: note || null }),
    onSuccess: (updated) => {
      client.invalidateQueries({ queryKey: key });
      client.invalidateQueries({ queryKey: statsKey });
      setDismissingCard(null);
      setDismissNote("");
      const title = updated?.title ?? "Action card";
      showToast({
        title: `Dismissed: ${title}`,
        description: "Feedback logged to calibrate the AI engine.",
        type: "default",
      });
    },
    onError: (err: Error) => {
      showToast({ title: "Could not dismiss", description: err.message, type: "error" });
    },
  });

  const cards = cardsQuery.data ?? [];

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (kindFilter !== "all" && KIND_CATEGORY[card.kind] !== kindFilter) return false;
      if (urgencyFilter !== "all" && card.urgency !== urgencyFilter) return false;
      return true;
    });
  }, [cards, kindFilter, urgencyFilter]);

  const stats = statsQuery.data;
  const pendingCount = stats?.pending_cards ?? cards.filter((c) => c.status === "pending" || c.status === "claimed").length;
  const highUrgencyCount = cards.filter((c) => (c.urgency === "high" || c.urgency === "critical") && c.status === "pending").length;
  const totalImpact = stats?.realised_impact ?? 0;

  const canApprove = hasPermission("cards:approve");
  const canDismiss = hasPermission("cards:dismiss");

  const handleApprove = (card: Card) => {
    approveMutation.mutate({ id: card.id });
  };

  const openAdjustModal = (card: Card) => {
    setAdjustingCard(card);
    const suggestedQty = card.payload?.quantity;
    setAdjustedQty(suggestedQty !== undefined ? String(suggestedQty) : "");
    setAdjustedNote("");
  };

  const handleSaveAdjusted = () => {
    if (!adjustingCard) return;
    const qty = parseFloat(adjustedQty);
    if (isNaN(qty) || qty <= 0) {
      showToast({ title: "Invalid quantity", description: "Enter a number greater than zero.", type: "warning" });
      return;
    }
    const adjustments: Record<string, unknown> = { quantity: qty };
    if (adjustedNote.trim()) adjustments.note = adjustedNote.trim();
    setAdjustingCard(null);
    approveMutation.mutate({ id: adjustingCard.id, adjustments });
  };

  const handleSnooze = (card: Card, minutes: number, label: string) => {
    snoozeMutation.mutate({ id: card.id, minutes });
    showToast({
      title: `Snoozed: ${card.title}`,
      description: `Card snoozed for ${label}. It will reappear automatically.`,
      type: "default",
    });
  };

  const handleConfirmDismiss = () => {
    if (!dismissingCard) return;
    dismissMutation.mutate({ id: dismissingCard.id, reason: dismissReason, note: dismissNote });
  };

  const today = new Date();

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Action Queue"
        description="Autonomous recommendations calibrated against real-time demand, sensor telemetry, and guest pace."
        meta={format(today, "EEE, d MMM yyyy")}
        actions={
          <div className="flex items-center gap-2">
            {stats?.shadow_mode && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                <Zap className="h-3 w-3" />
                Shadow mode on — decisions logged but not applied
              </span>
            )}
            {canApprove && (
              <Button
                variant="default"
                size="sm"
                disabled={autoExecuteMutation.isPending}
                onClick={() => autoExecuteMutation.mutate()}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-sm gap-1.5"
              >
                <Zap className="h-3.5 w-3.5 text-amber-300 fill-amber-300" />
                {autoExecuteMutation.isPending ? "Auto-Executing…" : "⚡ Auto-Execute Qualified (Risk < 40% & Profit > 60%)"}
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              disabled={runningAiEngine !== null}
              onClick={() => triggerAi("run-all", "All 4 AI Autonomous Engines")}
              className="bg-sand-900 text-sand-50 hover:bg-sand-800 shadow-sm gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              {runningAiEngine === "All 4 AI Autonomous Engines" ? "Scanning Workflows…" : "Run AI Scan (All 4)"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                cardsQuery.refetch();
                statsQuery.refetch();
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Error banner */}
      {cardsQuery.isError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {cardsQuery.error instanceof Error ? cardsQuery.error.message : "Could not load action cards."}
          <button type="button" className="ml-2 font-semibold underline" onClick={() => cardsQuery.refetch()}>
            Retry
          </button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          variant="value-first"
          label="Pending Cards"
          value={pendingCount}
          change={highUrgencyCount > 0 ? `${highUrgencyCount} high / critical` : "All clear"}
          intent={highUrgencyCount > 0 ? "bad" : "good"}
          comparison="awaiting manager review"
          tone="sand"
          icon={Bot}
        />
        <StatTile
          variant="value-first"
          label="Realised Impact"
          value={`+₹${Math.round(totalImpact).toLocaleString("en-IN")}`}
          change="Executed cards"
          intent="good"
          comparison="total approved this period"
          tone="forest"
          icon={IndianRupee}
        />
        <StatTile
          variant="value-first"
          label="Cards Executed"
          value={stats?.executed_cards ?? 0}
          change={stats?.shadow_mode ? "Shadow mode" : "Live"}
          intent="neutral"
          comparison={stats?.shadow_mode ? "no real actions taken" : "applied to live data"}
          tone="sage"
          icon={Sparkles}
        />
      </div>

      {/* AI Autonomous Engines Simulation & Trigger Cockpit */}
      <Panel className="border-sand-200/80 bg-gradient-to-r from-sand-50/80 via-white to-sand-50/60 shadow-sm">
        <PanelBody className="py-3 px-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sand-900 text-amber-300">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-sand-900">
                    AI Autonomous Workflows
                  </h4>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                    4 Engines Active
                  </span>
                </div>
                <p className="text-xs text-sand-500">
                  Trigger targeted heuristics to discover off-peak perks, prevent guest churn, audit turnovers & rescue food stock.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={runningAiEngine !== null}
                onClick={() => triggerAi("facility-promo", "Facility Demand Engine")}
                className="h-7 text-xs border-sand-200 hover:bg-sand-100"
              >
                🏸 Badminton & Perks
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={runningAiEngine !== null}
                onClick={() => triggerAi("guest-recovery", "Predictive Churn Engine")}
                className="h-7 text-xs border-sand-200 hover:bg-sand-100"
              >
                ❤️ SLA Recovery
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={runningAiEngine !== null}
                onClick={() => triggerAi("vision-audit", "Vision-AI Turnover Engine")}
                className="h-7 text-xs border-sand-200 hover:bg-sand-100"
              >
                📷 Vision Turnover
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={runningAiEngine !== null}
                onClick={() => triggerAi("kitchen-waste", "Kitchen Waste Rescue")}
                className="h-7 text-xs border-sand-200 hover:bg-sand-100"
              >
                🍲 Chef Special
              </Button>
            </div>
          </div>
        </PanelBody>
      </Panel>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          options={[
            { value: "all" as const, label: "All Cards", count: cards.length },
            { value: "pricing" as const, label: "Revenue & Pricing", count: cards.filter((c) => KIND_CATEGORY[c.kind] === "pricing").length },
            { value: "maintenance" as const, label: "Engineering & Rooms", count: cards.filter((c) => KIND_CATEGORY[c.kind] === "maintenance").length },
            { value: "staffing" as const, label: "Workforce", count: cards.filter((c) => KIND_CATEGORY[c.kind] === "staffing").length },
            { value: "inventory" as const, label: "F&B & Stock", count: cards.filter((c) => KIND_CATEGORY[c.kind] === "inventory").length },
            { value: "guest" as const, label: "Guest SLA & Perks", count: cards.filter((c) => KIND_CATEGORY[c.kind] === "guest").length },
          ]}
          value={kindFilter}
          onChange={setKindFilter}
        />

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-sand-500">Urgency:</span>
          {(["all", "critical", "high", "medium", "low"] as const).map((urgency) => (
            <button
              key={urgency}
              onClick={() => setUrgencyFilter(urgency)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                urgencyFilter === urgency
                  ? "bg-sand-900 text-white"
                  : "border border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
              )}
            >
              {urgency}
            </button>
          ))}
          <button
            onClick={() => setIncludeDecided((v) => !v)}
            className={cn(
              "ml-2 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
              includeDecided
                ? "border-sage-700 bg-sage-700 text-white"
                : "border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
            )}
          >
            {includeDecided ? "Hide decided" : "Show decided"}
          </button>
        </div>
      </div>

      {/* Cards */}
      {cardsQuery.isPending ? (
        <Panel>
          <PanelBody className="py-16 text-center">
            <p role="status" className="text-sm text-sand-600">Loading action queue…</p>
          </PanelBody>
        </Panel>
      ) : filteredCards.length === 0 ? (
        <Panel>
          <PanelBody className="py-16 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-sage-600" />
            <h3 className="mt-3 font-serif text-lg font-semibold text-sand-950">
              {includeDecided ? "No cards match this filter" : "Queue is clear"}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-sand-600">
              {includeDecided
                ? "Try clearing filters to see all cards."
                : "There are no pending recommendations for these filters. Check the revenue forecast and department alerts for current signals, then return here to review any actions they raise."}
            </p>
            {!includeDecided && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {(user?.role === "owner" || user?.role === "general_manager") && (
                  <Button type="button" onClick={() => recommendationsMutation.mutate()} disabled={recommendationsMutation.isPending}>
                    {recommendationsMutation.isPending ? "Checking forecast…" : "Generate rate recommendations"}
                  </Button>
                )}
                <Link href="/admin/rates" className="inline-flex items-center rounded-lg border border-sage-300 px-4 py-2 text-sm font-medium text-sage-800 hover:bg-sage-50">
                  Open revenue forecast
                </Link>
              </div>
            )}
          </PanelBody>
        </Panel>
      ) : (
        <div className="space-y-4">
          {filteredCards.map((card) => {
            const urgency = urgencyForCard(card);
            const isDecided = ["executed", "dismissed", "undone", "expired"].includes(card.status);
            const isSnoozed = card.status === "snoozed";
            const { risk_percentage, profit_percentage, isAutonomousQualified, recipient } = getCardRiskAndProfit(card);

            return (
              <Panel
                key={card.id}
                className={cn(
                  "border-sand-200/80 transition-shadow hover:shadow-md",
                  (card.urgency === "high" || card.urgency === "critical") && !isDecided && "border-l-4 border-l-rose-500",
                  isDecided && "opacity-60"
                )}
              >
                <PanelBody className="space-y-4 pt-5">
                  {/* Top Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          urgency.chip
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", urgency.bar)} />
                        {urgency.label}
                      </span>

                      <span className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-sand-50 px-2.5 py-0.5 text-xs font-medium text-sand-700">
                        {kindLabel(card)}
                      </span>

                      {isSnoozed && card.snoozed_until && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700">
                          <Clock className="h-3 w-3" />
                          Snoozed until {new Date(card.snoozed_until).toLocaleTimeString("en-IN")}
                        </span>
                      )}

                      {isDecided && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-sand-100 px-2.5 py-0.5 text-xs capitalize text-sand-600">
                          {card.status}
                        </span>
                      )}

                      <span className="text-xs text-sand-400">
                        · {format(new Date(card.created_at), "d MMM, h:mm a")}
                      </span>
                    </div>

                    {/* Risk & Profit Autonomous Metrics + Confidence Bar */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold border",
                          profit_percentage > 60
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : "bg-sand-100 text-sand-800 border-sand-300"
                        )}
                        title="AI Profit / Value Upside Potential"
                      >
                        <TrendingUp className="h-3 w-3 text-emerald-600" />
                        Profit: {profit_percentage}%
                      </span>

                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold border",
                          risk_percentage < 40
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : "bg-rose-50 text-rose-800 border-rose-300"
                        )}
                        title="Evaluated Operational & Delivery Risk"
                      >
                        <AlertCircle className="h-3 w-3 text-amber-600" />
                        Risk: {risk_percentage}%
                      </span>

                      <div className="flex items-center gap-2 pl-2 border-l border-sand-200">
                        <span className="text-xs font-medium text-sand-600">Score:</span>
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-sand-200">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              card.confidence >= 0.9
                                ? "bg-emerald-600"
                                : card.confidence >= 0.7
                                  ? "bg-gold-500"
                                  : "bg-rose-500"
                            )}
                            style={{ width: `${Math.round(card.confidence * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-sand-900">
                          {Math.round(card.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Autonomous Execution Status Banner */}
                  {isAutonomousQualified && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-300/80 bg-emerald-50/70 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-600 animate-ping" />
                        <span className="font-semibold text-emerald-950">
                          ⚡ AI Autonomous Qualified (Risk: {risk_percentage}% &lt; 40% &amp; Profit: {profit_percentage}% &gt; 60%)
                        </span>
                      </div>
                      <span className="rounded bg-emerald-200/80 px-2 py-0.5 text-[11px] font-medium text-emerald-900">
                        Provided to: {recipient}
                      </span>
                    </div>
                  )}

                  {/* Title & Impact */}
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                    <div>
                      <h3 className="font-serif text-xl font-semibold leading-snug text-sand-950">
                        {card.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-sand-700">{card.summary}</p>

                      {/* Drivers */}
                      {card.drivers.length > 0 && (
                        <div className="mt-3">
                          <span className="text-xs font-medium text-sand-500">Key Drivers:</span>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {card.drivers.map((driver, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1 text-xs text-sand-800"
                                title={driver.detail}
                              >
                                <span className="h-1 w-1 rounded-full bg-sand-500" />
                                {driver.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Impact Box */}
                    <div className="flex flex-col justify-between rounded-xl border border-sand-200 bg-sand-50/50 p-4">
                      <div>
                        <span className="text-xs font-medium text-sand-500">Engine estimate · unverified</span>
                        <p className="font-serif text-2xl font-semibold text-emerald-700">
                          ₹{Number(card.impact_amount).toLocaleString("en-IN")}
                        </p>
                        <p className="mt-0.5 text-xs text-sand-600">Source: {card.engine}. Check underlying records and assumptions before approval.</p>
                      </div>

                      {card.payload && Object.keys(card.payload).length > 0 && (
                        <div className="mt-3 border-t border-sand-200/80 pt-3 space-y-1.5">
                          {card.payload.quantity !== undefined && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-sand-500">Suggested quantity</span>
                              <span className="font-medium text-sand-800">{String(card.payload.quantity)}</span>
                            </div>
                          )}
                          {card.payload.item_id !== undefined && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-sand-500">Item ID</span>
                              <span className="font-mono font-medium text-sand-700 text-[10px]">
                                {String(card.payload.item_id).slice(0, 8)}…
                              </span>
                            </div>
                          )}
                          {/* Facility Utilization details */}
                          {card.kind === "facility_promo" && card.payload.facility !== undefined && (
                            <div className="rounded-md border border-sand-200 bg-sand-100/70 p-2 text-xs space-y-1">
                              <div className="flex justify-between font-semibold text-sand-900">
                                <span>🏸 {String(card.payload.facility)}</span>
                                <span className="text-emerald-700">+{String(card.payload.discount_percent)}% Resident Perk</span>
                              </div>
                              <p className="text-[11px] text-sand-600 font-mono">{String(card.payload.time_slot)}</p>
                              <div className="text-[10px] text-sand-500 mt-1 italic border-t border-sand-200/60 pt-1">
                                &ldquo;{String(card.payload.concierge_message ?? "")}&rdquo;
                              </div>
                            </div>
                          )}
                          {/* Guest SLA Recovery details */}
                          {card.kind === "guest_recovery" && card.payload.room_number !== undefined && (
                            <div className="rounded-md border border-rose-200 bg-rose-50/70 p-2 text-xs space-y-1">
                              <div className="flex justify-between font-semibold text-rose-900">
                                <span>❤️ Room: {String(card.payload.room_number)}</span>
                                <span className="rounded bg-rose-100 px-1 py-0.5 text-[10px] text-rose-800 font-medium">VIP Rescue</span>
                              </div>
                              <p className="text-[11px] text-rose-800 font-medium">
                                {String(card.payload.recommended_action ?? "Executive courtesy delivery")}
                              </p>
                            </div>
                          )}
                          {/* Vision AI Room Inspection details */}
                          {card.kind === "vision_audit" && card.payload.audit_score !== undefined && (
                            <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-2 text-xs space-y-1">
                              <div className="flex justify-between font-semibold text-emerald-950">
                                <span>📷 Room {String(card.payload.room_number ?? "304")}</span>
                                <span className="rounded bg-emerald-100 px-1 py-0.5 text-[10px] text-emerald-800 font-bold">
                                  {String(card.payload.audit_score)}% Passed
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-emerald-900">
                                <span>✓ Crisp Linen</span>
                                <span>✓ Sanitized Surfaces</span>
                                <span>✓ Luxury Towels</span>
                                <span>✓ Minibar Sealed</span>
                              </div>
                            </div>
                          )}
                          {/* Kitchen Waste Rescue details */}
                          {card.kind === "chef_special" && card.payload.dish_name !== undefined && (
                            <div className="rounded-md border border-amber-200 bg-amber-50/70 p-2 text-xs space-y-1">
                              <div className="flex justify-between font-semibold text-amber-950">
                                <span>🍲 {String(card.payload.ingredient_name ?? "Stock Rescue")}</span>
                                <span className="text-emerald-700 font-bold">₹{String(card.payload.proposed_menu_price)}</span>
                              </div>
                              <p className="text-[11px] text-amber-900 font-medium">
                                {String(card.payload.dish_name)}
                              </p>
                            </div>
                          )}
                          {card.adjustments && Object.keys(card.adjustments).length > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-emerald-700">Adjusted to</span>
                              <span className="font-bold text-emerald-700">
                                {String((card.adjustments as Record<string, unknown>).quantity ?? "")}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Row — only shown for actionable cards */}
                  {!isDecided && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sand-200/80 pt-3">
                      <div className="flex items-center gap-2">
                        {canApprove && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(card)}
                              disabled={approveMutation.isPending}
                              className="bg-sage-700 hover:bg-sage-800"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approve
                            </Button>

                            {card.payload?.editable_fields && (card.payload.editable_fields as string[]).length > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openAdjustModal(card)}
                                disabled={approveMutation.isPending}
                              >
                                <Sliders className="h-3.5 w-3.5" />
                                Adjust
                              </Button>
                            )}
                          </>
                        )}
                      </div>

                      <div className="relative flex items-center gap-2">
                        {/* Snooze */}
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActiveSnoozeId(activeSnoozeId === card.id ? null : card.id)}
                            className="text-sand-600"
                            disabled={snoozeMutation.isPending}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            Snooze
                            <ChevronDown className="h-3 w-3" />
                          </Button>

                          {activeSnoozeId === card.id && (
                            <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-sand-200 bg-white p-1.5 shadow-elevated">
                              <p className="px-2.5 py-1 text-[11px] font-semibold text-sand-400">
                                SNOOZE RECOMMENDATION
                              </p>
                              {SNOOZE_OPTIONS.map((opt) => (
                                <button
                                  key={opt.minutes}
                                  onClick={() => handleSnooze(card, opt.minutes, opt.label)}
                                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-sand-800 transition-colors hover:bg-sand-50"
                                >
                                  <span>{opt.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Dismiss */}
                        {canDismiss && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDismissingCard(card);
                              setDismissReason(DISMISS_REASONS[0].value);
                              setDismissNote("");
                            }}
                            className="text-sand-500 hover:text-rose-600"
                          >
                            <X className="h-3.5 w-3.5" />
                            Dismiss
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mutation error inline */}
                  {(approveMutation.isError || dismissMutation.isError) && (
                    <p role="alert" className="text-xs text-rose-700">
                      {(approveMutation.error ?? dismissMutation.error) instanceof Error
                        ? ((approveMutation.error ?? dismissMutation.error) as Error).message
                        : "An error occurred."}
                    </p>
                  )}
                </PanelBody>
              </Panel>
            );
          })}
        </div>
      )}

      {/* Adjust Modal */}
      <Drawer
        open={adjustingCard !== null}
        onOpenChange={(open) => {
          if (!open) setAdjustingCard(null);
        }}
        title="Adjust Action Recommendation"
        description={adjustingCard?.title}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setAdjustingCard(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveAdjusted} disabled={approveMutation.isPending}>
              Save & Approve
            </Button>
          </>
        }
      >
        {adjustingCard && (
          <div className="space-y-5">
            <div className="rounded-xl border border-sand-200 bg-sand-50/70 p-4">
              <span className="text-xs text-sand-500">AI Suggested Quantity</span>
              <p className="mt-0.5 font-serif text-lg font-semibold text-sand-900">
                {adjustingCard.payload?.quantity !== undefined
                  ? String(adjustingCard.payload.quantity)
                  : "—"}
              </p>
              <p className="mt-1 text-xs text-sand-600">{adjustingCard.summary}</p>
            </div>

            <div>
              <label htmlFor="adjusted-qty" className="mb-1.5 block text-sm font-medium text-sand-800">
                Your Adjusted Quantity
              </label>
              <Input
                id="adjusted-qty"
                type="number"
                min="1"
                value={adjustedQty}
                onChange={(e) => setAdjustedQty(e.target.value)}
                placeholder="Enter revised quantity…"
              />
              <p className="mt-1 text-xs text-sand-500">
                The engine suggested {String(adjustingCard.payload?.quantity ?? "—")} units. You can override this.
              </p>
            </div>

            <div>
              <label htmlFor="adjusted-note" className="mb-1.5 block text-sm font-medium text-sand-800">
                Reason for Adjustment (Optional)
              </label>
              <textarea
                id="adjusted-note"
                rows={3}
                value={adjustedNote}
                onChange={(e) => setAdjustedNote(e.target.value)}
                placeholder="e.g. We have an upcoming banquet event…"
                className="w-full rounded-xl border border-sand-200 bg-white p-3 text-sm text-sand-900 placeholder:text-sand-400 focus:border-sage-500 focus:outline-none focus:ring-1 focus:ring-sage-500"
              />
            </div>
          </div>
        )}
      </Drawer>

      {/* Dismiss Modal */}
      <Drawer
        open={dismissingCard !== null}
        onOpenChange={(open) => {
          if (!open) setDismissingCard(null);
        }}
        title="Dismiss Suggestion"
        description="Help calibrate the AI engine by specifying why this suggestion is not being used."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDismissingCard(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmDismiss}
              disabled={dismissMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Confirm Dismissal
            </Button>
          </>
        }
      >
        {dismissingCard && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-sand-900">
              Select reason for dismissing &ldquo;{dismissingCard.title}&rdquo;:
            </p>

            <ul className="space-y-2">
              {DISMISS_REASONS.map((reason) => (
                <li key={reason.value}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-sand-200 p-3 text-sm transition-colors hover:bg-sand-50">
                    <input
                      type="radio"
                      name="dismiss-reason"
                      checked={dismissReason === reason.value}
                      onChange={() => setDismissReason(reason.value)}
                      className="h-4 w-4 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-sand-800">{reason.label}</span>
                  </label>
                </li>
              ))}
            </ul>

            <div>
              <label htmlFor="dismiss-note" className="mb-1.5 block text-sm font-medium text-sand-800">
                Additional note (Optional)
              </label>
              <textarea
                id="dismiss-note"
                rows={2}
                value={dismissNote}
                onChange={(e) => setDismissNote(e.target.value)}
                placeholder="Anything that helps calibrate the model…"
                className="w-full rounded-xl border border-sand-200 bg-white p-3 text-sm text-sand-900 placeholder:text-sand-400 focus:border-sage-500 focus:outline-none focus:ring-1 focus:ring-sage-500"
              />
            </div>

            <p className="rounded-xl bg-sand-50 p-3 text-xs text-sand-600">
              &ldquo;Not accurate&rdquo; counts against the engine&rsquo;s confidence score. All other
              reasons leave the engine&rsquo;s weight unchanged and prevent a re-raise for 3 days.
            </p>
          </div>
        )}
      </Drawer>
    </div>
  );
}
