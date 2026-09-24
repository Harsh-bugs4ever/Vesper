"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Building2, Check, ChevronDown, LogOut, Menu, Search, UserCog } from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { RoleSwitcherModal } from "@/components/layout/role-switcher-modal";
import { cn } from "@/lib/utils";

interface AdminTopBarProps {
  onOpenSidebar: () => void;
}

const NOTIFICATIONS = [
  {
    id: "n1",
    title: "Low inventory alert",
    detail: "Toiletries (Shampoo) below 10 units",
    time: "5:47 PM",
    unread: true,
  },
  {
    id: "n2",
    title: "Maintenance request raised",
    detail: "AC not cooling · Room 318",
    time: "5:54 PM",
    unread: true,
  },
  {
    id: "n3",
    title: "Housekeeping completed",
    detail: "Room 405 · Deluxe Room",
    time: "6:20 PM",
    unread: false,
  },
];

/** Closes a popover on outside click and on Escape. */
function useDismiss(onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onDismiss]);

  return ref;
}

export function AdminTopBar({ onOpenSidebar }: AdminTopBarProps) {
  const { user, logout, property: branch, properties, isConnected } = useAuth();
  const router = useRouter();

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [openMenu, setOpenMenu] = useState<"property" | "alerts" | "profile" | null>(null);
  // Which one is being viewed. Defaults to the user's own branch, and follows it when
  // the backend's answer replaces the placeholder the context starts with.
  const [selectedId, setSelectedId] = useState(branch.id);
  useEffect(() => setSelectedId(branch.id), [branch.id]);

  const property = properties.find((item) => item.id === selectedId) ?? properties[0];

  const menuRef = useDismiss(useCallback(() => setOpenMenu(null), []));
  const unread = isConnected ? 0 : NOTIFICATIONS.filter((item) => item.unread).length;

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  return (
    <>
      <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-sand-200/80 bg-sand-50/90 px-4 backdrop-blur-md sm:px-6">
        <button
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-sand-700 transition-colors hover:bg-sand-100 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div ref={menuRef} className="flex flex-1 items-center gap-3">
          {/* Property switcher */}
          <div className="relative">
            <button
              onClick={() => !isConnected && setOpenMenu(openMenu === "property" ? null : "property")}
              disabled={isConnected}
              title={isConnected ? "Your account is scoped to this property" : "Choose a demo property"}
              className="flex items-center gap-2.5 rounded-xl border border-sand-200 bg-white px-3 py-2 text-left transition-colors hover:bg-sand-50 disabled:cursor-default"
              aria-expanded={openMenu === "property"}
            >
              <Building2 className="h-4 w-4 shrink-0 text-sand-500" />
              <span className="hidden sm:block">
                <span className="block text-sm font-semibold leading-tight text-sand-950">
                  {property.name}
                </span>
                <span className="block text-xs text-sand-500">{property.locality}</span>
              </span>
              {!isConnected && <ChevronDown className="h-4 w-4 shrink-0 text-sand-400" />}
            </button>

            {!isConnected && openMenu === "property" && (
              <div className="animate-in fade-in zoom-in-95 absolute left-0 z-50 mt-2 w-72 rounded-2xl border border-sand-200 bg-white p-1.5 shadow-elevated">
                {properties.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      setOpenMenu(null);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-colors hover:bg-sand-50"
                  >
                    <span>
                      <span className="block text-sm font-medium text-sand-900">{item.name}</span>
                      <span className="block text-xs text-sand-500">{item.locality}</span>
                    </span>
                    {item.id === property.id && <Check className="h-4 w-4 shrink-0 text-sage-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search */}
          {!isConnected && <div className="ml-auto hidden max-w-md flex-1 md:block">
            <label className="relative block">
              <span className="sr-only">Search bookings, guests and rooms</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-400" />
              <input
                type="search"
                placeholder="Search bookings, guests, rooms..."
                className="w-full rounded-xl border border-sand-200 bg-white py-2.5 pl-10 pr-3 text-sm text-sand-900 placeholder:text-sand-400 focus:border-sage-500 focus:outline-none focus:ring-1 focus:ring-sage-500"
              />
            </label>
          </div>}

          {/* Alerts */}
          {!isConnected && <div className="relative ml-auto md:ml-0">
            <button
              onClick={() => setOpenMenu(openMenu === "alerts" ? null : "alerts")}
              className="relative rounded-xl p-2.5 text-sand-600 transition-colors hover:bg-sand-100 hover:text-sand-900"
              aria-label={unread > 0 ? "Alerts, " + unread + " unread" : "Alerts"}
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-sand-50" />
              )}
            </button>

            {openMenu === "alerts" && (
              <div className="animate-in fade-in zoom-in-95 absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-sand-200 bg-white p-4 shadow-elevated">
                <div className="flex items-center justify-between pb-2">
                  <h4 className="font-serif text-base font-semibold text-sand-950">Alerts</h4>
                  <span className="text-xs text-sand-500">{unread} unread</span>
                </div>
                <ul className="divide-y divide-sand-100">
                  {NOTIFICATIONS.map((item) => (
                    <li key={item.id} className="flex items-start gap-2 py-2.5">
                      <span
                        className={cn(
                          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                          item.unread ? "bg-rose-500" : "bg-transparent"
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-sand-900">{item.title}</span>
                        <span className="block text-xs text-sand-600">{item.detail}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-sand-400">{item.time}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>}

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === "profile" ? null : "profile")}
              className="flex items-center gap-2.5 rounded-xl p-1 pr-2 transition-colors hover:bg-sand-100"
              aria-expanded={openMenu === "profile"}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-600 text-xs font-semibold text-white">
                {initials}
              </span>
              <span className="hidden text-left lg:block">
                <span className="block text-sm font-semibold leading-tight text-sand-950">{user.name}</span>
                <span className="block text-xs text-sand-500">{user.roleTitle}</span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-sand-400" />
            </button>

            {openMenu === "profile" && (
              <div className="animate-in fade-in zoom-in-95 absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-sand-200 bg-white p-1.5 shadow-elevated">
                <button
                  onClick={() => {
                    setOpenMenu(null);
                    setShowRoleModal(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-sand-800 transition-colors hover:bg-sand-50"
                >
                  <UserCog className="h-4 w-4 text-sand-500" />
                  Switch demo role
                </button>
                <button
                  onClick={() => {
                    logout();
                    router.push("/login");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-sand-800 transition-colors hover:bg-rose-50 hover:text-rose-700"
                >
                  <LogOut className="h-4 w-4 text-sand-500" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <RoleSwitcherModal isOpen={showRoleModal} onClose={() => setShowRoleModal(false)} />
    </>
  );
}
