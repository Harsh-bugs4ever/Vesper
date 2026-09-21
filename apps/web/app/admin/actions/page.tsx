"use client";

import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
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
import {
  categoryMeta,
  initialActions,
  urgencyMeta,
  type ActionCategory,
  type ActionItem,
  type UrgencyLevel,
} from "@/lib/demo/actions";
import { cn } from "@/lib/utils";

type CategoryFilter = ActionCategory | "all";
type UrgencyFilter = UrgencyLevel | "all";

const DISMISS_REASONS = [
  "Competitor rate data is inaccurate",
  "Manual VIP / corporate override in place",
  "Implementation risk is too high",
  "Already resolved through manual operations",
  "Market conditions changed unexpectedly",
];

const SNOOZE_OPTIONS = [
  { label: "1 hour", value: "1h" },
  { label: "4 hours", value: "4h" },
  { label: "Until tomorrow morning (9 AM)", value: "tomorrow" },
];

export default function ActionQueuePage() {
  const { showToast, showUndoToast } = useToast();

  const [actions, setActions] = useState<ActionItem[]>(initialActions);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");

  // Adjust Modal state
  const [adjustingAction, setAdjustingAction] = useState<ActionItem | null>(null);
  const [adjustedValue, setAdjustedValue] = useState("");
  const [adjustedNote, setAdjustedNote] = useState("");

  // Dismiss Modal state
  const [dismissingAction, setDismissingAction] = useState<ActionItem | null>(null);
  const [selectedDismissReason, setSelectedDismissReason] = useState<string>(DISMISS_REASONS[0]);

  // Snooze dropdown state (action id of active dropdown)
  const [activeSnoozeId, setActiveSnoozeId] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);

  const filteredActions = useMemo(() => {
    return actions.filter((act) => {
      if (categoryFilter !== "all" && act.category !== categoryFilter) return false;
      if (urgencyFilter !== "all" && act.urgency !== urgencyFilter) return false;
      return true;
    });
  }, [actions, categoryFilter, urgencyFilter]);

  const totalImpact = useMemo(() => {
    return actions.reduce((sum, item) => sum + item.impactAmount, 0);
  }, [actions]);

  const highUrgencyCount = useMemo(() => {
    return actions.filter((act) => act.urgency === "high").length;
  }, [actions]);

  // Handle Approve with 10s Undo Countdown Toast
  const handleApprove = (action: ActionItem, customValue?: string) => {
    const previousActions = [...actions];
    setActions((prev) => prev.filter((act) => act.id !== action.id));

    const finalVal = customValue || action.proposedValue;
    showUndoToast(
      `Approved: ${action.title}`,
      `Applied ${finalVal}. Impact: ${action.impactDescription}.`,
      () => {
        setActions(previousActions);
        showToast({
          title: "Action Restored",
          description: `"${action.title}" has been restored to the queue.`,
          type: "default",
        });
      },
      10
    );
  };

  // Open Adjust Modal
  const openAdjustModal = (action: ActionItem) => {
    setAdjustingAction(action);
    setAdjustedValue(action.proposedValue);
    setAdjustedNote("");
  };

  // Save Adjusted and Approve
  const handleSaveAdjusted = () => {
    if (!adjustingAction) return;

    if (!adjustedValue.trim()) {
      showToast({
        title: "Please specify a value",
        description: "The adjusted action requires a valid proposed value.",
        type: "warning",
      });
      return;
    }

    const actionToApprove = {
      ...adjustingAction,
      proposedValue: adjustedValue.trim(),
    };

    setAdjustingAction(null);
    handleApprove(actionToApprove, adjustedValue.trim());
  };

  // Handle Snooze
  const handleSnooze = (action: ActionItem, durationLabel: string) => {
    const previousActions = [...actions];
    setActions((prev) => prev.filter((act) => act.id !== action.id));
    setActiveSnoozeId(null);

    showUndoToast(
      `Snoozed: ${action.title}`,
      `Action snoozed for ${durationLabel}. It will reappear automatically.`,
      () => setActions(previousActions),
      10
    );
  };

  // Handle Dismiss
  const handleConfirmDismiss = () => {
    if (!dismissingAction) return;
    const previousActions = [...actions];
    const dismissed = dismissingAction;

    setActions((prev) => prev.filter((act) => act.id !== dismissed.id));
    setDismissingAction(null);

    showUndoToast(
      `Dismissed: ${dismissed.title}`,
      `Reason: "${selectedDismissReason}". Feedback logged to calibrate the AI model.`,
      () => setActions(previousActions),
      10
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Action Queue"
        description="Autonomous recommendations calibrated against real-time demand, sensor telemetry, and guest pace."
        meta={format(today, "EEE, d MMM yyyy")}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActions(initialActions);
                showToast({
                  title: "Queue Refreshed",
                  description: "Reloaded all 5 AI action recommendations.",
                  type: "default",
                });
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Demo Queue
            </Button>
          </div>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          variant="value-first"
          label="Pending Suggestions"
          value={actions.length}
          change={highUrgencyCount > 0 ? `${highUrgencyCount} high urgency` : "All clear"}
          intent={highUrgencyCount > 0 ? "bad" : "good"}
          comparison="awaiting manager review"
          tone="sand"
          icon={Bot}
        />
        <StatTile
          variant="value-first"
          label="Projected Revenue Impact"
          value={`+₹${totalImpact.toLocaleString("en-IN")}`}
          change="Combined uplift"
          intent="good"
          comparison="if all actions executed"
          tone="forest"
          icon={IndianRupee}
        />
        <StatTile
          variant="value-first"
          label="Model Confidence"
          value="91.2%"
          change="+4.2%"
          intent="neutral"
          comparison="30-day decision accuracy"
          tone="sage"
          icon={Sparkles}
        />
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          options={[
            { value: "all" as const, label: "All Suggestions", count: actions.length },
            {
              value: "pricing" as const,
              label: "Revenue & Pricing",
              count: actions.filter((a) => a.category === "pricing").length,
            },
            {
              value: "maintenance" as const,
              label: "Engineering",
              count: actions.filter((a) => a.category === "maintenance").length,
            },
            {
              value: "staffing" as const,
              label: "Workforce",
              count: actions.filter((a) => a.category === "staffing").length,
            },
            {
              value: "inventory" as const,
              label: "Stock & F&B",
              count: actions.filter((a) => a.category === "inventory").length,
            },
          ]}
          value={categoryFilter}
          onChange={(val) => setCategoryFilter(val as CategoryFilter)}
        />

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-sand-500">Urgency:</span>
          {(["all", "high", "medium", "low"] as const).map((urgency) => (
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
        </div>
      </div>

      {/* Action Cards Grid */}
      {filteredActions.length === 0 ? (
        <Panel>
          <PanelBody className="py-16 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-sage-600" />
            <h3 className="mt-3 font-serif text-lg font-semibold text-sand-950">
              Queue is completely clear!
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-sand-600">
              All recommended actions have been addressed. The AI decision engine will flag new
              opportunities as hotel pace and telemetry change.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setActions(initialActions)}
            >
              Restore Demo Suggestions
            </Button>
          </PanelBody>
        </Panel>
      ) : (
        <div className="space-y-4">
          {filteredActions.map((action) => {
            const CategoryIcon = categoryMeta[action.category].icon;
            const urgency = urgencyMeta[action.urgency];

            return (
              <Panel
                key={action.id}
                className={cn(
                  "border-sand-200/80 transition-shadow hover:shadow-md",
                  action.urgency === "high" && "border-l-4 border-l-rose-500"
                )}
              >
                <PanelBody className="space-y-4 pt-5">
                  {/* Top Bar: Urgency, Category, CreatedAt, Confidence */}
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
                        <CategoryIcon className="h-3 w-3 text-sand-500" />
                        {categoryMeta[action.category].label}
                      </span>

                      {action.targetDate && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-0.5 text-xs text-sand-600">
                          <Calendar className="h-3 w-3 text-sand-400" />
                          {action.targetDate}
                        </span>
                      )}

                      <span className="text-xs text-sand-400">· {action.createdAt}</span>
                    </div>

                    {/* Confidence Bar */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-sand-600">Confidence:</span>
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-sand-200">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            action.confidence >= 90
                              ? "bg-emerald-600"
                              : action.confidence >= 80
                                ? "bg-gold-500"
                                : "bg-rose-500"
                          )}
                          style={{ width: `${action.confidence}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-sand-900">
                        {action.confidence}%
                      </span>
                    </div>
                  </div>

                  {/* Title & Projected Impact */}
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div>
                      <h3 className="font-serif text-xl font-semibold leading-snug text-sand-950">
                        {action.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-sand-700">{action.rationale}</p>

                      {/* Drivers */}
                      <div className="mt-3">
                        <span className="text-xs font-medium text-sand-500">Key Drivers:</span>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {action.drivers.map((driver) => (
                            <span
                              key={driver}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1 text-xs text-sand-800"
                            >
                              <span className="h-1 w-1 rounded-full bg-sand-500" />
                              {driver}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Impact & Diff Box */}
                    <div className="flex flex-col justify-between rounded-xl border border-sand-200 bg-sand-50/50 p-4">
                      <div>
                        <span className="text-xs font-medium text-sand-500">Projected Impact</span>
                        <p className="font-serif text-2xl font-semibold text-emerald-700">
                          +₹{action.impactAmount.toLocaleString("en-IN")}
                        </p>
                        <p className="mt-0.5 text-xs text-sand-600">{action.impactDescription}</p>
                      </div>

                      <div className="mt-3 border-t border-sand-200/80 pt-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-sand-500">Current</span>
                          <span className="font-medium text-sand-800">{action.currentValue}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-emerald-800">Proposed</span>
                          <span className="font-bold text-emerald-700">
                            {action.proposedValue} {action.unit ?? ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sand-200/80 pt-3">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(action)}
                        className="bg-sage-700 hover:bg-sage-800"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve Action
                      </Button>

                      <Button variant="outline" size="sm" onClick={() => openAdjustModal(action)}>
                        <Sliders className="h-3.5 w-3.5" />
                        Adjust
                      </Button>
                    </div>

                    <div className="relative flex items-center gap-2">
                      {/* Snooze Menu */}
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setActiveSnoozeId(activeSnoozeId === action.id ? null : action.id)
                          }
                          className="text-sand-600"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          Snooze
                          <ChevronDown className="h-3 w-3" />
                        </Button>

                        {activeSnoozeId === action.id && (
                          <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-sand-200 bg-white p-1.5 shadow-elevated">
                            <p className="px-2.5 py-1 text-[11px] font-semibold text-sand-400">
                              SNOOZE RECOMMENDATION
                            </p>
                            {SNOOZE_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => handleSnooze(action, opt.label)}
                                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-sand-800 transition-colors hover:bg-sand-50"
                              >
                                <span>{opt.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Dismiss */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDismissingAction(action);
                          setSelectedDismissReason(DISMISS_REASONS[0]);
                        }}
                        className="text-sand-500 hover:text-rose-600"
                      >
                        <X className="h-3.5 w-3.5" />
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </PanelBody>
              </Panel>
            );
          })}
        </div>
      )}

      {/* Adjust Modal Drawer */}
      <Drawer
        open={adjustingAction !== null}
        onOpenChange={(open) => {
          if (!open) setAdjustingAction(null);
        }}
        title="Adjust Action Recommendation"
        description={adjustingAction?.title}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setAdjustingAction(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveAdjusted}>
              Save & Approve
            </Button>
          </>
        }
      >
        {adjustingAction && (
          <div className="space-y-5">
            <div className="rounded-xl border border-sand-200 bg-sand-50/70 p-4">
              <span className="text-xs text-sand-500">AI Suggested Value</span>
              <p className="mt-0.5 font-serif text-lg font-semibold text-sand-900">
                {adjustingAction.proposedValue} {adjustingAction.unit ?? ""}
              </p>
              <p className="mt-1 text-xs text-sand-600">{adjustingAction.impactDescription}</p>
            </div>

            <div>
              <label
                htmlFor="adjusted-value"
                className="mb-1.5 block text-sm font-medium text-sand-800"
              >
                Manager Adjusted Value
              </label>
              <Input
                id="adjusted-value"
                value={adjustedValue}
                onChange={(e) => setAdjustedValue(e.target.value)}
                placeholder="Enter revised rate / amount / target..."
              />
              <p className="mt-1 text-xs text-sand-500">
                You can override the engine rate, quantity, or shift count.
              </p>
            </div>

            <div>
              <label
                htmlFor="adjusted-note"
                className="mb-1.5 block text-sm font-medium text-sand-800"
              >
                Reason for Adjustment (Optional)
              </label>
              <textarea
                id="adjusted-note"
                rows={3}
                value={adjustedNote}
                onChange={(e) => setAdjustedNote(e.target.value)}
                placeholder="e.g. VIP group arriving, agreed on corporate ceiling..."
                className="w-full rounded-xl border border-sand-200 bg-white p-3 text-sm text-sand-900 placeholder:text-sand-400 focus:border-sage-500 focus:outline-none focus:ring-1 focus:ring-sage-500"
              />
            </div>
          </div>
        )}
      </Drawer>

      {/* Dismiss Reasons Modal Drawer */}
      <Drawer
        open={dismissingAction !== null}
        onOpenChange={(open) => {
          if (!open) setDismissingAction(null);
        }}
        title="Dismiss Suggestion"
        description="Help calibrate the AI engine by specifying why this suggestion is not being used."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDismissingAction(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmDismiss}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Confirm Dismissal
            </Button>
          </>
        }
      >
        {dismissingAction && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-sand-900">
              Select reason for dismissing &ldquo;{dismissingAction.title}&rdquo;:
            </p>

            <ul className="space-y-2">
              {DISMISS_REASONS.map((reason) => (
                <li key={reason}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-sand-200 p-3 text-sm transition-colors hover:bg-sand-50">
                    <input
                      type="radio"
                      name="dismiss-reason"
                      checked={selectedDismissReason === reason}
                      onChange={() => setSelectedDismissReason(reason)}
                      className="h-4 w-4 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-sand-800">{reason}</span>
                  </label>
                </li>
              ))}
            </ul>

            <p className="rounded-xl bg-sand-50 p-3 text-xs text-sand-600">
              Dismissals adjust the engine weights for your property and prevent similar false
              positives over the next 14 days.
            </p>
          </div>
        )}
      </Drawer>
    </div>
  );
}
