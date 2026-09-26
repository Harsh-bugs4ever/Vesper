"use client";

import { ConnectedOverview } from "@/components/connected/connected-overview";
import { loadRevenueInsights } from "@/lib/api/overviews";

export default function Page() {
  return <ConnectedOverview title="Revenue changes" description="Room rate movements by department and room category." queryKey="revenue-insights" load={loadRevenueInsights} />;
}
