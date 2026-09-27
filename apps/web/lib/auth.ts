/**
 * Static role/permission configuration.
 *
 * - UserRole: the four internal roles that the UI supports, plus guest.
 *   system_admin is gone; it was never emitted by the backend.
 * - PERMISSIONS_LIST / PERMISSION_DOMAINS: presentational metadata, not business data.
 * - DEFAULT_ROLE_PERMISSIONS: the seed set the permission-matrix editor starts from.
 *   Components must not read this as a proxy for what a signed-in user can do;
 *   they must read user.permissions from the backend response.
 */

export type UserRole =
  | "owner"
  | "general_manager"
  | "dept_manager_fb"
  | "dept_manager_hk"
  | "dept_manager_frontdesk"
  | "dept_manager_maint"
  | "employee"
  | "guest";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  department?: string;
  departmentId?: string | null;
  departmentKey?: string | null;
  propertyId: string;
  propertyName: string;
  avatarUrl?: string;
  roomNumber?: string;
  shift?: string;
  status?: "active" | "on_shift" | "off_duty" | "suspended";
  permissions: string[];
}

export interface PermissionDefinition {
  key: string;
  domain:
    | "revenue"
    | "tasks"
    | "rooms"
    | "inventory"
    | "workforce"
    | "maintenance"
    | "guest"
    | "governance";
  label: string;
  description: string;
  isHighImpact?: boolean;
}

export const PERMISSION_DOMAINS: {
  id: PermissionDefinition["domain"];
  label: string;
  description: string;
}[] = [
  { id: "revenue", label: "Revenue & Pricing", description: "AI dynamic rates, forecasting, and pricing overrides" },
  { id: "tasks", label: "Tasks & Operations", description: "Task allocation, workflow dispatch, and SLA completion" },
  { id: "rooms", label: "Rooms & Housekeeping", description: "Room board statuses, cleaning turnover, and quality checks" },
  { id: "inventory", label: "Inventory & Purchasing", description: "Stock deductions, auto-reorders, and PO authorization" },
  { id: "workforce", label: "Workforce & Rosters", description: "Shift attendance, GPS check-in, and auto-rostering" },
  { id: "maintenance", label: "Engineering & BMS", description: "IoT sensor telemetry, chiller alerts, and work orders" },
  { id: "guest", label: "Guest Experience", description: "In-room dining orders, concierge service, and guest DNA" },
  { id: "governance", label: "Governance & Systems", description: "User credentials, permission matrix, PMS/BMS connectors, and audit trail" },
];

