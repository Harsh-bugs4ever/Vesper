"use client";

import { ConnectedOverview } from "@/components/connected/connected-overview";
import { loadReports } from "@/lib/api/overviews";

export default function Page() {
  return <ConnectedOverview title="Operational reports" description="Current totals from reservations, service requests and purchasing." queryKey="reports" load={loadReports} />;
}
