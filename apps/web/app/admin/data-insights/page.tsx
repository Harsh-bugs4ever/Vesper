"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BrainCircuit,
  Database,
  Eye,
  Filter,
  Lightbulb,
  LineChart,
  Loader2,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Insight {
  id: string;
  type: "correlation" | "anomaly" | "trend" | "segment";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  department: string;
  metric: string;
  change: string;
  direction: "up" | "down" | "neutral";
  confidence: number;
  timestamp: string;
  actionable: boolean;
}

const INSIGHTS: Insight[] = [
  {
    id: "ins_001",
    type: "correlation",
    severity: "high",
    title: "High check-in delays correlate with lower NPS across Deluxe rooms",
    description: "Rooms with check-in wait times >12 min show a 23% lower NPS score. Peak correlation at 3–5 PM arrivals, when front desk has 2 staff on duty. Consider adding a third person during these hours.",
    department: "Front Office",
    metric: "NPS Score",
    change: "-23%",
    direction: "down",
    confidence: 91,
    timestamp: "6 hours ago",
    actionable: true,
  },
  {
    id: "ins_002",
    type: "anomaly",
    severity: "high",
    title: "F&B revenue dip on Wednesday evenings — 3 consecutive weeks",
    description: "Dashanzi revenue drops 34% on Wednesdays vs. other weekdays. Lotus Cafe sees no comparable drop. Suggest running a mid-week promotion or shifting chef special to Wednesdays.",
    department: "Food & Beverage",
    metric: "Revenue",
    change: "-34%",
    direction: "down",
    confidence: 87,
    timestamp: "12 hours ago",
    actionable: true,
  },
  {
    id: "ins_003",
    type: "trend",
    severity: "medium",
    title: "Executive Suite ADR trending up +8% over 30 days",
    description: "Consistent upward price acceptance suggests room for a further 3–5% increase without impacting occupancy. Current booking pace remains strong at 2.3 bookings/day.",
    department: "Revenue",
    metric: "ADR",
    change: "+8%",
    direction: "up",
    confidence: 85,
    timestamp: "1 day ago",
    actionable: true,
  },
  {
    id: "ins_004",
    type: "segment",
    severity: "medium",
    title: "Corporate segment shifting to longer stays (+1.2 nights avg)",
    description: "Average corporate stay increased from 2.1 to 3.3 nights in Q4. Linked to new remote-work-friendly packages. Consider extending the offering with dedicated work pods.",
    department: "Sales",
    metric: "Avg. Stay Duration",
    change: "+1.2 nights",
    direction: "up",
    confidence: 82,
    timestamp: "2 days ago",
    actionable: false,
  },
  {
    id: "ins_005",
    type: "anomaly",
    severity: "low",
    title: "Housekeeping SLA breach rate dropped to 2.1% — best in 90 days",
    description: "After the AI roster optimiser redistributed cleaning loads based on checkout patterns, average turnaround fell from 38 to 26 minutes. Breach rate below the 5% target.",
    department: "Housekeeping",
    metric: "SLA Breach Rate",
    change: "-2.9 pp",
    direction: "down",
    confidence: 94,
    timestamp: "3 hours ago",
    actionable: false,
  },
  {
    id: "ins_006",
    type: "correlation",
    severity: "medium",
    title: "Spa bookings spike 48h after Quan wellness emails",
    description: "Guests who receive the Quan Wellness promo email book a spa session within 48 hours at a 18% conversion rate — 3× higher than walk-ins. Channel is underutilised.",
    department: "Spa & Wellness",
    metric: "Conversion Rate",
    change: "+18%",
    direction: "up",
    confidence: 79,
    timestamp: "1 day ago",
    actionable: true,
  },
  {
    id: "ins_007",
    type: "trend",
    severity: "low",
    title: "Chiller #2 vibration baseline drifting upward over 14 days",
    description: "Gradual 0.08g increase suggests bearing wear. BMS Anomaly Detector recommends scheduling maintenance within 9 days to prevent unplanned downtime.",
    department: "Engineering",
    metric: "Vibration (g)",
    change: "+0.08g",
    direction: "up",
    confidence: 93,
    timestamp: "4 hours ago",
    actionable: true,
  },
];

const TYPE_CONFIG = {
  correlation: { label: "Correlation", icon: LineChart, color: "bg-purple-50 text-purple-800 border-purple-200" },
  anomaly: { label: "Anomaly", icon: AlertTriangle, color: "bg-amber-50 text-amber-800 border-amber-200" },
  trend: { label: "Trend", icon: TrendingUp, color: "bg-sage-50 text-sage-800 border-sage-200" },
  segment: { label: "Segment", icon: Users, color: "bg-blue-50 text-blue-800 border-blue-200" },
};

