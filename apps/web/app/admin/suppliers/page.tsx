"use client";

import { ConnectedOverview } from "@/components/connected/connected-overview";
import { loadSuppliers } from "@/lib/api/overviews";

export default function Page() {
  return <ConnectedOverview title="Suppliers" description="Supplier coverage, lead times and low-stock exposure." queryKey="suppliers" load={loadSuppliers} />;
}
