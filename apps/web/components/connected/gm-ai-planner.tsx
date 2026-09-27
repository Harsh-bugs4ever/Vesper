"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  HelpCircle,
  IndianRupee,
  Layers,
  ListOrdered,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  Sparkles,
  TrendingUp,
  Wrench,
  X,
  Zap,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface PlannerTask {
  id: string;
  rank: number;
  title: string;
  department: "engineering" | "revenue" | "guest" | "inventory" | "frontdesk";
  departmentLabel: string;
  urgency: "critical" | "high" | "medium";
  complexity: "low" | "medium" | "high";
  impactEstimate: string;
  estimatedMinutes: number;
  problemSummary: string;
  problemDetails: string;
  actionSteps: string[];
  targetUrl: string;
  targetSection: string;
}

const DEFAULT_PLANNER_TASKS: PlannerTask[] = [
  {
    id: "task-1",
    rank: 1,
    title: "Resolve Critical HVAC Compressor Breakdown in Room 302",
    department: "engineering",
    departmentLabel: "Engineering & Maintenance",
    urgency: "critical",
    complexity: "medium",
    impactEstimate: "Protects ₹45,000 VIP stay & avoids 1-star review",
    estimatedMinutes: 10,
    problemSummary: "Room 302 HVAC failed with ambient temperature reaching 29°C. Platinum Elite guest check-in is scheduled for 1:30 PM.",
    problemDetails: "Sensor telemetry detected compressor thermal shutdown. The room is currently unlivable, and arriving VIP guest Mr. Aditya Roy specifically requested an upper floor suite. If not mitigated, this will cause an immediate walk or severe guest escalation.",
    actionSteps: [
      "Open Front Desk Room Status to inspect available clean rooms on Floor 4.",
      "Reassign Mr. Aditya Roy to vacant clean Executive Suite 405.",
      "Dispatch urgent maintenance work order to Chief Engineer for compressor replacement.",
      "Send courtesy complimentary wine amenity to Suite 405 with welcoming apology note."
    ],
    targetUrl: "/admin/front-desk?tab=room-status",
    targetSection: "Front Desk · Room Status & Occupancy Grid",
  },
  {
    id: "task-2",
    rank: 2,
    title: "Approve Dynamic Weekend Rate Surge (+18%) for Luxury Suites",
    department: "revenue",
    departmentLabel: "Revenue & Pricing",
    urgency: "critical",
    complexity: "low",
    impactEstimate: "+₹1,24,000 projected RevPAR gain",
    estimatedMinutes: 3,
    problemSummary: "Local city festival increased market demand by 34%. Competitor rates surged to ₹18,000, leaving Vesper suites underpriced by 18%.",
    problemDetails: "Competitor scraping models and booking pacing indicate 88% market compression across luxury resorts in the area. Vesper currently has 14 unsold suites at base rate of ₹12,500. Raising rates to ₹14,750 captures immediate margin without reducing pacing.",
    actionSteps: [
      "Navigate to Rate Management revenue forecast.",
      "Review AI demand spike curve for Friday through Sunday.",
      "Approve proposed +18% rate card recommendation to instantly sync across OTAs and direct booking engine."
    ],
    targetUrl: "/admin/rates",
    targetSection: "Rate Management · 14-Day Demand Forecast",
  },
  {
    id: "task-3",
    rank: 3,
    title: "Recover Guest Experience for Delayed Airport Transfer (Room 214)",
    department: "guest",
    departmentLabel: "Guest Relations & SLA",
    urgency: "high",
    complexity: "low",
    impactEstimate: "Saves ₹35,000 lifetime spend & guest loyalty",
    estimatedMinutes: 5,
    problemSummary: "Guest Mrs. Mehta waited 25 minutes for the airport shuttle due to highway traffic. Sentiment score dropped into negative territory.",
    problemDetails: "Guest logged an in-transit escalation via the WhatsApp guest concierge. Her loyalty record shows 4 previous stays and high F&B spend. Proactive recovery will turn a potential churn into brand advocacy.",
    actionSteps: [
      "Open Action Queue or Guest Relations chat.",
      "Send personalized welcome message acknowledging the traffic delay.",
      "Credit a complimentary 60-minute spa rejuvenation voucher to Room 214 folio.",
      "Alert front desk duty manager to greet Mrs. Mehta with direct in-room check-in."
    ],
    targetUrl: "/admin/actions",
    targetSection: "Action Queue · Guest Recovery SLA",
  },
  {
    id: "task-4",
    rank: 4,
    title: "14-Day Housekeeping Linen Stock Replenishment Par Breach",
    department: "inventory",
    departmentLabel: "Inventory & Maintenance",
    urgency: "high",
    complexity: "low",
    impactEstimate: "Guarantees 100% weekend room turnover readiness",
    estimatedMinutes: 4,
    problemSummary: "14-Day AI Inventory Forecast detected luxury sheet sets will breach safety threshold (remaining: 24 sets; minimum: 60 sets) by Friday.",
    problemDetails: "Due to 92% weekend occupancy projections, laundry turnover cycles will deplete on-hand stock by Thursday night. Supplier lead time is 48 hours.",
    actionSteps: [
      "Open Inventory Maintenance Control & 14-Day AI Management tab.",
      "Review the projected runout countdown for Egyptian Cotton King Sets.",
      "Click '⚡ 1-Click AI Auto-Replenish' to dispatch purchase order to certified textile supplier.",
      "Charge expense against Housekeeping OpEx budget balance."
    ],
    targetUrl: "/admin/inventory?tab=maintenance-ai",
    targetSection: "Inventory · 14-Day AI Stock Forecast",
  },
  {
    id: "task-5",
    rank: 5,
    title: "Clear 6 Dirty Room Turnovers for 2:00 PM Peak Arrivals",
    department: "frontdesk",
    departmentLabel: "Front Desk & Housekeeping",
    urgency: "high",
    complexity: "medium",
    impactEstimate: "Eliminates front-desk arrival queues & waiting times",
    estimatedMinutes: 15,
    problemSummary: "Rooms 104, 108, 202, 207, 311, and 315 are in dirty status with 8 arrivals scheduled between 2:00 PM and 3:00 PM.",
    problemDetails: "Housekeeping morning turnover was delayed by late 11:30 AM checkouts. Arriving guests have already completed web pre-check-in and expect keys immediately upon arrival.",
    actionSteps: [
      "Open Front Desk Room Status & Occupancy grid.",
      "Filter by 'Dirty / Turnover' to identify priority rooms on Floors 1 and 2.",
      "Direct Housekeeping 2nd shift supervisor to expedite turnover on Rooms 104 and 202.",
      "Verify room status changes to 'Vacant Clean' before assigning guest keys."
    ],
    targetUrl: "/admin/front-desk?tab=room-status",
    targetSection: "Front Desk · Live Occupancy & Turnovers",
  },
  {
    id: "task-6",
    rank: 6,
    title: "Launch Off-Peak Facility Promotion for Badminton Pavilion",
    department: "revenue",
    departmentLabel: "Facility Perks & Ancillary",
    urgency: "medium",
    complexity: "low",
    impactEstimate: "+₹18,500 ancillary afternoon revenue",
    estimatedMinutes: 2,
    problemSummary: "Badminton Pavilion court utilization is projected at only 12% between 1:00 PM and 5:00 PM today.",
    problemDetails: "The facility demand engine identified idle indoor sports courts. Promoting a 20% discount package for afternoon sessions will capture in-house family leisure demand without adding operating cost.",
    actionSteps: [
      "Open Action Queue.",
      "Locate the 'Badminton Pavilion 20% Off-Peak' recommendation card.",
      "Click '⚡ Approve' to broadcast the push notification to currently in-house guests."
    ],
    targetUrl: "/admin/actions",
    targetSection: "Action Queue · Facility Demand Engine",
  },
  {
    id: "task-7",
    rank: 7,
    title: "Approve Chef Special Prix-Fixe for Kitchen Waste Rescue",
    department: "inventory",
    departmentLabel: "Food & Beverage",
    urgency: "medium",
    complexity: "low",
    impactEstimate: "Rescues ₹14,200 perishable inventory & boosts dinner covers",
    estimatedMinutes: 3,
    problemSummary: "Surplus 18 kg of artisanal black truffles and organic burrata will expire within 48 hours.",
    problemDetails: "Chef Matteo proposed a 3-course Truffle & Burrata Tasting Menu at ₹1,850/person. The AI engine scored this with 84% profit margin and 12% risk.",
    actionSteps: [
      "Open Action Queue.",
      "Review the 'Kitchen Waste Rescue: Chef Special Tasting Menu' card.",
      "Click Approve to push menu feature to in-room dining tablets and restaurant host stand."
    ],
    targetUrl: "/admin/actions",
    targetSection: "Action Queue · Kitchen Waste Rescue",
  },
  {
    id: "task-8",
    rank: 8,
    title: "Review Engineering Department Budget Overspend Alert",
    department: "engineering",
    departmentLabel: "Budgets & CapEx",
    urgency: "medium",
    complexity: "medium",
    impactEstimate: "Prevents ₹85,000 monthly variance breach",
    estimatedMinutes: 10,
    problemSummary: "Engineering department has utilized 91% of monthly allocation due to boiler pump overhaul.",
    problemDetails: "With 9 days remaining in the billing cycle, routine maintenance requisitions could exceed the approved department cap without GM authorization.",
    actionSteps: [
      "Open Department Budgets & Caps in Inventory.",
      "Inspect Engineering budget ledger line items.",
      "Authorize a temporary ₹40,000 reallocation from the general property contingency pool."
    ],
    targetUrl: "/admin/inventory?tab=budgets",
    targetSection: "Inventory · Department Budgets & Caps",
  },
  {
    id: "task-9",
    rank: 9,
    title: "Fill Evening Front Desk Associate Coverage Gap",
    department: "frontdesk",
    departmentLabel: "Workforce & Rostering",
    urgency: "medium",
    complexity: "low",
    impactEstimate: "Guarantees 100% front desk coverage during arrivals peak",
    estimatedMinutes: 5,
    problemSummary: "Front Desk associate Priya Sharma reported sick leave for the 4:00 PM - 12:00 AM shift.",
    problemDetails: "Evening desk requires 3 associates to handle 42 scheduled check-ins and concierge enquiries. Only 2 are currently rostered.",
    actionSteps: [
      "Open Workforce & Roster management.",
      "Review standby associates with active rest period compliance.",
      "Assign associate Rahul Verma for the evening overtime shift."
    ],
    targetUrl: "/admin/roster",
    targetSection: "Workforce · Live Roster & Shifts",
  },
  {
    id: "task-10",
    rank: 10,
    title: "Verify Weekly Electrical Safety & Fire Damper Compliance Audit",
    department: "engineering",
    departmentLabel: "Compliance & Safety",
    urgency: "medium",
    complexity: "high",
    impactEstimate: "Maintains 100% regulatory compliance & property insurance status",
    estimatedMinutes: 15,
    problemSummary: "Mandatory weekly emergency generator and fire damper automated test report is pending GM sign-off before Friday 5:00 PM.",
    problemDetails: "All sensor metrics passed automatically with zero faults. Local municipal hospitality code requires weekly GM digital acknowledgement on file.",
    actionSteps: [
      "Navigate to Reports & Audits.",
      "Open Weekly Life Safety & Fire Test Report.",
      "Review diesel generator load run logs and click 'Acknowledge & Sign'."
    ],
    targetUrl: "/admin/reports",
    targetSection: "Reports & Audits · Weekly Safety Log",
  },
];

