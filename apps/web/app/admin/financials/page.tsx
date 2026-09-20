import React from "react";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export default function FinancialsPage() {
  return (
    <SectionPlaceholder
      title="Financials"
      description="Revenue, cost and margin across the property."
      day="Day 6–9"
      covers={[
        "Revenue by department and outlet",
        "Cost of sale and payroll against budget",
        "RevPAR, GOPPAR and margin trends",
        "Export for the monthly pack",
      ]}
    />
  );
}
