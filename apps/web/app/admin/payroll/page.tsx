import React from "react";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export default function PayrollPage() {
  return (
    <SectionPlaceholder
      title="Payroll"
      description="Hours worked, overtime and what it costs."
      day="Day 9"
      covers={[
        "Hours from attendance check-ins",
        "Overtime and shift differentials",
        "Department cost against budget",
        "Export for the payroll run",
      ]}
    />
  );
}
