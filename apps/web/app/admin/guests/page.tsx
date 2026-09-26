"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CalendarPlus,
  CheckCircle2,
  CircleUser,
  Gift,
  IndianRupee,
  Loader2,
  Moon,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

import { SentimentTrendChart } from "@/components/charts/sentiment-trend-chart";
import { ConnectedOverview } from "@/components/connected/connected-overview";
import { loadFeedback } from "@/lib/api/overviews";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SectionTabs } from "@/components/ui/section-tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "at-risk", label: "At-Risk Guests" },
  { value: "offers", label: "Retention Offers" },
  { value: "sentiment", label: "Sentiment Trend" },
  { value: "feedback", label: "Feedback" },
] as const;

type Tab = (typeof TABS)[number]["value"];

export default function GuestProfilePage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");

  // 1. Fetch live at-risk guests from guest-intel service
  const {
    data: atRiskGuests = [],
    isLoading: atRiskLoading,
    isError: atRiskError,
  } = useQuery<any[]>({
    queryKey: ["guest-intel-at-risk"],
    queryFn: () => api.get<any[]>("/guest-intel/at-risk"),
    refetchInterval: 60_000,
  });

  // 2. Fetch live generated retention offers
  const { data: offers = [], isLoading: offersLoading } = useQuery<any[]>({
    queryKey: ["guest-intel-offers"],
    queryFn: () => api.get<any[]>("/guest-intel/offers"),
    refetchInterval: 30_000,
  });

  // 3. Fetch sentiment trend
  const { data: sentimentTrend = [], isLoading: trendLoading } = useQuery<any[]>({
    queryKey: ["guest-intel-trend"],
    queryFn: () => api.get<any[]>("/guest-intel/sentiment/trend", { days: 30 }),
  });

  // 4. Fetch in-house bookings for real active guest context
  const { data: todayBookings } = useQuery<any>({
    queryKey: ["frontdesk-bookings-today"],
    queryFn: () => api.get<any>("/bookings/today"),
  });

  // Approve offer mutation
  const approveOfferMutation = useMutation({
    mutationFn: (offerId: string) =>
      api.post(`/guest-intel/offers/${offerId}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guest-intel-offers"] });
      showToast({
        title: "Offer Approved & Dispatched",
        description: "Retention offer delivered to the guest via active channels.",
        type: "success",
      });
    },
    onError: (err: any) => {
      showToast({
        title: "Approval Failed",
        description: err.message ?? "The server rejected this offer approval.",
        type: "error",
      });
    },
  });

  // Dismiss offer mutation
  const dismissOfferMutation = useMutation({
    mutationFn: (offerId: string) =>
      api.post(`/guest-intel/offers/${offerId}/dismiss`, { reason: "dismissed_by_manager" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guest-intel-offers"] });
      showToast({
        title: "Offer Dismissed",
        description: "Offer marked inactive.",
        type: "default",
      });
    },
  });

  const chartPoints = sentimentTrend.flatMap((department: any) =>
    (department.points ?? []).filter((point: any) =>
      typeof point.average_sentiment === "number" && typeof point.date === "string"
    ).map((point: any) => ({
      date: point.date,
      sentiment: Math.round((point.average_sentiment + 1) * 50),
      // The API supplies no confidence interval; show the full possible range.
      range: [0, 100] as [number, number],
    }))
  );
  const chartAverage = chartPoints.length
    ? chartPoints.reduce((sum, point) => sum + point.sentiment, 0) / chartPoints.length
    : 0;

  const activeOffers = offers.filter((o) => o.status === "proposed" || o.status === "active" || o.status === "pending");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-sand-950">
            Guest Intelligence & Retention
          </h1>
          <p className="text-xs text-sand-600 mt-0.5">
            Real-time churn risk prediction, sentiment tracking, and personalized retention offers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1 text-xs font-semibold text-sand-800">
            {atRiskGuests.length} At-Risk Flagged
          </span>
          <span className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1 text-xs font-semibold text-sand-800">
            {todayBookings?.in_house_count ?? 0} In-House
          </span>
        </div>
      </div>

      <SectionTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "feedback" && <ConnectedOverview title="Guest feedback" description="Persisted sentiment trends and review volume." queryKey="guest-feedback" load={loadFeedback} />}

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
          <div className="space-y-4">
            {/* Sentiment trend panel */}
            <Panel>
              <PanelHeader
                title="Property Sentiment Trend (30 Days)"
                description="Live scores calculated from guest reviews, feedback forms, and incident ratings"
              />
              <PanelBody className="pt-4">
                {trendLoading ? (
                  <p role="status" className="py-12 text-center text-sm text-sand-500">
                    Loading sentiment trend…
                  </p>
                ) : chartPoints.length > 0 ? (
                  <SentimentTrendChart data={chartPoints} average={chartAverage} />
                ) : (
                  <div className="py-12 text-center text-sm text-sand-500">
                    <p className="font-semibold text-sand-800">No Sentiment Points</p>
                    <p className="text-xs text-sand-400 mt-1">
                      No scored feedback recorded during the last 30 days.
                    </p>
                  </div>
                )}
              </PanelBody>
            </Panel>

            {/* In-House Guests Overview */}
            <Panel>
              <PanelHeader
                title="Current In-House Arrivals & Stays"
                description="Synchronized with front desk board"
              />
              <PanelBody className="pt-4">
                {!todayBookings || todayBookings.arrivals?.length === 0 ? (
                  <p className="py-8 text-center text-xs text-sand-500">
                    No scheduled arrivals recorded for today.
                  </p>
                ) : (
                  <div className="divide-y divide-sand-100">
                    {todayBookings.arrivals.slice(0, 5).map((arr: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between py-2 text-xs">
                        <div>
                          <p className="font-semibold text-sand-900">
                            {arr.guest_name ?? `Guest #${arr.id?.slice(0, 6)}`}
                          </p>
                          <p className="text-sand-500">Room {arr.room_number ?? "TBD"}</p>
                        </div>
                        <span className="rounded bg-sage-100 px-2 py-0.5 text-[10px] font-semibold text-sage-800">
                          {arr.status ?? "Confirmed"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </PanelBody>
            </Panel>
          </div>

          <div className="space-y-4">
            {/* At-Risk Guests Summary */}
            <Panel>
              <PanelHeader
                title="High Churn Risk Profiles"
                description="Identified by the guest intelligence engine"
                action={
                  <button
                    onClick={() => setTab("at-risk")}
                    className="pt-1 text-xs font-semibold text-sage-800 hover:text-sage-950"
                  >
                    View all ({atRiskGuests.length}) →
                  </button>
                }
              />
              <PanelBody className="pt-4">
                {atRiskLoading ? (
                  <p role="status" className="py-8 text-center text-sm text-sand-500">
                    Scanning churn indicators…
                  </p>
                ) : atRiskGuests.length === 0 ? (
                  <div className="py-12 text-center text-sm text-sand-500">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                    <p className="mt-2 font-semibold text-sand-900">
                      Zero At-Risk Guests Flagged
                    </p>
                    <p className="text-xs text-sand-400 mt-1">
                      No negative sentiment or churn patterns detected across active profiles.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-sand-100">
                    {atRiskGuests.slice(0, 4).map((g: any) => (
                      <li key={g.id ?? g.guest_id} className="flex items-center justify-between py-3">
                        <div>
                          <p className="text-xs font-semibold text-sand-950">
                            {g.guest_name ?? `Guest #${(g.guest_id ?? g.id).slice(0, 8)}`}
                          </p>
                          <p className="text-[11px] text-sand-500">
                            Churn Risk:{" "}
                            <span className="font-semibold text-rose-700">
                              {g.churn_risk ? `${Math.round(g.churn_risk * 100)}%` : "High"}
                            </span>
                            {g.sentiment_score !== undefined && (
                              <> · Sentiment: {g.sentiment_score.toFixed(1)}/5</>
                            )}
                          </p>
                        </div>
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                          At Risk
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </PanelBody>
            </Panel>

            {/* Suggested Retention Offers */}
            <Panel>
              <PanelHeader
                title="Retention Offers"
                description="Model-generated retention perks awaiting approval"
              />
              <PanelBody className="space-y-3 pt-4">
                {offersLoading ? (
                  <p role="status" className="py-8 text-center text-sm text-sand-500">
                    Loading retention queue…
                  </p>
                ) : activeOffers.length === 0 ? (
                  <div className="py-12 text-center text-sm text-sand-500">
                    <Gift className="mx-auto h-8 w-8 text-sand-300" />
                    <p className="mt-2 font-semibold text-sand-800">
                      No Pending Retention Offers
                    </p>
                    <p className="text-xs text-sand-400 mt-1">
                      All generated win-back perks have been reviewed.
                    </p>
                  </div>
                ) : (
                  activeOffers.slice(0, 3).map((offer: any) => (
                    <div
                      key={offer.id}
                      className="rounded-xl border border-sand-200 bg-sand-50/50 p-3.5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-semibold text-sand-950">
                            {offer.title ?? "Personalized Stay Incentive"}
                          </p>
                          <p className="text-xs text-sand-600 mt-1">
                            {offer.description ?? offer.perk ?? "Special upgrade & dining credit"}
                          </p>
                          {offer.guest_name && (
                            <p className="text-[11px] text-sage-800 font-medium mt-1">
                              Recipient: {offer.guest_name}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-2 border-t border-sand-200/60 pt-2">
                        <button
                          type="button"
                          disabled={dismissOfferMutation.isPending}
                          onClick={() => dismissOfferMutation.mutate(offer.id)}
                          className="rounded-lg border border-sand-200 bg-white px-2.5 py-1 text-xs text-sand-600 hover:bg-sand-50"
                        >
                          Dismiss
                        </button>
                        <Button
                          size="sm"
                          disabled={approveOfferMutation.isPending}
                          onClick={() => approveOfferMutation.mutate(offer.id)}
                          className="text-xs"
                        >
                          Approve & Send
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </PanelBody>
            </Panel>
          </div>
        </div>
      )}

      {tab === "at-risk" && (
        <Panel>
          <PanelHeader
            title="Complete At-Risk Guest Registry"
            description="Profiles flagged with high probability of customer churn or negative service encounters."
          />
          <PanelBody className="pt-4">
            {atRiskLoading ? (
              <p role="status" className="py-12 text-center text-sm text-sand-500">
                Loading at-risk records…
              </p>
            ) : atRiskGuests.length === 0 ? (
              <div className="py-16 text-center text-sm text-sand-500">
                <p className="font-semibold text-sand-800">Registry Clear</p>
                <p className="text-xs text-sand-400 mt-1">
                  Zero guests currently meet the churn risk threshold.
                </p>
              </div>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Guest Identifier</TH>
                    <TH>Churn Risk</TH>
                    <TH>Sentiment Score</TH>
                    <TH>Preferences / Tags</TH>
                  </tr>
                </THead>
                <TBody>
                  {atRiskGuests.map((g: any) => (
                    <TR key={g.id ?? g.guest_id}>
                      <TD className="font-mono text-xs font-semibold text-sand-900">
                        {g.guest_name ?? (g.guest_id ?? g.id).slice(0, 12)}…
                      </TD>
                      <TD>
                        <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                          {g.churn_risk ? `${Math.round(g.churn_risk * 100)}%` : "High"}
                        </span>
                      </TD>
                      <TD className="text-xs text-sand-800">
                        {g.sentiment_score !== undefined ? `${g.sentiment_score.toFixed(1)} / 5` : "—"}
                      </TD>
                      <TD className="text-xs text-sand-600">
                        {Array.isArray(g.tags) ? g.tags.join(", ") : "Standard profile"}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </PanelBody>
        </Panel>
      )}

      {tab === "offers" && (
        <Panel>
          <PanelHeader
            title="Retention Offers Ledger"
            description="Historical and pending personalized incentives generated by the retention engine."
          />
          <PanelBody className="pt-4">
            {offers.length === 0 ? (
              <div className="py-16 text-center text-sm text-sand-500">
                <p className="font-semibold text-sand-800">No Offers Found</p>
                <p className="text-xs text-sand-400 mt-1">
                  No retention offers generated by the model.
                </p>
              </div>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Offer</TH>
                    <TH>Target Guest</TH>
                    <TH>Status</TH>
                    <TH align="right">Actions</TH>
                  </tr>
                </THead>
                <TBody>
                  {offers.map((off: any) => (
                    <TR key={off.id}>
                      <TD>
                        <p className="font-semibold text-sand-900">{off.title}</p>
                        <p className="text-xs text-sand-500">{off.description}</p>
                      </TD>
                      <TD className="text-xs text-sand-700">
                        {off.guest_name ?? off.guest_id?.slice(0, 8)}
                      </TD>
                      <TD>
                        <span className="rounded bg-sand-100 px-2 py-0.5 text-xs font-medium capitalize text-sand-800">
                          {off.status}
                        </span>
                      </TD>
                      <TD align="right">
                        {off.status === "pending" || off.status === "proposed" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => dismissOfferMutation.mutate(off.id)}
                            >
                              Dismiss
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => approveOfferMutation.mutate(off.id)}
                            >
                              Approve
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-sand-400">—</span>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </PanelBody>
        </Panel>
      )}

      {tab === "sentiment" && (
        <Panel>
          <PanelHeader
            title="30-Day Sentiment Score Evolution"
            description="Daily aggregations of guest review scores"
          />
          <PanelBody className="pt-4">
            {chartPoints.length > 0 ? (
              <SentimentTrendChart data={chartPoints} average={chartAverage} />
            ) : (
              <p className="py-12 text-center text-sm text-sand-500">
                No sentiment trend data available.
              </p>
            )}
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}
