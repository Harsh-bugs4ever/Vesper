"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import {
  Bell,
  Search,
  Menu,
  Sun,
  Sparkles,
  Building2,
  ChevronDown,
  LogOut,
  Check,
  Settings,
} from "lucide-react";
import { RoleSwitcherModal } from "@/components/layout/role-switcher-modal";
import { useRouter } from "next/navigation";

interface AdminTopBarProps {
  onOpenSidebar: () => void;
}

export function AdminTopBar({ onOpenSidebar }: AdminTopBarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPropertyMenu, setShowPropertyMenu] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState("Madh Island Beach Resort");

  const properties = [
    { name: "Madh Island Beach Resort", location: "Mumbai (145 Rooms)", active: true },
    { name: "JW Marriott Mumbai Juhu", location: "Juhu, Mumbai (355 Rooms)", active: false },
    { name: "Vesper Mandwa Sands", location: "Alibaug (40 Villas)", active: false },
  ];

  const notifications = [
    {
      id: 1,
      title: "AI Rate Recommendation",
      time: "10m ago",
      desc: "+12% ADR suggested for Weekend Ocean Deluxe rooms (demand surge).",
      unread: true,
      type: "revenue",
    },
    {
      id: 2,
      title: "Chiller #2 Vibration Alert",
      time: "24m ago",
      desc: "Maintenance AI flagged minor bearing anomaly. Quiet-day repair queued.",
      unread: true,
      type: "maintenance",
    },
    {
      id: 3,
      title: "Club Sandwich Stock Auto-Deduct",
      time: "1h ago",
      desc: "Room 412 order completed. Multigrain bread dropped to reorder level.",
      unread: false,
      type: "inventory",
    },
  ];

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-md border-b border-sand-200/90 px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Left Section: Mobile Menu + Property Switcher */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSidebar}
            className="lg:hidden p-2 rounded-lg text-sand-700 hover:bg-sand-100 hover:text-sand-950 transition-colors"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Property Selector */}
          <div className="relative">
            <button
              onClick={() => setShowPropertyMenu(!showPropertyMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-sand-200 bg-sand-50/60 hover:bg-sand-100/80 transition-colors text-left"
            >
              <Building2 className="w-4 h-4 text-sage-600 shrink-0" />
              <div className="hidden sm:block">
                <span className="text-xs font-semibold text-sand-950 block leading-tight">
                  {selectedProperty}
                </span>
                <span className="text-[10px] text-sand-500 font-medium block">
                  Mumbai · Beachfront Boutique
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-sand-400 ml-1" />
            </button>

            {showPropertyMenu && (
              <div className="absolute left-0 mt-1 w-64 rounded-xl bg-white border border-sand-200 shadow-elevated py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1 text-[10px] font-semibold text-sand-400 uppercase tracking-wider">
                  Select Property
                </div>
                {properties.map((prop, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedProperty(prop.name);
                      setShowPropertyMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-sand-50 flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-sand-900">{prop.name}</p>
                      <p className="text-[11px] text-sand-500">{prop.location}</p>
                    </div>
                    {prop.name === selectedProperty && (
                      <Check className="w-4 h-4 text-sage-600" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Live Resort Telemetry Pill */}
        <div className="hidden md:flex items-center gap-4 px-3.5 py-1.5 rounded-full bg-sand-100/70 border border-sand-200/80 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-sand-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>78% Occupancy</span>
          </div>
          <span className="text-sand-300">|</span>
          <div className="flex items-center gap-1 text-sand-700">
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span>29°C Mumbai Sunny</span>
          </div>
          <span className="text-sand-300">|</span>
          <div className="flex items-center gap-1 text-sage-700 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-gold-500" />
            <span>AI Decision Loop: Ready</span>
          </div>
        </div>

        {/* Right Section: Search, Notifications, Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Search */}
          <div className="relative hidden xl:block w-48">
            <Search className="w-3.5 h-3.5 text-sand-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search rooms, staff..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-sand-200 bg-sand-50/50 focus:bg-white focus:outline-none focus:border-sage-500 transition-all"
            />
          </div>

          {/* Notifications Center */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg text-sand-600 hover:text-sand-950 hover:bg-sand-100/80 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-gold-500 ring-2 ring-white" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-sand-200 shadow-elevated p-4 z-50 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-sand-100">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-sand-950">Resort Alerts</h4>
                    <span className="text-[10px] bg-gold-100 text-gold-900 font-bold px-1.5 py-0.5 rounded-full">
                      2 new
                    </span>
                  </div>
                  <span className="text-[11px] text-sage-700 font-medium cursor-pointer hover:underline">
                    Mark all read
                  </span>
                </div>

                <div className="py-2 divide-y divide-sand-100 max-h-64 overflow-y-auto">
                  {notifications.map((item) => (
                    <div key={item.id} className="py-2.5 first:pt-1 last:pb-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-sand-900 flex items-center gap-1.5">
                          {item.unread && <span className="w-1.5 h-1.5 rounded-full bg-gold-500" />}
                          {item.title}
                        </span>
                        <span className="text-[10px] text-sand-400">{item.time}</span>
                      </div>
                      <p className="text-[11px] text-sand-600 leading-snug">{item.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-sand-100 text-center">
                  <a href="/admin#action-queue" className="text-xs font-medium text-sage-700 hover:text-sage-900">
                    Open Action Queue &rarr;
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Settings Quick Access for Admin/GM */}
          {["system_admin", "general_manager"].includes(user.role) && (
            <button
              onClick={() => router.push("/admin/settings")}
              className="p-2 rounded-lg text-sand-600 hover:text-sand-950 hover:bg-sand-100/80 transition-colors"
              title="Resort Settings & Connectors"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* User Profile Chip */}
          <div className="flex items-center gap-2 pl-2 border-l border-sand-200">
            <button
              onClick={() => setShowRoleModal(true)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-lg border border-sand-200 bg-sand-50/50 hover:bg-sand-100/80 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-sage-600 text-white flex items-center justify-center text-xs font-semibold shadow-xs">
                {user.name[0]}
              </div>
              <div className="hidden md:block text-left">
                <span className="text-xs font-semibold text-sand-900 block leading-tight">
                  {user.name}
                </span>
                <span className="text-[10px] text-sage-700 font-medium block">
                  {user.roleTitle}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-sand-400 ml-0.5" />
            </button>

            <button
              onClick={handleLogout}
              className="p-1.5 text-sand-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <RoleSwitcherModal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
      />
    </>
  );
}
