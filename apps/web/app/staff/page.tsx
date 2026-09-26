"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { LiveStaff } from "@/components/connected/live-staff";

export default function StaffPage() {
  const { isReady, isConnected } = useAuth();
  if (!isReady) return <p role="status" className="p-8">Restoring your session…</p>;
  if (!isConnected) return <p className="p-8">Please <Link className="underline" href="/login">sign in</Link> to view your work.</p>;
  return <><div className="px-4 pt-6 sm:px-8"><Link href="/staff/supplies" className="text-sm font-medium text-sage-700 underline">Request supplies and view my requests</Link></div><LiveStaff /></>;
}
