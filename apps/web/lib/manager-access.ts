import type { UserRole } from "@/lib/auth";

export const MANAGER_ROUTES: Partial<Record<UserRole, readonly string[]>> = {
  dept_manager_hk: ["/admin", "/admin/housekeeping", "/admin/maintenance"],
  dept_manager_fb: ["/admin", "/admin/fnb"],
  dept_manager_frontdesk: ["/admin", "/admin/front-desk"],
};

export function canVisitManagerRoute(role: UserRole | null, path: string): boolean {
  if (!role || role === "general_manager") return true;
  const routes = MANAGER_ROUTES[role];
  return Boolean(routes?.some((route) => path === route || (route !== "/admin" && path.startsWith(`${route}/`))));
}
