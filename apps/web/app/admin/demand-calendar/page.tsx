"use client";

import { ConnectedOverview } from "@/components/connected/connected-overview";
import { loadDemandCalendar } from "@/lib/api/overviews";

export default function Page() {
  return <ConnectedOverview title="Demand calendar" description="Nightly rates and projected occupancy by room category." queryKey="demand-calendar" load={loadDemandCalendar} />;
}
