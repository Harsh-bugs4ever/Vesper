import React from "react";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export default function ForecastPage() {
  return (
    <SectionPlaceholder
      title="Forecast"
      description="Demand out to 90 days, and the what-if levers around it."
      day="Day 6–9"
      covers={[
        "90-day demand forecast with confidence band",
        "Price, staffing and promo simulator",
        "Event and holiday calendar overlay",
        "Cold-start readiness per engine",
      ]}
    />
  );
}
