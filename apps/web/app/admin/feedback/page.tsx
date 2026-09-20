import React from "react";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export default function FeedbackPage() {
  return (
    <SectionPlaceholder
      title="Guest Feedback"
      description="What guests said, by department and over time."
      day="Day 8"
      covers={[
        "Sentiment trend per department",
        "Review and in-stay rating stream",
        "At-risk guests and retention offers",
        "Guest DNA preference profiles",
      ]}
    />
  );
}
