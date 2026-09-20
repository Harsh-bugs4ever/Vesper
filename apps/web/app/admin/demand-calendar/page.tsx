import React from "react";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export default function DemandCalendarPage() {
  return (
    <SectionPlaceholder
      title="Demand Calendar"
      description="Every night in the window, priced against forecast demand."
      day="Day 6"
      covers={[
        "Night-by-night demand heatmap",
        "Event and holiday overlay",
        "Sold-out and pressure markers",
        "Jump straight to a date's rate",
      ]}
    />
  );
}
