import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loading state for the admin dashboard.
 * Mirrors the exact layout of the real dashboard so the transition feels seamless.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-sand-200/80 bg-white p-5 shadow-soft">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action queue banner */}
      <Skeleton className="h-16 w-full rounded-2xl" />

      {/* Charts and activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-sand-200/80 bg-white p-6 shadow-soft">
            <Skeleton className="h-5 w-40 mb-4" />
            <Skeleton className="h-[200px] w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-sand-200/80 bg-white p-6 shadow-soft">
                <Skeleton className="h-5 w-36 mb-4" />
                <Skeleton className="h-[160px] w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-sand-200/80 bg-white p-6 shadow-soft">
          <Skeleton className="h-5 w-28 mb-4" />
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for generic panel with table layout.
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-sand-200/80 bg-white shadow-soft overflow-hidden">
      {/* Header */}
      <div className="border-b border-sand-200/80 bg-sand-50/40 px-6 py-3.5">
        <Skeleton className="h-4 w-full" />
      </div>
      {/* Rows */}
      <div className="divide-y divide-sand-100">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-3.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for stat tiles row.
 */
export function StatTileSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-sand-200/80 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-7 w-14" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
