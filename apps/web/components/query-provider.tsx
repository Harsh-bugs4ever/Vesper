"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ApiError } from "@/lib/api";

/**
 * The React Query client for the whole app.
 *
 * Created inside state rather than at module scope: a module-level client is shared
 * across requests on the server, which in a multi-user app means one person's data can
 * be served to another from the cache.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Operational data ages fast — a room board a minute stale is misleading —
            // but not so fast that switching tabs refetches everything.
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: (failureCount, error) => {
              // A 403 or a 404 will fail the same way three times in a row; only retry
              // things that might genuinely be transient.
              if (error instanceof ApiError && error.status !== 0 && error.status < 500) {
                return false;
              }
              return failureCount < 2;
            },
          },
          mutations: {
            // Writes are never retried automatically: submitting a review twice because
            // the first response was slow is worse than showing the person an error.
            retry: false,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
