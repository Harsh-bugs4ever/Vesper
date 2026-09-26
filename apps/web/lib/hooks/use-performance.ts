"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/auth-context";
import { api } from "@/lib/api";
import {
  performanceApi,
  type StaffPerformanceBoardResponse,
  type StaffPerformanceResponse,
} from "@/lib/api/performance";

export type Tier = "top" | "solid" | "developing" | "unranked";

export interface StaffPerformance {
  staffId: string;
  name: string;
  role: string;
  department: string;
  departmentId?: string | null;
  reviewCount: number;
  meanRating: number | null;
  score: number | null;
  confidence: number;
  tier: Tier;
  reasons: string[];
  complaintContextReviews: number;
  thinEvidence: boolean;
  deservesRecognition: boolean;
  meritsAConversation: boolean;
  previousScore: number | null;
  trend: number[];
}

export interface GuestReviewOfStaff {
  id: string;
  staffId: string;
  guest: string;
  rating: number;
  comment: string | null;
  when: string;
  duringComplaint: boolean;
}

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
    name: user?.full_name ?? "Team member",
    role: "",
    department: departmentId ? (departments.get(departmentId) ?? "Unassigned") : "Unassigned",
    departmentId,
    reviewCount: row.review_count,
    meanRating: row.mean_rating,
    score: row.score,
    confidence: row.confidence,
    tier: (row.tier as Tier) || "unranked",
    reasons: row.reasons ?? [],
    complaintContextReviews: row.complaint_context_reviews,
    thinEvidence: row.thin_evidence,
    deservesRecognition: row.deserves_recognition,
    meritsAConversation: row.merits_a_conversation,
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

const EMPTY_BOARD: PerformanceBoard = {
  ranked: [],
  unranked: [],
  houseAverage: 0,
  minimumReviews: 5,
  isDemo: false,
};

export function usePerformanceBoard(departmentId?: string) {
  const { user } = useAuth();
  const scope = [user?.propertyId ?? "", departmentId ?? "all"];

  const query = useQuery({
    queryKey: ["performance-board", ...scope],
    queryFn: async (): Promise<PerformanceBoard> => {
      const [board, users, departments] = await Promise.all([
        performanceApi.board(departmentId),
        api.get<UserRow[]>("/admin/users").catch(() => [] as UserRow[]),
        api.get<DepartmentRow[]>("/property/departments").catch(() => [] as DepartmentRow[]),
      ]);

      const userMap = new Map(users.map((u) => [u.id, u]));
      const deptMap = new Map(departments.map((d) => [d.id, d.name]));

      return {
        ranked: (board?.ranked ?? []).map((row) => join(row, userMap, deptMap)),
        unranked: (board?.unranked ?? []).map((row) => join(row, userMap, deptMap)),
        houseAverage: board?.house_average ?? 0,
        minimumReviews: board?.minimum_reviews_for_score ?? 5,
        isDemo: false,
      };
    },
    staleTime: 60_000,
  });

  return {
    data: query.data ?? EMPTY_BOARD,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/** The comments behind one person's score. Managers only. */
export function useStaffReviews(staffId: string | null) {
  const query = useQuery({
    queryKey: ["staff-reviews", staffId],
    enabled: Boolean(staffId),
    queryFn: async (): Promise<GuestReviewOfStaff[]> => {
      if (!staffId) return [];
      const detail = await performanceApi.detail(staffId);
      return (detail.reviews ?? []).map((review) => ({
        id: review.id,
        staffId: review.staff_id,
        guest: "Verified Guest",
        rating: review.rating,
        comment: review.comment,
        when: new Date(review.created_at).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        }),
        duringComplaint: review.during_complaint,
      }));
    },
    staleTime: 60_000,
  });

  return {
    reviews: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
