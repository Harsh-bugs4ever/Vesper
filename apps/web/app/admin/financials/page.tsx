"use client";

import { ConnectedOverview } from "@/components/connected/connected-overview";
import { loadFinancials } from "@/lib/api/overviews";

export default function Page() {
  return <ConnectedOverview title="Financials" description="Booked room value and reservation status from the live system." queryKey="financials" load={loadFinancials} />;
}
