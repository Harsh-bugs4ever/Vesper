"use client";

import { ConnectedOverview } from "@/components/connected/connected-overview";
import { loadPayroll } from "@/lib/api/overviews";

export default function Page() {
  return <ConnectedOverview title="Attendance and payroll" description="Recorded attendance and hours available for payroll preparation." queryKey="payroll" load={loadPayroll} />;
}
