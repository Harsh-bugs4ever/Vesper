"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";

const LIVE_ADMIN_ROUTES = new Set([
  "/admin", "/admin/requests", "/admin/forecast", "/admin/demand-calendar",
  "/admin/financials", "/admin/fnb", "/admin/suppliers", "/admin/purchase-orders",
  "/admin/feedback", "/admin/loyalty", "/admin/payroll", "/admin/reports",
  "/admin/revenue-insights",
]);

export function DataSourceBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isConnected, isReady } = useAuth();
  if (!isReady) return <p role="status" className="py-12 text-center text-sm text-sage-700">Restoring your session…</p>;
  if (!isConnected || LIVE_ADMIN_ROUTES.has(pathname)) return <>{children}</>;

  return <div className="mx-auto max-w-2xl rounded-2xl border border-sand-200 bg-white p-8 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-800">Design preview</p>
    <h1 className="mt-3 font-serif text-3xl text-sage-950">This page uses sample data</h1>
    <p className="mt-4 text-sm leading-6 text-sage-700">You are signed in to live resort data. This module has not been connected to its backend workflow yet, so its sample figures are hidden here to prevent conflicting totals and actions.</p>
    <div className="mt-6 flex flex-wrap gap-3">
      <Link href="/admin" className="rounded-lg bg-sage-700 px-4 py-2.5 text-sm font-medium text-white">Open live dashboard</Link>
      <Link href="/admin/reports" className="rounded-lg border border-sage-300 px-4 py-2.5 text-sm font-medium text-sage-800">View live reports</Link>
    </div>
    <p className="mt-5 text-xs text-sage-600">Use “Switch demo role” in the account menu to explore the sample design.</p>
  </div>;
}
