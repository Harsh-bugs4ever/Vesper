/**
 * Mapping a signed-in backend user onto the `User` shape the components already use.
 *
 * The two sides name roles differently — the UI has `general_manager` and
 * `dept_manager_hk`, the backend issues `owner`, `gm`, `manager` plus a separate
 * department. Rather than force one to rename, this translates at the boundary and
 * carries the backend's real permission list through untouched.
 *
 * Gate on permissions, not on the role name. `hasPermission("rates:approve")` keeps
 * working whatever either side calls the job.
 */
import type { BackendProperty, BackendPropertySummary, BackendUser } from "./api";
import { DEMO_PROPERTY, DEMO_USERS, type User, type UserRole } from "./auth";

/** Department keys the backend seeds, used to pick a UI role for a manager. */
const HOUSEKEEPING = "housekeeping";
const FNB = "fnb";

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
      // Any other department still needs a manager's screens; F&B is the closest
      // existing layout until per-department views land.
      return "dept_manager_fb";
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
    propertyId: user.property_id,
    propertyName: options.propertyName ?? DEMO_USERS[role].propertyName,
    permissions: user.permissions,
  };
}

export type Property = typeof DEMO_PROPERTY;

/** How the backend writes an hour, rendered the way the screens already show one. */
function toClockTime(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * The property as the backend knows it, in the shape the screens already read.
 *
 * Name, address, room count, timezone, currency and the check-in/out hours are facts
 * about the business, so they come from `GET /property` — printing them from a
 * constant compiled into the bundle meant the address on screen and the property in
 * the database could disagree and nothing would notice.
 *
 * The rest of `DEMO_PROPERTY` is kept as the base: outlets, room categories, the
 * headcount table and the live weather have no backend field behind them yet, and
 * blanking those screens would be a worse answer than showing the demo's version of
 * them. Each is a candidate for the same treatment as an endpoint appears.
 *
 * `address` is nullable server-side; when it is null the city is the honest answer,
 * because inventing a street for a property that has not recorded one is how the
 * hardcoded address got there in the first place.
 */
export function toUiProperty(backend: BackendProperty): Property {
  return {
    ...DEMO_PROPERTY,
    id: backend.id,
    name: backend.name,
    location: backend.address ?? backend.city,
    totalRooms: backend.total_rooms,
    timezone: backend.timezone,
    currency: backend.currency,
    checkInTime: toClockTime(backend.check_in_hour),
    checkOutTime: toClockTime(backend.check_out_hour),
  };
}

export interface PropertyOption {
  id: string;
  name: string;
  locality: string;
}

/** The switcher's list. Same nullable-address rule as above. */
export function toPropertyOptions(rows: BackendPropertySummary[]): PropertyOption[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    locality: row.address ?? row.city,
  }));
}

/**
 * Whether a permission is held.
 *
 * The mock users carry a wildcard `"all"`; real backend users never do — every
 * permission is listed explicitly. Honouring both keeps demo mode and connected mode
 * behaving identically from a component's point of view.
 */
export function holdsPermission(permissions: string[], permission: string): boolean {
  return permissions.includes("all") || permissions.includes(permission);
}

/** Admin surfaces are for anyone who can read the dashboard or approve a card. */
export function isAdminUser(user: User): boolean {
  return (
    holdsPermission(user.permissions, "dashboard:read") ||
    holdsPermission(user.permissions, "cards:approve") ||
    holdsPermission(user.permissions, "users:read")
  );
}
