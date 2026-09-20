import React from "react";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export default function RoomsPage() {
  return (
    <SectionPlaceholder
      title="Rooms & Inventory"
      description="Room types, counts and what is sellable."
      day="Day 5"
      covers={[
        "Room type definitions and counts",
        "Sellable versus out-of-order rooms",
        "Amenity and bedding configuration",
        "Rate plan linkage",
      ]}
    />
  );
}
