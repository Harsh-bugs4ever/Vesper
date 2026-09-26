"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { guestRatingApi, guestReviewApi, type RateableStaffResponse } from "@/lib/api/performance";
import { ApiError, guestTokens, tokens } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";

/**
 * The two review directions, from the guest's phone and from the staff portal.
 *
 * Both fall back to fixtures when there is no session, for the same reason the board
 * does: the demo has to run without a backend. Unlike the board, the write paths do
 * *not* fake success — a rating that silently goes nowhere is worse than one that says
 * it could not be sent, so mutations surface their error and the caller decides.
 */

/** Staff the guest may rate, when the demo has no room token. */
const DEMO_RATEABLE: RateableStaffResponse[] = [
  { id: "s1", name: "Ramesh Patil", role: "Housekeeping", department_id: null, already_rated: false },
  { id: "s6", name: "Neha Kulkarni", role: "Room Service", department_id: null, already_rated: false },
  { id: "s8", name: "Priya Nair", role: "Front Desk", department_id: null, already_rated: false },
];

export function useRateableStaff() {
  const guestToken = guestTokens.access();
  const query = useQuery({
    queryKey: ["rateable-staff", guestToken],
    enabled: guestToken !== null,
    queryFn: guestRatingApi.rateable,
    // A guest without a valid room token is the normal case in a demo, not an error
    // worth retrying three times.
    retry: false,
  });

  const isDemo = guestToken === null;
  return {
    staff: isDemo ? DEMO_RATEABLE : query.data ?? [],
    isDemo,
    isLoading: query.isLoading && !isDemo,
    error: query.error,
  };
}

export function useRateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { staffId: string; rating: number; comment?: string }) => {
      if (guestTokens.access() === null) {
        // No room token: the demo path. Pause briefly so the pending state is visible,
        // then resolve — but say so, so the UI can avoid claiming it reached anyone.
        await new Promise((resolve) => setTimeout(resolve, 400));
        return { delivered: false as const };
      }
      await guestRatingApi.submit({
        staff_id: input.staffId,
        rating: input.rating,
        comment: input.comment,
      });
      return { delivered: true as const };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rateable-staff"] });
    },
  });
}

/** Stays departing today that this staff member may still review. */
export function useDepartingStays() {
  const { isConnected, user } = useAuth();
  const query = useQuery({
    queryKey: ["departing-stays", user?.propertyId, user?.id],
    enabled: isConnected && Boolean(user),
    queryFn: guestReviewApi.departing,
    retry: false,
  });

  return {
    stays: query.data ?? [],
    isDemo: !isConnected,
    isLoading: query.isLoading && isConnected,
    error: query.error,
  };
}

export function useReviewGuest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { stayId: string; rating: number; comment?: string }) => {
      if (tokens.access() === null) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        return { delivered: false as const };
      }
      await guestReviewApi.submit(input.stayId, {
        rating: input.rating,
        comment: input.comment,
      });
      return { delivered: true as const };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departing-stays"] });
    },
  });
}

/** The message to show when a write fails, already written for a person. */
export function reviewErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "conflict") return "You have already left this rating.";
    return error.message;
  }
  return "Could not send that just now. Please try again.";
}
