import { api } from "@/lib/api";

/**
 * The staff performance endpoints, typed.
 *
 * Field names are snake_case because that is what the backend sends; mapping them to
 * camelCase here would mean two vocabularies for the same data and a translation layer
 * to keep in step. The mapping to display shapes happens once, in `toStaffPerformance`.
 */

export interface StaffPerformanceResponse {
  staff_id: string;
  department_id: string | null;
  review_count: number;
  mean_rating: number | null;
  score: number | null;
  confidence: number;
  tier: string;
  reasons: string[];
  complaint_context_reviews: number;
  thin_evidence: boolean;
  deserves_recognition: boolean;
  merits_a_conversation: boolean;
  computed_at: string | null;
}

export interface StaffPerformanceBoardResponse {
  ranked: StaffPerformanceResponse[];
  unranked: StaffPerformanceResponse[];
  house_average: number;
  minimum_reviews_for_score: number;
}

export interface StaffReviewResponse {
  id: string;
  stay_id: string;
  staff_id: string;
  department_id: string | null;
  rating: number;
  comment: string | null;
  sentiment_score: number;
  sentiment_label: string;
  during_complaint: boolean;
  created_at: string;
}

export interface StaffPerformanceDetailResponse extends StaffPerformanceResponse {
  reviews: StaffReviewResponse[];
}

export interface RateableStaffResponse {
  id: string;
  name: string;
  role: string | null;
  department_id: string | null;
  already_rated: boolean;
}

export const performanceApi = {
  /** Manager view: the board plus the people not on it. */
  board: (departmentId?: string) =>
    api.get<StaffPerformanceBoardResponse>(
      "/staff-reviews/board",
      departmentId ? { department_id: departmentId } : undefined
    ),

  /** One person's score and the reviews behind it. */
  detail: (staffId: string) =>
    api.get<StaffPerformanceDetailResponse>(`/staff-reviews/staff/${staffId}`),

  /** A staff member's own summary. No individual comments — see the route's own note. */
  mine: () => api.get<StaffPerformanceResponse>("/staff-reviews/me"),

  recompute: (staffId: string) =>
    api.post<StaffPerformanceResponse>(`/staff-reviews/staff/${staffId}/recompute`),
};

export const guestRatingApi = {
  /** Who this guest may rate. Requires a room token. */
  rateable: () => api.guestGet<RateableStaffResponse[]>("/staff-reviews/rateable"),

  submit: (body: { staff_id: string; rating: number; comment?: string; request_id?: string }) =>
    api.guestPost<{ id: string; staff_id: string; rating: number; created_at: string }>(
      "/staff-reviews",
      body
    ),

  mine: () =>
    api.guestGet<{ id: string; staff_id: string; rating: number; comment: string | null }[]>(
      "/staff-reviews/mine"
    ),
};

/** Staff reviewing guests — the other direction, already on the backend. */
export const guestReviewApi = {
  departing: () =>
    api.get<
      {
        stay_id: string;
        guest_id: string;
        room_number: string | null;
        departs_on: string | null;
        review_count: number;
      }[]
    >("/guest-reviews/departing"),

  submit: (stayId: string, body: { rating: number; comment?: string }) =>
    api.post<{ id: string; rating: number; created_at: string }>(
      `/guest-reviews/stays/${stayId}`,
      body
    ),

  mine: () => api.get<{ id: string; stay_id: string; rating: number }[]>("/guest-reviews/mine"),
};
