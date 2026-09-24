# Vesper — Demo Script & Walkthrough

> **Purpose:** A smooth demo anyone can run, from guest QR scan → AI action → owner review.
> **Duration:** ~10 minutes

---

## Pre-Demo Checklist

1. Open the app at `http://localhost:3000`
2. Default login is **Arjun Mehta** (General Manager) — full access
3. Ensure browser is at **1440 × 900** or wider for optimal layout
4. Open DevTools → Toggle Device Toolbar to show tablet/phone views when needed

---

## Demo Flow

### 1. Landing Page (30 seconds)
- Open `/` — the resort landing page
- Highlight: luxury branding, serif typography, gold accents
- Point out the QR-to-room-service flow for guests

### 2. Admin Dashboard (2 minutes)
- Navigate to `/admin`
- **KPI Tiles**: Occupancy (78%), ADR (₹9,400), Revenue (₹14.2L), Open Requests (12) with sparkline trends
- **AI Action Queue banner**: 5 pending suggestions, 2 high urgency with direct link to Action Queue
- **Occupancy Forecast chart**: 14-day Prophet-based prediction with confidence bands
- **Revenue by Department donut**: shows F&B vs Room revenue split
- **Live Activity & Operational Alerts**:
  - Live Feed shows real-time operational events (check-ins, orders, housekeeping)
  - Toggle to **Alerts** tab: highlights critical BMS IoT anomalies (Chiller 2 vibration spike), demand pacing, and VIP arrivals with direct inspection links


### 3. What-If Simulator (2 minutes)
- Navigate to `/admin/simulator`
- **Adjust sliders**: Room Price (+10%), Staffing (+15), Promo Discount (-5%)
- Show how projected revenue, occupancy, and RevPAR update in real-time
- Try the **scenario presets** (Conservative, Balanced, Growth)
- Click **Save Scenario** → see the toast notification

### 4. AI Learning & Readiness (1.5 minutes)
- Navigate to `/admin/training`
- Point out the **cold-start banner** for the Inventory Auto-Reorder engine
- Show data ingestion progress bars across 6 ML engines
- **Toggle shadow mode** on the Guest Sentiment NLP
- Scroll to **Recent Training Events** log

### 5. 3D Resort Digital Twin (1 minute)
- Navigate to `/admin/rooms`
- Watch the **Suspense skeleton** load, then the floor view appears
- Click different floors to see room status grids
- Hover over rooms to see temperature readings
- Point out live IoT telemetry strip at the bottom

### 6. Model Settings (1 minute)
- Navigate to `/admin/model-settings`
- Show the **global shadow mode toggle** at the top
- Demonstrate per-engine controls: autonomy level, confidence threshold
- Highlight cold-start pending status on Inventory engine

### 7. Communications & CSV Import (1.5 minutes)
- Navigate to `/admin/communications`
- **Outbox tab**: Show message statuses (delivered, failed, queued) across WhatsApp/SMS/Email
- **CSV Import tab**: Click the upload zone
  - Watch the dry-run spinner
  - Point out the 4 validation errors (invalid email, unknown category, date mismatch, empty name)
  - Click "Import 6 Valid Rows" → success toast

### 8. Data Insights (1 minute)
- Navigate to `/admin/data-insights`
- Show AI-surfaced insights with severity levels
- Filter by type (correlation, anomaly, trend, segment)
- Point out the "Actionable" badges and confidence scores

### 9. Resort Settings (30 seconds)
- Navigate to `/admin/settings`
- Show property profile, room categories, PMS/BMS connectors
- Show the **AI Guardrails** tab with confidence and rate thresholds
- Show the **Audit Trail** tab

### 10. Role Switching (30 seconds)
- Click "Viewing as General Manager" in the sidebar footer
- Switch to **F&B Manager** — notice sidebar items change
- Switch to **Housekeeping Manager** — different permissions
- Switch back to General Manager

### 11. End-of-Day Golden Loop: Guest QR → AI Action → Owner Dashboard (3 minutes)
1. **Guest QR Interaction (`/guest`)**:
   - Open `/guest` in mobile device mode (emulating the room tent QR scan)
   - Guest Rohan Mehta (Room 405) requests express late checkout and orders in-room dining
   - Notice instant optimistic UI confirmation and service SLA countdown
2. **AI Action Queue Processing (`/admin/actions`)**:
   - Navigate to `/admin/actions`
   - Observe the newly generated, ranked operational recommendations:
     - Rate surge for upcoming high occupancy (+₹1,200/night)
     - Predictive maintenance dispatch for Chiller 2 before failure
   - Click **Approve** on the suggestion; observe status change and audit trail recording
3. **Owner Dashboard Validation (`/admin`)**:
   - Return to `/admin`
   - Review live operational pulse: KPI tiles reflect current ADR and revenue
   - Check the **Alerts** tab: IoT anomaly acknowledged
   - Live activity feed shows the approved operational event recorded in real-time

---

## Key Talking Points

| Feature | What It Shows |
|---------|---------------|
| KPI Dashboard | Real-time operational pulse at a glance |
| What-If Simulator | Owner can model scenarios before committing |
| AI Learning | Transparency into ML engine readiness |
| Shadow Mode | Safe way to evaluate AI before going live |
| Cold-Start Banners | Honest about what's not ready yet |
| CSV Dry-Run | Error-safe data import workflow |
| Resort Twin | Spatial awareness of every room |
| RBAC Role Switcher | Different views for different stakeholders |
| AI Guardrails | Human-in-the-loop safety boundaries |
| Audit Trail | Full accountability for every AI and human action |

---

## Responsive Demo

After the main flow, optionally demonstrate:
1. **Tablet (iPad)** — sidebar collapses to hamburger, charts reflow
2. **Phone (iPhone 14)** — mobile-first layout, bottom nav for staff view
3. Show the guest view at `/guest` — QR scanning, room service ordering

---

## Troubleshooting

- **Charts not rendering?** → Ensure `recharts` is installed: `npm install`
- **Auth error?** → Clear local storage and refresh
- **Port conflict?** → App runs on port 3000 by default, change in `package.json`
