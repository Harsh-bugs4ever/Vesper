"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { LiveStaff } from "@/components/connected/live-staff";

export default function StaffPage() {
  const { isConnected, isReady, sessionExpired } = useAuth();

  if (!isReady) {
    return (
      <p role="status" className="py-12 text-center text-sm text-sage-700">
        Restoring your session…
      </p>
    );
  }

  if (sessionExpired || !isConnected) {
    return (
      <p className="py-12 text-center text-sm text-sage-700">
        Authentication required.{" "}
        <Link href="/login" className="underline font-medium">
          Sign in
        </Link>{" "}
        to view assigned staff duties.
      </p>
    );
  }

  return (
    <>
      <div className="px-4 pt-6 sm:px-8">
        <Link
          href="/staff/supplies"
          className="text-sm font-medium text-sage-700 underline"
        >
          Request supplies and view my requests
        </Link>
      </div>
      <LiveStaff />
    </>
  );
}
