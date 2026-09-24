"use client";

import { ConnectedOverview } from "@/components/connected/connected-overview";
import { loadLoyalty } from "@/lib/api/overviews";

export default function Page() {
  return <ConnectedOverview title="Loyalty" description="Guest tiers and VIP coverage from the guest directory." queryKey="loyalty" load={loadLoyalty} />;
}
