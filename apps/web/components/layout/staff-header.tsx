"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";
import { ClipboardList, LogOut, Package, Star, Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function StaffHeader() {
  const { user, isConnected, isReady, sessionExpired, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const attendance = useQuery({
    queryKey: ["staff-header-attendance", user?.id],
    enabled: isConnected && Boolean(user?.id),
    queryFn: () => api.get<{ checked_in_at: string; checked_out_at: string | null }[]>("/attendance/me", { days: 1 }),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
  const liveOnDuty = attendance.data?.some((record) => record.checked_out_at == null) ?? false;

  if (!isReady || sessionExpired || !user) return <header className="h-[72px] border-b border-sand-200 bg-white" aria-hidden="true" />;

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const links = [
    { href: "/staff", label: "My shift", icon: ClipboardList },
    { href: "/staff/supplies", label: "Supplies", icon: Package },
    { href: "/staff/reviews", label: "Guest reviews", icon: Star },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-sand-200/80 bg-white/95 shadow-[0_4px_24px_-18px_rgba(30,54,42,.35)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Link href="/staff" className="group flex shrink-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-600">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sage-800 text-gold-300 shadow-sm transition-transform group-hover:-rotate-6">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="hidden sm:block">
              <span className="block font-serif text-lg leading-none tracking-[0.12em] text-sage-950">VESPER</span>
              <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.16em] text-sand-500">Team workspace</span>
            </span>
          </Link>

          <span className="hidden h-8 w-px bg-sand-200 sm:block" aria-hidden="true" />

          <nav aria-label="Staff workspace" className="flex items-center gap-1 overflow-x-auto">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors sm:px-3.5 sm:text-sm",
                    active ? "bg-sage-50 text-sage-900" : "text-sand-600 hover:bg-sand-50 hover:text-sage-900"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden md:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1.5 text-[10px] font-semibold sm:px-2.5 sm:text-[11px]",
            liveOnDuty ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-sand-200 bg-sand-50 text-sand-600"
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", liveOnDuty ? "bg-emerald-500" : "bg-sand-400")} />
            {attendance.isPending ? "Checking shift" : attendance.isError ? "Shift unavailable" : liveOnDuty ? "On shift" : "Off shift"}
          </span>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sage-200 bg-sage-100 text-xs font-bold text-sage-800">{initials}</div>
            <div className="hidden min-w-0 lg:block">
              <p className="max-w-40 truncate text-xs font-semibold text-sage-950">{user.name}</p>
              <p className="max-w-40 truncate text-[10px] text-sand-500">{user.department || user.roleTitle || "Team member"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { logout(); router.push("/login"); }}
            aria-label="Sign out"
            title="Sign out"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-sand-200 text-sand-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-600"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-gold-300/70 to-transparent" />
    </header>
  );
}
