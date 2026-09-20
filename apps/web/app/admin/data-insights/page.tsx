import React from "react";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export default function DataInsightsPage() {
  return (
    <SectionPlaceholder
      title="Data Insights"
      description="What the data says that nobody asked."
      day="Day 9"
      covers={[
        "Correlations worth a manager's eye",
        "Segment behaviour shifts",
        "Anomalies across departments",
        "Data coverage and gaps",
      ]}
    />
  );
}