const SEVERITY_COLORS = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-sand-100 text-sand-700 border-sand-300",
};

export default function DataInsightsPage() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = INSIGHTS.filter((ins) => {
    if (typeFilter !== "all" && ins.type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        ins.title.toLowerCase().includes(q) ||
        ins.department.toLowerCase().includes(q) ||
        ins.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const actionableCount = INSIGHTS.filter((i) => i.actionable).length;
  const highSeverityCount = INSIGHTS.filter((i) => i.severity === "high").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Insights"
        description="AI-surfaced correlations, anomalies, trends, and segment shifts that deserve a manager's attention."
        actions={
          <Button variant="outline" size="sm">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Insights
          </Button>
        }
      />

      {/* Insight banner */}
      {highSeverityCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50/80 via-white to-sand-50/40 p-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white shadow-xs">
              <Lightbulb className="h-5 w-5" />
            </span>
            <div>
              <span className="font-serif text-base font-semibold text-sand-950">
                {highSeverityCount} High-Priority Insights · {actionableCount} Actionable
              </span>
              <p className="text-xs text-sand-600">
                These patterns were detected by the AI analytics pipeline and may need attention.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Panel className="p-4">
          <p className="text-[11px] text-sand-500">Total Insights</p>
          <p className="mt-0.5 font-serif text-2xl font-semibold text-sand-950">{INSIGHTS.length}</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-[11px] text-rose-600">High Severity</p>
          <p className="mt-0.5 font-serif text-2xl font-semibold text-rose-900">{highSeverityCount}</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-[11px] text-emerald-600">Actionable</p>
          <p className="mt-0.5 font-serif text-2xl font-semibold text-emerald-900">{actionableCount}</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-[11px] text-sand-500">Avg. Confidence</p>
          <p className="mt-0.5 font-serif text-2xl font-semibold text-sand-950">
            {Math.round(INSIGHTS.reduce((s, i) => s + i.confidence, 0) / INSIGHTS.length)}%
          </p>
        </Panel>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search insights..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {["all", "correlation", "anomaly", "trend", "segment"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition-all",
                typeFilter === t
                  ? "border-sage-500 bg-sage-50 text-sage-900"
                  : "border-sand-200 bg-white text-sand-600 hover:bg-sand-50"
              )}
            >
              {t === "all" ? "All Types" : t}
            </button>
          ))}
        </div>
      </div>

      {/* Insight cards */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No insights match your filter"
          description="Try a different search term or type filter."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((insight) => {
            const typeCfg = TYPE_CONFIG[insight.type];
            const TypeIcon = typeCfg.icon;
            return (
              <Panel key={insight.id} className="transition-all duration-200 hover:shadow-card">
                <PanelBody className="space-y-3">
                  {/* Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", typeCfg.color)}>
                        <TypeIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-sand-950 leading-snug">{insight.title}</h3>
                        <p className="mt-1 text-xs text-sand-600 leading-relaxed">{insight.description}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize", SEVERITY_COLORS[insight.severity])}>
                        {insight.severity}
                      </span>
                      {insight.actionable && (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          Actionable
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Meta strip */}
                  <div className="flex flex-wrap items-center gap-3 border-t border-sand-200/80 pt-2.5 text-[11px] text-sand-500">
                    <span className="rounded bg-sand-100 px-1.5 py-0.5 font-medium text-sand-700">{insight.department}</span>
                    <span className="flex items-center gap-1">
                      <Database className="h-3 w-3" />
                      {insight.metric}
                    </span>
                    <span className={cn(
                      "flex items-center gap-1 font-semibold",
                      insight.direction === "up" && insight.change.startsWith("+") ? "text-emerald-700" :
                      insight.direction === "down" ? "text-rose-600" : "text-sand-600"
                    )}>
                      {insight.direction === "up" ? <ArrowUp className="h-3 w-3" /> : insight.direction === "down" ? <ArrowDown className="h-3 w-3" /> : null}
                      {insight.change}
                    </span>
                    <span className="flex items-center gap-1">
                      <BrainCircuit className="h-3 w-3" />
                      {insight.confidence}% confidence
                    </span>
                    <span>{insight.timestamp}</span>
                  </div>
                </PanelBody>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
