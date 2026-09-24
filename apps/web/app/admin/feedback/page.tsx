"use client";

import { ConnectedOverview } from "@/components/connected/connected-overview";
import { loadFeedback } from "@/lib/api/overviews";

export default function Page() {
  return <ConnectedOverview title="Guest feedback" description="Sentiment trends and review volume across departments." queryKey="feedback" load={loadFeedback} />;
}
