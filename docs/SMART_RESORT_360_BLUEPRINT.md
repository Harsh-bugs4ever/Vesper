# Vesper: Smart Resort 360
## AI-Powered Resort Operations, Guest Experience & Revenue Intelligence Platform
### *Comprehensive Architectural Blueprint & Feature Specification*

---

## 1. Executive Summary & Hackathon Alignment

This document outlines the complete architectural, operational, and AI blueprint for **Vesper**, designed to directly solve **Problem Statement ID - 5: Smart Resort 360 (AI-Powered Resort Operations, Guest Experience & Revenue Intelligence)** while capturing high-value bonus dimensions from **PS ID - 6 (Green & Inclusive Hospitality)** and **PS ID - 7 (Local Experiences Discovery)**.

### Core Problem Solved
Modern luxury resorts struggle with siloed operations: front desk, housekeeping, engineering, inventory, F&B, and revenue management operate in disconnected systems. **Vesper** unifies these streams into a real-time, proactive, AI-orchestrated intelligence platform.

---

## 2. Workforce Roster Planner & Demand Solver

The Roster Engine dynamically calculates shift requirements using multi-dimensional inputs rather than static weekly templates.

```
                           DEMAND-DRIVEN ROSTER ENGINE
  ┌───────────────────────┐   ┌────────────────────────┐   ┌───────────────────────┐
  │ 14-Day Occupancy Data │ + │ F&B Covers / Banquets  │ + │ VIP Arrival Schedules │
  └───────────┬───────────┘   └───────────┬────────────┘   └───────────┬───────────┘
              └───────────────────────────┼────────────────────────────┘
                                          ▼
                      ┌───────────────────────────────────────┐
                      │    Automated Solver & Fair Roster     │
                      │  (Skill Match + Rest Rules + Leaves)  │
                      └───────────────────┬───────────────────┘
                                          ▼
                      ┌───────────────────────────────────────┐
                      │       Department Roster Output        │
                      └───────────────────────────────────────┘
```

### Department-Wise Shift Matrix

| Department | Shift Schedule | Staff Capacity (Sched vs Req) | Core Demand Driver | Dynamic Reactive Trigger |
| :--- | :--- | :--- | :--- | :--- |
| **Front Office & Facilities** | Morning (07:00–15:30): 4<br>Evening (15:00–23:30): 5<br>Night (23:00–07:30): 2 | 11 / 11 staff (100% SLA) | Check-in peaks (14:00–18:00) & VIP arrival times | Delayed group flights $\rightarrow$ shifts extended / flex-staff activated. |
| **Housekeeping** | Morning (08:00–16:30): 14<br>Evening (14:00–22:30): 6<br>Night (Turn-down): 2 | 22 / 20 staff (+2 buffer) | 42 departures, 18 deep cleans, room turnover time | Late checkouts $\rightarrow$ dynamic reordering of floor cleaning queues. |
| **Food & Beverage (F&B)** | Breakfast (06:00–14:30): 8<br>Dinner (16:30–00:30): 12 | 20 / 20 staff (100%) | 220 breakfast covers + 1 private banquet | Walk-in covers exceed 115% $\rightarrow$ runners cross-dispatched from buffer. |
| **Engineering & Maintenance** | Day (08:00–17:00): 4<br>Evening/Night (On-call): 2 | 6 / 6 staff | Scheduled preventive maintenance (PM) | Critical HVAC/plumbing alert $\rightarrow$ auto-assigns lead technician. |

---

## 3. Real-Time Inventory Stock-Out Reactive Automation Loop

When an essential consumable or ingredient reaches safety-stock threshold / zero, Vesper executes an instant automated chain across 3 departments:

```
                        [ INVENTORY OUT-OF-STOCK EVENT ]
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│ Frontline Shift  │          │ Auto-Purchase &  │          │ Guest & Order    │
│ Task Adjustments │          │ Supplier Dispatch│          │ Guardrails (POS) │
└────────┬─────────┘          └────────┬─────────┘          └────────┬─────────┘
         │                             │                             │
• Housekeeping carts           • Auto-drafts PO              • Dishes with out-
  switch to alternate            for pre-approved              of-stock ingredients
  linen / amenities.             vendor.                       are marked "Sold Out"
• Runner task created          • Flags delivery SLA          • Guest App hides
  to fetch buffer stock          and buffer lead               unavailable mini-bar
  from central store.            time.                         items.
```

1. **Frontline Floor Runner Dispatch**: An urgent task is auto-assigned to the nearest floor runner to pull buffer backup from central storage.
2. **Automated Procurement PO Draft**: The system auto-drafts a pre-negotiated Purchase Order (PO) and routes it to the GM Action Center for 1-click approval.
3. **Point of Sale (POS) & Digital Menu Guardrail**: In F&B, any menu item requiring the missing item is instantly marked "Sold Out" on staff POS terminals and guest digital menus.

---

