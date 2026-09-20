import React from "react";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export default function FnbPage() {
  return (
    <SectionPlaceholder
      title="Food & Beverage"
      description="Outlet covers, kitchen throughput and the room service order book."
      day="Day 5–6"
      covers={[
        "Outlet covers and average spend",
        "Kitchen order queue and prep times",
        "Auto-deduction of ingredients on completed orders",
        "Purchase suggestions from low stock",
      ]}
    />
  );
}
