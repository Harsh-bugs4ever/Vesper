"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import {
  Sparkles,
  BedDouble,
  Users,
  CheckCircle2,
  Clock,
  RotateCcw,
  SlidersHorizontal,
  ShieldCheck,
  Check,
  IndianRupee,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

export default function AdminOverviewPage() {
  const { user, role } = useAuth();
  const { showToast, showUndoToast } = useToast();

  const [cardStatus, setCardStatus] = useState<"pending" | "approved" | "dismissed">("pending");
  const [activeTab, setActiveTab] = useState<"all" | "revenue" | "maintenance" | "staffing">("all");

  const handleApproveAction = () => {
    setCardStatus("approved");
    showUndoToast(
      "AI Action Executed: Weekend Deluxe Rates Updated (+12%)",
      "Per-date rates published to PMS connector. Reversible for 10 seconds.",
      () => {
        setCardStatus("pending");
        showToast({
          title: "Action Reverted",
          description: "Deluxe Ocean View rates restored to previous baseline.",
          type: "default",
        });
      },
      10
    );
  };

  const handleDismissAction = () => {
    setCardStatus("dismissed");
    showToast({
      title: "Suggestion Dismissed",
      description: "Feedback logged to Revenue Model accuracy weights.",
      type: "warning",
    });
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner & Day 2 Roles & Demo Resort Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-sage-50 via-sand-50 to-gold-50/40 p-6 rounded-2xl border border-sand-200 shadow-soft">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-sage-800 uppercase tracking-wider">
              Resort Operations Deck
            </span>
            <span className="text-sand-300">·</span>
            <Badge variant="gold" className="text-[10px] py-0 px-2">
              Day 2 Roles & Demo Resort Active
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-sand-950 font-serif">
            Welcome back, {user.name}
          </h1>
          <p className="text-xs sm:text-sm text-sand-600 mt-1">
            Viewing {user.propertyName} as <strong className="text-sage-800">{user.roleTitle}</strong>.
            {role === "system_admin" && " You have full governance access to configure users, permission matrices, and connectors."}
            {role === "general_manager" && " You hold full executive sign-off authority for high-impact AI action cards."}
            {role === "dept_manager_hk" && " Filtered to Housekeeping board, room cleaning turnover, and floor staff."}
            {role === "dept_manager_fb" && " Filtered to Food & Beverage, ingredient reorders, and dining tasks."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {["system_admin", "general_manager"].includes(role) && (
            <>
              <a href="/admin/users">
                <Button variant="outline" size="sm">
                  <Users className="w-3.5 h-3.5 mr-1 text-sage-700" />
                  Users & Matrix
                </Button>
              </a>
              <a href="/admin/settings">
                <Button variant="outline" size="sm">
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1 text-sage-700" />
                  Resort Settings
                </Button>
              </a>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              showToast({
                title: "Resort Telemetry Refreshed",
                description: "Live occupancy, BMS sensors, and task statuses synchronized with Opera PMS.",
                type: "success",
              })
            }
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Refresh Data
          </Button>
          <a href="#action-queue">
            <Button variant="default" size="sm">
              <Sparkles className="w-3.5 h-3.5 text-gold-300 mr-1" />
              Review Action Queue (3)
            </Button>
          </a>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Occupancy Card */}
        <Card className="hover:border-sage-300 transition-all">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-sand-600">Resort Occupancy</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <BedDouble className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-sand-950">78%</span>
              <span className="text-xs font-medium text-emerald-700 flex items-center">
                <ArrowUpRight className="w-3 h-3" /> +6% vs last week
              </span>
            </div>
            <p className="text-[11px] text-sand-500 mt-1">
              113 of 145 rooms occupied tonight
            </p>
          </CardContent>
        </Card>

        {/* Daily Revenue */}
        <Card className="hover:border-sage-300 transition-all">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-sand-600">Est. Daily Revenue</span>
            <div className="p-2 rounded-lg bg-gold-50 text-gold-700">
              <IndianRupee className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-sand-950">₹14,85,000</span>
              <span className="text-xs font-medium text-emerald-700 flex items-center">
                <ArrowUpRight className="w-3 h-3" /> +14%
              </span>
            </div>
            <p className="text-[11px] text-sand-500 mt-1">
              ADR ₹13,140 · RevPAR ₹10,240
            </p>
          </CardContent>
        </Card>

        {/* AI Action Cards */}
        <Card className="hover:border-gold-300 border-gold-200/80 bg-gold-50/20 transition-all">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-gold-950">AI Action Queue</span>
            <div className="p-2 rounded-lg bg-gold-100 text-gold-800 animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gold-950">3 Cards</span>
              <Badge variant="gold" className="text-[10px] py-0 px-1.5">
                1 High-Impact
              </Badge>
            </div>
            <p className="text-[11px] text-sand-600 mt-1">
              Rate surge, chiller service, flour stock
            </p>
          </CardContent>
        </Card>

        {/* Staff on Duty */}
        <Card className="hover:border-sage-300 transition-all">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-sand-600">On-Duty Workforce</span>
            <div className="p-2 rounded-lg bg-sage-50 text-sage-700">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-sand-950">42 / 48</span>
              <span className="text-xs font-medium text-sage-700">92% Turnout</span>
            </div>
            <p className="text-[11px] text-sand-500 mt-1">
              Morning shift · 6 staff on break
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Interactive AI Action Queue Section */}
      <div id="action-queue" className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-sand-950 font-serif">
                AI Action Queue
              </h2>
              <Badge variant="gold" className="text-xs">
                Manager Decides
              </Badge>
            </div>
            <p className="text-xs text-sand-600 mt-0.5">
              Suggestions generated by Prophet demand model, BMS survival analysis, and inventory thresholds.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-sand-100 p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeTab === "all" ? "bg-white text-sand-950 shadow-xs font-semibold" : "text-sand-600"
              }`}
            >
              All (3)
            </button>
            <button
              onClick={() => setActiveTab("revenue")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeTab === "revenue" ? "bg-white text-sand-950 shadow-xs font-semibold" : "text-sand-600"
              }`}
            >
              Revenue (1)
            </button>
            <button
              onClick={() => setActiveTab("maintenance")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeTab === "maintenance" ? "bg-white text-sand-950 shadow-xs font-semibold" : "text-sand-600"
              }`}
            >
              Maintenance (1)
            </button>
            <button
              onClick={() => setActiveTab("staffing")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeTab === "staffing" ? "bg-white text-sand-950 shadow-xs font-semibold" : "text-sand-600"
              }`}
            >
              Inventory (1)
            </button>
          </div>
        </div>

        {/* Featured High-Impact Action Card */}
        {cardStatus === "pending" && (
          <Card className="border-gold-300 bg-gradient-to-br from-white via-white to-gold-50/30 shadow-card relative overflow-hidden transition-all">
            <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-gradient-to-b from-gold-400 to-gold-600" />

            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="gold" className="text-xs px-2 py-0.5">
                    HIGH-IMPACT APPROVAL
                  </Badge>
                  <span className="text-xs font-medium text-sand-500">
                    Engine: Revenue Forecaster (Prophet + XGBoost)
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-sand-600 font-medium">Confidence:</span>
                  <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    94%
                  </span>
                  <span className="text-sand-400">·</span>
                  <span className="text-amber-800 font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> 3h remaining
                  </span>
                </div>
              </div>

              <CardTitle className="text-xl text-sand-950 mt-2 font-serif">
                Increase Weekend Ocean Deluxe Rate by 12% (₹16,500 → ₹18,500)
              </CardTitle>
              <CardDescription className="text-sand-600">
                Saturday occupancy is trending 18% ahead of seasonal average due to Bandra Music Festival. Competitor ADR surged 15%.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Financial & Demand Drivers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-sand-50/80 border border-sand-200 text-xs">
                <div>
                  <span className="text-sand-500 block">Est. Revenue Lift</span>
                  <span className="text-base font-bold text-sand-950 font-serif">+₹1,44,000</span>
                  <span className="text-[10px] text-emerald-700">Across 36 Deluxe rooms</span>
                </div>
                <div>
                  <span className="text-sand-500 block">Projected Occupancy</span>
                  <span className="text-base font-bold text-sand-950 font-serif">96%</span>
                  <span className="text-[10px] text-sand-600">No adverse drop predicted</span>
                </div>
                <div>
                  <span className="text-sand-500 block">Competitive Index</span>
                  <span className="text-base font-bold text-sand-950 font-serif">1.04 ADR</span>
                  <span className="text-[10px] text-sand-600">Aligned with Juhu beachfront set</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="text-xs text-sand-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-gold-600" />
                  <span>Requires General Manager / Owner clearance. 10s safe undo enabled.</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDismissAction}
                    className="text-sand-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Dismiss
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      showToast({
                        title: "Rate Adjustment Slider Opened",
                        description: "Fine-tune rate override between +5% and +20%.",
                        type: "default",
                      })
                    }
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
                    Adjust (+10% / +15%)
                  </Button>
                  <Button
                    variant="gold"
                    size="sm"
                    onClick={handleApproveAction}
                    className="shadow-gold"
                  >
                    <Check className="w-4 h-4 mr-1 text-sand-950" />
                    Approve Rate Surge (1 Tap)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {cardStatus === "approved" && (
          <div className="p-5 rounded-xl border border-emerald-300 bg-emerald-50/50 flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-emerald-950">
                  Rate Adjustment Executed (Weekend Ocean Deluxe +12%)
                </h4>
                <p className="text-xs text-emerald-800">
                  Published to PMS channel manager. Logged to immutable audit trail by {user.name}.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCardStatus("pending");
                showToast({
                  title: "Action Card Restored",
                  description: "Rate reverted to previous price card.",
                  type: "default",
                });
              }}
            >
              Reset Card
            </Button>
          </div>
        )}

        {cardStatus === "dismissed" && (
          <div className="p-4 rounded-xl border border-sand-200 bg-sand-50 flex items-center justify-between">
            <span className="text-xs text-sand-600">Card dismissed. Click to re-open for demo testing.</span>
            <Button variant="ghost" size="sm" onClick={() => setCardStatus("pending")}>
              Undo Dismiss
            </Button>
          </div>
        )}

        {/* Secondary Action Cards (Maintenance & Inventory) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Maintenance Card */}
          <Card className="hover:border-sand-300 transition-all">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <Badge variant="sand" className="text-[10px]">
                  PREVENTIVE MAINTENANCE
                </Badge>
                <span className="text-[11px] text-sand-500 font-medium">BMS Anomaly Model</span>
              </div>
              <CardTitle className="text-base font-serif mt-1">
                Schedule Chiller #2 Bearing Service on Tuesday
              </CardTitle>
              <CardDescription className="text-xs">
                Vibration frequency rising (+8% week-over-week). Schedule maintenance during low occupancy window (Tuesday 11:00 AM).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-center justify-between pt-3 border-t border-sand-100">
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                  Avoids ₹85,000 emergency repair
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    showToast({
                      title: "Work Order Scheduled",
                      description: "Assigned to Engineering Lead Rajesh Verma for Tuesday 11 AM.",
                      type: "success",
                    })
                  }
                >
                  Approve Schedule
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Inventory Reorder Card */}
          <Card className="hover:border-sand-300 transition-all">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <Badge variant="sage" className="text-[10px]">
                  INVENTORY REORDER
                </Badge>
                <span className="text-[11px] text-sand-500 font-medium">Auto Stock Model</span>
              </div>
              <CardTitle className="text-base font-serif mt-1">
                Approve PO: Organic Coffee Beans (25kg)
              </CardTitle>
              <CardDescription className="text-xs">
                Store inventory crossed minimum threshold of 5kg following breakfast banquet rush. Supplier turnaround: 24h.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-center justify-between pt-3 border-t border-sand-100">
                <span className="text-xs font-semibold text-sand-900">₹18,500 · Blue Tokai</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    showToast({
                      title: "Purchase Order Dispatched",
                      description: "PO #PO-941 sent to approved supplier via WhatsApp Business connector.",
                      type: "success",
                    })
                  }
                >
                  Dispatch PO
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Housekeeping Live Room Board Breakdown */}
      <div id="housekeeping" className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-sand-950 font-serif">
              Floor & Room Status Breakdown
            </h3>
            <p className="text-xs text-sand-600">
              Live room readiness fed from staff mobile apps across Ocean Wing and Palm Wing.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Ready: 112
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Cleaning: 18
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Dirty: 15
            </span>
          </div>
        </div>

        <Card className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
            {[
              { num: "401", status: "ready", type: "Deluxe Ocean" },
              { num: "402", status: "cleaning", type: "Deluxe Ocean" },
              { num: "403", status: "ready", type: "Deluxe Ocean" },
              { num: "404", status: "dirty", type: "Club Suite" },
              { num: "405", status: "ready", type: "Club Suite" },
              { num: "406", status: "ready", type: "Deluxe Ocean" },
              { num: "407", status: "cleaning", type: "Executive Suite" },
              { num: "408", status: "ready", type: "Executive Suite" },
              { num: "409", status: "ready", type: "Deluxe Ocean" },
              { num: "410", status: "dirty", type: "Deluxe Ocean" },
              { num: "411", status: "ready", type: "Deluxe Ocean" },
              { num: "412", status: "cleaning", type: "Ocean Villa" },
              { num: "413", status: "ready", type: "Ocean Villa" },
              { num: "414", status: "ready", type: "Deluxe Garden" },
              { num: "415", status: "dirty", type: "Deluxe Garden" },
              { num: "416", status: "ready", type: "Deluxe Garden" },
            ].map((room) => (
              <div
                key={room.num}
                onClick={() =>
                  showToast({
                    title: `Room ${room.num} (${room.type})`,
                    description: `Current Status: ${room.status.toUpperCase()}. Attendant: Ramesh Patil.`,
                    type: "default",
                  })
                }
                className={`p-2.5 rounded-lg border text-center cursor-pointer transition-all hover:scale-102 shadow-xs ${
                  room.status === "ready"
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                    : room.status === "cleaning"
                    ? "bg-amber-50/80 border-amber-200 text-amber-900"
                    : "bg-rose-50/70 border-rose-200 text-rose-900"
                }`}
              >
                <span className="text-xs font-bold block">{room.num}</span>
                <span className="text-[10px] capitalize font-medium opacity-90 block">
                  {room.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
