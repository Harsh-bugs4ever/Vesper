"use client";

import { useState } from "react";
import { ConnectedOverview } from "@/components/connected/connected-overview";
import { loadReports, loadRevenueInsights } from "@/lib/api/overviews";

export default function Page() {
  const [tab, setTab] = useState<"operations" | "revenue">("operations");
  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist" aria-label="Report category">
        {(["operations", "revenue"] as const).map((value) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value}
            className={`rounded-lg border px-3 py-2 text-sm ${tab === value ? "border-sage-700 bg-sage-50 text-sage-900" : "border-sand-200 text-sand-700"}`}
            onClick={() => setTab(value)}>
            {value === "operations" ? "Operations" : "Revenue changes"}
          </button>
        ))}
      </div>
      {tab === "operations" ? (
        <ConnectedOverview title="Operational reports" description="Current totals from reservations, service requests and purchasing." queryKey="reports" load={loadReports} />
      ) : (
        <ConnectedOverview title="Revenue changes" description="Recorded rate changes and their sources." queryKey="revenue-insights" load={loadRevenueInsights} />
      )}
    </div>
  );
}