export const PERMISSIONS_LIST: PermissionDefinition[] = [
  // Revenue
  { key: "rates:view_forecast", domain: "revenue", label: "View Demand Forecast", description: "Inspect Prophet & XGBoost occupancy/demand projections." },
  { key: "rates:approve", domain: "revenue", label: "Approve Daily Rates", description: "Approve routine ADR suggestions under ±10% threshold." },
  { key: "rates:approve_high_impact", domain: "revenue", label: "Approve High-Impact Rates", description: "Authorize surge pricing or discount cards exceeding ±10% impact.", isHighImpact: true },
  { key: "revenue:simulator", domain: "revenue", label: "Run Revenue Simulator", description: "Simulate what-if elasticity scenarios on live property data." },

  // Tasks
  { key: "tasks:manage", domain: "tasks", label: "Manage Department Tasks", description: "Create, assign, re-route, and prioritize task queues." },
  { key: "tasks:view_assigned", domain: "tasks", label: "View Assigned Tasks", description: "Access personal floor task checklist on mobile staff view." },
  { key: "tasks:update_status", domain: "tasks", label: "Update Task Progress", description: "Mark tasks in-progress or completed with SLA verification." },

  // Rooms
  { key: "rooms:manage_status", domain: "rooms", label: "Override Room Board", description: "Force room status dirty / clean / inspected / out of order." },
  { key: "rooms:update_status", domain: "rooms", label: "Floor Room Turnover", description: "Flip room status dirty → cleaning → ready via QR scan." },
  { key: "rooms:inspect", domain: "rooms", label: "Supervisor Room Inspection", description: "Conduct pre-arrival VIP audit and release room to front desk." },

  // Inventory
  { key: "stock:manage", domain: "inventory", label: "Manage Stock & Par Levels", description: "Adjust stock counts, minimum par alerts, and wastage logs." },
  { key: "purchases:request", domain: "inventory", label: "Request Stock Orders", description: "Submit replenishment POs when items breach minimum par." },
  { key: "purchases:approve_high_impact", domain: "inventory", label: "Approve High-Value POs", description: "Authorize purchase requisitions exceeding ₹50,000 threshold.", isHighImpact: true },

  // Workforce
  { key: "attendance:mark", domain: "workforce", label: "Mark Shift Attendance", description: "Clock in/out with GPS location & QR security verification." },
  { key: "attendance:view_dept", domain: "workforce", label: "View Dept Attendance", description: "Supervise active floor staffing and shift headcounts." },
  { key: "roster:manage", domain: "workforce", label: "Manage AI Rosters", description: "Approve CP-SAT generated shift schedules and resolve gaps." },

  // Maintenance
  { key: "sensors:view", domain: "maintenance", label: "Inspect BMS Telemetry", description: "Monitor live vibration, temperature, and smart sensor streams." },
  { key: "equipment:report_issue", domain: "maintenance", label: "Report Broken Asset", description: "Submit maintenance tickets with attached photo evidence." },
  { key: "work_orders:resolve", domain: "maintenance", label: "Resolve Work Orders", description: "Sign off on completed chiller, pump, and electrical repairs." },

  // Guest
  { key: "guest:order", domain: "guest", label: "Place Room Orders", description: "Order room dining and amenities via nightstand QR token." },
  { key: "guest:request", domain: "guest", label: "Request Services", description: "Request housekeeping turnover, towels, or bellhop." },
  { key: "guest:concierge", domain: "guest", label: "AI Concierge Interaction", description: "Query RAG knowledge base for spa timings and Mumbai recs." },
  { key: "guest:sentiment_view", domain: "guest", label: "View Guest Sentiment", description: "Inspect guest DNA, satisfaction trends, and feedback scores." },

  // Governance
  { key: "users:manage", domain: "governance", label: "Manage Staff Accounts", description: "Create, edit, suspend, and assign roles to resort team." },
  { key: "roles:manage", domain: "governance", label: "Configure Permission Matrix", description: "Edit role privileges and access control thresholds.", isHighImpact: true },
  { key: "resort:configure", domain: "governance", label: "Configure Resort Settings", description: "Update resort profile, room keys, outlets, and shifts." },
  { key: "integrations:manage", domain: "governance", label: "Manage PMS/BMS Connectors", description: "Configure API credentials, sync intervals, and telemetry feeds." },
  { key: "audit:view", domain: "governance", label: "View Dept Audit Logs", description: "Inspect audit trail for departmental operations." },
  { key: "audit:view_full", domain: "governance", label: "Inspect Full Audit Ledger", description: "Complete tamper-evident cryptographic log of all AI and staff actions." },
];

/**
 * Seed permissions used by the permission-matrix editor.
 *
 * These are the *default* sets the editor starts from, NOT what a signed-in user
 * actually holds — that always comes from `user.permissions` on the backend response.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner: [
    "rates:view_forecast",
    "rates:approve",
    "rates:approve_high_impact",
    "revenue:simulator",
    "tasks:manage",
    "rooms:manage_status",
    "rooms:inspect",
    "stock:manage",
    "purchases:request",
    "purchases:approve_high_impact",
    "attendance:view_dept",
    "roster:manage",
    "sensors:view",
    "work_orders:resolve",
    "guest:sentiment_view",
    "users:manage",
    "roles:manage",
    "resort:configure",
    "integrations:manage",
    "audit:view",
    "audit:view_full",
  ],
  general_manager: [
    "rates:view_forecast",
    "rates:approve",
    "rates:approve_high_impact",
    "revenue:simulator",
    "tasks:manage",
    "rooms:manage_status",
    "rooms:inspect",
    "stock:manage",
    "purchases:request",
    "purchases:approve_high_impact",
    "attendance:view_dept",
    "roster:manage",
    "sensors:view",
    "work_orders:resolve",
    "guest:sentiment_view",
    "users:manage",
    "roles:manage",
    "resort:configure",
    "integrations:manage",
    "audit:view",
    "audit:view_full",
  ],
  dept_manager_fb: [
    "tasks:manage",
    "tasks:update_status",
    "stock:manage",
    "purchases:request",
    "attendance:view_dept",
    "audit:view",
    "guest:sentiment_view",
  ],
  dept_manager_hk: [
    "tasks:manage",
    "tasks:update_status",
    "rooms:manage_status",
    "rooms:inspect",
    "attendance:view_dept",
    "equipment:report_issue",
    "audit:view",
  ],
  dept_manager_frontdesk: [
    "bookings:read",
    "bookings:write",
    "attendance:view_dept",
    "tasks:manage",
  ],
  dept_manager_maint: [
    "workorder:approve",
    "issues:write",
    "tasks:manage",
    "attendance:view_dept",
    "stock:read",
    "rooms:manage_status",
  ],
  employee: [
    "attendance:mark",
    "tasks:view_assigned",
    "tasks:update_status",
    "rooms:update_status",
    "equipment:report_issue",
  ],
  guest: [
    "guest:order",
    "guest:request",
    "guest:concierge",
  ],
};
