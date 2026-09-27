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


export const DEPARTMENT_PLANNER_TASKS: Record<string, PlannerTask[]> = {
  front_office: [
    {
      id: "fo-task-1",
      rank: 1,
      title: "Pre-Allocate Platinum Elite VIP Arrival Suites (Room 201 & Room 501)",
      department: "frontdesk",
      departmentLabel: "Front Desk & Concierge",
      urgency: "critical",
      complexity: "medium",
      impactEstimate: "Protects ₹2,43,000 VIP stay & brand advocacy",
      estimatedMinutes: 5,
      problemSummary: "Two Platinum VIP guests arriving at 1:30 PM with special requests for upper-floor sea-facing suites.",
      problemDetails: "Suite 201 and Suite 501 are currently inspected and ready. Pre-allocating them in the PMS prevents double-assignment during afternoon check-in rushes and enables pre-arrival keycard coding.",
      actionSteps: [
        "Open Front Desk Room Status grid.",
        "Verify Suite 201 and Suite 501 are vacant and inspected.",
        "Assign VIP profiles and dispatch welcome tea amenity to the floor butler.",
      ],
      targetUrl: "/admin/front-desk?tab=room-status",
      targetSection: "Front Desk · Room Status & Occupancy Grid",
    },
    {
      id: "fo-task-2",
      rank: 2,
      title: "Prepare for Friday Peak 2:00 PM – 5:00 PM Arrival Window (45 Check-ins)",
      department: "frontdesk",
      departmentLabel: "Front Desk Operations",
      urgency: "critical",
      complexity: "low",
      impactEstimate: "Keeps lobby check-in wait time under 3 minutes",
      estimatedMinutes: 8,
      problemSummary: "Flight arrival clusters from Mumbai and Delhi will produce 45 arrivals between 2:00 PM and 5:00 PM.",
      problemDetails: "Current front desk roster has 4 agents on duty. With 45 arrivals arriving in a 3-hour cluster, queue times will exceed 9 minutes unless 2 greeting agents are positioned at the lobby lounge.",
      actionSteps: [
        "Review today's arrivals schedule and filter by afternoon time slots.",
        "Position 2 mobile tablet check-in agents in the main greeting rotunda.",
        "Offer signature welcome cold towels and iced kokum cooler to waiting guests.",
      ],
      targetUrl: "/admin/front-desk?tab=arrivals",
      targetSection: "Front Desk · Today's Arrivals Schedule",
    },
    {
      id: "fo-task-3",
      rank: 3,
      title: "Resolve Outstanding Folio Balance for Departing Corporate Guest (Room 103)",
      department: "frontdesk",
      departmentLabel: "Front Desk Cashiering",
      urgency: "high",
      complexity: "low",
      impactEstimate: "Finalizes ₹28,900 billing before express checkout",
      estimatedMinutes: 4,
      problemSummary: "Guest Priya Singhania scheduled checkout at 12:00 PM with unbilled laundry and room service charges.",
      problemDetails: "Unposted F&B charge of ₹4,200 from night needs to be posted to the folio before corporate GST invoice generation.",
      actionSteps: [
        "Open Front Desk In-House ledger.",
        "Select Room 103 stay record and inspect pending ledger postings.",
        "Click 'Check Out' or finalize corporate GST invoice.",
      ],
      targetUrl: "/admin/front-desk?tab=in-house",
      targetSection: "Front Desk · In-House Folios",
    },
    {
      id: "fo-task-4",
      rank: 4,
      title: "Approve Early Check-in Requests for Morning Flight Arrivals",
      department: "frontdesk",
      departmentLabel: "Guest Reservations",
      urgency: "medium",
      complexity: "low",
      impactEstimate: "Elevates guest sentiment rating from 4.2 to 4.9",
      estimatedMinutes: 3,
      problemSummary: "3 incoming guests requested early check-in between 10:00 AM and 11:30 AM.",
      problemDetails: "Rooms 101, 105, and 108 are clean and inspected from night's vacant pool. We can grant complimentary early access.",
      actionSteps: [
        "Open Reservations list and filter by today's date.",
        "Approve early check-in badge and notify guest via WhatsApp concierge.",
      ],
      targetUrl: "/admin/front-desk?tab=list",
      targetSection: "Front Desk · Reservations Ledger",
    },
    {
      id: "fo-task-5",
      rank: 5,
      title: "Sync with Housekeeping on Priority Turnover for Room 104 & Room 205",
      department: "frontdesk",
      departmentLabel: "Inter-Department SLA",
      urgency: "high",
      complexity: "low",
      impactEstimate: "Ensures clean room ready for 1:00 PM early arrival",
      estimatedMinutes: 3,
      problemSummary: "Dirty turnover status on Room 104 and Room 205 blocks 1:00 PM scheduled arrivals.",
      problemDetails: "Housekeeping floor sweep is currently on Floor 3. Re-routing an attendant to Floor 1 expedites turnover by 40 minutes.",
      actionSteps: [
        "Check room status grid to confirm dirty status.",
        "Send express turnover ping to Executive Housekeeper Sunita Pillai.",
      ],
      targetUrl: "/admin/front-desk?tab=room-status",
      targetSection: "Front Desk · Turnover Matrix",
    },
  ],
  housekeeping: [
    {
      id: "hk-task-1",
      rank: 1,
      title: "Expedite Morning Turnover on 12 Priority Checkout Rooms Before 2:00 PM",
      department: "frontdesk",
      departmentLabel: "Housekeeping Operations",
      urgency: "critical",
      complexity: "high",
      impactEstimate: "Guarantees 100% arrival readiness for afternoon check-in wave",
      estimatedMinutes: 10,
      problemSummary: "12 departures this morning have incoming arrivals assigned for 2:00 PM.",
      problemDetails: "Turnover queue currently shows 12 dirty rooms on Floors 1, 2, and 4. Housekeeping teams must prioritize these over stay-over cleanings.",
      actionSteps: [
        "Open Room Status Matrix and filter by Dirty / Turnover.",
        "Dispatch dual-attendant express pairs to priority rooms.",
        "Sign off inspection checklist as each room reaches Ready status.",
      ],
      targetUrl: "/admin/rooms",
      targetSection: "Room Status & Turnaround Matrix",
    },
    {
      id: "hk-task-2",
      rank: 2,
      title: "Reallocate 4 Floor Attendants to South Wing Presidential Suites",
      department: "inventory",
      departmentLabel: "Housekeeping Staffing",
      urgency: "high",
      complexity: "medium",
      impactEstimate: "Guarantees deep inspection compliance for incoming VIP guests",
      estimatedMinutes: 5,
      problemSummary: "VIP Presidential Suite requires intensive 45-point luxury inspection checklist.",
      problemDetails: "Shift roster shows North Wing is overstaffed by 3 attendants while South Wing has 2 vacant suite turnarounds.",
      actionSteps: [
        "Open Staff Roster solver.",
        "Shift 2 attendants from North Wing to South Wing luxury block.",
        "Send task notification to mobile staff app.",
      ],
      targetUrl: "/admin/roster",
      targetSection: "Staff Roster · Shift Allocation",
    },
    {
      id: "hk-task-3",
      rank: 3,
      title: "Activate AI Alternate Path for 400TC King Linen Par Buffer",
      department: "inventory",
      departmentLabel: "Linen & Laundry Control",
      urgency: "high",
      complexity: "low",
      impactEstimate: "Protects weekend room turnover without linen stockout",
      estimatedMinutes: 4,
      problemSummary: "Safety par breached: 14 King sets remaining against 50 minimum buffer.",
      problemDetails: "AI Auto-Order PO-HK-2026-402 is in transit. In the interim, AI Alternate Path recommends releasing 35 sets from Central Pool Buffer.",
      actionSteps: [
        "Open Department Inventory & AI Management tab.",
        "Review AI Alternate Path Contingency note.",
        "Confirm 35 reserve sets issued to floor pantries.",
      ],
      targetUrl: "/admin/inventory?tab=maintenance-ai",
      targetSection: "Inventory · 14-Day AI Management",
    },
    {
      id: "hk-task-4",
      rank: 4,
      title: "Inspect Deep-Clean Turnaround in Deluxe Suite 204",
      department: "frontdesk",
      departmentLabel: "Quality Assurance",
      urgency: "medium",
      complexity: "low",
      impactEstimate: "100% Quality Assurance sign-off for guest arrival",
      estimatedMinutes: 6,
      problemSummary: "Suite 204 turnover completed by attendant; supervisor inspection pending.",
      problemDetails: "Inspection pending status prevents Front Desk from checking in arriving guest Mr. Rohan Mehra.",
      actionSteps: [
        "Inspect spatial 3D room status for Room 204.",
        "Change status from Inspection to Ready.",
      ],
      targetUrl: "/admin/rooms",
      targetSection: "Room Spatial Schematic",
    },
    {
      id: "hk-task-5",
      rank: 5,
      title: "Review & Sign Off 4 Pending Shift Handover Checklist Reports",
      department: "engineering",
      departmentLabel: "Shift Governance",
      urgency: "high",
      complexity: "low",
      impactEstimate: "Handover compliance archived before afternoon shift rotation",
      estimatedMinutes: 4,
      problemSummary: "4 morning shift attendants submitted digital room turnover checklists.",
      problemDetails: "Manager sign-off required to archive daily room hygiene compliance.",
      actionSteps: [
        "Open Department Dashboard.",
        "Inspect submitted shift reports.",
        "Click 'Approve Report' to approve and archive.",
      ],
      targetUrl: "/admin",
      targetSection: "Department Dashboard · Shift Handover Reports",
    },
  ],
  fnb: [
    {
      id: "fnb-task-1",
      rank: 1,
      title: "Verify AI Guest Menu Shield: Barolo 2018 Vintage Auto-Concealed from Tablets",
      department: "inventory",
      departmentLabel: "F&B Guest Experience",
      urgency: "critical",
      complexity: "low",
      impactEstimate: "100% order accuracy; prevents guest disappointment during 0-stock",
      estimatedMinutes: 3,
      problemSummary: "Barolo 2018 Vintage reserve wine reached 0 bottles in on-hand cellar inventory.",
      problemDetails: "Vesper AI Guest Menu Shield automatically concealed the item from the guest in-room tablet menu so guests cannot order it. Sommelier recommends 2019 Brunello di Montalcino as seamless alternate.",
      actionSteps: [
        "Open Department Inventory tab to inspect AI Guest Menu Shield status.",
        "Confirm AI Auto-Order PO-FNB-2026-904 is in transit with wine merchant.",
        "Brief restaurant sommeliers on Brunello di Montalcino reserve vintage recommendation.",
      ],
      targetUrl: "/admin/inventory?tab=maintenance-ai",
      targetSection: "Inventory · AI Guest Menu Shield",
    },
    {
      id: "fnb-task-2",
      rank: 2,
      title: "Pre-Order 25 kg Premium Black Angus Ribeye for Saturday Banquet Gala",
      department: "inventory",
      departmentLabel: "Kitchen Supply Chain",
      urgency: "critical",
      complexity: "medium",
      impactEstimate: "Safeguards ₹3,80,000 banquet dinner revenue",
      estimatedMinutes: 5,
      problemSummary: "Saturday Grand Banquet Gala has 190 confirmed covers with 65% beef main selections.",
      problemDetails: "On-hand stock of Black Angus ribeye is 6 kg against required 30 kg. Lead time from cold-chain distributor is 24 hours.",
      actionSteps: [
        "Open Department Inventory & Requisitions.",
        "Simulate AI Auto-Order for Angus Ribeye chilled vacuum pack.",
        "Charge against F&B food cost operating budget.",
      ],
      targetUrl: "/admin/inventory",
      targetSection: "Inventory · Purchase Orders",
    },
    {
      id: "fnb-task-3",
      rank: 3,
      title: "Roster +4 Banquet Stewards for Saturday Destination Wedding Event",
      department: "revenue",
      departmentLabel: "Brigade Scheduling",
      urgency: "high",
      complexity: "low",
      impactEstimate: "Prevents service bottlenecks during peak dinner rush (205 covers)",
      estimatedMinutes: 6,
      problemSummary: "14-Day AI Forecast predicts 205 banquet covers on Saturday, 10 Oct.",
      problemDetails: "Current roster has 14 stewards scheduled against 19 needed to sustain a 15-minute course turnaround SLA.",
      actionSteps: [
        "Open Staff Roster solver.",
        "Add 4 on-call banquet stewards to Saturday evening shift.",
        "Publish updated roster to team mobile app.",
      ],
      targetUrl: "/admin/roster",
      targetSection: "Staff Roster · Department Schedule",
    },
    {
      id: "fnb-task-4",
      rank: 4,
      title: "Review In-Room Breakfast Delivery Turnaround & Guest Satisfaction",
      department: "guest",
      departmentLabel: "Service SLAs",
      urgency: "medium",
      complexity: "low",
      impactEstimate: "Elevates in-room dining rating to 4.8/5.0",
      estimatedMinutes: 4,
      problemSummary: "Morning room service breakfast delivery average time was 28 minutes (SLA: 25 mins).",
      problemDetails: "Toasting station bottleneck identified between 8:15 AM and 8:45 AM. Adding a dual-conveyor toaster resolves delay.",
      actionSteps: [
        "Open Guest Requests queue and filter by In-Room Dining.",
        "Review closed orders and kitchen ticket delivery timestamps.",
      ],
      targetUrl: "/admin/requests",
      targetSection: "Guest Requests · Service SLAs",
    },
    {
      id: "fnb-task-5",
      rank: 5,
      title: "Approve Shift Handover Report for Morning Breakfast Brigade",
      department: "engineering",
      departmentLabel: "Kitchen Compliance",
      urgency: "medium",
      complexity: "low",
      impactEstimate: "Ensures smooth handover to afternoon sous chef team",
      estimatedMinutes: 3,
      problemSummary: "Breakfast sous chef submitted shift log with notes on pastry prep par.",
      problemDetails: "Shift report notes 40 croissants prep par for tomorrow's executive lounge buffet.",
      actionSteps: [
        "Open Department Dashboard.",
        "Review submitted handover notes and click 'Approve Report'.",
      ],
      targetUrl: "/admin",
      targetSection: "Department Dashboard · Shift Handover Reports",
    },
  ],
  maintenance: [
    {
      id: "eng-task-1",
      rank: 1,
      title: "Deploy Universal Dual-Stage Filter on Chiller Plant (AI Alternate Path)",
      department: "engineering",
      departmentLabel: "Chiller Plant Operations",
      urgency: "critical",
      complexity: "medium",
      impactEstimate: "Prevents chiller head pressure thermal trip & saves ₹45,000 VIP comfort",
      estimatedMinutes: 8,
      problemSummary: "HVAC Primary MERV 13 filters depleted (2 on hand / 8 minimum buffer).",
      problemDetails: "AI Auto-Order PO-ENG-2026-104 is in transit with OEM supplier. In the interim, AI Alternate Path recommends mounting universal dual-stage washable bypass cartridge from local reserve store.",
      actionSteps: [
        "Open Maintenance & 14-Day Spares Automation tab.",
        "Dispatch technician with universal bypass cartridge to central chiller riser.",
        "Verify differential air pressure drops below 0.35 in WG.",
      ],
      targetUrl: "/admin/maintenance",
      targetSection: "Maintenance · 14-Day Ahead Spares Automation",
    },
    {
      id: "eng-task-2",
      rank: 2,
      title: "Expedite AC Compressor Thermal Repair in Room 302",
      department: "engineering",
      departmentLabel: "Room Defect Interventions",
      urgency: "critical",
      complexity: "high",
      impactEstimate: "Releases room from Out-of-Order hold for afternoon check-in",
      estimatedMinutes: 12,
      problemSummary: "Room 302 HVAC tripped on high head pressure (thermal cutoff at 29°C).",
      problemDetails: "Work order #WO-412 assigned to technician Suresh Nair. Capacitor replacement required to restore cooling before 2:00 PM.",
      actionSteps: [
        "Open Maintenance Work Orders log.",
        "Check status of Work Order #WO-412 and confirm capacitor install.",
        "Test thermostatic cycle and release room from Out-of-Order hold.",
      ],
      targetUrl: "/admin/maintenance",
      targetSection: "Maintenance · Room Defects & Work Orders",
    },
    {
      id: "eng-task-3",
      rank: 3,
      title: "Inspect Guest Elevator #2 Safety Interlocks & Hydraulic Leveling",
      department: "engineering",
      departmentLabel: "Vertical Transport Safety",
      urgency: "high",
      complexity: "medium",
      impactEstimate: "Mandatory monthly compliance audit passed without guest disruption",
      estimatedMinutes: 7,
      problemSummary: "Scheduled preventive maintenance due on Guest Elevator #2 door sensor.",
      problemDetails: "Optical door curtain intermittently recalibrating on Floor 3. Minor optical sensor realignment required.",
      actionSteps: [
        "Review authorized work orders in Maintenance panel.",
        "Execute 10-minute off-peak elevator inspection window (2:00 PM - 2:30 PM).",
      ],
      targetUrl: "/admin/maintenance",
      targetSection: "Maintenance · Authorized Work Orders",
    },
    {
      id: "eng-task-4",
      rank: 4,
      title: "Verify Autonomous Reorder for Brass Thermostatic Mixing Valves",
      department: "inventory",
      departmentLabel: "Engineering Spares",
      urgency: "medium",
      complexity: "low",
      impactEstimate: "Guarantees zero plumbing downtime across guest suites",
      estimatedMinutes: 3,
      problemSummary: "Safety threshold reached on 3/4\" brass thermostatic mixing valves (1 remaining).",
      problemDetails: "Autonomous purchase order PO-ENG-2026-108 generated. Delivery ETA in 24 hours.",
      actionSteps: [
        "Open 14-Day Spares Automation tab in Maintenance.",
        "Verify supplier ETA and acknowledge tracking number.",
      ],
      targetUrl: "/admin/maintenance",
      targetSection: "Maintenance · 14-Day Spares Automation",
    },
    {
      id: "eng-task-5",
      rank: 5,
      title: "Review 14-Day Plant Electrical & Thermal Stress Projections",
      department: "engineering",
      departmentLabel: "Preventive Engineering",
      urgency: "high",
      complexity: "medium",
      impactEstimate: "Balances chiller load circuits ahead of Friday temperature spike",
      estimatedMinutes: 5,
      problemSummary: "Weather forecast predicts 36°C heat wave on Day 6 & Day 13.",
      problemDetails: "Peak thermal load will require both Chiller Circuits A and B to run in tandem. Stage 2 secondary pump must be tested.",
      actionSteps: [
        "Open Room Status & Spatial Matrix.",
        "Inspect central cooling telemetry and schedule secondary pump test.",
      ],
      targetUrl: "/admin/rooms",
      targetSection: "Resort 3D Spatial Schematic",
    },
  ],
};

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

  const isGmOrOwner = user?.role === "general_manager" || user?.role === "owner" || !user?.role;
  const deptKey = (user?.departmentKey || "").toLowerCase();
  
  // Resolve whether user is a departmental manager
  const isDeptManager = !isGmOrOwner && Boolean(
    user?.role === "dept_manager_fb" ||
    user?.role === "dept_manager_hk" ||
    user?.role === "dept_manager_frontdesk" ||
    user?.role === "dept_manager_maint" ||
    deptKey === "fnb" ||
    deptKey === "housekeeping" ||
    deptKey === "front_office" ||
    deptKey === "maintenance" ||
    user?.email === "fom@vesper.demo" ||
    user?.email === "exec@vesper.demo" ||
    user?.email === "chef@vesper.demo" ||
    user?.email === "chiefeng@vesper.demo"
  );

  // Time-aware greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const managerName = user?.name ? user.name.split(" ")[0] : "Manager";

  // Resolve department key for 5 tailored commands
  const activeDeptKey =
    deptKey === "front_office" || user?.role === "dept_manager_frontdesk" || user?.email === "fom@vesper.demo"
      ? "front_office"
      : deptKey === "housekeeping" || user?.role === "dept_manager_hk" || user?.email === "exec@vesper.demo"
      ? "housekeeping"
      : deptKey === "maintenance" || user?.role === "dept_manager_maint" || user?.email === "chiefeng@vesper.demo"
      ? "maintenance"
      : "fnb";

  // Filter and sort tasks: 10 tasks for GM/Owner, exactly 5 tailored tasks for Department Managers
  const displayedTasks = useMemo(() => {
    let list: PlannerTask[];
    if (isGmOrOwner) {
      list = [...DEFAULT_PLANNER_TASKS];
    } else {
      list = [...(DEPARTMENT_PLANNER_TASKS[activeDeptKey] || DEPARTMENT_PLANNER_TASKS.fnb)];
    }

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
  }, [activeDeptKey, filterDept, isGmOrOwner, searchQuery, sortBy]);

  const toggleTaskCompletion = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (completedTaskIds.includes(taskId)) {
      setCompletedTaskIds((prev) => prev.filter((id) => id !== taskId));
    } else {
      setCompletedTaskIds((prev) => [...prev, taskId]);
      showToast({
        title: "✓ Priority Marked as Resolved",
        description: "Great progress! Your daily priority list has been updated.",
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

  // Only display for GM, Owner, or Department Managers
  if (!isGmOrOwner && !isDeptManager) return null;


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
            I analyzed today&apos;s operational telemetry: <strong>{isGmOrOwner ? "10 ranked executive priorities" : "5 department priority commands"}</strong> require your action.
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
              {isGmOrOwner ? 'View 10-Task Daily Plan' : 'View 5 Department Commands'}
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
            {displayedTasks.length}
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
                    {isGmOrOwner ? "Vesper AI Executive Planner" : `Vesper AI · ${activeDeptKey === "front_office" ? "Front Desk" : activeDeptKey === "housekeeping" ? "Housekeeping" : activeDeptKey === "maintenance" ? "Engineering" : "F&B"} Planner`}
                  </h3>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold tracking-wider text-emerald-300 uppercase border border-emerald-500/30">
                    {isGmOrOwner ? "GM Rank 1–10" : "Top 5 Department Commands"}
                  </span>
                </div>
                <p className="text-[11px] text-sand-300">
                  {isGmOrOwner ? "Autonomous operational roadmap calibrated for General Managers" : `Autonomous operational priorities calibrated for ${activeDeptKey === "front_office" ? "Front Desk" : activeDeptKey === "housekeeping" ? "Housekeeping" : activeDeptKey === "maintenance" ? "Engineering & Maintenance" : "Food & Beverage"} Manager`}
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
                {completedTaskIds.length} of {displayedTasks.length} priorities resolved today
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-20 rounded-full bg-sand-200 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all"
                  style={{ width: `${(completedTaskIds.length / Math.max(1, displayedTasks.length)) * 100}%` }}
                />
              </div>
              <span className="text-[11px] font-bold font-mono text-sand-800">
                {Math.round((completedTaskIds.length / Math.max(1, displayedTasks.length)) * 100)}%
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
                ← Back to Priority List
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
