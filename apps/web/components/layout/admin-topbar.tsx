"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, LogOut, Menu, Sparkles } from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";

interface AdminTopBarProps {
  onOpenSidebar: () => void;
}

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
  const { user, logout, property: branch, properties } = useAuth();
  const router = useRouter();

  const [openMenu, setOpenMenu] = useState<"property" | "profile" | null>(null);
  const [selectedId, setSelectedId] = useState(branch?.id ?? "");

  useEffect(() => {
    if (branch?.id) {
      setSelectedId(branch.id);
    }
  }, [branch?.id]);

  const activeProperty =
    properties.find((item) => item.id === selectedId) ??
    (branch ? { id: branch.id, name: branch.name, locality: branch.location } : properties[0]);

  const menuRef = useDismiss(useCallback(() => setOpenMenu(null), []));

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "—";

  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-sand-200/80 bg-sand-50/90 px-4 backdrop-blur-md sm:px-6">
      <button
        onClick={onOpenSidebar}
        className="rounded-lg p-2 text-sand-700 transition-colors hover:bg-sand-100 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div ref={menuRef} className="flex flex-1 items-center justify-between gap-3">
        {/* Property indicator / picker */}
        <div className="relative">
          <button
            onClick={() => properties.length > 1 && setOpenMenu(openMenu === "property" ? null : "property")}
            disabled={properties.length <= 1}
            title={activeProperty?.name ?? "Property"}
            className="flex items-center gap-2.5 rounded-xl border border-sand-200 bg-white px-3 py-2 text-left transition-colors hover:bg-sand-50 disabled:cursor-default"
            aria-expanded={openMenu === "property"}
          >
            <Building2 className="h-4 w-4 shrink-0 text-sand-500" />
            <span className="hidden sm:block">
              <span className="block text-sm font-semibold leading-tight text-sand-950">
                {activeProperty?.name ?? "Property"}
              </span>
              <span className="block text-xs text-sand-500">{activeProperty?.locality ?? ""}</span>
            </span>
            {properties.length > 1 && <ChevronDown className="h-4 w-4 shrink-0 text-sand-400" />}
          </button>

          {properties.length > 1 && openMenu === "property" && (
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
                  {item.id === activeProperty?.id && <Check className="h-4 w-4 shrink-0 text-sage-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Link to Guest Demo Mode for Seamless End-to-End Demo Presentation */}
        <Link
          href="/guest"
          target="_blank"
          title="Open Guest Portal in Demo Mode (Suite 405 · Rohan Mehta)"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-gold-300/80 bg-gold-50/80 px-3 py-2 text-xs font-semibold text-gold-900 shadow-sm transition hover:bg-gold-100 active:scale-95"
        >
          <Sparkles className="h-3.5 w-3.5 text-gold-600" />
          <span>Guest Portal (Demo 405)</span>
        </Link>

        {/* Profile */}
        <div className="relative ml-2 sm:ml-0">
          <button
            onClick={() => setOpenMenu(openMenu === "profile" ? null : "profile")}
            className="flex items-center gap-2.5 rounded-xl p-1 pr-2 transition-colors hover:bg-sand-100"
            aria-expanded={openMenu === "profile"}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-600 text-xs font-semibold text-white">
              {initials}
            </span>
            <span className="hidden text-left lg:block">
              <span className="block text-sm font-semibold leading-tight text-sand-950">{user?.name ?? "Staff"}</span>
              <span className="block text-xs text-sand-500">{user?.roleTitle ?? ""}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-sand-400" />
          </button>

          {openMenu === "profile" && (
            <div className="animate-in fade-in zoom-in-95 absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-sand-200 bg-white p-1.5 shadow-elevated">
              <div className="px-3 py-2 border-b border-sand-100 mb-1 lg:hidden">
                <span className="block text-sm font-semibold text-sand-950">{user?.name}</span>
                <span className="block text-xs text-sand-500">{user?.email}</span>
              </div>
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
  );
}
