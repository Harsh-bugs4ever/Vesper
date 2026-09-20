export type UserRole =
  | "general_manager"
  | "dept_manager_fb"
  | "dept_manager_hk"
  | "employee"
  | "system_admin"
  | "guest";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  department?: string;
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
  { key: "resort:configure", domain: "governance", label: "Configure Resort Settings", description: "Update resort profile, 145 room keys, outlets, and shifts." },
  { key: "integrations:manage", domain: "governance", label: "Manage PMS/BMS Connectors", description: "Configure API credentials, sync intervals, and telemetry feeds." },
  { key: "audit:view", domain: "governance", label: "View Dept Audit Logs", description: "Inspect audit trail for departmental operations." },
  { key: "audit:view_full", domain: "governance", label: "Inspect Full Audit Ledger", description: "Complete tamper-evident cryptographic log of all AI and staff actions." },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  general_manager: [
    "all",
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
    "resort:configure",
    "audit:view",
    "audit:view_full",
  ],
  system_admin: [
    "users:manage",
    "roles:manage",
    "resort:configure",
    "integrations:manage",
    "audit:view_full",
    "audit:view",
    "sensors:view",
    "rates:view_forecast",
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

export const DEMO_USERS: Record<UserRole, User> = {
  general_manager: {
    id: "usr_gm_01",
    name: "Arjun Mehta",
    email: "arjun.mehta@vesperresorts.com",
    role: "general_manager",
    roleTitle: "General Manager",
    department: "Executive Office",
    propertyId: "prop_mumbai_01",
    propertyName: "Madh Island Beach Resort, Mumbai",
    status: "active",
    permissions: DEFAULT_ROLE_PERMISSIONS.general_manager,
  },
  dept_manager_fb: {
    id: "usr_dm_fb_01",
    name: "Priya Sharma",
    email: "priya.sharma@vesperresorts.com",
    role: "dept_manager_fb",
    roleTitle: "F&B Manager",
    department: "Food & Beverage",
    propertyId: "prop_mumbai_01",
    propertyName: "Madh Island Beach Resort, Mumbai",
    status: "active",
    permissions: DEFAULT_ROLE_PERMISSIONS.dept_manager_fb,
  },
  dept_manager_hk: {
    id: "usr_dm_hk_01",
    name: "Sunita Rao",
    email: "sunita.rao@vesperresorts.com",
    role: "dept_manager_hk",
    roleTitle: "Executive Housekeeper",
    department: "Housekeeping",
    propertyId: "prop_mumbai_01",
    propertyName: "Madh Island Beach Resort, Mumbai",
    status: "active",
    permissions: DEFAULT_ROLE_PERMISSIONS.dept_manager_hk,
  },
  employee: {
    id: "usr_emp_hk_14",
    name: "Ramesh Patil",
    email: "ramesh.p@vesperresorts.com",
    role: "employee",
    roleTitle: "Housekeeping Attendant",
    department: "Housekeeping",
    shift: "Morning (07:00 - 15:30)",
    propertyId: "prop_mumbai_01",
    propertyName: "Madh Island Beach Resort, Mumbai",
    status: "on_shift",
    permissions: DEFAULT_ROLE_PERMISSIONS.employee,
  },
  system_admin: {
    id: "usr_adm_01",
    name: "Kavita Nair",
    email: "kavita.nair@vesperresorts.com",
    role: "system_admin",
    roleTitle: "System Administrator",
    department: "IT & Systems",
    propertyId: "prop_mumbai_01",
    propertyName: "Madh Island Beach Resort, Mumbai",
    status: "active",
    permissions: DEFAULT_ROLE_PERMISSIONS.system_admin,
  },
  guest: {
    id: "gst_412_09",
    name: "Guest - Room 412",
    email: "guest.412@demo.vesper",
    role: "guest",
    roleTitle: "In-House Guest",
    roomNumber: "412",
    propertyId: "prop_mumbai_01",
    propertyName: "Madh Island Beach Resort, Mumbai",
    status: "active",
    permissions: DEFAULT_ROLE_PERMISSIONS.guest,
  },
};

export const RESORT_STAFF_DIRECTORY: User[] = [
  {
    id: "usr_gm_01",
    name: "Arjun Mehta",
    email: "arjun.mehta@vesperresorts.com",
    role: "general_manager",
    roleTitle: "General Manager",
    department: "Executive Office",
    propertyId: "prop_mumbai_01",
    propertyName: "Madh Island Beach Resort",
    shift: "Executive (09:00 - 18:00)",
    status: "active",
    permissions: DEFAULT_ROLE_PERMISSIONS.general_manager,
  },
  {
    id: "usr_adm_01",
    name: "Kavita Nair",
    email: "kavita.nair@vesperresorts.com",
    role: "system_admin",
    roleTitle: "System Administrator",
    department: "IT & Systems",
    propertyId: "prop_mumbai_01",
    propertyName: "Madh Island Beach Resort",
    shift: "Regular (09:30 - 18:30)",
    status: "active",
    permissions: DEFAULT_ROLE_PERMISSIONS.system_admin,
  },
  {
    id: "usr_dm_hk_01",
    name: "Sunita Rao",
    email: "sunita.rao@vesperresorts.com",
    role: "dept_manager_hk",
    roleTitle: "Executive Housekeeper",
    department: "Housekeeping",
    propertyId: "prop_mumbai_01",
    propertyName: "Madh Island Beach Resort",
    shift: "Morning (06:30 - 15:30)",
    status: "active",
    permissions: DEFAULT_ROLE_PERMISSIONS.dept_manager_hk,
  },
  {
    id: "usr_dm_fb_01",
    name: "Priya Sharma",
    email: "priya.sharma@vesperresorts.com",
    role: "dept_manager_fb",
    roleTitle: "F&B Manager",
    department: "Food & Beverage",
    propertyId: "prop_mumbai_01",
    propertyName: "Madh Island Beach Resort",
    shift: "Split (11:00 - 22:00)",
    status: "active",
    permissions: DEFAULT_ROLE_PERMISSIONS.dept_manager_fb,
  },
  {
    id: "usr_emp_hk_14",
    name: "Ramesh Patil",
    email: "ramesh.p@vesperresorts.com",
    role: "employee",
    roleTitle: "Housekeeping Attendant",
    department: "Housekeeping",
    propertyId: "prop_mumbai_01",
    propertyName: "Madh Island Beach Resort",
    shift: "Morning (07:00 - 15:30)",
    status: "on_shift",
    permissions: DEFAULT_ROLE_PERMISSIONS.employee,
  },
  {
    id: "usr_emp_hk_09",
    name: "Anjali Deshmukh",
    email: "anjali.d@vesperresorts.com",
    role: "employee",
    roleTitle: "Floor Attendant (Villas)",
    department: "Housekeeping",
    propertyId: "prop_mumbai_01",
    propertyName: "Madh Island Beach Resort",
    shift: "Morning (07:00 - 15:30)",
    status: "on_shift",
    permissions: DEFAULT_ROLE_PERMISSIONS.employee,
  },
  {
    id: "usr_emp_fb_03",
    name: "Vikram Malhotra",
    email: "vikram.m@vesperresorts.com",
    role: "employee",
    roleTitle: "Head Barista & Server",
    department: "Food & Beverage",
    propertyId: "prop_mumbai_01",
    propertyName: "Madh Island Beach Resort",
    shift: "Morning (06:30 - 15:00)",
    status: "on_shift",
    permissions: DEFAULT_ROLE_PERMISSIONS.employee,
  },
  {
    id: "usr_emp_eng_02",
    name: "Deepak Chauhan",
    email: "deepak.c@vesperresorts.com",
    role: "employee",
    roleTitle: "HVAC & BMS Technician",
    department: "Engineering",
    propertyId: "prop_mumbai_01",
    propertyName: "Madh Island Beach Resort",
    shift: "General (08:00 - 17:00)",
    status: "active",
    permissions: [
      "attendance:mark",
      "tasks:view_assigned",
      "tasks:update_status",
      "sensors:view",
      "equipment:report_issue",
      "work_orders:resolve",
    ],
  },
  {
    id: "usr_emp_fo_01",
    name: "Sneha Kulkarni",
    email: "sneha.k@vesperresorts.com",
    role: "employee",
    roleTitle: "Front Desk Supervisor",
    department: "Front Office",
    propertyId: "prop_mumbai_01",
    propertyName: "Madh Island Beach Resort",
    shift: "Afternoon (14:30 - 23:00)",
    status: "off_duty",
    permissions: [
      "attendance:mark",
      "tasks:view_assigned",
      "tasks:update_status",
      "rooms:manage_status",
    ],
  },
  {
    id: "usr_emp_sec_04",
    name: "Balwant Singh",
    email: "balwant.s@vesperresorts.com",
    role: "employee",
    roleTitle: "Security Officer",
    department: "Security",
    propertyId: "prop_mumbai_01",
    propertyName: "Madh Island Beach Resort",
    shift: "Night (22:30 - 07:00)",
    status: "off_duty",
    permissions: ["attendance:mark", "tasks:view_assigned", "tasks:update_status"],
  },
];

export const DEMO_PROPERTY = {
  id: "prop_mumbai_01",
  name: "Madh Island Beach Resort",
  brand: "JW Marriott Mumbai, Juhu / Vesper Luxury Collection",
  location: "Madh Island & Juhu Coastline, Mumbai, Maharashtra 400061",
  totalRooms: 145,
  liveOccupancy: 78,
  weather: "29°C · Coastal Sunny",
  timezone: "Asia/Kolkata (IST · UTC+5:30)",
  currency: "INR (₹)",
  checkInTime: "15:00",
  checkOutTime: "11:00",
  roomCategories: [
    { code: "DLX_OCN", name: "Deluxe Ocean View", count: 80, baseRate: 18500, floor: "Floors 2-4" },
    { code: "EXEC_STE", name: "Executive Ocean Suite", count: 40, baseRate: 27500, floor: "Floors 4-5" },
    { code: "PRES_VIL", name: "Presidential Beach Villa", count: 15, baseRate: 65000, floor: "Beachfront Walk" },
    { code: "SEA_CLB", name: "Sea Breeze Club Room", count: 10, baseRate: 22000, floor: "Floor 1 & Garden" },
  ],
  outlets: [
    { id: "out_01", name: "Lotus Cafe", type: "All-Day Dining & Buffet", hours: "06:30 - 23:30", capacity: 160 },
    { id: "out_02", name: "Dashanzi", type: "Progressive Asian Cuisine", hours: "18:30 - 00:30", capacity: 85 },
    { id: "out_03", name: "Reflections Bar", type: "Beachfront Cocktail Lounge", hours: "16:00 - 01:00", capacity: 70 },
    { id: "out_04", name: "Quan Spa & Wellness", type: "Ayurvedic & Hydrotherapy", hours: "08:00 - 21:00", capacity: 12 },
  ],
  staffHeadcount: {
    total: 180,
    departments: [
      { name: "Housekeeping", count: 55, activeOnShift: 18 },
      { name: "Food & Beverage", count: 48, activeOnShift: 16 },
      { name: "Front Office", count: 28, activeOnShift: 8 },
      { name: "Engineering & BMS", count: 22, activeOnShift: 5 },
      { name: "Security", count: 15, activeOnShift: 4 },
      { name: "Executive & Admin", count: 12, activeOnShift: 6 },
    ],
  },
  connectors: {
    pms: {
      provider: "Demo PMS Connector (Opera Cloud Simulation)",
      status: "connected",
      latencyMs: 18,
      lastSync: "Just now (30s interval)",
      mappedRooms: 145,
      activeFolios: 112,
    },
    bms: {
      provider: "Demo BMS IoT Gateway (BACnet/MQTT)",
      status: "connected",
      activeSensors: 145,
      chillersOnline: 12,
      lastReading: "1m ago",
      vibrationStatus: "1 Anomaly Alert (Chiller #2 Bearing)",
    },
  },
  aiGuardrails: {
    confidenceThreshold: 85,
    requireHumanApprovalAboveImpactPercent: 10,
    highImpactPurchaseThresholdInr: 50000,
    undoBufferSeconds: 10,
    shadowMode: false,
    dpdpCompliance: true,
  },
};
