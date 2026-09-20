import React from "react";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export default function CommunicationsPage() {
  return (
    <SectionPlaceholder
      title="Communications"
      description="Every message sent to a guest, and whether it landed."
      day="Day 9"
      covers={[
        "Outbox across WhatsApp, SMS and email",
        "Delivery status and retries",
        "Templates and approval",
        "Per-guest message history",
      ]}
    />
  );
}
