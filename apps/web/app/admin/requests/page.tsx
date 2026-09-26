"use client";

import React from "react";
import { useAuth } from "@/components/auth/auth-context";
import { LiveRequests } from "@/components/connected/live-requests";

export default function RequestsPage() {
  const { isConnected, isReady } = useAuth();

  if (!isReady) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6 text-sm text-sand-500">
        Loading requests…
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6 text-sm text-sand-500">
        Authentication required. Please sign in to view department requests.
      </div>
    );
  }

  return <LiveRequests />;
}
