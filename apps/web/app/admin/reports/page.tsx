import React from "react";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export default function ReportsPage() {
  return (
    <SectionPlaceholder
      title="Reports"
      description="Demand, pace and performance against last year."
      day="Day 6"
      covers={[
        "30-day demand forecast with confidence band",
        "Pace and pick-up against budget",
        "Segment and channel mix",
        "Engine accuracy over time",
      ]}
    />
  );
}
