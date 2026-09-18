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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleSwitcherModal } from "@/components/layout/role-switcher-modal";

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [showRoleModal, setShowRoleModal] = useState(false);

  const navGroups = [
    {
      label: "Decision Layer",
      items: [
        {
          name: "Overview",
          href: "/admin",
          icon: LayoutDashboard,
        },
        {
          name: "AI Action Queue",
          href: "/admin#action-queue",
          icon: Sparkles,
          badge: "3 Pending",
          badgeColor: "gold",
        },
      ],
    },
    {
      label: "Operations",
      items: [
        {
          name: "Front Desk & Stays",
          href: "/admin#frontdesk",
          icon: BedDouble,
        },
        {
          name: "Housekeeping Board",
          href: "/admin#housekeeping",
          icon: Compass,
          badge: "15 Dirty",
          badgeColor: "dirty",
        },
        {
          name: "Predictive Maintenance",
          href: "/admin#maintenance",
          icon: Wrench,
          badge: "BMS Alert",
          badgeColor: "sand",
        },
        {
          name: "Inventory & Stock",
          href: "/admin#inventory",
          icon: PackageCheck,
        },
      ],
    },
    {
      label: "Team & Guests",
      items: [
        {
          name: "Workforce Roster",
          href: "/admin#workforce",
          icon: Users,
        },
        {
          name: "Guest DNA & Concierge",
          href: "/admin#guests",
          icon: HeartHandshake,
        },
      ],
    },
    {
      label: "Governance",
      items: [
        {
          name: "Audit Trail & Settings",
          href: "/admin#audit",
          icon: FileClock,
        },
      ],
    },
  ];

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

        {/* Resort Location Pill */}
        <div className="mx-4 my-3 p-2.5 rounded-lg bg-sand-100/60 border border-sand-200/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
            <span className="font-medium text-sand-800 truncate">
              Madh Island Beach Resort
            </span>
          </div>
          <span className="text-[11px] text-sage-700 font-semibold shrink-0">145 Rms</span>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6">
          {navGroups.map((group, groupIdx) => (
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
        </div>

        {/* Current User & Role Switcher Footer */}
        <div className="p-4 border-t border-sand-200/80 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-sage-100 border border-sage-300 flex items-center justify-center text-sage-800 font-semibold text-xs shrink-0">
                {user.name.split(" ").map(n => n[0]).join("")}
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
