"use client";

import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Award,
  Info,
  MessageSquareQuote,
  Minus,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

import { Sparkline } from "@/components/charts/sparkline";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { StarRating } from "@/components/ui/star-rating";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { chartColors } from "@/lib/chart-theme";
import { DEPARTMENTS, tierMeta, type StaffPerformance } from "@/lib/demo/performance";
import { usePerformanceBoard, useStaffReviews } from "@/lib/hooks/use-performance";
import { cn } from "@/lib/utils";

type DeptFilter = (typeof DEPARTMENTS)[number] | "all";

/** Arrow and colour for month-on-month movement. */
function movement(person: StaffPerformance) {
  if (person.score === null || person.previousScore === null) {
    return { icon: Minus, text: "new", className: "text-sand-400" };
  }
  const delta = person.score - person.previousScore;
  if (Math.abs(delta) < 0.03) return { icon: Minus, text: "steady", className: "text-sand-500" };
  return delta > 0
    ? { icon: TrendingUp, text: `+${delta.toFixed(2)}`, className: "text-emerald-700" }
    : { icon: TrendingDown, text: delta.toFixed(2), className: "text-rose-600" };
}

export default function PerformancePage() {
  const [department, setDepartment] = useState<DeptFilter>("all");
  const [selected, setSelected] = useState<StaffPerformance | null>(null);

  const { data: board, isLoading } = usePerformanceBoard();
  const { ranked, unranked, houseAverage, minimumReviews, isDemo } = board;
  const { reviews, isLoading: reviewsLoading } = useStaffReviews(selected?.staffId ?? null);

  const byDept = (person: StaffPerformance) =>
    department === "all" || person.department === department;

  const visibleRanked = useMemo(() => ranked.filter(byDept), [ranked, department]);
  const visibleUnranked = useMemo(() => unranked.filter(byDept), [unranked, department]);

  const recognised = ranked.filter((person) => person.deservesRecognition);
  const conversations = ranked.filter((person) => person.meritsAConversation);
  const totalReviews =
    ranked.reduce((sum, person) => sum + person.reviewCount, 0) +
    unranked.reduce((sum, person) => sum + person.reviewCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance"
        description="How guests rate the team, corrected for how harshly each guest marks."
        meta={
          <span className="flex items-center gap-2">
            {isDemo && (
              <span className="rounded-full border border-sand-200 bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-sand-600">
                Demo data
              </span>
            )}
            {format(new Date(), "EEE, d MMM yyyy")}
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          variant="value-first"
          label="Guest Ratings Collected"
          value={totalReviews}
          change="+38"
          comparison="in the last 30 days"
          tone="sage"
          icon={Star}
        />
        <StatTile
          variant="value-first"
          label="House Average"
          value={houseAverage.toFixed(2)}
          change="+0.06"
          comparison="vs. last month"
          tone="forest"
          icon={Users}
        />
        <StatTile
          variant="value-first"
          label="Clear for Recognition"
          value={recognised.length}
          change="scored and well-evidenced"
          intent="neutral"
          comparison=""
          tone="sand"
          icon={Award}
        />
        <StatTile
          variant="value-first"
          label="Worth a Conversation"
          value={conversations.length}
          change="read the comments first"
          intent="neutral"
          comparison=""
          tone="rose"
          icon={MessageSquareQuote}
        />
      </div>

      {/* The caveat sits above the board, not in a footnote under it. */}
      <div className="flex items-start gap-3 rounded-2xl border border-sand-200/80 bg-sand-50/60 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sand-500" />
        <p className="text-xs leading-relaxed text-sand-600">
          Scores are a Bayesian average pulled toward the house average, weighted so recent
          ratings count for more, and corrected for how harshly each guest marks. They are only
          loosely comparable across departments — a concierge meets far more guests, in far
          better moods, than a night auditor. Nobody appears here until{" "}
          <strong className="font-semibold text-sand-800">{minimumReviews} different
          guests</strong>{" "}
          have rated them, and a low score is a prompt to read the comments, never a
          consequence on its own.
        </p>
      </div>

      <Panel>
        <PanelHeader
          title="Performance Board"
          description="Select anyone to read the ratings behind their score."
          action={
            <FilterChips
              className="pt-1"
              options={[
                { value: "all" as const, label: "All departments", count: ranked.length },
                ...DEPARTMENTS.map((dept) => ({
                  value: dept,
                  label: dept,
                  count: ranked.filter((person) => person.department === dept).length,
                })),
              ]}
              value={department}
              onChange={(value) => setDepartment(value as DeptFilter)}
            />
          }
        />
        <PanelBody className="pt-4">
          {isLoading ? (
            <div className="space-y-2 py-2">
              {[0, 1, 2, 3, 4].map((row) => (
                <div key={row} className="h-11 animate-pulse rounded-lg bg-sand-100" />
              ))}
            </div>
          ) : visibleRanked.length === 0 ? (
            <p className="py-10 text-center text-sm text-sand-500">
              Nobody in this department has enough ratings to be scored yet.
            </p>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>#</TH>
                  <TH>Team member</TH>
                  <TH>Department</TH>
                  <TH align="right">Score</TH>
                  <TH align="right">Ratings</TH>
                  <TH align="right">Confidence</TH>
                  <TH align="right">Movement</TH>
                  <TH align="right">Standing</TH>
                </tr>
              </THead>
              <TBody>
                {visibleRanked.map((person, index) => {
                  const move = movement(person);
                  const Move = move.icon;
                  return (
                    <TR key={person.staffId}>
                      <TD className="w-8 tabular-nums text-sand-400">{index + 1}</TD>
                      <TD>
                        <button
                          onClick={() => setSelected(person)}
                          className="text-left font-medium text-sand-900 hover:text-sage-700 hover:underline"
                        >
                          {person.name}
                        </button>
                        <span className="block text-xs text-sand-500">{person.role}</span>
                      </TD>
                      <TD className="text-sand-600">{person.department}</TD>
                      <TD align="right">
                        <span className="font-sans text-base font-semibold text-sand-950 tabular-nums">
                          {person.score?.toFixed(2)}
                        </span>
                        {person.thinEvidence && (
                          <span className="ml-1.5 text-xs text-sand-400">thin</span>
                        )}
                      </TD>
                      <TD align="right" className="text-sand-700">
                        {person.reviewCount}
                      </TD>
                      <TD align="right" className="text-sand-600">
                        {Math.round(person.confidence * 100)}%
                      </TD>
                      <TD align="right">
                        <span
                          className={cn(
                            "inline-flex items-center justify-end gap-1 text-xs font-medium",
                            move.className
                          )}
                        >
                          <Move className="h-3.5 w-3.5" />
                          {move.text}
                          {person.trend.length > 1 && (
                            <Sparkline
                              data={person.trend}
                              color={
                                move.className.includes("rose")
                                  ? chartColors.rose
                                  : chartColors.forest
                              }
                              width={48}
                              height={18}
                              className="ml-1"
                            />
                          )}
                        </span>
                      </TD>
                      <TD align="right">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            tierMeta[person.tier].chip
                          )}
                        >
                          {tierMeta[person.tier].label}
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

      <Panel tone="muted">
        <PanelHeader
          title="Not Yet Scored"
          description={`Fewer than ${minimumReviews} guests have rated these people. Listed apart from the board on purpose — the bottom of a ranking is not where "no data" belongs.`}
        />
        <PanelBody className="pt-4">
          {visibleUnranked.length === 0 ? (
            <p className="py-6 text-center text-sm text-sand-500">
              Everyone in this department has enough ratings to be scored.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {visibleUnranked.map((person) => (
                <li
                  key={person.staffId}
                  className="rounded-xl border border-sand-200 bg-white p-4"
                >
                  <p className="text-sm font-medium text-sand-900">{person.name}</p>
                  <p className="text-xs text-sand-500">{person.role}</p>
                  <p className="mt-2 text-xs text-sand-600">
                    {person.reviewCount === 0
                      ? "No ratings yet"
                      : `${person.reviewCount} of ${minimumReviews} ratings needed`}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand-100">
                    <div
                      className="h-full rounded-full bg-sage-400"
                      style={{
                        width: `${Math.min(100, (person.reviewCount / minimumReviews) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>

      <Drawer
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.name ?? ""}
        description={selected ? `${selected.role} · ${selected.department}` : undefined}
        footer={
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
            Close
          </Button>
        }
      >
        {selected && (
          <div className="space-y-6">
            <div className="rounded-xl border border-sand-200 bg-sand-50/60 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-sans text-3xl font-semibold text-sand-950 tabular-nums">
                  {selected.score?.toFixed(2) ?? "—"}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    tierMeta[selected.tier].chip
                  )}
                >
                  {tierMeta[selected.tier].label}
                </span>
              </div>
              <p className="mt-1 text-xs text-sand-600">
                From {selected.reviewCount} guest ratings · raw average{" "}
                {selected.meanRating?.toFixed(2) ?? "—"} · confidence{" "}
                {Math.round(selected.confidence * 100)}%
              </p>
            </div>

            {selected.reasons.length > 0 && (
              <div>
                <h4 className="font-serif text-base font-semibold text-sand-950">
                  How this score was reached
                </h4>
                <ul className="mt-2 space-y-1.5">
                  {selected.reasons.map((reason) => (
                    <li key={reason} className="flex items-start gap-2 text-xs text-sand-600">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sand-300" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h4 className="font-serif text-base font-semibold text-sand-950">
                What guests said
              </h4>
              {reviewsLoading ? (
                <div className="mt-2 space-y-2">
                  {[0, 1, 2].map((row) => (
                    <div key={row} className="h-14 animate-pulse rounded-lg bg-sand-100" />
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <p className="mt-2 text-sm text-sand-500">
                  No written comments recorded for this person yet.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-sand-100">
                  {reviews.map((review) => (
                    <li key={review.id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <StarRating value={review.rating} size="sm" />
                        <span className="text-xs text-sand-400">{review.when}</span>
                      </div>
                      {review.comment && (
                        <p className="mt-1.5 text-sm leading-snug text-sand-800">
                          “{review.comment}”
                        </p>
                      )}
                      <p className="mt-1 text-xs text-sand-500">
                        {review.guest}
                        {review.duringComplaint && (
                          <span className="ml-2 rounded-full border border-gold-200 bg-gold-50 px-1.5 py-0.5 text-[11px] font-medium text-gold-800">
                            open complaint at the time
                          </span>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selected.meritsAConversation && (
              <div className="rounded-xl border border-gold-200 bg-gold-50/50 p-4 text-xs leading-relaxed text-sand-700">
                This score is low enough to be worth a conversation.{" "}
                {selected.complaintContextReviews > 0 && (
                  <>
                    Note that {selected.complaintContextReviews} of these ratings were given while
                    the guest had an open complaint — a technician sent to a broken room is
                    often rated on the room.{" "}
                  </>
                )}
                Read the comments before drawing a conclusion.
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
