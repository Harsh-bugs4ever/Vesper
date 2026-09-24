"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowRightLeft,
  Award,
  BedDouble,
  Boxes,
  BrainCircuit,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  ConciergeBell,
  Contact,
  GraduationCap,
  Heart,
  LayoutGrid,
  LineChart,
  MessageSquare,
  MessagesSquare,
  Package,
  ReceiptText,
  Settings,
  SlidersHorizontal,
  Sprout,
  Tags,
  Truck,
  Users,
  UsersRound,
  UtensilsCrossed,
  Wallet,
  Wrench,
  X,
  Zap,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { RoleSwitcherModal } from "@/components/layout/role-switcher-modal";
import { VesperMark } from "@/components/layout/vesper-mark";
import { cn } from "@/lib/utils";

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Roles allowed to see the link. Omitted means everyone with admin access. */
  roles?: string[];
}

const MANAGEMENT = ["system_admin", "general_manager"];

interface NavGroup {
  /** Omitted for the ungrouped first entry (Dashboard). */
  label?: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    items: [{ name: "Dashboard", href: "/admin", icon: LayoutGrid }],
  },
  {
    label: "Operations",
    items: [
      { name: "Reservations", href: "/admin/reservations", icon: CalendarDays },
      { name: "Front Desk", href: "/admin/front-desk", icon: ConciergeBell },
      {
        name: "Housekeeping",
        href: "/admin/housekeeping",
        icon: BedDouble,
        roles: ["system_admin", "general_manager", "dept_manager_hk"],
      },
      {
        name: "F&B",
        href: "/admin/fnb",
        icon: UtensilsCrossed,
        roles: ["system_admin", "general_manager", "dept_manager_fb"],
      },
      { name: "Maintenance", href: "/admin/maintenance", icon: Wrench },
      { name: "Guest Requests", href: "/admin/requests", icon: ClipboardList },
      { name: "Guest Chat", href: "/admin/guest-chat", icon: MessagesSquare },
    ],
  },
  {
    label: "Revenue",
    items: [
      { name: "Reports", href: "/admin/reports", icon: LineChart, roles: MANAGEMENT },
      { name: "Rate Management", href: "/admin/rates", icon: Tags, roles: MANAGEMENT },
      { name: "Revenue Forecast", href: "/admin/forecast", icon: Activity, roles: MANAGEMENT },
      { name: "What-If Simulator", href: "/admin/simulator", icon: SlidersHorizontal, roles: MANAGEMENT },
      { name: "Demand Calendar", href: "/admin/demand-calendar", icon: CalendarRange, roles: MANAGEMENT },
      { name: "Financials", href: "/admin/financials", icon: Wallet, roles: MANAGEMENT },
    ],
  },
  {
    label: "People",
    items: [
      { name: "Staff Roster", href: "/admin/roster", icon: UsersRound },
      { name: "Attendance", href: "/admin/staff", icon: Users },
      { name: "Performance", href: "/admin/performance", icon: Award },
      { name: "Payroll", href: "/admin/payroll", icon: ReceiptText, roles: MANAGEMENT },
      { name: "AI Learning", href: "/admin/training", icon: GraduationCap },
    ],
  },
  {
    label: "Guests",
    items: [
      { name: "Guest Profiles", href: "/admin/guests", icon: Contact },
      { name: "Loyalty", href: "/admin/loyalty", icon: Heart },
      { name: "Communications", href: "/admin/communications", icon: MessageSquare },
      { name: "Guest Feedback", href: "/admin/feedback", icon: Award },
    ],
  },
  {
    label: "Property",
    items: [
      { name: "Resort Twin (3D)", href: "/admin/rooms", icon: Boxes },
      { name: "Inventory", href: "/admin/inventory", icon: Package },
      { name: "Suppliers", href: "/admin/suppliers", icon: Truck },
      { name: "Purchase Orders", href: "/admin/purchase-orders", icon: ReceiptText },
      { name: "Settings", href: "/admin/settings", icon: Settings, roles: MANAGEMENT },
    ],
  },
  {
    label: "AI & Analytics",
    items: [
      { name: "Action Queue", href: "/admin/actions", icon: Zap, roles: MANAGEMENT },
      { name: "Model Performance", href: "/admin/model-performance", icon: BrainCircuit, roles: MANAGEMENT },
      { name: "Data Insights", href: "/admin/data-insights", icon: LineChart, roles: MANAGEMENT },
      { name: "Model Settings", href: "/admin/model-settings", icon: Settings, roles: MANAGEMENT },
    ],
  },
];

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { user, role } = useAuth();
  const [showRoleModal, setShowRoleModal] = useState(false);

  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      {/* Scrim for the mobile drawer. */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-sand-950/20 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sand-200/80 bg-white transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0 shadow-elevated" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-6 pb-5 pt-6">
          <Link href="/admin" className="group flex items-center gap-2.5">
            <VesperMark className="h-6 w-6 shrink-0 text-gold-500" />
            <span>
              <span className="block font-serif text-2xl font-semibold leading-none tracking-wide text-sand-950">
                VESPER
              </span>
              <span className="mt-1 block text-[11px] font-medium tracking-wide text-sand-500">
                Hospitality, Simplified
              </span>
            </span>
          </Link>

          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-sand-500 hover:bg-sand-100 hover:text-sand-800 lg:hidden"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
          {groups.map((group, groupIdx) => (
            <div key={group.label ?? `group-${groupIdx}`}>
              {group.label && (
                <p className="px-3 pb-1.5 text-xs font-medium text-sand-500">{group.label}</p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  // `/admin` must match exactly or it lights up on every child route.
                  const isActive =
                    item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                          isActive
                            ? "bg-sage-50 font-semibold text-sage-900"
                            : "font-medium text-sand-700 hover:bg-sand-50 hover:text-sand-950"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0",
                            isActive ? "text-sage-700" : "text-sand-500"
                          )}
                        />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* House note, and the demo role switch tucked under it. */}
        <div className="space-y-3 px-4 pb-5">
          <div className="flex items-start gap-3 rounded-2xl bg-sage-50/70 p-4">
            <Sprout className="mt-0.5 h-4 w-4 shrink-0 text-sage-600" />
            <p className="font-serif text-sm leading-snug text-sage-900">
              Great stays build brighter tomorrows.
              <span className="mt-1.5 block text-sand-400">—</span>
            </p>
          </div>

          <button
            onClick={() => setShowRoleModal(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-sand-200 py-2 text-xs font-medium text-sand-600 transition-colors hover:bg-sand-50 hover:text-sand-900"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Viewing as {user.roleTitle}
          </button>
        </div>
      </aside>

      <RoleSwitcherModal isOpen={showRoleModal} onClose={() => setShowRoleModal(false)} />
    </>
  );
}
