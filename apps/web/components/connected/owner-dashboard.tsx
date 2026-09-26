"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  FileText,
  IndianRupee,
  Layers,
  LineChart as LineChartIcon,
  Package,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAuth } from "@/components/auth/auth-context";
import { api, dashboardApi, type DashboardData } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { StatTile } from "@/components/ui/stat-tile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { axisProps, chartColors, gridProps, formatLakh } from "@/lib/chart-theme";
import { cn } from "@/lib/utils";

// Monthly financial summary data for owner visualization
const FINANCIAL_TREND_DATA = [
  { month: "Apr", revenue: 14500000, profit: 6200000, gopMargin: 42.7 },
  { month: "May", revenue: 15800000, profit: 6900000, gopMargin: 43.6 },
  { month: "Jun", revenue: 13900000, profit: 5700000, gopMargin: 41.0 },
  { month: "Jul", revenue: 16200000, profit: 7100000, gopMargin: 43.8 },
  { month: "Aug", revenue: 17400000, profit: 7800000, gopMargin: 44.8 },
  { month: "Sep", revenue: 18200000, profit: 8250000, gopMargin: 45.3 },
];

// Occupancy vs ADR comparison data
const YIELD_COMPARISON_DATA = [
  { month: "Apr", occupancy: 72, adr: 16200, revpar: 11664 },
  { month: "May", occupancy: 78, adr: 17100, revpar: 13338 },
  { month: "Jun", occupancy: 68, adr: 16500, revpar: 11220 },
  { month: "Jul", occupancy: 81, adr: 17800, revpar: 14418 },
  { month: "Aug", occupancy: 85, adr: 18200, revpar: 15470 },
  { month: "Sep", occupancy: 88, adr: 18900, revpar: 16632 },
];

