import React from "react";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export default function TrainingPage() {
  return (
    <SectionPlaceholder
      title="Training"
      description="Certifications, refreshers and who is due."
      day="Day 9"
      covers={[
        "Certification register and expiry dates",
        "Required training per role",
        "Completion rates by department",
        "Sessions scheduled against quiet shifts",
      ]}
    />
  );
}
