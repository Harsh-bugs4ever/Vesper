"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import {
  MapPin,
  ArrowRightLeft,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";
import { RoleSwitcherModal } from "@/components/layout/role-switcher-modal";

export function StaffHeader() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isOnDuty, setIsOnDuty] = useState(true);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const toggleAttendance = () => {
    const newState = !isOnDuty;
    setIsOnDuty(newState);
    if (newState) {
      showToast({
        title: "Shift Started · GPS & QR Verified",
        description: "Checked into Madh Island Beach Resort at 07:02 AM. Today's task list loaded.",
        type: "success",
      });
    } else {
      showToast({
        title: "Shift Ended · Handover Recorded",
        description: "Clocked out. 8 tasks completed today. Good job!",
        type: "default",
      });
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-sand-200 px-4 py-3 shadow-soft">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          {/* Staff Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sage-100 border border-sage-300 flex items-center justify-center font-bold text-sage-800 text-sm shadow-xs">
              RP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-sand-950">{user.name}</h2>
                <Badge variant="sage" className="text-[10px] py-0 px-1.5">
                  {user.department || "Housekeeping"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-sand-500 mt-0.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-sage-600" />
                  Floor 4 · Ocean Wing
                </span>
              </div>
            </div>
          </div>

          {/* Attendance Toggle & Role Switch */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAttendance}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-xs ${
                isOnDuty
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100"
                  : "bg-sand-100 text-sand-600 border border-sand-200 hover:bg-sand-200"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnDuty ? "bg-emerald-500 animate-pulse" : "bg-sand-400"
                }`}
              />
              <span>{isOnDuty ? "On Duty" : "Clock In"}</span>
            </button>

            <Link
              href="/staff/reviews"
              className="p-2 rounded-lg border border-sand-200 bg-sand-50 text-sand-600 hover:text-sand-900 transition-colors"
              title="Review departing guests"
            >
              <Star className="w-4 h-4" />
            </Link>

            <button
              onClick={() => setShowRoleModal(true)}
              className="p-2 rounded-lg border border-sand-200 bg-sand-50 text-sand-600 hover:text-sand-900 transition-colors"
              title="Switch Demo Role"
            >
              <ArrowRightLeft className="w-4 h-4" />
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
