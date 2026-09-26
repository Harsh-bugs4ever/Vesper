"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import {
  SlidersHorizontal,
  Building2,
  BedDouble,
  Utensils,
  Cpu,
  ShieldCheck,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Server,
  Activity,
  Zap,
  Clock,
  IndianRupee,
  FileClock,
  Download,
  Check,
  RefreshCw,
  Layers,
  Thermometer,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { AccessDeniedCard } from "@/components/auth/role-guard";
import { cn } from "@/lib/utils";

interface AuditLogEntry {
  id: string;
  time: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  impact: string;
  status: "verified" | "flagged" | "reverted";
}

export default function ResortSettingsPage() {
  const { user, role, property } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<
    "profile" | "outlets" | "connectors" | "ai_guardrails" | "audit"
  >("profile");

  // Property Profile State
  const [resortName, setResortName] = useState(property?.name ?? "");
  const [brandName, setBrandName] = useState(property?.brand ?? "");
  const [locationStr, setLocationStr] = useState(property?.location ?? "");
  const [currency, setCurrency] = useState(property?.currency ?? "");
  const [checkIn, setCheckIn] = useState(property?.checkInTime ?? "");
  const [checkOut, setCheckOut] = useState(property?.checkOutTime ?? "");

  const [loadedPropertyId, setLoadedPropertyId] = useState(property?.id ?? "");
  useEffect(() => {
    if (!property || property.id === loadedPropertyId) return;
    setLoadedPropertyId(property.id);
    setResortName(property.name);
    setBrandName(property.brand ?? "");
    setLocationStr(property.location);
    setCurrency(property.currency);
    setCheckIn(property.checkInTime);
    setCheckOut(property.checkOutTime);
  }, [property, loadedPropertyId]);

  // AI Guardrail States
  const [confidenceThreshold, setConfidenceThreshold] = useState(
    property?.aiGuardrails?.confidenceThreshold ?? 85
  );
  const [highImpactRateThreshold, setHighImpactRateThreshold] = useState(
    property?.aiGuardrails?.requireHumanApprovalAboveImpactPercent ?? 15
  );
  const [highImpactPoThreshold, setHighImpactPoThreshold] = useState(
    property?.aiGuardrails?.highImpactPurchaseThresholdInr ?? 50000
  );
  const [undoDuration, setUndoDuration] = useState(
    property?.aiGuardrails?.undoBufferSeconds ?? 30
  );
  const [shadowMode, setShadowMode] = useState(
    property?.aiGuardrails?.shadowMode ?? false
  );
  const [dpdpCompliance, setDpdpCompliance] = useState(
    property?.aiGuardrails?.dpdpCompliance ?? true
  );

  // Connector States
  const [pmsSyncInterval, setPmsSyncInterval] = useState("30s");
  const [isPmsSyncing, setIsPmsSyncing] = useState(false);
  const [isBmsPinging, setIsBmsPinging] = useState(false);
  const [bmsChillerAlertActive, setBmsChillerAlertActive] = useState(true);

  // Mock Audit Log Entries
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([
    {
      id: "aud_9021",
      time: "12m ago",
      actor: "Arjun Mehta",
      role: "General Manager",
      action: "Approved AI Rate Card (+12% Deluxe Ocean)",
      target: "Rates Engine · PMS Sync",
      impact: "+₹1,42,000 Projected Weekend ADR",
      status: "verified",
    },
    {
      id: "aud_9020",
      time: "28m ago",
      actor: "Sunita Rao",
      role: "Executive Housekeeper",
      action: "Flipped Room 412 status to Cleaned",
      target: "Room Board 412",
      impact: "SLA verified in 22 mins",
      status: "verified",
    },
    {
      id: "aud_9019",
      time: "44m ago",
      actor: "BMS Anomaly Engine",
      role: "Autonomous ML",
      action: "Flagged Chiller #2 Bearing Vibration (0.42g)",
      target: "Chiller #2 · Juhu Central Plant",
      impact: "Queued Maintenance Card for quiet day",
      status: "flagged",
    },
    {
      id: "aud_9018",
      time: "1h 10m ago",
      actor: "Kavita Nair",
      role: "System Administrator",
      action: "Updated Permission Matrix for Staff Role",
      target: "RBAC Matrix · attendance:mark",
      impact: "GPS check-in perimeter validated",
      status: "verified",
    },
    {
      id: "aud_9017",
      time: "2h ago",
      actor: "Priya Sharma",
      role: "F&B Manager",
      action: "Approved Multigrain Bread Reorder PO",
      target: "Inventory Service · Lotus Cafe",
      impact: "Stock auto-deducted after Room 412 order",
      status: "verified",
    },
  ]);

  const isAuthorized = role === "general_manager" || role === "owner";

  const handleSaveSettings = () => {
    showToast({
      title: "Resort Configuration Saved",
      description: "Updated property parameters, connector preferences, and AI safety thresholds.",
      type: "success",
    });
  };

  const handleTriggerPmsResync = () => {
    setIsPmsSyncing(true);
    setTimeout(() => {
      setIsPmsSyncing(false);
      showToast({
        title: "PMS Resync Completed",
        description: "355/355 room keys and 112 active guest folios synchronized with Opera Cloud.",
        type: "success",
      });
    }, 1200);
  };

  const handleTriggerBmsPing = () => {
    setIsBmsPinging(true);
    setTimeout(() => {
      setIsBmsPinging(false);
      showToast({
        title: "BMS Sensor Network Responding",
        description: "145 smart thermostats and 12 chillers reporting 100% heartbeat packet health (18ms latency).",
        type: "default",
      });
    }, 800);
  };

  const handleSimulateBmsAnomaly = () => {
    setBmsChillerAlertActive(true);
    const newEntry: AuditLogEntry = {
      id: `aud_${Date.now().toString().slice(-4)}`,
      time: "Just now",
      actor: "BMS Sensor Anomaly Detector",
      role: "IoT ML Engine",
      action: "High Vibration Spike (0.58g) on Chiller #2",
      target: "HVAC Plant · Central Loop",
      impact: "AI Maintenance Card Dispatched to Engineering",
      status: "flagged",
    };
    setAuditLogs([newEntry, ...auditLogs]);

    showToast({
      title: "Simulated BMS Anomaly Injected",
      description: "Chiller #2 sensor stream tripped 0.50g threshold. Maintenance Action Card created.",
      type: "warning",
    });
  };

  if (!isAuthorized) {
    return (
      <div className="space-y-6">
        <AccessDeniedCard
          title="Resort Settings Restricted"
          message="Resort profile configuration, PMS/BMS connector settings, and AI guardrail management are restricted to General Managers."
          currentRole={user?.roleTitle ?? "User"}
          requiredPermission="resort:configure or system:configure"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-sage-50 via-sand-50 to-gold-50/40 p-6 rounded-2xl border border-sand-200 shadow-soft">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-sage-800 uppercase tracking-wider">
              Resort Infrastructure
            </span>
            <span className="text-sand-300">·</span>
            <Badge variant="gold" className="text-[10px] py-0 px-2">
              JW Marriott Mumbai Juhu · 145 Keys
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-sand-950 font-serif">
            Resort Configuration & Connectors
          </h1>
          <p className="text-xs sm:text-sm text-sand-600 mt-1 max-w-2xl">
            Configure resort key distribution, operational outlets, PMS/BMS live telemetry connectors, and AI decision safety boundaries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleSaveSettings}
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            Save Configuration
          </Button>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-sand-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("profile")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0",
            activeTab === "profile"
              ? "bg-sage-700 text-white shadow-soft"
              : "text-sand-600 hover:text-sand-950 hover:bg-sand-100"
          )}
        >
          <Building2 className="w-4 h-4" />
          <span>Property Profile & 355 Rooms</span>
        </button>

        <button
          onClick={() => setActiveTab("outlets")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0",
            activeTab === "outlets"
              ? "bg-sage-700 text-white shadow-soft"
              : "text-sand-600 hover:text-sand-950 hover:bg-sand-100"
          )}
        >
          <Utensils className="w-4 h-4" />
          <span>Outlets & ~180 Staff</span>
        </button>

        <button
          onClick={() => setActiveTab("connectors")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0",
            activeTab === "connectors"
              ? "bg-sage-700 text-white shadow-soft"
              : "text-sand-600 hover:text-sand-950 hover:bg-sand-100"
          )}
        >
          <Cpu className="w-4 h-4" />
          <span>PMS & BMS Connectors</span>
        </button>

        <button
          onClick={() => setActiveTab("ai_guardrails")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0",
            activeTab === "ai_guardrails"
              ? "bg-sage-700 text-white shadow-soft"
              : "text-sand-600 hover:text-sand-950 hover:bg-sand-100"
          )}
        >
          <Zap className="w-4 h-4" />
          <span>AI Decision Guardrails</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0",
            activeTab === "audit"
              ? "bg-sage-700 text-white shadow-soft"
              : "text-sand-600 hover:text-sand-950 hover:bg-sand-100"
          )}
        >
          <FileClock className="w-4 h-4" />
          <span>Audit Trail ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: PROPERTY PROFILE & 355 ROOMS */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* General Property Settings Form */}
            <div className="lg:col-span-7 space-y-4">
              <Card className="border-sand-200 bg-white shadow-soft">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-sand-950">
                    Resort Profile & Identity
                  </CardTitle>
                  <CardDescription className="text-xs text-sand-500">
                    Primary operational metadata configured for JW Marriott Mumbai Juhu / Vesper Luxury Collection.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-sand-800">Resort Name</label>
                    <Input
                      value={resortName}
                      onChange={(e) => setResortName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-sand-800">Brand Collection</label>
                    <Input
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-sand-800">Location & Coordinates</label>
                    <Input
                      value={locationStr}
                      onChange={(e) => setLocationStr(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-semibold text-sand-800">Base Currency</label>
                      <Input
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-semibold text-sand-800">Check-in Time</label>
                      <Input
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-semibold text-sand-800">Check-out Time</label>
                      <Input
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Total Keys Breakdown Pill */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-gold-300 bg-gradient-to-br from-white to-gold-50/20 shadow-soft">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-sand-950">
                      145 Demo Resort Keys
                    </CardTitle>
                    <Badge variant="gold" className="text-xs">
                      100% Seeded
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-sand-500">
                    Seeded room categories mapped across floors and PMS connectors.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  {(property?.roomCategories ?? []).length === 0 ? (
                    <div className="p-4 text-center text-sand-500 italic">No room category data available from backend</div>
                  ) : (
                    (property?.roomCategories ?? []).map((cat: any) => (
                      <div
                        key={cat.code}
                        className="p-3 rounded-xl bg-white border border-sand-200/90 shadow-2xs flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sand-950">{cat.name}</span>
                            <span className="text-[10px] font-mono text-sand-400">
                              ({cat.code})
                            </span>
                          </div>
                          <p className="text-[11px] text-sand-500 mt-0.5">{cat.floor}</p>
                        </div>

                        <div className="text-right">
                          <span className="font-sans text-base font-bold text-sage-900 block tabular-nums">
                            {cat.count} Keys
                          </span>
                          <span className="text-[10px] text-sand-500 font-medium">
                            Base: ₹{cat.baseRate.toLocaleString("en-IN")}/night
                          </span>
                        </div>
                      </div>
                    ))
                  )}

                  <div className="pt-2 border-t border-sand-200/80 flex items-center justify-between text-xs font-semibold text-sand-800">
                    <span>Total Key Inventory:</span>
                    <span className="text-sage-900 font-sans text-lg font-bold tabular-nums">{property?.totalRooms ?? 0} Rooms</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OUTLETS & STAFF DISTRIBUTION */}
      {activeTab === "outlets" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Outlets */}
            <div className="lg:col-span-6 space-y-3">
              <h3 className="text-base font-bold text-sand-950 font-serif">
                Resort Outlets & Dining Venues ({(property?.outlets ?? []).length})
              </h3>
              <div className="space-y-3">
                {(property?.outlets ?? []).length === 0 ? (
                  <div className="p-4 text-center text-sand-500 italic border border-sand-200 rounded-xl bg-white">No outlet data available from backend</div>
                ) : (
                  (property?.outlets ?? []).map((outlet: any) => (
                    <Card key={outlet.id} className="border-sand-200 shadow-2xs bg-white">
                      <CardContent className="p-4 flex items-start justify-between gap-3 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-sand-950">
                              {outlet.name}
                            </h4>
                            <Badge variant="sage" className="text-[10px] py-0 px-1.5">
                              {outlet.type}
                            </Badge>
                          </div>
                          <p className="text-sand-500 mt-1 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-sand-400" />
                            Hours: {outlet.hours}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[11px] font-semibold text-sand-800 block">
                            Capacity: {outlet.capacity} Pax
                          </span>
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium mt-1 inline-block">
                            QR Menus Active
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Staff Headcount Breakdown */}
            <div className="lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-sand-950 font-serif">
                  Staff Roster Breakdown
                </h3>
                <Badge variant="outline" className="text-xs">
                  {property?.staffHeadcount?.total ?? 0} Total Personnel
                </Badge>
              </div>

              <Card className="border-sand-200 bg-white shadow-soft">
                <CardContent className="p-4 divide-y divide-sand-100 text-xs">
                  {(property?.staffHeadcount?.departments ?? []).length === 0 ? (
                    <div className="py-4 text-center text-sand-500 italic">No department headcount data available from backend</div>
                  ) : (
                    (property?.staffHeadcount?.departments ?? []).map((dept: any) => {
                      const total = property?.staffHeadcount?.total ?? 1;
                      const percentage = Math.round((dept.count / total) * 100);

                      return (
                        <div key={dept.name} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sand-950">{dept.name}</span>
                            <span className="font-semibold text-sage-900">
                              {dept.count} Staff ({percentage}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-sand-100 overflow-hidden">
                            <div
                              className="h-full bg-sage-600 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-sand-500">
                            <span>Active On Shift: {dept.activeOnShift} on duty</span>
                            <span>Three Shifts · 24/7 Coverage</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DEMO PMS & BMS CONNECTORS */}
      {activeTab === "connectors" && (
        <div className="space-y-6">
          <p className="text-xs text-sand-600">
            Real-time telemetry connectors simulate live PMS guest booking events and BMS IoT building sensor streams.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Demo PMS Connector */}
            <Card className="border-sand-200 bg-white shadow-soft">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-sage-700" />
                    <CardTitle className="text-base text-sand-950">
                      Demo PMS Connector (Opera Cloud)
                    </CardTitle>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Connected · Live
                  </span>
                </div>
                <CardDescription className="text-xs text-sand-500">
                  Maps in-house guest folios, bookings, check-ins, and night audits to Vesper Decision Layer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-sand-50 border border-sand-200">
                  <div>
                    <span className="text-sand-500 text-[11px] block">Mapped Rooms</span>
                    <span className="font-sans text-lg font-bold text-sand-950 tabular-nums">
                      355 / 355 Rooms
                    </span>
                  </div>
                  <div>
                    <span className="text-sand-500 text-[11px] block">Active Guest Stays</span>
                    <span className="font-sans text-lg font-bold text-sage-800 tabular-nums">
                      112 Occupied
                    </span>
                  </div>
                  <div>
                    <span className="text-sand-500 text-[11px] block">Connector Latency</span>
                    <span className="font-semibold text-sand-900">18 ms (Low)</span>
                  </div>
                  <div>
                    <span className="text-sand-500 text-[11px] block">Sync Heartbeat</span>
                    <span className="font-semibold text-sand-900">Active (30s interval)</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-sand-800 block">
                    Auto-Polling Sync Interval
                  </label>
                  <select
                    value={pmsSyncInterval}
                    onChange={(e) => setPmsSyncInterval(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-sand-50 border border-sand-200 text-xs font-medium text-sand-900 focus:outline-none focus:ring-1 focus:ring-sage-500"
                  >
                    <option value="15s">15 seconds (High Frequency)</option>
                    <option value="30s">30 seconds (Default Standard)</option>
                    <option value="60s">60 seconds (Eco Polling)</option>
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3 border-t border-sand-200">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTriggerPmsResync}
                    disabled={isPmsSyncing}
                    className="text-xs"
                  >
                    <RefreshCw
                      className={cn("w-3.5 h-3.5 mr-1.5", isPmsSyncing && "animate-spin")}
                    />
                    {isPmsSyncing ? "Syncing..." : "Trigger Full PMS Resync"}
                  </Button>
                  <span className="text-[11px] text-sand-400">Opera v24.2 Spec</span>
                </div>
              </CardContent>
            </Card>

            {/* Demo BMS Sensor Connector */}
            <Card className="border-sand-200 bg-white shadow-soft">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-amber-600" />
                    <CardTitle className="text-base text-sand-950">
                      Demo BMS IoT Connector (BACnet/MQTT)
                    </CardTitle>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    IoT Stream Active
                  </span>
                </div>
                <CardDescription className="text-xs text-sand-500">
                  Streams vibration, temperature, and power metrics from 145 smart thermostats and 12 plant chillers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-sand-50 border border-sand-200">
                  <div>
                    <span className="text-sand-500 text-[11px] block">Smart Thermostats</span>
                    <span className="font-sans text-lg font-bold text-sand-950 tabular-nums">
                      145 Online
                    </span>
                  </div>
                  <div>
                    <span className="text-sand-500 text-[11px] block">HVAC Plant Chillers</span>
                    <span className="font-sans text-lg font-bold text-sand-950 tabular-nums">
                      12 / 12 Online
                    </span>
                  </div>
                  <div>
                    <span className="text-sand-500 text-[11px] block">Sensor Telemetry</span>
                    <span className="font-semibold text-sand-900">MQTT over TLS</span>
                  </div>
                  <div>
                    <span className="text-sand-500 text-[11px] block">Current Health</span>
                    <span className="font-semibold text-amber-800">1 Anomaly Flagged</span>
                  </div>
                </div>

                {bmsChillerAlertActive && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-950 block">
                        Chiller #2 Bearing Vibration (0.42g)
                      </span>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Predicted failure window in 9 days. Maintenance suggestion queued for quiet occupancy day.
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between gap-3 border-t border-sand-200">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTriggerBmsPing}
                    disabled={isBmsPinging}
                    className="text-xs"
                  >
                    <Activity
                      className={cn("w-3.5 h-3.5 mr-1.5", isBmsPinging && "animate-spin")}
                    />
                    Ping IoT Network
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSimulateBmsAnomaly}
                    className="text-xs text-amber-900 bg-amber-100/70 hover:bg-amber-100"
                  >
                    Simulate Sensor Anomaly
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 4: AI DECISION LAYER & GUARDRAILS */}
      {activeTab === "ai_guardrails" && (
        <div className="space-y-6">
          <p className="text-xs text-sand-600">
            Establish human-in-the-loop safety boundaries for AI Prophet, XGBoost, and OR-Tools optimization engines.
          </p>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950">
            <strong>Demo controls:</strong> these sliders show the intended approval boundaries but are not saved as live policy. Each engine must explicitly enforce a threshold before it changes whether an action is routed or executed. Review high-impact actions in the Action Queue.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Confidence & Impact Guardrails */}
            <Card className="border-sand-200 bg-white shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-sand-950">
                  Autonomous Execution Safety Limits
                </CardTitle>
                <CardDescription className="text-xs text-sand-500">
                  Decisions exceeding these thresholds require mandatory General Manager authorization.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 text-xs">
                {/* Confidence Threshold */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-sand-800">
                      Minimum Confidence Threshold for Auto-Execution
                    </label>
                    <span className="font-bold text-sage-800 font-mono text-sm">
                      {confidenceThreshold}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="98"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                    className="w-full accent-sage-600 cursor-pointer"
                  />
                  <p className="text-[11px] text-sand-500">
                    Recommendations below {confidenceThreshold}% confidence are routed directly to the human action queue.
                  </p>
                </div>

                {/* Rate Change Threshold */}
                <div className="space-y-2 pt-2 border-t border-sand-100">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-sand-800">
                      Rate Fluctuation Requiring Approval
                    </label>
                    <span className="font-bold text-sand-900 font-mono text-sm">
                      &gt; ±{highImpactRateThreshold}% ADR
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="25"
                    value={highImpactRateThreshold}
                    onChange={(e) => setHighImpactRateThreshold(Number(e.target.value))}
                    className="w-full accent-sage-600 cursor-pointer"
                  />
                  <p className="text-[11px] text-sand-500">
                    Any surge pricing or discount card exceeding ±{highImpactRateThreshold}% requires General Manager signoff.
                  </p>
                </div>

                {/* Purchase Order Threshold */}
                <div className="space-y-2 pt-2 border-t border-sand-100">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-sand-800">
                      High-Impact Purchase Order Limit
                    </label>
                    <span className="font-bold text-sand-900 font-mono text-sm">
                      ₹{highImpactPoThreshold.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10000"
                    max="100000"
                    step="5000"
                    value={highImpactPoThreshold}
                    onChange={(e) => setHighImpactPoThreshold(Number(e.target.value))}
                    className="w-full accent-sage-600 cursor-pointer"
                  />
                  <p className="text-[11px] text-sand-500">
                    Ingredient and linen purchases over ₹{highImpactPoThreshold.toLocaleString("en-IN")} cannot be auto-dispatched.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Undo & Shadow Mode Controls */}
            <Card className="border-sand-200 bg-white shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-sand-950">
                  Reversibility & Sandboxing
                </CardTitle>
                <CardDescription className="text-xs text-sand-500">
                  Safe undo buffers, shadow execution mode, and privacy regulations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 text-xs">
                {/* Safe Undo Duration */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-sand-800">
                      Safe Undo Buffer Window
                    </label>
                    <span className="font-bold text-sand-900 font-mono text-sm">
                      {undoDuration} Seconds
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={undoDuration}
                    onChange={(e) => setUndoDuration(Number(e.target.value))}
                    className="w-full accent-sage-600 cursor-pointer"
                  />
                  <p className="text-[11px] text-sand-500">
                    Provides an active countdown toast allowing instant rollback before PMS rate write-backs occur.
                  </p>
                </div>

                {/* Shadow Mode Toggle */}
                <div className="p-3.5 rounded-xl border border-sand-200 bg-sand-50/70 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-sand-950 block">Shadow Mode Execution</span>
                    <p className="text-[11px] text-sand-500 mt-0.5">
                      Generates model predictions and scores accuracy without committing changes to live property connectors.
                    </p>
                  </div>
                  <button
                    onClick={() => setShadowMode(!shadowMode)}
                    className={cn(
                      "w-11 h-6 rounded-full transition-colors relative shrink-0",
                      shadowMode ? "bg-sage-600" : "bg-sand-300"
                    )}
                  >
                    <span
                      className={cn(
                        "w-4 h-4 rounded-full bg-white transition-transform absolute top-1",
                        shadowMode ? "right-1" : "left-1"
                      )}
                    />
                  </button>
                </div>

                {/* DPDP Act 2023 Compliance */}
                <div className="p-3.5 rounded-xl border border-sand-200 bg-sand-50/70 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-sand-950 block">
                      DPDP Act 2023 Privacy Safeguards
                    </span>
                    <p className="text-[11px] text-sand-500 mt-0.5">
                      Mask guest phone numbers and PII tokens in non-executive logs and AI concierge vector stores.
                    </p>
                  </div>
                  <button
                    onClick={() => setDpdpCompliance(!dpdpCompliance)}
                    className={cn(
                      "w-11 h-6 rounded-full transition-colors relative shrink-0",
                      dpdpCompliance ? "bg-sage-600" : "bg-sand-300"
                    )}
                  >
                    <span
                      className={cn(
                        "w-4 h-4 rounded-full bg-white transition-transform absolute top-1",
                        dpdpCompliance ? "right-1" : "left-1"
                      )}
                    />
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT TRAIL */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-sand-950 font-serif">
                Immutable Decision Ledger
              </h3>
              <p className="text-xs text-sand-500">
                Every AI suggestion, manager approval, undo event, and staff action is cryptographically recorded.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                showToast({
                  title: "Audit Ledger Exported",
                  description: "Downloaded encrypted JSON audit snapshot (SHA-256 verified).",
                  type: "success",
                })
              }
              className="text-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export Audit Log (JSON)
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-sand-200 shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-sand-700">
                <thead className="bg-sand-50/80 border-b border-sand-200 text-[11px] uppercase font-bold text-sand-500 tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Timestamp & ID</th>
                    <th className="py-3.5 px-4">Operator / Actor</th>
                    <th className="py-3.5 px-4">Action Details</th>
                    <th className="py-3.5 px-4">Resource Target</th>
                    <th className="py-3.5 px-4">System Impact</th>
                    <th className="py-3.5 px-4 text-right">Ledger Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {auditLogs.map((entry) => (
                    <tr key={entry.id} className="hover:bg-sand-50/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-sand-400 block text-[10px]">
                          {entry.id}
                        </span>
                        <span className="font-medium text-sand-800 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-sand-400" />
                          {entry.time}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-sand-950 block">{entry.actor}</span>
                        <span className="text-[11px] text-sage-800">{entry.role}</span>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-sand-900">
                        {entry.action}
                      </td>

                      <td className="py-3.5 px-4 text-sand-600 font-mono text-[11px]">
                        {entry.target}
                      </td>

                      <td className="py-3.5 px-4 text-sage-800 font-medium">
                        {entry.impact}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Badge
                          variant={
                            entry.status === "verified"
                              ? "ready"
                              : entry.status === "flagged"
                              ? "cleaning"
                              : "dirty"
                          }
                          className="text-[10px] capitalize"
                        >
                          {entry.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
