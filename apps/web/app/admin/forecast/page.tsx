"use client";

import { ConnectedOverview } from "@/components/connected/connected-overview";
import { loadForecast } from "@/lib/api/overviews";

export default function Page() {
  return <ConnectedOverview title="Forecast" description="90-day demand outlook with confidence ranges and projected daily rates." queryKey="forecast" load={loadForecast} />;
}
