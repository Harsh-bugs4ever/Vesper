import React from "react";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export default function PurchaseOrdersPage() {
  return (
    <SectionPlaceholder
      title="Purchase Orders"
      description="What has been ordered and what has arrived."
      day="Day 5"
      covers={[
        "Draft, dispatched and received orders",
        "Orders raised from low stock",
        "Goods-received matching",
        "Spend against budget by category",
      ]}
    />
  );
}
