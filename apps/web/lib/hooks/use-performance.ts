"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/auth-context";
import { api } from "@/lib/api";
import {
  performanceApi,
  type StaffPerformanceBoardResponse,
  type StaffPerformanceResponse,
} from "@/lib/api/performance";
import {
  HOUSE_AVERAGE,
  MIN_REVIEWS_FOR_SCORE,
  ranked as demoRanked,
  reviewsByStaff as demoReviews,
  unranked as demoUnranked,
  type GuestReviewOfStaff,
  type StaffPerformance,
  type Tier,
} from "@/lib/demo/performance";

/**
 * Performance data, from the API when there is a session and from the demo fixtures
 * when there is not.
 *
 * The same two-mode arrangement `auth-context` already uses: the design work and the
 * demo must keep running with no backend, and components should not each grow their own
 * fallback. Callers get one shape either way and a flag saying which it came from.
 */

interface UserRow {
  id: string;
  full_name: string;
  department_id: string | null;
}

interface DepartmentRow {
  id: string;
  name: string;
}

/** The board carries ids; names and departments live in identity and property. */
function join(
  row: StaffPerformanceResponse,
  users: Map<string, UserRow>,
  departments: Map<string, string>
): StaffPerformance {
  const user = users.get(row.staff_id);
  const departmentId = row.department_id ?? user?.department_id ?? null;

  return {
    staffId: row.staff_id,
    // A score with no name attached is unusable on screen, but it is also not a reason
    // to drop the row — someone who has left still shaped the averages.
    name: user?.full_name ?? "Former team member",
    role: "",
    department: departmentId ? (departments.get(departmentId) ?? "Unassigned") : "Unassigned",
    reviewCount: row.review_count,
    meanRating: row.mean_rating,
    score: row.score,
    confidence: row.confidence,
    tier: row.tier as Tier,
    reasons: row.reasons,
    complaintContextReviews: row.complaint_context_reviews,
    thinEvidence: row.thin_evidence,
    deservesRecognition: row.deserves_recognition,
    meritsAConversation: row.merits_a_conversation,
    // The API does not keep a previous score; the movement column stays blank on live
    // data rather than inventing a trend from one reading.
    previousScore: null,
    trend: [],
  };
}

export interface PerformanceBoard {
  ranked: StaffPerformance[];
  unranked: StaffPerformance[];
  houseAverage: number;
  minimumReviews: number;
  isDemo: boolean;
}

export function usePerformanceBoard(departmentId?: string) {
  const { isConnected } = useAuth();

  const query = useQuery({
    queryKey: ["performance-board", departmentId ?? "all"],
    enabled: isConnected,
    queryFn: async (): Promise<PerformanceBoard> => {
      // Three calls rather than one fat endpoint: guest-intel holds the scores and has
      // no business holding the staff directory, and asking it to resolve names would
      // mean one identity lookup per person on every board render.
      const [board, users, departments] = await Promise.all([
        performanceApi.board(departmentId),
        api.get<UserRow[]>("/admin/users"),
        api.get<DepartmentRow[]>("/property/departments").catch(() => [] as DepartmentRow[]),
      ]);

      const userMap = new Map(users.map((user) => [user.id, user]));
      const deptMap = new Map(departments.map((dept) => [dept.id, dept.name]));

      return {
        ranked: board.ranked.map((row) => join(row, userMap, deptMap)),
        unranked: board.unranked.map((row) => join(row, userMap, deptMap)),
        houseAverage: board.house_average,
        minimumReviews: board.minimum_reviews_for_score,
        isDemo: false,
      };
    },
  });

  const demo: PerformanceBoard = {
    ranked: demoRanked,
    unranked: demoUnranked,
    houseAverage: HOUSE_AVERAGE,
    minimumReviews: MIN_REVIEWS_FOR_SCORE,
    isDemo: true,
  };

  return {
    // A failed fetch falls back to the fixtures rather than an empty board, and
    // `isDemo` on the returned data is what the page shows the viewer.
    data: isConnected && query.data ? query.data : demo,
    isLoading: isConnected && query.isLoading,
    error: query.error,
  };
}

/** The comments behind one person's score. Managers only. */
export function useStaffReviews(staffId: string | null) {
  const { isConnected } = useAuth();

  const query = useQuery({
    queryKey: ["staff-reviews", staffId],
    enabled: isConnected && staffId !== null,
    queryFn: async (): Promise<GuestReviewOfStaff[]> => {
      const detail = await performanceApi.detail(staffId as string);
      return detail.reviews.map((review) => ({
        id: review.id,
        staffId: review.staff_id,
        // Guests are not named to the manager on this screen. The rating is about the
        // staff member; surfacing who said what invites a conversation with the guest.
        guest: "A guest",
        rating: review.rating,
        comment: review.comment,
        when: new Date(review.created_at).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        }),
        duringComplaint: review.during_complaint,
      }));
    },
  });

  if (!isConnected) {
    return { reviews: staffId ? (demoReviews[staffId] ?? []) : [], isLoading: false };
  }

  return { reviews: query.data ?? [], isLoading: query.isLoading };
}
