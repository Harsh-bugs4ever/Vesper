/**
 * Demo performance data, shaped exactly like `GET /staff-reviews/board`.
 *
 * The field names match the API response so that swapping the demo import for a fetch
 * is a one-line change rather than a rewrite. The numbers are what the real engine
 * would produce: scores shrunk toward the house average, unrated people held off the
 * board entirely, and reasons attached to every score.
 */

export type Tier = "exceptional" | "strong" | "steady" | "developing" | "needs_support" | "insufficient" | "unrated";

export interface StaffPerformance {
  staffId: string;
  name: string;
  role: string;
  department: string;
  reviewCount: number;
  meanRating: number | null;
  /** Recency-weighted, severity-corrected Bayesian average. Null until scoreable. */
  score: number | null;
  confidence: number;
  tier: Tier;
  reasons: string[];
  complaintContextReviews: number;
  thinEvidence: boolean;
  deservesRecognition: boolean;
  meritsAConversation: boolean;
  /** Score at the same point last month, for the movement column. */
  previousScore: number | null;
  trend: number[];
}

export const tierMeta: Record<Tier, { label: string; chip: string }> = {
  exceptional: { label: "Exceptional", chip: "border-sage-300 bg-sage-50 text-sage-800" },
  strong: { label: "Strong", chip: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  steady: { label: "Steady", chip: "border-sand-200 bg-sand-100 text-sand-700" },
  developing: { label: "Developing", chip: "border-gold-200 bg-gold-50 text-gold-800" },
  needs_support: { label: "Needs support", chip: "border-rose-200 bg-rose-50 text-rose-700" },
  insufficient: { label: "Not enough ratings", chip: "border-sand-200 bg-white text-sand-500" },
  unrated: { label: "No ratings yet", chip: "border-sand-200 bg-white text-sand-500" },
};

/** What guests at this property average across everyone they rate. */
export const HOUSE_AVERAGE = 4.08;
export const MIN_REVIEWS_FOR_SCORE = 4;

export const ranked: StaffPerformance[] = [
  {
    staffId: "s8",
    name: "Priya Nair",
    role: "Front Office Executive",
    department: "Front Office",
    reviewCount: 34,
    meanRating: 4.79,
    score: 4.71,
    confidence: 0.89,
    tier: "exceptional",
    reasons: ["Adjusted for how harshly each guest marks"],
    complaintContextReviews: 2,
    thinEvidence: false,
    deservesRecognition: true,
    meritsAConversation: false,
    previousScore: 4.62,
    trend: [4.4, 4.5, 4.55, 4.6, 4.62, 4.68, 4.71],
  },
  {
    staffId: "s12",
    name: "Meena Shinde",
    role: "Spa Therapist",
    department: "Spa & Wellness",
    reviewCount: 21,
    meanRating: 4.76,
    score: 4.62,
    confidence: 0.84,
    tier: "exceptional",
    reasons: ["Adjusted for how harshly each guest marks"],
    complaintContextReviews: 0,
    thinEvidence: false,
    deservesRecognition: true,
    meritsAConversation: false,
    previousScore: 4.55,
    trend: [4.3, 4.38, 4.44, 4.5, 4.52, 4.58, 4.62],
  },
  {
    staffId: "s1",
    name: "Ramesh Patil",
    role: "Housekeeping Attendant",
    department: "Housekeeping",
    reviewCount: 28,
    meanRating: 4.54,
    score: 4.44,
    confidence: 0.87,
    tier: "exceptional",
    reasons: ["Adjusted for how harshly each guest marks"],
    complaintContextReviews: 1,
    thinEvidence: false,
    deservesRecognition: true,
    meritsAConversation: false,
    previousScore: 4.47,
    trend: [4.5, 4.52, 4.49, 4.47, 4.45, 4.46, 4.44],
  },
  {
    staffId: "s9",
    name: "Aditya Rane",
    role: "Guest Relations",
    department: "Front Office",
    reviewCount: 19,
    meanRating: 4.42,
    score: 4.31,
    confidence: 0.82,
    tier: "exceptional",
    reasons: ["Adjusted for how harshly each guest marks"],
    complaintContextReviews: 3,
    thinEvidence: false,
    deservesRecognition: true,
    meritsAConversation: false,
    previousScore: 4.12,
    trend: [3.9, 4.0, 4.05, 4.12, 4.2, 4.27, 4.31],
  },
  {
    staffId: "s6",
    name: "Neha Kulkarni",
    role: "Restaurant Steward",
    department: "Food & Beverage",
    reviewCount: 26,
    meanRating: 4.19,
    score: 4.16,
    confidence: 0.86,
    tier: "strong",
    reasons: ["Adjusted for how harshly each guest marks"],
    complaintContextReviews: 2,
    thinEvidence: false,
    deservesRecognition: false,
    meritsAConversation: false,
    previousScore: 4.1,
    trend: [4.02, 4.05, 4.08, 4.1, 4.12, 4.14, 4.16],
  },
  {
    staffId: "s5",
    name: "Imran Shaikh",
    role: "Commis Chef",
    department: "Food & Beverage",
    reviewCount: 9,
    meanRating: 4.22,
    score: 4.11,
    confidence: 0.67,
    tier: "strong",
    reasons: ["Adjusted for how harshly each guest marks"],
    complaintContextReviews: 0,
    thinEvidence: false,
    deservesRecognition: false,
    meritsAConversation: false,
    previousScore: 4.05,
    trend: [3.95, 3.98, 4.0, 4.05, 4.07, 4.09, 4.11],
  },
  {
    staffId: "s2",
    name: "Anjali Deshmukh",
    role: "Floor Attendant (Villas)",
    department: "Housekeeping",
    reviewCount: 6,
    meanRating: 4.17,
    score: 4.06,
    confidence: 0.58,
    tier: "strong",
    reasons: [
      "Based on 6 guests — enough to score, not enough to rank confidently",
      "Adjusted for how harshly each guest marks",
    ],
    complaintContextReviews: 0,
    thinEvidence: true,
    deservesRecognition: false,
    meritsAConversation: false,
    previousScore: null,
    trend: [4.0, 4.02, 4.03, 4.04, 4.05, 4.06, 4.06],
  },
  {
    staffId: "s10",
    name: "Rajesh Verma",
    role: "Engineering Lead",
    department: "Engineering",
    reviewCount: 11,
    meanRating: 3.82,
    score: 3.91,
    confidence: 0.72,
    tier: "strong",
    reasons: [
      "Adjusted for how harshly each guest marks",
      "4 of these ratings were given while the guest had an open complaint — read the comments before drawing conclusions",
    ],
    complaintContextReviews: 4,
    thinEvidence: false,
    deservesRecognition: false,
    meritsAConversation: false,
    previousScore: 3.78,
    trend: [3.7, 3.72, 3.75, 3.78, 3.84, 3.88, 3.91],
  },
  {
    staffId: "s3",
    name: "Sunita Kamble",
    role: "Housekeeping Attendant",
    department: "Housekeeping",
    reviewCount: 14,
    meanRating: 3.5,
    score: 3.62,
    confidence: 0.78,
    tier: "steady",
    reasons: [
      "Adjusted for how harshly each guest marks",
      "3 ratings older than four months count for little",
    ],
    complaintContextReviews: 1,
    thinEvidence: false,
    deservesRecognition: false,
    meritsAConversation: false,
    previousScore: 3.71,
    trend: [3.8, 3.78, 3.74, 3.71, 3.68, 3.65, 3.62],
  },
  {
    staffId: "s11",
    name: "Sameer Joshi",
    role: "Maintenance Technician",
    department: "Engineering",
    reviewCount: 13,
    meanRating: 2.85,
    score: 3.0,
    confidence: 0.76,
    tier: "developing",
    reasons: [
      "Adjusted for how harshly each guest marks",
      "6 of these ratings were given while the guest had an open complaint — read the comments before drawing conclusions",
    ],
    complaintContextReviews: 6,
    thinEvidence: false,
    deservesRecognition: false,
    meritsAConversation: true,
    previousScore: 3.14,
    trend: [3.3, 3.26, 3.2, 3.14, 3.09, 3.04, 3.0],
  },
];

/**
 * Scored too thinly, or not at all. Kept in its own list rather than appended below the
 * board — the bottom of a descending table reads as "worst", and "nobody has rated them"
 * is not a ranking.
 */
export const unranked: StaffPerformance[] = [
  {
    staffId: "s4",
    name: "Vikram Jadhav",
    role: "Senior Attendant",
    department: "Housekeeping",
    reviewCount: 3,
    meanRating: 4.67,
    score: null,
    confidence: 0,
    tier: "insufficient",
    reasons: ["3 guest ratings so far — 4 different guests are needed before this counts as a score"],
    complaintContextReviews: 0,
    thinEvidence: true,
    deservesRecognition: false,
    meritsAConversation: false,
    previousScore: null,
    trend: [],
  },
  {
    staffId: "s13",
    name: "Kiran Bhosale",
    role: "Spa Receptionist",
    department: "Spa & Wellness",
    reviewCount: 1,
    meanRating: 5,
    score: null,
    confidence: 0,
    tier: "insufficient",
    reasons: ["1 guest rating so far — 4 different guests are needed before this counts as a score"],
    complaintContextReviews: 0,
    thinEvidence: true,
    deservesRecognition: false,
    meritsAConversation: false,
    previousScore: null,
    trend: [],
  },
  {
    staffId: "s7",
    name: "Farhan Qureshi",
    role: "Room Service Attendant",
    department: "Food & Beverage",
    reviewCount: 0,
    meanRating: null,
    score: null,
    confidence: 0,
    tier: "unrated",
    reasons: ["No guest has rated this person yet"],
    complaintContextReviews: 0,
    thinEvidence: true,
    deservesRecognition: false,
    meritsAConversation: false,
    previousScore: null,
    trend: [],
  },
  {
    staffId: "s14",
    name: "Deepak Rawat",
    role: "Night Auditor",
    department: "Front Office",
    reviewCount: 2,
    meanRating: 4.5,
    score: null,
    confidence: 0,
    tier: "insufficient",
    reasons: [
      "2 guest ratings so far — 4 different guests are needed before this counts as a score",
    ],
    complaintContextReviews: 0,
    thinEvidence: true,
    deservesRecognition: false,
    meritsAConversation: false,
    previousScore: null,
    trend: [],
  },
];

export interface GuestReviewOfStaff {
  id: string;
  staffId: string;
  guest: string;
  rating: number;
  comment: string | null;
  when: string;
  duringComplaint: boolean;
}

export const reviewsByStaff: Record<string, GuestReviewOfStaff[]> = {
  s8: [
    { id: "r1", staffId: "s8", guest: "Mr. Rohan Mehta", rating: 5, comment: "Remembered my room preference from last year without me asking.", when: "2 days ago", duringComplaint: false },
    { id: "r2", staffId: "s8", guest: "Ms. Kavya Iyer", rating: 5, comment: "Check-in took four minutes. Genuinely warm about it too.", when: "4 days ago", duringComplaint: false },
    { id: "r3", staffId: "s8", guest: "Dr. Sanjay Kulkarni", rating: 4, comment: "Helpful with the airport transfer, though the cab ran late.", when: "6 days ago", duringComplaint: true },
    { id: "r4", staffId: "s8", guest: "Mrs. Leela Menon", rating: 5, comment: "Arranged the anniversary cake quietly. Lovely touch.", when: "1 week ago", duringComplaint: false },
    { id: "r5", staffId: "s8", guest: "Mr. Faisal Khan", rating: 5, comment: null, when: "1 week ago", duringComplaint: false },
  ],
  s11: [
    { id: "r6", staffId: "s11", guest: "Mr. Arvind Nair", rating: 2, comment: "Came twice and the AC still is not cooling.", when: "Today", duringComplaint: true },
    { id: "r7", staffId: "s11", guest: "Ms. Divya Rao", rating: 3, comment: "Fixed the tap eventually. Took most of the afternoon.", when: "Yesterday", duringComplaint: true },
    { id: "r8", staffId: "s11", guest: "Mr. Nikhil Bose", rating: 4, comment: "Polite and quick once he arrived.", when: "3 days ago", duringComplaint: false },
    { id: "r9", staffId: "s11", guest: "Ms. Ritu Chandran", rating: 2, comment: "Had to call the desk three times before anyone came up.", when: "5 days ago", duringComplaint: true },
    { id: "r10", staffId: "s11", guest: "Mr. Aakash Pillai", rating: 3, comment: null, when: "1 week ago", duringComplaint: false },
  ],
};

export const DEPARTMENTS = [
  "Housekeeping",
  "Food & Beverage",
  "Front Office",
  "Engineering",
  "Spa & Wellness",
] as const;
