"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { guestRatingApi, guestReviewApi, type RateableStaffResponse } from "@/lib/api/performance";
import { ApiError, guestTokens, tokens } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";

export function useRateableStaff() {
  const guestToken = guestTokens.access();
  const query = useQuery({
    queryKey: ["rateable-staff", guestToken],
    enabled: guestToken !== null,
    queryFn: guestRatingApi.rateable,
    retry: false,
  });

  return {
    staff: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useRateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { staffId: string; rating: number; comment?: string }) => {
      if (guestTokens.access() === null) {
        throw new ApiError(401, {
          code: "unauthorized",
          message: "A valid guest room session token is required to submit a staff rating.",
        });
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
  const { isConnected, user, hasPermission } = useAuth();
  const canReadDeparting = hasPermission("guest_review:read");
  const query = useQuery({
    queryKey: ["departing-stays", user?.propertyId, user?.id],
    enabled: isConnected && Boolean(user) && canReadDeparting,
    queryFn: guestReviewApi.departing,
    retry: false,
  });

  return {
    stays: query.data ?? [],
    isLoading: query.isLoading && isConnected && canReadDeparting,
    error: query.error,
  };
}

export function useReviewGuest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { stayId: string; rating: number; comment?: string }) => {
      if (tokens.access() === null) {
        throw new ApiError(401, {
          code: "unauthorized",
          message: "An active staff session is required to submit a guest review.",
        });
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
