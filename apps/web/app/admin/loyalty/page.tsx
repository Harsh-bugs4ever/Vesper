import React from "react";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export default function LoyaltyPage() {
  return (
    <SectionPlaceholder
      title="Loyalty"
      description="Tiers, points and what they unlock."
      day="Day 9"
      covers={[
        "Tier membership and progression",
        "Points earned and redeemed",
        "Tier benefits per property",
        "Enrolment and churn",
      ]}
    />
  );
}
