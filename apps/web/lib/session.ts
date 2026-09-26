/**
 * Mapping a signed-in backend user onto the `User` shape the components use.
 *
 * The two sides name roles differently — the UI has `general_manager` and
 * `dept_manager_hk`, the backend issues `owner`, `gm`, `manager` plus a separate
 * department field. Translation happens at this boundary. The backend's real permission
 * list is carried through untouched.
 *
 * Gate on permissions, not on the role name. `hasPermission("rates:approve")` keeps
 * working whatever either side calls the job.
 */
import type { BackendProperty, BackendPropertySummary, BackendUser } from "./api";
import { type User, type UserRole } from "./auth";

/** Department keys the backend seeds, used to pick a UI role for a manager. */
const HOUSEKEEPING = "housekeeping";
const FNB = "fnb";
const FRONT_OFFICE = "front_office";

export interface Department {
  id: string;
  key: string;
  name: string;
}

/**
 * Which UI role best represents this backend user.
 *
 * Presentational only — it decides which navigation and dashboard to show. Anything
 * that controls whether an action is *allowed* reads `permissions` instead.
 *
 * Managers outside the three operational areas are mapped to `employee` rather than silently presenting
 * them as F&B managers. Their actual permissions from the backend govern what they
 * can do; the navigation shown is the staff view, which is the lowest-privilege
 * baseline any logged-in user can reach.
 */
export function toUiRole(user: BackendUser, departmentKey?: string): UserRole {
  switch (user.role) {
    case "owner":
    case "gm":
      return "general_manager";
    case "manager":
    case "supervisor":
      if (departmentKey === HOUSEKEEPING) return "dept_manager_hk";
      if (departmentKey === FNB) return "dept_manager_fb";
      if (departmentKey === FRONT_OFFICE) return "dept_manager_frontdesk";
      // A manager in any other department (Engineering, Security, …)
      // uses the staff view. Their effective permissions come from the backend response,
      // not this role label — so they can reach exactly what they are allowed to.
      return "employee";
    case "guest":
      return "guest";
    default:
      return "employee";
  }
}

const ROLE_TITLES: Record<string, string> = {
  owner: "Owner",
  gm: "General Manager",
  manager: "Department Manager",
  supervisor: "Supervisor",
  employee: "Team Member",
  guest: "In-House Guest",
};

export function toUiUser(
  user: BackendUser,
  options: { departments?: Department[]; propertyName?: string } = {},
): User {
  const department = options.departments?.find((d) => d.id === user.department_id);
  const role = toUiRole(user, department?.key);

  return {
    id: user.id,
    name: user.full_name,
    email: user.email,
    role,
    // The backend's own word for the job, not the UI's approximation of it.
    roleTitle: ROLE_TITLES[user.role] ?? user.role,
    department: department?.name,
    departmentId: user.department_id,
    departmentKey: department?.key,
    propertyId: user.property_id,
    propertyName: options.propertyName ?? `Property ${user.property_id.slice(0, 8)}`,
    permissions: user.permissions,
  };
}

/**
 * The shape of a property as the frontend represents it.
 *
 * Fields present in `GET /property` are required. Fields that have no backend endpoint
 * yet are optional; components must render an explicit unavailable state when they are
 * absent rather than inventing values.
 */
export interface Property {
  id: string;
  name: string;
  brand?: string;
  /** Street address, or city when the address has not been set on the backend. */
  location: string;
  totalRooms: number;
  timezone: string;
  currency: string;
  /** "15:00" formatted from check_in_hour */
  checkInTime: string;
  /** "11:00" formatted from check_out_hour */
  checkOutTime: string;
  // ── fields not yet backed by an endpoint ──────────────────────────────────────
  // When these are absent the component must say so, not substitute a fabricated value.
  liveOccupancy?: number;
  weather?: string;
  roomCategories?: {
    code: string;
    name: string;
    count: number;
    baseRate: number;
    floor: string;
  }[];
  outlets?: {
    id: string;
    name: string;
    type: string;
    hours: string;
    capacity: number;
  }[];
  staffHeadcount?: {
    total: number;
    departments: { name: string; count: number; activeOnShift: number }[];
  };
  connectors?: {
    pms?: unknown;
    bms?: unknown;
  };
  aiGuardrails?: {
    confidenceThreshold: number;
    requireHumanApprovalAboveImpactPercent: number;
    highImpactPurchaseThresholdInr: number;
    undoBufferSeconds: number;
    shadowMode: boolean;
    dpdpCompliance: boolean;
  };
}

/** How the backend writes an hour, rendered the way the screens already show one. */
function toClockTime(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * The property as the backend knows it, in the shape the screens read.
 *
 * Only fields the backend actually provides are populated here. Optional fields
 * (outlets, room categories, live occupancy, etc.) are intentionally absent.
 * Screens that need them must show an "unavailable" state until a backend endpoint
 * exists. Inventing plausible-looking values is worse than an honest gap.
 */
export function toUiProperty(backend: BackendProperty): Property {
  return {
    id: backend.id,
    name: backend.name,
    location: backend.address ?? backend.city,
    totalRooms: backend.total_rooms,
    timezone: backend.timezone,
    currency: backend.currency,
    checkInTime: toClockTime(backend.check_in_hour),
    checkOutTime: toClockTime(backend.check_out_hour),
    // Optional fields are deliberately not set here.
    // They will be populated once the corresponding endpoints exist.
  };
}

export interface PropertyOption {
  id: string;
  name: string;
  locality: string;
}

/** The property switcher's list. Same nullable-address rule as above. */
export function toPropertyOptions(rows: BackendPropertySummary[]): PropertyOption[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    locality: row.address ?? row.city,
  }));
}

/** Whether a permission is held. */
export function holdsPermission(permissions: string[], permission: string): boolean {
  return permissions.includes(permission);
}

/** Admin surfaces are for anyone who can read the dashboard or approve a card. */
export function isAdminUser(user: User): boolean {
  return (
    holdsPermission(user.permissions, "dashboard:read") ||
    holdsPermission(user.permissions, "cards:approve") ||
    holdsPermission(user.permissions, "users:read") ||
    holdsPermission(user.permissions, "rates:approve") ||
    holdsPermission(user.permissions, "tasks:manage") ||
    user.role === "general_manager" ||
    user.role === "dept_manager_fb" ||
    user.role === "dept_manager_hk" ||
    user.role === "dept_manager_frontdesk"
  );
}
