"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import {
  LayoutDashboard,
  Sparkles,
  BedDouble,
  Wrench,
  PackageCheck,
  Users,
  HeartHandshake,
  FileClock,
  Compass,
  ArrowRightLeft,
  X,
  SlidersHorizontal,
  ShieldCheck,
  ShieldAlert,
  Server,
  KeyRound,
  Utensils,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleSwitcherModal } from "@/components/layout/role-switcher-modal";
import { Badge } from "@/components/ui/badge";

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: "gold" | "dirty" | "sand" | "sage" | "amber";
  requiredRole?: string[];
  requiredPermission?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { user, role, hasPermission } = useAuth();
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Define full navigation catalog with role & permission requirements
  const allNavGroups: NavGroup[] = [
    {
      label: "Decision Layer",
      items: [
        {
          name: "Overview Deck",
          href: "/admin",
          icon: LayoutDashboard,
        },
        {
          name: "AI Action Queue",
          href: "/admin#action-queue",
          icon: Sparkles,
          badge: role === "general_manager" ? "3 High Impact" : "2 Pending",
          badgeColor: "gold",
        },
      ],
    },
    {
      label: "Resort Operations",
      items: [
        {
          name: "Front Desk & Stays",
          href: "/admin#frontdesk",
          icon: BedDouble,
          requiredRole: ["general_manager", "system_admin"],
        },
        {
          name: "Housekeeping Board",
          href: "/admin#housekeeping",
          icon: Compass,
          badge: "15 Dirty",
          badgeColor: "dirty",
          requiredRole: ["general_manager", "dept_manager_hk"],
        },
        {
          name: "Predictive Maintenance",
          href: "/admin#maintenance",
          icon: Wrench,
          badge: "BMS Alert",
          badgeColor: "sand",
          requiredRole: ["general_manager", "dept_manager_hk", "system_admin"],
        },
        {
          name: "Inventory & Stock",
          href: "/admin#inventory",
          icon: PackageCheck,
          badge: role === "dept_manager_fb" ? "Low Bread" : undefined,
          badgeColor: "amber",
          requiredRole: ["general_manager", "dept_manager_fb", "dept_manager_hk"],
        },
      ],
    },
    {
      label: "Team & Guests",
      items: [
        {
          name: "Workforce & Rosters",
          href: "/admin#workforce",
          icon: Users,
          requiredRole: ["general_manager", "dept_manager_fb", "dept_manager_hk"],
        },
        {
          name: "Guest DNA & Concierge",
          href: "/admin#guests",
          icon: HeartHandshake,
          requiredRole: ["general_manager", "dept_manager_fb"],
        },
      ],
    },
    {
      label: "Governance & Systems",
      items: [
        {
          name: "Users & Permission Matrix",
          href: "/admin/users",
          icon: KeyRound,
          badge: "Editor",
          badgeColor: "sage",
          requiredRole: ["general_manager", "system_admin"],
        },
        {
          name: "Resort Settings",
          href: "/admin/settings",
          icon: SlidersHorizontal,
          badge: "145 Rms",
          badgeColor: "sand",
          requiredRole: ["general_manager", "system_admin"],
        },
        {
          name: "Audit Trail",
          href: "/admin#audit",
          icon: FileClock,
        },
      ],
    },
  ];

  // Dynamically filter navigation items based on active role & permissions
  const filteredNavGroups = allNavGroups
    .map((group) => {
      const filteredItems = group.items.filter((item) => {
        // If specific roles required, check match
        if (item.requiredRole && !item.requiredRole.includes(role)) {
          return false;
        }
        // If specific permission required, check permission
        if (item.requiredPermission && !hasPermission(item.requiredPermission)) {
          return false;
        }
        return true;
      });

      return {
        ...group,
        items: filteredItems,
      };
    })
    .filter((group) => group.items.length > 0);

  const getRoleScopeDescription = () => {
    switch (role) {
      case "general_manager":
        return "Executive Authority · Full Property";
      case "system_admin":
        return "IT Systems & Governance Scope";
      case "dept_manager_fb":
        return "Food & Beverage Departmental Scope";
      case "dept_manager_hk":
        return "Housekeeping & Rooms Scope";
      case "employee":
        return "Mobile Operations Attendant";
      default:
        return "Limited Guest Scope";
    }
  };

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 bg-[#faf8f5] border-r border-sand-200/90 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0 shadow-elevated" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="px-6 py-5 border-b border-sand-200/80 bg-white/70 backdrop-blur-sm flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sage-700 via-sage-800 to-sage-900 flex items-center justify-center text-white shadow-soft group-hover:shadow-card transition-all">
              <span className="font-serif text-2xl font-bold tracking-wider text-gold-300">V</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-xl font-bold tracking-tight text-sage-950">
                  VESPER
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-gold-100 text-gold-900 px-1.5 py-0.5 rounded">
                  360
                </span>
              </div>
              <p className="text-[11px] text-sand-600 font-medium tracking-wide">
                Smart Resort Operating Layer
              </p>
            </div>
          </Link>

          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-sand-500 hover:text-sand-800 hover:bg-sand-100"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Resort Location & Active Role Scope Pill */}
        <div className="mx-4 my-3 p-3 rounded-xl bg-sand-100/70 border border-sand-200/80 text-xs">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
              <span className="font-bold text-sand-950 truncate">
                Madh Island Beach Resort
              </span>
            </div>
            <span className="text-[10px] text-sage-800 font-semibold bg-white/80 px-1.5 py-0.5 rounded border border-sand-200 shrink-0">
              145 Rms
            </span>
          </div>

          <div className="pt-2 border-t border-sand-200/60 flex items-center justify-between text-[11px] text-sand-600">
            <span className="truncate">{getRoleScopeDescription()}</span>
          </div>
        </div>

        {/* Role-Filtered Navigation List */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6">
          {filteredNavGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              <p className="px-3 text-[11px] font-semibold tracking-wider text-sand-500 uppercase">
                {group.label}
              </p>
              <div className="space-y-0.5 mt-1">
                {group.items.map((item, itemIdx) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || (item.href === "/admin" && pathname === "/admin");

                  return (
                    <Link
                      key={itemIdx}
                      href={item.href}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group",
                        isActive
                          ? "bg-sage-600 text-white shadow-soft font-semibold"
                          : "text-sand-800 hover:bg-sand-200/60 hover:text-sage-950"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={cn(
                            "w-4 h-4 transition-colors",
                            isActive ? "text-gold-200" : "text-sage-600 group-hover:text-sage-800"
                          )}
                        />
                        <span>{item.name}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-semibold",
                            item.badgeColor === "gold" && "bg-gold-200 text-gold-900",
                            item.badgeColor === "dirty" && "bg-rose-100 text-rose-800",
                            item.badgeColor === "amber" && "bg-amber-100 text-amber-900",
                            item.badgeColor === "sage" && "bg-sage-100 text-sage-800",
                            item.badgeColor === "sand" && "bg-sand-200 text-sand-800",
                            isActive && "bg-white/20 text-white"
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quick Staff/Guest Portal Jump if authorized */}
          <div className="pt-2 px-3">
            <Link
              href="/staff"
              className="flex items-center justify-between text-[11px] text-sand-500 hover:text-sage-800 transition-colors py-1 group"
            >
              <span>Preview Staff Mobile Portal</span>
              <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Current User Profile & Role Switcher Footer */}
        <div className="p-4 border-t border-sand-200/80 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-sage-100 border border-sage-300 flex items-center justify-center text-sage-800 font-semibold text-xs shrink-0">
                {user.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-sand-950 truncate leading-tight">
                  {user.name}
                </p>
                <p className="text-[11px] text-sage-700 truncate font-medium">
                  {user.roleTitle}
                </p>
              </div>
            </div>

            <Badge variant="outline" className="text-[10px] py-0 px-1 bg-sand-50">
              {user.department?.split(" ")[0] || "Admin"}
            </Badge>
          </div>

          <button
            onClick={() => setShowRoleModal(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-sand-300 bg-sand-50/80 hover:bg-sand-100 text-xs font-medium text-sand-800 transition-colors shadow-xs active:scale-[0.99]"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-sage-600" />
            Switch Demo Role
          </button>
        </div>
      </aside>

      <RoleSwitcherModal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
      />
    </>
  );
}
