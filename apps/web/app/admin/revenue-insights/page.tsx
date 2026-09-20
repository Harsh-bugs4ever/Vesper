import React from "react";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export default function RevenueInsightsPage() {
  return (
    <SectionPlaceholder
      title="Revenue Insights"
      description="Why the numbers moved, not just that they did."
      day="Day 6–9"
      covers={[
        "Pick-up and pace against the same point last year",
        "Segment, channel and length-of-stay mix",
        "Rate decisions and what each one earned",
        "Engine accuracy and confidence over time",
      ]}
    />
  );
}
