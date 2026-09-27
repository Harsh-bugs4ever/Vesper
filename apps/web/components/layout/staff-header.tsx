"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export function StaffHeader() {
  const { user, isConnected, isReady, sessionExpired } = useAuth();
  const attendance = useQuery({
    queryKey: ["staff-header-attendance", user?.id],
    enabled: isConnected && Boolean(user?.id),
    queryFn: () => api.get<{ checked_in_at: string; checked_out_at: string | null }[]>("/attendance/me", { days: 1 }),
  });
  const liveOnDuty = attendance.data?.some((record) => record.checked_out_at == null) ?? false;

  if (!isReady || sessionExpired || !user) return <header className="h-16 border-b border-sand-200 bg-white" aria-hidden="true" />;

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-sand-200 px-4 py-3 shadow-soft">
      <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
        {/* Staff Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sage-100 border border-sage-300 flex items-center justify-center font-bold text-sage-800 text-sm shadow-xs">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-sand-950">{user.name}</h2>
              <Badge variant="sage" className="text-[10px] py-0 px-1.5">
                {user.department || "Staff"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Shift status & action links */}
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              liveOnDuty
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-sand-200 bg-sand-100 text-sand-600"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${liveOnDuty ? "bg-emerald-500" : "bg-sand-400"}`} />
            {attendance.isPending
              ? "Checking shift"
              : attendance.isError
              ? "Shift unavailable"
              : liveOnDuty
              ? "On duty"
              : "Off duty"}
          </span>

          <Link
            href="/staff/reviews"
            className="p-2 rounded-lg border border-sand-200 bg-sand-50 text-sand-600 hover:text-sand-900 transition-colors"
            title="My guest ratings"
            aria-label="My guest ratings"
          >
            <Star className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
