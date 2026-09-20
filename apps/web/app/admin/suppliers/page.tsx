import React from "react";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export default function SuppliersPage() {
  return (
    <SectionPlaceholder
      title="Suppliers"
      description="Who we buy from, and how fast they deliver."
      day="Day 5"
      covers={[
        "Supplier register and contacts",
        "Lead times and delivery reliability",
        "Contracted rates per item",
        "Contract renewal dates",
      ]}
    />
  );
}