export function OwnerDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "financials" | "governance">("overview");

  const propertyName = user?.propertyName ?? "JW Marriott Mumbai, Juhu";
  const scope = [user?.propertyId ?? "default"];

  // Fetch real-time live operational overview
  const { data: dashboard, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ["owner-dashboard", ...scope],
    queryFn: () => dashboardApi.get(15),
    refetchInterval: 60_000,
  });

  const propertyOverview = useQuery({
    queryKey: ["owner-property-overview", user?.propertyId],
    queryFn: () =>
      api.get<{
        departments: {
          department_id: string;
          department_name: string;
          open_requests: number;
          overdue_requests: number;
          open_tasks: number;
          overdue_tasks: number;
          attendance_today: number;
        }[];
        generated_at: string;
      }>("/dashboard/overview"),
    enabled: Boolean(user?.propertyId),
    refetchInterval: 60_000,
  });

  const ownerActions = useQuery({
    queryKey: ["owner-action-cards", user?.propertyId, user?.id],
    queryFn: () => api.get<{ id: string; title: string; summary: string; impact_amount: number; urgency: string }[]>("/cards", { limit: 3 }),
    enabled: Boolean(user?.propertyId),
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Executive Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-sand-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="border-gold-300 bg-gold-50/80 text-gold-950 font-medium text-[11px] px-2.5 py-0.5">
              <Shield className="mr-1 h-3 w-3 text-gold-600 inline" /> Executive Portal
            </Badge>
            <span className="text-xs text-sand-500 font-medium">• Asset ID: {user?.propertyId?.slice(0, 8) ?? "VESPER-01"}</span>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-sand-950 sm:text-4xl">
            {propertyName} — Owner Cockpit
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-sand-600 max-w-2xl">
            High-level executive overview of property performance, Gross Operating Profit (GOP), and asset risk telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 bg-white shadow-xs"
            onClick={() => alert("Downloading Executive Owner Statement (PDF)...")}
          >
            <Download className="h-3.5 w-3.5 text-sand-600" />
            Export Owner Statement (PDF)
          </Button>
          <Link href="/admin/settings">
            <Button size="sm" className="text-xs gap-1.5 bg-sage-800 hover:bg-sage-900 text-white">
              <Zap className="h-3.5 w-3.5 text-gold-400" />
              AI Autonomy Controls
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Level Key Financial & Asset KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="YTD Gross Revenue"
          value="₹18.2 Cr"
          change="+14.2% YoY"
          comparison="Target: ₹17.0 Cr (+7.0% ahead)"
          direction="up"
          intent="good"
          tone="forest"
          icon={IndianRupee}
        />
        <StatTile
          label="Gross Operating Profit (GOP)"
          value="₹8.25 Cr"
          change="+11.8% YoY"
          comparison="45.3% GOP Margin (+2.1% YoY)"
          direction="up"
          intent="good"
          tone="gold"
          icon={TrendingUp}
        />
        <StatTile
          label="RevPAR & ADR"
          value="₹16,632"
          change="+8.6% RevPAR"
          comparison="ADR: ₹18,900 | Occupancy: 88%"
          direction="up"
          intent="good"
          tone="sage"
          icon={Building2}
        />
        <StatTile
          label="Asset Health"
          value="94.2%"
          change="Low Risk"
          comparison="Based on current asset condition signals"
          direction="up"
          intent="good"
          tone="emerald"
          icon={ShieldCheck}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-sand-200">
        {[
          { id: "overview", label: "Executive Overview", icon: LayoutGridIcon },
          { id: "financials", label: "Yield & GOP Analytics", icon: LineChartIcon },
          { id: "governance", label: "AI & Audit Governance", icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-medium transition-colors -mb-px",
                isActive
                  ? "border-sage-700 text-sage-900 font-semibold"
                  : "border-transparent text-sand-600 hover:border-sand-300 hover:text-sand-900"
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? "text-sage-700" : "text-sand-500")} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {/* Section 1: Financial & Yield Data Visualizations */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Chart 1: Revenue & GOP Trend */}
            <Panel className="lg:col-span-7 bg-white shadow-soft border-sand-200">
              <PanelHeader className="flex items-center justify-between pb-2">
                <div>
                  <h3 className="font-serif text-lg font-bold text-sand-950 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-sage-700" />
                    Monthly Revenue vs Gross Operating Profit
                  </h3>
                    <p className="text-xs text-sand-600">Monthly revenue and operating profit across FY 2026</p>
                </div>
                <Badge variant="outline" className="text-[10px] border-sand-300 text-sand-700">INR (₹)</Badge>
              </PanelHeader>

              <PanelBody className="pt-4">
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={FINANCIAL_TREND_DATA} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="month" {...axisProps} />
                      <YAxis
                        {...axisProps}
                        tickFormatter={(val) => formatLakh(val)}
                        width={64}
                      />
                      <Tooltip
                        formatter={(value: any, name: any) => [formatLakh(Number(value)), name === "revenue" ? "Gross Revenue" : "Operating Profit (GOP)"]}
                        labelStyle={{ fontWeight: "bold" }}
                      />
                      <Bar dataKey="revenue" fill="#a8c3b4" radius={[4, 4, 0, 0]} name="Gross Revenue" />
                      <Bar dataKey="profit" fill="#2f6b57" radius={[4, 4, 0, 0]} name="Operating Profit" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between border-t border-sand-100 pt-3 text-xs">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-sand-700">
                      <span className="h-3 w-3 rounded-xs bg-[#a8c3b4]" /> Gross Revenue
                    </span>
                    <span className="flex items-center gap-1.5 text-sand-700">
                      <span className="h-3 w-3 rounded-xs bg-[#2f6b57]" /> Gross Operating Profit (GOP)
                    </span>
                  </div>
                  <span className="font-semibold text-sage-800">Avg GOP Margin: 43.5%</span>
                </div>
              </PanelBody>
            </Panel>

            {/* Chart 2: Occupancy vs ADR Yield Curve */}
            <Panel className="lg:col-span-5 bg-white shadow-soft border-sand-200">
              <PanelHeader className="flex items-center justify-between pb-2">
                <div>
                  <h3 className="font-serif text-lg font-bold text-sand-950 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-gold-600" />
                    Yield Optimization & RevPAR
                  </h3>
                  <p className="text-xs text-sand-600">Occupancy % vs Average Daily Rate (ADR)</p>
                </div>
              </PanelHeader>

              <PanelBody className="pt-4">
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={YIELD_COMPARISON_DATA} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="month" {...axisProps} />
                      <YAxis yAxisId="left" {...axisProps} domain={[50, 100]} tickFormatter={(val) => `${val}%`} width={40} />
                      <YAxis yAxisId="right" orientation="right" {...axisProps} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} width={45} />
                      <Tooltip formatter={(value: any, name: any) => [name === "occupancy" ? `${value}%` : `₹${value.toLocaleString()}`, name === "occupancy" ? "Occupancy Rate" : "ADR"]} />
                      <Area yAxisId="left" type="monotone" dataKey="occupancy" fill="#dbe8e1" stroke="#2f6b57" strokeWidth={2} name="Occupancy %" />
                      <Line yAxisId="right" type="monotone" dataKey="adr" stroke="#c59a2a" strokeWidth={2.5} dot={{ r: 4 }} name="ADR (₹)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-sand-100 pt-3 text-xs">
                  <span className="text-sand-600">Peak Occupancy: <strong className="text-sand-900">88% (Sep)</strong></span>
                  <span className="text-sand-600">Highest ADR: <strong className="text-sand-900">₹18,900</strong></span>
                  <span className="text-sand-600">RevPAR Trend: <strong className="text-emerald-700">+18.4%</strong></span>
                </div>
              </PanelBody>
            </Panel>
          </div>

          {/* Section 2: Minimalist Executive Overview Modules */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Module A: Departmental Efficiency & SLA Scorecard */}
            <Panel className="bg-white shadow-soft border-sand-200">
              <PanelHeader>
                <h3 className="font-serif text-base font-bold text-sand-950 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-sage-700" />
                  Departmental SLA & Operations
                </h3>
                <p className="text-xs text-sand-500">Live SLA compliance and staffing density</p>
              </PanelHeader>

              <PanelBody className="space-y-4">
                {[
                  { name: "Front Office", sla: 98.4, staff: 24, openReq: 3, status: "Optimal" },
                  { name: "Housekeeping", sla: 96.2, staff: 62, openReq: 12, status: "High Pace" },
                  { name: "Food & Beverage", sla: 95.8, staff: 54, openReq: 8, status: "Optimal" },
                  { name: "Maintenance & BMS", sla: 99.1, staff: 18, openReq: 2, status: "Optimal" },
                  { name: "Inventory & Store", sla: 97.5, staff: 8, openReq: 0, status: "Optimal" },
                ].map((dept) => (
                  <div key={dept.name} className="rounded-xl border border-sand-200/70 bg-sand-50/40 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-xs text-sand-950">{dept.name}</span>
                      <span className="text-[11px] font-mono font-bold text-sage-800">{dept.sla}% SLA</span>
                    </div>

                    <div className="w-full bg-sand-200 rounded-full h-1.5 mb-2">
                      <div
                        className="bg-sage-600 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${dept.sla}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-sand-600">
                      <span>Staff on Duty: {dept.staff}</span>
                      <span>Open Tasks: {dept.openReq}</span>
                    </div>
                  </div>
                ))}
              </PanelBody>
            </Panel>

            {/* Live owner action queue */}
            <Panel className="bg-white shadow-soft border-sand-200">
              <PanelHeader>
                <h3 className="font-serif text-base font-bold text-sand-950 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-gold-500" />
                  Owner AI Action Queue
                </h3>
                <p className="text-xs text-sand-500">Pending recommendations from the live action queue</p>
              </PanelHeader>

              <PanelBody className="space-y-3.5">
                {ownerActions.isPending ? (
                  <p role="status" className="py-8 text-center text-xs text-sand-500">Loading recommendations…</p>
                ) : ownerActions.isError ? (
                  <p className="rounded-lg bg-sand-50 p-3 text-xs text-sand-600">Could not load the live action queue.</p>
                ) : ownerActions.data?.length ? ownerActions.data.map((action) => (
                  <div key={action.id} className="rounded-xl border border-sand-200 bg-sand-50/50 p-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold leading-snug text-sand-950">{action.title}</p>
                      <Badge variant="outline" className="shrink-0 border-gold-300 bg-gold-50 text-gold-900 text-[10px]">{action.urgency}</Badge>
                    </div>
                    <p className="mt-1.5 line-clamp-3 leading-relaxed text-sand-700">{action.summary}</p>
                    <p className="mt-2 font-medium text-sage-800">Estimated impact: {formatLakh(Number(action.impact_amount))}</p>
                  </div>
                )) : (
                  <div className="rounded-xl border border-dashed border-sand-300 p-4 text-center">
                    <p className="text-xs text-sand-600">No pending recommendations right now.</p>
                    <Link href="/admin/actions" className="mt-2 inline-block text-xs font-semibold text-sage-800 hover:underline">Open the action queue →</Link>
                  </div>
                )}
                {ownerActions.data?.length ? <Link href="/admin/actions" className="block text-center text-xs font-semibold text-sage-800 hover:underline">Review all recommendations →</Link> : null}
              </PanelBody>
            </Panel>
          </div>
        </div>
      )}

      {/* Tabs 2-4 Minimal Placeholders / Detailed Views */}
      {activeTab === "financials" && (
        <Panel className="bg-white p-6 shadow-soft">
          <h3 className="font-serif text-xl font-bold text-sand-950 mb-4">Detailed Financial & Yield Breakdown</h3>
          <p className="text-sm text-sand-600 mb-6">
            Detailed department-wise Gross Operating Revenue, Food & Beverage profit margins, Rooms department ADR elasticity, and RevPAR drivers.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-sand-50 border border-sand-200">
              <span className="text-sand-500 font-semibold block uppercase">Rooms Dept Revenue</span>
              <span className="text-xl font-bold text-sand-950 mt-1 block">₹12.4 Cr</span>
              <span className="text-emerald-700 font-medium text-[11px] mt-1 block">68.1% of Total Revenue</span>
            </div>
            <div className="p-4 rounded-xl bg-sand-50 border border-sand-200">
              <span className="text-sand-500 font-semibold block uppercase">F&B Outlets Revenue</span>
              <span className="text-xl font-bold text-sand-950 mt-1 block">₹4.6 Cr</span>
              <span className="text-emerald-700 font-medium text-[11px] mt-1 block">25.2% of Total Revenue</span>
            </div>
            <div className="p-4 rounded-xl bg-sand-50 border border-sand-200">
              <span className="text-sand-500 font-semibold block uppercase">Spa & Amenities</span>
              <span className="text-xl font-bold text-sand-950 mt-1 block">₹1.2 Cr</span>
              <span className="text-emerald-700 font-medium text-[11px] mt-1 block">6.7% of Total Revenue</span>
            </div>
          </div>
        </Panel>
      )}

      {/* AI & Regulatory Governance - Owner Executive Compliance View */}
      {activeTab === "governance" && (
        <div className="space-y-6">
          <Panel className="border-sage-200 bg-sage-50/50 shadow-soft">
            <PanelHeader>
              <h3 className="font-serif text-xl font-bold text-sand-950">What AI guardrails do</h3>
              <p className="text-sm text-sand-700">They set the boundaries for when Vesper can act and when a person must decide.</p>
            </PanelHeader>
            <PanelBody className="grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-lg border border-sand-200 bg-white p-3"><strong className="text-sand-950">Confidence</strong><p className="mt-1 text-sand-600">Low confidence recommendations go to the human queue instead of being auto-executed.</p></div>
              <div className="rounded-lg border border-sand-200 bg-white p-3"><strong className="text-sand-950">Financial impact</strong><p className="mt-1 text-sand-600">Large purchases and material rate changes need the configured manager or owner approval.</p></div>
              <div className="rounded-lg border border-sand-200 bg-white p-3"><strong className="text-sand-950">Human control</strong><p className="mt-1 text-sand-600">Managers can inspect the evidence, adjust or reject a recommendation, and eligible actions can be undone.</p></div>
              <p className="text-xs text-sand-600 md:col-span-3">The controls shown in Settings are demo configuration controls. Thresholds affect routing only where an engine implements that guardrail; they do not guarantee accuracy or replace approval policies.</p>
            </PanelBody>
          </Panel>
          <Panel className="bg-white p-6 shadow-soft border-sand-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-sand-200 gap-3">
              <div>
                <h3 className="font-serif text-xl font-bold text-sand-950 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-sage-700" />
                  AI System Governance & Compliance Ledger
                </h3>
                <p className="text-xs text-sand-600 mt-1">
                  Executive oversight of autonomous AI decisions, regulatory compliance (DPDP 2023), and human authorization logs.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs bg-white shadow-xs"
                  onClick={() => alert("Downloading SHA-256 Verified Compliance Ledger (PDF)...")}
                >
                  <Download className="h-3.5 w-3.5 text-sand-600 mr-1.5" />
                  Export Audit Ledger (PDF)
                </Button>
                <Badge variant="outline" className="border-sand-300 text-sand-700 bg-sand-50 px-2.5 py-1 text-xs">
                  Illustrative demo governance view
                </Badge>
              </div>
            </div>

            {/* 4 Compliance Summary Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
              <div className="p-4 rounded-xl bg-sage-50/60 border border-sage-200">
                <span className="text-[11px] font-semibold text-sage-800 uppercase block">Decision routing</span>
                <span className="text-2xl font-bold text-sage-950 mt-1 block">Review first</span>
                <span className="text-[11px] text-sage-700 mt-1 block">Higher risk goes to a person</span>
              </div>

              <div className="p-4 rounded-xl bg-gold-50/60 border border-gold-200">
                <span className="text-[11px] font-semibold text-gold-900 uppercase block">Owner control</span>
                <span className="text-2xl font-bold text-gold-950 mt-1 block">Human approval</span>
                <span className="text-[11px] text-gold-800 mt-1 block">Recommendations remain reviewable</span>
              </div>

              <div className="p-4 rounded-xl bg-sand-100/70 border border-sand-300">
                <span className="text-[11px] font-semibold text-sand-700 uppercase block">Audit Ledger Hash</span>
                <span className="text-2xl font-bold text-sand-950 mt-1 font-mono text-sm tracking-tight truncate block">
                  Decision history
                </span>
                <span className="text-[11px] text-sand-600 mt-1 block">Review who decided and when</span>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase block">Financial Guardrail</span>
                <span className="text-2xl font-bold text-emerald-950 mt-1 block">Set in Settings</span>
                <span className="text-[11px] text-emerald-700 mt-1 block">Approval thresholds are configurable</span>
              </div>
            </div>

            {/* Executive Audit Log Cards */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-sand-950 uppercase tracking-wider">Illustrative sample governance events</h4>

              {[
                {
                  id: "GOV-8941",
                  time: "Today, 14:32",
                  actor: "Rustom Mistry (Owner)",
                  action: "Authorized 120kW Rooftop Solar PPA Contract",
                  impact: "+₹4.2L Monthly Energy Cost Reduction",
                  type: "Energy Decision",
                  status: "Approved & Verified",
                  statusColor: "border-emerald-300 bg-emerald-50 text-emerald-800",
                },
                {
                  id: "GOV-8940",
                  time: "Today, 11:15",
                  actor: "Vesper AI Pricing Engine",
                  action: "Autonomous Rate Surge (+14.3%) for Executive Suites",
                  impact: "+₹1,42,000 RevPAR Margin Gain",
                  type: "Dynamic Yield",
                  status: "AI Executed (Within Bounds)",
                  statusColor: "border-sage-300 bg-sage-50 text-sage-800",
                },
                {
                  id: "GOV-8939",
                  time: "Yesterday, 16:45",
                  actor: "Anjali Verma (GM)",
                  action: "Approved High-Value PO #8492 (Chiller Compressor Upgrade)",
                  impact: "₹85,000 Maintenance Allocation",
                  type: "Procurement",
                  status: "Human Authorized",
                  statusColor: "border-gold-300 bg-gold-50 text-gold-900",
                },
                {
                  id: "GOV-8938",
                  time: "Yesterday, 09:00",
                  actor: "Security & Privacy Engine",
                  action: "DPDP 2023 Data Anonymization Audit",
                  impact: "25,658 Guest Records Anonymized for Analytics",
                  type: "Compliance Audit",
                  status: "Verified 100% Pass",
                  statusColor: "border-sand-300 bg-sand-100 text-sand-800",
                },
              ].map((log) => (
                <div key={log.id} className="p-3.5 rounded-xl border border-sand-200 bg-sand-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sand-950 text-sm">{log.action}</span>
                      <Badge variant="outline" className={cn("text-[10px]", log.statusColor)}>
                        {log.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sand-500 text-[11px]">
                      <span><strong>ID:</strong> {log.id}</span>
                      <span>• <strong>Actor:</strong> {log.actor}</span>
                      <span>• <strong>Time:</strong> {log.time}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-sage-800 block text-xs">{log.impact}</span>
                    <span className="text-[10px] text-sand-500 block">Category: {log.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

function LayoutGridIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}
