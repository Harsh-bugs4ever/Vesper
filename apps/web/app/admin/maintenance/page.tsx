"use client";

import React, { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarCheck2,
  ChevronRight,
  Download,
  FileText,
  Gauge,
  Search,
  Thermometer,
  TimerReset,
  TrendingUp,
  Wrench,
  Zap,
} from "lucide-react";

import { RiskGauge, riskBand } from "@/components/charts/risk-gauge";
import { SensorTrendChart } from "@/components/charts/sensor-trend-chart";
import { Button } from "@/components/ui/button";
import { FilterChips } from "@/components/ui/filter-chips";
import { Input } from "@/components/ui/input";
import { MiniStat } from "@/components/ui/mini-stat";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SectionTabs } from "@/components/ui/section-tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { chartColors } from "@/lib/chart-theme";
import {
  assets,
  condenserTemperature,
  priorityChip,
  riskMeta,
  workOrderStateChip,
  workOrders,
  type Asset,
  type RiskLevel,
} from "@/lib/demo/maintenance";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "assets", label: "Assets" },
  { value: "work-orders", label: "Work Orders" },
  { value: "preventive", label: "Preventive Maintenance" },
  { value: "history", label: "Service History" },
  { value: "vendors", label: "Vendors" },
] as const;

type Tab = (typeof TABS)[number]["value"];

const DETAIL_TABS = [
  { value: "overview", label: "Overview" },
  { value: "sensor", label: "Sensor Data" },
  { value: "history", label: "Service History" },
  { value: "documents", label: "Documents" },
] as const;

type DetailTab = (typeof DETAIL_TABS)[number]["value"];

