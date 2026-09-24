"use client";

import { ConnectedOverview } from "@/components/connected/connected-overview";
import { loadRevenueInsights } from "@/lib/api/overviews";

export default function Page() {
  return <ConnectedOverview title="Revenue insights" description="Recorded rate changes and their sources." queryKey="revenue-insights" load={loadRevenueInsights} />;
}
