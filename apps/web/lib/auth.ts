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
  permissions: string[];
}

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
    permissions: [
      "all",
      "rates:approve",
      "rates:approve_high_impact",
      "purchases:approve_high_impact",
      "roster:approve",
      "tasks:manage",
      "reports:view_all",
      "audit:view",
    ],
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
    permissions: [
      "dept:fb",
      "tasks:manage",
      "stock:manage",
      "purchases:request",
      "attendance:view_dept",
    ],
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
    permissions: [
      "dept:hk",
      "rooms:manage_status",
      "tasks:manage",
      "attendance:view_dept",
    ],
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
    permissions: [
      "attendance:mark",
      "tasks:view_assigned",
      "tasks:update_status",
      "rooms:update_status",
      "equipment:report_issue",
    ],
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
    permissions: [
      "users:manage",
      "roles:manage",
      "integrations:manage",
      "audit:view_full",
      "system:configure",
    ],
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
    permissions: ["guest:order", "guest:request", "guest:concierge"],
  },
};

export const DEMO_PROPERTY = {
  id: "prop_mumbai_01",
  name: "Madh Island Beach Resort",
  chain: "Vesper Luxury Collection",
  location: "Madh Island, Mumbai, Maharashtra",
  totalRooms: 145,
  liveOccupancy: 78,
  weather: "29°C · Coastal Sunny",
};