/** The week of the recommended service window, and which days it covers. */
const SERVICE_WEEK = [16, 17, 18, 19, 20, 21, 22];
const RECOMMENDED_DAYS = [18, 19, 20];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function MaintenancePage() {
  const { showToast } = useToast();

  const [tab, setTab] = useState<Tab>("assets");
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [risk, setRisk] = useState<RiskLevel | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(assets[0].id);

  const counts = useMemo(
    () => ({
      high: assets.filter((asset) => asset.risk === "high").length,
      medium: assets.filter((asset) => asset.risk === "medium").length,
      low: assets.filter((asset) => asset.risk === "low").length,
    }),
    []
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assets
      .filter((asset) => risk === "all" || asset.risk === risk)
      .filter(
        (asset) =>
          needle === "" ||
          asset.name.toLowerCase().includes(needle) ||
          asset.system.toLowerCase().includes(needle) ||
          asset.location.toLowerCase().includes(needle)
      );
  }, [risk, query]);

  const selected: Asset = assets.find((asset) => asset.id === selectedId) ?? assets[0];
  const score = riskMeta[selected.risk].score;
  const band = riskBand(score);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description="Keep your property running smoothly."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              showToast({
                title: "Asset register exported",
                description: `${assets.length} assets and ${workOrders.length} work orders written to CSV.`,
                type: "success",
              })
            }
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        }
      />

      <SectionTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "assets" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* Asset register */}
          <Panel className="flex flex-col">
            <PanelHeader title={`All Assets (${assets.length})`} />
            <PanelBody className="space-y-3 pt-4">
              <Input
                icon={<Search className="h-4 w-4" />}
                placeholder="Search assets..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />

              <FilterChips
                options={[
                  { value: "all" as const, label: "All", count: assets.length },
                  { value: "high" as const, label: "High Risk", count: counts.high },
                  { value: "medium" as const, label: "Medium", count: counts.medium },
                  { value: "low" as const, label: "Low", count: counts.low },
                ]}
                value={risk}
                onChange={(value) => setRisk(value as RiskLevel | "all")}
              />

              {visible.length === 0 ? (
                <p className="py-10 text-center text-sm text-sand-500">No assets match that search.</p>
              ) : (
                <ul className="divide-y divide-sand-100">
                  {visible.map((asset) => {
                    const Icon = asset.icon;
                    const isActive = asset.id === selected.id;
                    return (
                      <li key={asset.id}>
                        <button
                          onClick={() => setSelectedId(asset.id)}
                          aria-current={isActive ? "true" : undefined}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                            isActive ? "bg-sage-50" : "hover:bg-sand-50"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                              isActive ? "bg-white text-sage-700" : "bg-sand-100 text-sand-600"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-sand-950">
                              {asset.name}
                            </span>
                            <span className="block truncate text-xs text-sand-500">
                              {asset.system} · {asset.location}
                            </span>
                          </span>

                          <span
                            className={cn(
                              "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                              riskMeta[asset.risk].chip
                            )}
                          >
                            {riskMeta[asset.risk].label}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-sand-400" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PanelBody>
          </Panel>

          {/* Asset detail */}
          <Panel className="flex flex-col">
            <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5">
              <div className="flex items-start gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sage-50 text-sage-700">
                  <selected.icon className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="font-serif text-2xl font-semibold leading-tight text-sand-950">
                    {selected.name}
                  </h2>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-sand-600">
                    <span className="font-medium text-sand-700">{selected.system}</span>
                    <span className="text-sand-300">|</span>
                    <span>{selected.location}</span>
                    <span className="text-sand-300">|</span>
                    <span>Asset ID: {selected.id}</span>
                  </p>
                </div>
              </div>

              <div className="text-right">
                {selected.active && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sage-200 bg-sage-50 px-2.5 py-0.5 text-xs font-medium text-sage-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-sage-600" />
                    Active
                  </span>
                )}
                <p className="mt-2 text-xs text-sand-500">Installed: {selected.installedOn}</p>
                <p className="text-xs text-sand-500">Last Service: {selected.lastServicedOn}</p>
              </div>
            </div>

            <div className="px-5 pt-4">
              <SectionTabs tabs={DETAIL_TABS} value={detailTab} onChange={setDetailTab} />
            </div>

            {detailTab === "overview" && (
              <PanelBody className="space-y-4 pt-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-sand-200/80 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                        <TrendingUp className="h-4 w-4" />
                      </span>
                      <p className="text-xs text-sand-600">Risk Level</p>
                    </div>
                    <RiskGauge value={score} size={140} className="mt-1" />
                    <p className="mt-2 text-center text-xs leading-snug text-sand-500">
                      Increased vibration and high condenser temperature detected.
                    </p>
                  </div>

                  <MiniStat
                    label="Estimated Time to Failure"
                    value="9 days"
                    detail="Based on sensor trends and historical data"
                    tone="sand"
                    icon={TimerReset}
                  />

                  <MiniStat
                    label="Operational Impact"
                    value="High"
                    valueClassName={band.text}
                    detail="Potential for cooling downtime affecting guest comfort."
                    tone="gold"
                    icon={BarChart3}
                  />
                </div>

                <Panel tone="muted" className="border-sand-200/80">
                  <PanelHeader
                    title="Condenser Temperature"
                    action={
                      <div className="flex items-center gap-4 pt-1 text-xs text-sand-600">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="h-0.5 w-5 rounded-full"
                            style={{ backgroundColor: chartColors.forest }}
                          />
                          Temperature (°C)
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: chartColors.gold }}
                          />
                          Anomaly
                        </span>
                      </div>
                    }
                  />
                  <PanelBody className="pt-4">
                    <SensorTrendChart data={condenserTemperature} unit="°C" domain={[20, 60]} />
                  </PanelBody>
                </Panel>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MiniStat
                    label="Current Temp"
                    value="52°C"
                    delta="+8°C from normal"
                    deltaDirection="up"
                    deltaIntent="bad"
                    tone="rose"
                    icon={Thermometer}
                  />
                  <MiniStat
                    label="Vibration"
                    value="4.2 mm/s"
                    delta="+120%"
                    deltaDirection="up"
                    deltaIntent="bad"
                    tone="rose"
                    icon={Activity}
                  />
                  <MiniStat
                    label="Pressure (Low)"
                    value="2.1 bar"
                    delta="-18%"
                    deltaDirection="down"
                    deltaIntent="bad"
                    tone="sand"
                    icon={Gauge}
                  />
                  <MiniStat
                    label="Power Consumption"
                    value="86 kW"
                    delta="+15%"
                    deltaDirection="up"
                    deltaIntent="bad"
                    tone="gold"
                    icon={Zap}
                  />
                </div>

                <Panel tone="muted" className="border-sand-200/80">
                  <PanelHeader title="Suggested Service Window" />
                  <PanelBody className="grid grid-cols-1 gap-4 pt-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-sand-200 bg-white p-4">
                      <p className="mb-3 text-center text-sm font-medium text-sand-800">Nov 2026</p>
                      <div className="grid grid-cols-7 gap-1 text-center">
                        {WEEKDAYS.map((day) => (
                          <span key={day} className="pb-1 text-xs text-sand-500">
                            {day}
                          </span>
                        ))}
                        {SERVICE_WEEK.map((day) => {
                          const isRecommended = RECOMMENDED_DAYS.includes(day);
                          return (
                            <span
                              key={day}
                              className={cn(
                                "rounded-lg py-2 text-sm tabular-nums",
                                isRecommended
                                  ? "bg-sage-100 font-semibold text-sage-900"
                                  : "text-sand-700"
                              )}
                            >
                              {day}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-sage-200 bg-sage-50/60 p-4">
                      <CalendarCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-sage-700" />
                      <div>
                        <p className="text-sm font-semibold text-sage-900">
                          Recommended: 18 – 20 Nov 2026
                        </p>
                        <p className="mt-1 text-xs leading-snug text-sand-600">
                          Schedule maintenance during low occupancy to minimise guest impact.
                        </p>
                      </div>
                    </div>
                  </PanelBody>
                </Panel>

                <div className="flex flex-wrap items-end justify-between gap-4 border-t border-sand-200/80 pt-4">
                  <div className="flex min-w-0 items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-sand-400" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-sand-700">Notes</p>
                      <p className="mt-0.5 text-xs leading-snug text-sand-600">
                        Rising condenser temperature and vibration levels since 5 Sep. Recommend
                        inspection and cleaning of condenser coils.
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() =>
                      showToast({
                        title: "Work order created",
                        description: `${selected.name} · assigned to Rajesh Verma for 18 Nov.`,
                        type: "success",
                      })
                    }
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    Create Work Order
                  </Button>
                </div>
              </PanelBody>
            )}

            {detailTab === "sensor" && (
              <PanelBody className="space-y-4 pt-4">
                <Panel tone="muted" className="border-sand-200/80">
                  <PanelHeader
                    title="Condenser Temperature"
                    description="Twenty days of readings, with three flagged by the anomaly model."
                  />
                  <PanelBody className="pt-4">
                    <SensorTrendChart
                      data={condenserTemperature}
                      unit="°C"
                      domain={[20, 60]}
                      height={280}
                    />
                  </PanelBody>
                </Panel>

                <Table>
                  <THead>
                    <tr>
                      <TH>Date</TH>
                      <TH align="right">Reading</TH>
                      <TH align="right">Flagged</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {[...condenserTemperature].reverse().map((point) => (
                      <TR key={point.date}>
                        <TD className="text-sand-700">{point.date}</TD>
                        <TD align="right" className="font-medium text-sand-900">
                          {point.value}°C
                        </TD>
                        <TD align="right">
                          {point.anomaly ? (
                            <span className="inline-flex rounded-full border border-gold-200 bg-gold-50 px-2.5 py-0.5 text-xs font-medium text-gold-800">
                              Anomaly
                            </span>
                          ) : (
                            <span className="text-sand-400">—</span>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </PanelBody>
            )}

            {detailTab === "history" && (
              <PanelBody className="pt-4">
                <ul className="divide-y divide-sand-100">
                  {[
                    { date: "18 Aug 2026", detail: "Annual service — coils cleaned, refrigerant topped up", by: "Cool Care Services" },
                    { date: "02 Apr 2026", detail: "Compressor oil change", by: "Cool Care Services" },
                    { date: "27 Nov 2025", detail: "Condenser fan motor replaced", by: "Rajesh Verma" },
                    { date: "14 Jun 2025", detail: "Annual service — no faults found", by: "Cool Care Services" },
                  ].map((entry) => (
                    <li key={entry.date} className="flex items-baseline justify-between gap-4 py-3">
                      <span className="min-w-0">
                        <span className="block text-sm text-sand-900">{entry.detail}</span>
                        <span className="block text-xs text-sand-500">{entry.by}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-sand-500">{entry.date}</span>
                    </li>
                  ))}
                </ul>
              </PanelBody>
            )}

            {detailTab === "documents" && (
              <PanelBody className="pt-4">
                <ul className="divide-y divide-sand-100">
                  {[
                    { name: "Installation certificate.pdf", size: "412 KB" },
                    { name: "Manufacturer manual (Carrier 30XA).pdf", size: "8.1 MB" },
                    { name: "AMC contract 2026–27.pdf", size: "220 KB" },
                    { name: "Last service report — 18 Aug 2026.pdf", size: "186 KB" },
                  ].map((doc) => (
                    <li key={doc.name} className="flex items-center justify-between gap-4 py-3">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <FileText className="h-4 w-4 shrink-0 text-sand-400" />
                        <span className="truncate text-sm text-sand-800">{doc.name}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-sand-500">{doc.size}</span>
                    </li>
                  ))}
                </ul>
              </PanelBody>
            )}
          </Panel>
        </div>
      )}

      {tab === "work-orders" && (
        <Panel>
          <PanelHeader
            title="Work Orders"
            description="Raised by engineering, by the front desk, or from an approved action card."
          />
          <PanelBody className="pt-4">
            <Table>
              <THead>
                <tr>
                  <TH>Work order</TH>
                  <TH>Asset</TH>
                  <TH>Assignee</TH>
                  <TH align="right">Raised</TH>
                  <TH align="right">Due</TH>
                  <TH align="right">Priority</TH>
                  <TH align="right">Status</TH>
                </tr>
              </THead>
              <TBody>
                {workOrders.map((order) => (
                  <TR key={order.id}>
                    <TD>
                      <span className="block font-medium tabular-nums text-sand-900">{order.id}</span>
                      <span className="block text-xs text-sand-500">{order.summary}</span>
                    </TD>
                    <TD className="text-sand-700">{order.asset}</TD>
                    <TD className="text-sand-700">{order.assignee}</TD>
                    <TD align="right" className="text-sand-600">
                      {order.raised}
                    </TD>
                    <TD align="right" className="text-sand-600">
                      {order.due}
                    </TD>
                    <TD align="right">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          priorityChip[order.priority]
                        )}
                      >
                        {order.priority}
                      </span>
                    </TD>
                    <TD align="right">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          workOrderStateChip[order.state]
                        )}
                      >
                        {order.state}
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </PanelBody>
        </Panel>
      )}

      {tab === "preventive" && (
        <Panel>
          <PanelHeader
            title="Preventive Maintenance"
            description="Scheduled servicing placed against forecast occupancy."
          />
          <PanelBody className="pt-4">
            <Table>
              <THead>
                <tr>
                  <TH>Asset</TH>
                  <TH>Task</TH>
                  <TH>Interval</TH>
                  <TH align="right">Last done</TH>
                  <TH align="right">Next due</TH>
                </tr>
              </THead>
              <TBody>
                {[
                  { asset: "Chiller 2", task: "Condenser coil clean", interval: "Quarterly", last: "18 Aug 2026", next: "18 Nov 2026" },
                  { asset: "Chiller 1", task: "Condenser coil clean", interval: "Quarterly", last: "18 Aug 2026", next: "18 Nov 2026" },
                  { asset: "AHU 1", task: "Filter replacement", interval: "Monthly", last: "02 Sep 2026", next: "02 Oct 2026" },
                  { asset: "Generator 1", task: "Load test", interval: "Monthly", last: "06 Sep 2026", next: "06 Oct 2026" },
                  { asset: "Fire Pump", task: "Churn test", interval: "Weekly", last: "09 Sep 2026", next: "23 Sep 2026" },
                  { asset: "Boiler 1", task: "Pressure valve test", interval: "Quarterly", last: "25 Aug 2026", next: "25 Nov 2026" },
                ].map((row) => (
                  <TR key={`${row.asset}-${row.task}`}>
                    <TD className="font-medium text-sand-900">{row.asset}</TD>
                    <TD className="text-sand-700">{row.task}</TD>
                    <TD className="text-sand-600">{row.interval}</TD>
                    <TD align="right" className="text-sand-600">
                      {row.last}
                    </TD>
                    <TD align="right" className="font-medium text-sand-900">
                      {row.next}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </PanelBody>
        </Panel>
      )}

      {tab === "history" && (
        <Panel>
          <PanelHeader title="Service History" description="Every completed job across the register." />
          <PanelBody className="pt-4">
            <Table>
              <THead>
                <tr>
                  <TH>Date</TH>
                  <TH>Asset</TH>
                  <TH>Work done</TH>
                  <TH>By</TH>
                  <TH align="right">Cost</TH>
                </tr>
              </THead>
              <TBody>
                {[
                  { date: "12 Sep 2026", asset: "Kitchen Exhaust Fan", work: "Duct degrease and belt change", by: "Cool Care Services", cost: 14_500 },
                  { date: "09 Sep 2026", asset: "Fire Pump", work: "Weekly churn test", by: "Rajesh Verma", cost: 0 },
                  { date: "06 Sep 2026", asset: "Generator 1", work: "Load test and coolant top-up", by: "Rajesh Verma", cost: 3_200 },
                  { date: "02 Sep 2026", asset: "AHU 1", work: "Return air filter replacement", by: "Sameer Joshi", cost: 8_900 },
                  { date: "30 Aug 2026", asset: "Water Pump 2", work: "Seal replacement", by: "Cool Care Services", cost: 11_400 },
                  { date: "25 Aug 2026", asset: "Boiler 1", work: "Pressure valve test", by: "Cool Care Services", cost: 6_800 },
                  { date: "18 Aug 2026", asset: "Chiller 2", work: "Annual service", by: "Cool Care Services", cost: 42_000 },
                ].map((row) => (
                  <TR key={`${row.date}-${row.asset}`}>
                    <TD className="text-sand-600">{row.date}</TD>
                    <TD className="font-medium text-sand-900">{row.asset}</TD>
                    <TD className="text-sand-700">{row.work}</TD>
                    <TD className="text-sand-600">{row.by}</TD>
                    <TD align="right" className="font-medium text-sand-900">
                      {row.cost === 0 ? "In-house" : `₹${row.cost.toLocaleString("en-IN")}`}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </PanelBody>
        </Panel>
      )}

      {tab === "vendors" && (
        <Panel>
          <PanelHeader title="Vendors" description="Contracted suppliers and their response commitments." />
          <PanelBody className="pt-4">
            <Table>
              <THead>
                <tr>
                  <TH>Vendor</TH>
                  <TH>Covers</TH>
                  <TH>Contact</TH>
                  <TH align="right">Response SLA</TH>
                  <TH align="right">Contract ends</TH>
                </tr>
              </THead>
              <TBody>
                {[
                  { name: "Cool Care Services", covers: "HVAC, chillers, boilers", contact: "+91 98200 41172", sla: "4 hours", ends: "31 Mar 2027" },
                  { name: "Otis India", covers: "Lifts and escalators", contact: "+91 98195 22840", sla: "2 hours", ends: "30 Jun 2027" },
                  { name: "Sterling Power", covers: "Generators, UPS", contact: "+91 99301 77451", sla: "6 hours", ends: "31 Dec 2026" },
                  { name: "AquaPure Systems", covers: "Water treatment, STP", contact: "+91 98673 10084", sla: "8 hours", ends: "30 Sep 2027" },
                ].map((vendor) => (
                  <TR key={vendor.name}>
                    <TD className="font-medium text-sand-900">{vendor.name}</TD>
                    <TD className="text-sand-700">{vendor.covers}</TD>
                    <TD className="tabular-nums text-sand-600">{vendor.contact}</TD>
                    <TD align="right" className="text-sand-700">
                      {vendor.sla}
                    </TD>
                    <TD align="right" className="text-sand-600">
                      {vendor.ends}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}