## 4. AI Feature Capabilities Across Personas

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           AI FEATURE ECOSYSTEM BY PERSONA                         │
├─────────────────┬─────────────────┬─────────────────────┬─────────────────────────┤
│    👑 GUEST     │  👷 STAFF/TEAM  │ 📋 DEPT. MANAGERS   │   🏢 GENERAL MANAGER    │
├─────────────────┼─────────────────┼─────────────────────┼─────────────────────────┤
│ • Multilingual  │ • Smart Task    │ • Predictive Shift  │ • Executive Briefing    │
│   Concierge     │   Batching      │   Planner           │   & Anomaly Radar       │
│ • Zero-Wait     │ • Voice-to-     │ • Inventory Burn-   │ • Dynamic Revenue &     │
│   Mobile Dining │   Work-Order    │   Rate Forecaster   │   Pricing Optimizer     │
│ • Personalized  │ • Auto-Language │ • Real-Time SLA     │ • Cross-Department     │
│   Stay Requests │   Translator    │   Breach Predictor  │   Bottleneck Detection  │
└─────────────────┴─────────────────┴─────────────────────┴─────────────────────────┘
```

* **For Guests (Frictionless Luxury)**:
  * **24/7 Multilingual AI Concierge**: Instant WhatsApp & web concierge answering resort queries in 30+ languages.
  * **Zero-Touch Service Requests**: Natural language processing automatically extracts intent (e.g., *"Need 2 extra towels in 402"*) and routes direct tickets to Housekeeping.
  * **Curated Local Discovery (PS ID - 7)**: Generates personalized itineraries based on remaining guest time, preferences, and distance.
* **For Staff & Attendants (Effortless Execution)**:
  * **Smart Batch Floor Routing**: Optimizes room cleaning paths, cutting elevator/transit time by 35%.
  * **Voice-to-Work-Order**: Technicians dictate issues into the mobile app; AI formats, categorizes, and logs the work order.
  * **Auto-Language Translation**: Staff write in their native language; guest communications auto-translate into fluent English.
* **For Department Managers (Operational Command)**:
  * **Predictive Shift Roster Solver**: Resolves labor bottlenecks 7 days ahead, enforcing rest periods and labor laws.
  * **Inventory Burn-Rate Prediction**: Forecasts stock depletion based on upcoming banquet schedules rather than static counts.
  * **SLA Escalation Radar**: Alerts managers *before* a guest ticket exceeds target resolution time.
* **For General Manager (Executive Governance)**:
  * **30-Second Morning Audio/Text Debrief**: Key metrics (RevPAR, CSAT, open P1 tickets, revenue vs budget).
  * **Cross-Department Root Cause AI**: Discovers interconnected causes (e.g., F&B breakfast delays caused by laundry linen shortages).
  * **1-Click Strategic Approvals**: One-tap approval for purchase orders, rate adjustments, and shift replacements.

---

## 5. Unified Department Manager Dashboards

### A. Front Office & Facilities Operations Manager (Combined Front Desk + Maintenance)
Merges room check-ins with engineering status to eliminate room-assignment miscommunications.
* **Top KPIs**: Today's Arrivals/Departures, Sellable Inventory (Total vs OOO), Active In-Stay Repairs, Mean Time to Repair (MTTR).
* **Left Panel**: Live check-in/checkout queue, room assignment matrix, VIP arrival countdown.
* **Right Panel**: Real-time maintenance dispatch board, Out-of-Order (OOO) room countdown timers, critical plant health (chillers, boilers).
* **AI Synergy**: Repaired rooms auto-flip from `Under Maintenance` $\rightarrow$ `Ready for Front Desk Assignment`.

### B. Housekeeping Manager Dashboard
* **Top KPIs**: Room Cleanliness Status (Dirty, In-Progress, Inspected, Ready), Average Turnaround Time (min/room), Linen Buffer Days.
* **Core Views**: Floor-by-floor cleaning progress board, attendant task load, priority rush-room queue for early check-ins.

### C. Food & Beverage (F&B) Manager Dashboard
* **Top KPIs**: Total Covers Booked, Average Table Spend (₹), Kitchen Order Times (KDS), Low-Stock Ingredients.
* **Core Views**: Real-time table layout & reservation timeline, banquet catering function run-sheets, auto-sold-out POS sync.

### D. General Manager (Executive Cockpit)
* **Top KPIs**: RevPAR, ADR, Occupancy Rate %, Guest Satisfaction Index (4.4/5).
* **Core Views**: 14-Day Occupancy & Revenue Forecast curve, Property Exception Radar, AI Action Center with 1-Click Approvals.

---

## 6. Dual-Level Attendance & AI Insights System

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 👥 PROPERTY ATTENDANCE COCKPIT                                                        [ General Mgr ] │
│ Track live staff attendance, overtime spikes, punctuality trends, and staffing coverage gaps.         │
├───────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Department View: [ ▼ All Departments (Front Office & Facilities, Housekeeping, F&B) ]                │
│  Date / Shift:    [ Today · Morning Shift (07:00 – 15:30)                           ]                 │
├───────────────────┬───────────────────┬───────────────────┬───────────────────┬───────────────────────┤
│ Scheduled Staff   │ Present / On-Shift│ Late Check-Ins    │ Unplanned Absent  │ Coverage Ratio        │
│ 48 Staff          │ 44 Present (92%)  │ 3 Late (>15m)     │ 1 Absent          │ 96% of Required SLA   │
├───────────────────┴───────────────────┴───────────────────┴───────────────────┴───────────────────────┤
│                                                                                                       │
│ 💡 AI ATTENDANCE & WORKFORCE INSIGHTS (Dynamic based on selected dropdown)                           │
│ ───────────────────────────────────────────────────────────────────────────────────────────────────── │
│ • ⚠️ Housekeeping Shift Strain: 1 absent attendant on 4th Floor during peak checkout (42 departures)  │
│   → Recommendation: Auto-assign 1 cross-trained F&B runner to assist linen transport.                 │
│ • 📈 Punctuality Index: Front Office & Facilities at 98% on-time check-in this week (+4% vs last mo). │
│ • ⏳ Overtime Risk: F&B banquet service running 14 hours cumulative overtime; rest rule triggered.    │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

* **Department Manager Level**:
  * Scoped strictly to their logged-in team.
  * Real-time on-duty roster, clock-in timestamps, late-arrival tags (>15 min), and active break timers with countdowns.
* **General Manager Level**:
  * Global dropdown to toggle between: `"All Departments"`, `"Front Office & Facilities"`, `"Housekeeping"`, and `"Food & Beverage"`.
  * Real-time department comparison table (Scheduled vs Present, Late, Absent, Coverage Health).
  * AI Insights Engine flags overtime burnout risks and recommends cross-department shift reallocations.

---

## 7. Decluttering & Simplification Audit

To ensure the product is lightning-fast, intuitive, and production-grade, the following redundant/cluttered items have been removed or consolidated:

| Item / Feature Removed | Why It Was Cut | Where Value Is Retained |
| :--- | :--- | :--- |
| **`model-performance` & `model-settings`** | Hotel managers need business outcomes, not raw ML loss curves or "Shadow Mode" toggles. | AI runs silently in the background. |
| **`simulator` (Hypothetical Rate Sandbox)** | Managers do not use hypothetical manual sliders; they need direct, actionable rate recommendations. | Kept inside `revenue-insights` and `rates`. |
| **`loyalty` (Standalone Points Accounting)** | Complex points engines add bloat. Luxury resorts focus on guest profile VIP tags and stay history. | Tracked in `guests` and `guest-chat`. |
| **`data-insights` / `performance` overlap** | Four separate reporting screens caused confusion. | Consolidated into standard `reports`. |
| **Micro-Telemetry Activity Bars** | "12 decisions made 4 mins ago" adds visual noise without operational value. | Kept in backend security audit logs. |

---

## 8. Top 4 Standout "WOW Factor" Hackathon Features

### 1. 🌪️ The "Operational Ripple Effect" Auto-Orchestrator
* **Scenario**: A 4-hour flight delay brings 35 VIP guests at 11:30 PM instead of 7:00 PM.
* **AI Orchestration**: AI calculates the multi-department ripple plan:
  * Front Desk fast-tracks night check-in keys.
  * Housekeeping holds turn-down service and keeps 2 night attendants on standby.
  * F&B reschedules dining orders and preps late-night welcome drinks.
* **GM Action**: GM clicks a single **`[ Execute Ripple Plan ]`** button to dispatch all 3 departments simultaneously.

### 2. 🛡️ In-Stay "Silent Detractor" Recovery Radar
* **Scenario**: Guests rarely complain to the front desk; they post 1-star reviews on TripAdvisor *after* leaving.
* **AI Orchestration**: AI tracks in-stay friction signals (e.g., towel delay + Wi-Fi retry ticket + cold tone in chat) $\rightarrow$ flags **"Room 402: 82% Detractor Risk"**.
* **Action**: System triggers an immediate proactive service recovery (e.g., complimentary chef dessert + GM note) *before* checkout.

### 3. 🌱 Smart Eco-Energy Sync & Carbon Dashboard (PS ID - 6 Anchor)
* **Scenario**: HVAC runs constantly in unoccupied rooms, wasting huge power.
* **AI Orchestration**: Unoccupied clean rooms stay in Deep Eco-Saver Mode (saving 32% energy). When Front Desk initiates check-in, HVAC pre-cools to 22°C.
* **GM View**: Live display of kWh saved, water conserved, and carbon offsets for ESG compliance.

### 4. 📈 Dynamic Ancillary Revenue Booster (F&B / Spa Surge)
* **Scenario**: Resort spa has 60% idle capacity on weekday afternoons.
* **AI Orchestration**: AI Concierge proactively sends a personalized in-app message to free guests lounging by the pool offering a special 25% resident discount, instantly monetizing idle slots.
