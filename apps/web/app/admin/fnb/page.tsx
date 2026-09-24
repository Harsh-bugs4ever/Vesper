"use client";

import { ConnectedOverview } from "@/components/connected/connected-overview";
import { loadFoodAndBeverage } from "@/lib/api/overviews";

export default function Page() {
  return <ConnectedOverview title="Food & Beverage" description="Room-service order book and service performance." queryKey="fnb" load={loadFoodAndBeverage} />;
}