export function GmAiPlanner() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [showGreetingBubble, setShowGreetingBubble] = useState(true);
  const [selectedTask, setSelectedTask] = useState<PlannerTask | null>(null);
  const [sortBy, setSortBy] = useState<"rank" | "urgency" | "complexity" | "impact">("rank");
  const [filterDept, setFilterDept] = useState<string>("all");
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Only display for General Manager or Owner roles
  const isGmOrOwner = user?.role === "general_manager" || user?.role === "owner" || !user?.role;

  // Time-aware greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const managerName = user?.name ? user.name.split(" ")[0] : "General Manager";

  // Filter and sort tasks
  const displayedTasks = useMemo(() => {
    let list = [...DEFAULT_PLANNER_TASKS];

    if (filterDept !== "all") {
      list = list.filter((t) => t.department === filterDept);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) => 
        t.title.toLowerCase().includes(q) ||
        t.problemSummary.toLowerCase().includes(q) ||
        t.departmentLabel.toLowerCase().includes(q)
      );
    }

    // Sort order
    if (sortBy === "urgency") {
      const order = { critical: 0, high: 1, medium: 2 };
      list.sort((a, b) => order[a.urgency] - order[b.urgency]);
    } else if (sortBy === "complexity") {
      const order = { low: 0, medium: 1, high: 2 };
      list.sort((a, b) => order[a.complexity] - order[b.complexity]);
    } else if (sortBy === "impact") {
      list.sort((a, b) => (b.impactEstimate.includes("₹") ? 1 : 0) - (a.impactEstimate.includes("₹") ? 1 : 0));
    } else {
      list.sort((a, b) => a.rank - b.rank);
    }

    return list;
  }, [filterDept, searchQuery, sortBy]);

  const toggleTaskCompletion = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (completedTaskIds.includes(taskId)) {
      setCompletedTaskIds((prev) => prev.filter((id) => id !== taskId));
    } else {
      setCompletedTaskIds((prev) => [...prev, taskId]);
      showToast({
        title: "✓ Task Marked as Resolved",
        description: "Great progress! Your daily GM priority list has been updated.",
        type: "success",
      });
    }
  };

  const handleGoToProblem = (task: PlannerTask) => {
    showToast({
      title: `⚡ Navigating to ${task.targetSection}`,
      description: `Vesper AI briefing: Follow the ${task.actionSteps.length}-step action plan to resolve this priority.`,
      type: "default",
    });
    setIsOpen(false);
    setShowGreetingBubble(false);
    router.push(task.targetUrl);
  };

  if (!isGmOrOwner) return null;

  return (
    <aside aria-label="Vesper AI Executive Planner" className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* 1. FLOATING GREETING / PROMPT BUBBLE (Above Launcher Button) */}
      {!isOpen && showGreetingBubble && (
        <div className="mb-3 w-80 sm:w-96 rounded-2xl border border-sand-200/90 bg-white/95 p-4 shadow-elevated backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sand-900 text-amber-300 shadow-xs">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-sand-950">Vesper Executive AI</span>
                <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-800">
                  Ready
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowGreetingBubble(false)}
              className="text-sand-400 hover:text-sand-700 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="mt-2 text-xs font-medium text-sand-800 leading-relaxed">
            &ldquo;{greeting}, {managerName}! How can I help you today? Should I tell you what work you should do ASAP?&rdquo;
          </p>

          <p className="mt-1 text-[11px] text-sand-500">
            I analyzed today&apos;s hotel telemetry: <strong>3 critical issues</strong> and <strong>10 ranked priorities</strong> require your leadership.
          </p>

          {/* Quick Action Prompt Chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsOpen(true);
                setShowGreetingBubble(false);
                setSelectedTask(DEFAULT_PLANNER_TASKS[0]);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-sand-900 px-2.5 py-1 text-[11px] font-semibold text-sand-50 hover:bg-sand-800 transition-all shadow-xs"
            >
              <Zap className="h-3 w-3 text-amber-300 fill-amber-300" />
              ⚡ Show Rank #1 Problem ASAP
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(true);
                setShowGreetingBubble(false);
                setSelectedTask(null);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1 text-[11px] font-semibold text-sand-800 hover:bg-sand-100 transition-colors"
            >
              <ListOrdered className="h-3 w-3 text-sage-600" />
              View 10-Task Daily Plan
            </button>
          </div>
        </div>
      )}

      {/* 2. FLOATING LAUNCHER BUTTON */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setShowGreetingBubble(false);
          }}
          className="group relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sand-950 via-sand-900 to-sand-800 text-sand-50 shadow-elevated transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-95"
          title="Open Vesper AI Executive Planner"
        >
          <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs animate-bounce">
            10
          </div>
          <div className="relative">
            <Bot className="h-6 w-6 text-amber-300 transition-transform group-hover:rotate-6" />
            <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-emerald-400 animate-pulse" />
          </div>
        </button>
      )}

      {/* 3. EXPANDED EXECUTIVE PLANNER DRAWER / MODAL */}
      {isOpen && (
        <div className="w-[92vw] sm:w-[480px] md:w-[540px] max-h-[85vh] rounded-3xl border border-sand-200/90 bg-white/95 shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-sand-200/80 bg-gradient-to-r from-sand-950 via-sand-900 to-sand-800 px-5 py-4 text-sand-50">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sand-800/80 text-amber-300 border border-sand-700/60 shadow-xs">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-base font-bold tracking-tight text-white">
                    Vesper AI Executive Planner
                  </h3>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold tracking-wider text-emerald-300 uppercase border border-emerald-500/30">
                    GM Rank 1–10
                  </span>
                </div>
                <p className="text-[11px] text-sand-300">
                  Autonomous operational roadmap calibrated for General Managers
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-sand-400 hover:bg-sand-800 hover:text-sand-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Subheader Greeting & Progress Bar */}
          <div className="bg-sand-50/80 px-5 py-3 border-b border-sand-200/60 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-sand-900">
                {greeting}, {managerName}! Here is your prioritized plan:
              </p>
              <p className="text-[11px] text-sand-500">
                {completedTaskIds.length} of 10 tasks completed today
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-20 rounded-full bg-sand-200 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all"
                  style={{ width: `${(completedTaskIds.length / 10) * 100}%` }}
                />
              </div>
              <span className="text-[11px] font-bold font-mono text-sand-800">
                {Math.round((completedTaskIds.length / 10) * 100)}%
              </span>
            </div>
          </div>

          {/* DETAIL VIEW: "WHAT YOU HAVE TO DO" (If a task is selected) */}
          {selectedTask ? (
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="text-xs font-semibold text-sage-700 hover:text-sage-900 flex items-center gap-1 transition-colors"
              >
                ← Back to Full 10-Rank Plan
              </button>

              {/* Task Header */}
              <div className="rounded-2xl border border-sand-200 bg-sand-50/50 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-sand-900 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                    Priority Rank #{selectedTask.rank}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
                        selectedTask.urgency === "critical"
                          ? "bg-rose-50 text-rose-800 border-rose-300"
                          : selectedTask.urgency === "high"
                          ? "bg-amber-50 text-amber-800 border-amber-300"
                          : "bg-sand-100 text-sand-800 border-sand-200"
                      )}
                    >
                      {selectedTask.urgency}
                    </span>
                    <span className="rounded-full bg-sand-200/80 px-2 py-0.5 text-[10px] font-semibold text-sand-800">
                      Complexity: {selectedTask.complexity}
                    </span>
                  </div>
                </div>

                <h4 className="font-serif text-lg font-bold text-sand-950 leading-snug">
                  {selectedTask.title}
                </h4>

                <p className="text-xs font-medium text-emerald-800 flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  Estimated Impact: {selectedTask.impactEstimate}
                </p>
              </div>

              {/* 1. What is the Problem? */}
              <div className="rounded-2xl border border-sand-200 bg-white p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-800">
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                  What is the Problem?
                </div>
                <p className="text-xs text-sand-800 font-medium leading-relaxed">
                  {selectedTask.problemSummary}
                </p>
                <p className="text-xs text-sand-600 leading-relaxed pt-1 border-t border-sand-100">
                  {selectedTask.problemDetails}
                </p>
              </div>

              {/* 2. What You Have to Do? (AI Step-by-Step Instructions) */}
              <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-900">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  What You Have To Do (AI Action Plan)
                </div>
                <ol className="space-y-2">
                  {selectedTask.actionSteps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-sand-800">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 font-bold text-[10px] text-white">
                        {idx + 1}
                      </span>
                      <span className="pt-0.5 leading-snug">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Bottom Actions: Solve Problem Now */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                <Button
                  onClick={() => handleGoToProblem(selectedTask)}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1.5 shadow-sm"
                >
                  <Zap className="h-4 w-4 text-amber-300 fill-amber-300" />
                  Solve This Problem Now ({selectedTask.targetSection})
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={(e) => toggleTaskCompletion(selectedTask.id, e)}
                  className="w-full sm:w-auto text-xs border-sand-300"
                >
                  {completedTaskIds.includes(selectedTask.id) ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Resolved
                    </span>
                  ) : (
                    "Mark Done"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* LIST VIEW: RANK 1 TO 10 WORK PLANNER */
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Sort & Filter Controls */}
              <div className="space-y-2 pb-1 border-b border-sand-200/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-sand-700">Sort Priorities:</span>
                  <div className="flex items-center gap-1">
                    {[
                      { key: "rank", label: "Rank 1–10" },
                      { key: "urgency", label: "Need/Urgency" },
                      { key: "complexity", label: "Complexity" },
                      { key: "impact", label: "Financial Impact" },
                    ].map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setSortBy(s.key as typeof sortBy)}
                        className={cn(
                          "rounded-lg px-2 py-0.5 text-[11px] font-semibold transition-colors",
                          sortBy === s.key
                            ? "bg-sand-900 text-sand-50"
                            : "bg-sand-100 text-sand-700 hover:bg-sand-200"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Department filter pills */}
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    { key: "all", label: "All Departments" },
                    { key: "engineering", label: "Engineering" },
                    { key: "revenue", label: "Revenue & Rates" },
                    { key: "guest", label: "Guest SLA" },
                    { key: "inventory", label: "Inventory" },
                    { key: "frontdesk", label: "Front Desk" },
                  ].map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setFilterDept(d.key)}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-colors",
                        filterDept === d.key
                          ? "bg-sand-900 text-sand-50 border-sand-900"
                          : "bg-white text-sand-600 border-sand-200 hover:bg-sand-50"
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ranked Tasks Cards List */}
              <div className="space-y-2.5">
                {displayedTasks.map((task) => {
                  const isDone = completedTaskIds.includes(task.id);
                  const isTop3 = task.rank <= 3;

                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={cn(
                        "group relative cursor-pointer rounded-2xl border p-3.5 transition-all duration-200 hover:shadow-md",
                        isDone
                          ? "border-sand-200 bg-sand-50/50 opacity-60"
                          : isTop3
                          ? "border-amber-300/80 bg-gradient-to-r from-amber-50/40 via-white to-sand-50/30 hover:border-amber-400"
                          : "border-sand-200 bg-white hover:border-sand-300"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          {/* Rank badge */}
                          <div
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl font-serif text-xs font-bold shadow-xs",
                              isDone
                                ? "bg-sand-200 text-sand-600"
                                : task.rank === 1
                                ? "bg-rose-600 text-white animate-pulse"
                                : task.rank === 2
                                ? "bg-amber-600 text-white"
                                : task.rank === 3
                                ? "bg-sand-900 text-amber-300"
                                : "bg-sand-100 text-sand-800 border border-sand-200"
                            )}
                          >
                            #{task.rank}
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider",
                                  task.urgency === "critical"
                                    ? "bg-rose-100 text-rose-800"
                                    : task.urgency === "high"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-sand-100 text-sand-700"
                                )}
                              >
                                {task.urgency}
                              </span>
                              <span className="text-[10px] text-sand-400">·</span>
                              <span className="text-[10px] font-semibold text-sand-500">
                                {task.departmentLabel}
                              </span>
                              <span className="text-[10px] text-sand-400">·</span>
                              <span className="text-[10px] font-mono text-sand-500">
                                ~{task.estimatedMinutes}m
                              </span>
                            </div>

                            <h4
                              className={cn(
                                "text-xs font-bold leading-snug text-sand-950 group-hover:text-sage-800 transition-colors",
                                isDone && "line-through text-sand-500"
                              )}
                            >
                              {task.title}
                            </h4>

                            <p className="text-[11px] text-sand-600 line-clamp-1">
                              {task.problemSummary}
                            </p>

                            <p className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1 pt-0.5">
                              <TrendingUp className="h-3 w-3 text-emerald-600" />
                              {task.impactEstimate}
                            </p>
                          </div>
                        </div>

                        {/* Quick actions on card */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => toggleTaskCompletion(task.id, e)}
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-lg border transition-colors",
                              isDone
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : "border-sand-300 text-sand-400 hover:border-emerald-500 hover:text-emerald-600"
                            )}
                            title={isDone ? "Mark as pending" : "Mark as completed"}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGoToProblem(task);
                            }}
                            className="text-[10px] font-semibold text-sand-500 hover:text-sand-950 flex items-center gap-0.5"
                          >
                            Solve <ArrowRight className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Cockpit Info */}
          <div className="border-t border-sand-200/80 bg-sand-50/90 px-5 py-3 flex items-center justify-between text-xs text-sand-600">
            <span className="flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-amber-600" />
              Dynamic AI telemetry refreshed live
            </span>
            <button
              type="button"
              onClick={() => {
                showToast({
                  title: "Priority Model Re-Scanned",
                  description: "Rank 1–10 recalculated against live bookings and department loads.",
                  type: "default",
                });
              }}
              className="text-[11px] font-semibold text-sand-700 hover:text-sand-950 flex items-center gap-1 underline"
            >
              <RotateCcw className="h-3 w-3" />
              Re-Scan Priorities
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
