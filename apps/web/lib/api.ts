/**
 * The one way this app talks to the backend.
 *
 * One backend on :8000, which is the whole API — it validates the token and applies
 * rate limits on the way in.
 *
 * Three things it handles so callers never have to:
 *   - attaching the bearer token;
 *   - refreshing once on a 401 and replaying the original request, with concurrent
 *     callers sharing that single refresh rather than stampeding;
 *   - turning the backend's error envelope into a typed error carrying a message that
 *     is already written for a human.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";

const ACCESS_KEY = "vesper_access_token";
const REFRESH_KEY = "vesper_refresh_token";
const GUEST_KEY = "vesper_guest_token";

/** Endpoints reachable without a token; a 401 on these must not trigger a refresh. */
const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/refresh",
  "/auth/logout",
  "/guest/session",
  "/property/public",
  "/guest/amenities",
];

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    // `message` is written for the person reading the screen, so it is safe to show.
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details ?? {};
  }

  /** A failure the user can do something about, rather than a bug. */
  get isExpected(): boolean {
    return ["conflict", "invalid", "forbidden", "not_found", "rate_limited"].includes(this.code);
  }
}

// --- token storage ----------------------------------------------------------------
// localStorage rather than a cookie because the API is a separate origin and the demo
// has no shared domain to set one on. Moving to httpOnly cookies is a backend change
// and is on the backlog before this ever sees a real guest.

export const tokens = {
  access(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACCESS_KEY);
  },
  refresh(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh?: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACCESS_KEY, access);
    if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

/** A room QR session is separate from a staff account session. */
export const guestTokens = {
  access(): string | null {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(GUEST_KEY);
  },
  set(token: string) {
    if (typeof window !== "undefined") window.sessionStorage.setItem(GUEST_KEY, token);
  },
  clear() {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(GUEST_KEY);
  },
};

// A single in-flight refresh shared by every caller that hit a 401 at once. Without
// this, six dashboard tiles expiring together would fire six refreshes and five of them
// would fail against a rotated token.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = tokens.refresh();
    if (!refreshToken) return false;
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) {
        tokens.clear();
        return false;
      }
      const data = await response.json();
      tokens.set(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Send without a token — only for the QR session call. */
  anonymous?: boolean;
  /** Send the stay-scoped room token, including on guest routes outside /guest. */
  guest?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}, retrying = false): Promise<T> {
  const { method = "GET", body, params, anonymous = false, guest = false, signal } = options;

  const url = new URL(`${API_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {};
  const multipart = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !multipart) headers["Content-Type"] = "application/json";
  const guestRequest = guest || (path.startsWith("/guest/") && path !== "/guest/session");
  const token = guestRequest ? guestTokens.access() : tokens.access();
  if (!anonymous && token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    const effectiveSignal =
      signal ||
      (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
        ? AbortSignal.timeout(8000)
        : undefined);
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : multipart ? (body as FormData) : JSON.stringify(body),
      signal: effectiveSignal,
    });
  } catch (cause) {
    // The gateway is down, or the browser is offline. Say which, rather than throwing
    // a bare TypeError from fetch.
    throw new ApiError(0, {
      code: "network_error",
      message: `Could not reach backend at ${API_URL}. Please start the backend server (python -m uvicorn app.main:app --port 8000).`,
      details: { cause: String(cause) },
    });
  }

  // One refresh attempt, then give up. Anything else risks a loop.
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
  if (response.status === 401 && !retrying && !anonymous && !isPublic && !guestRequest) {
    if (await refreshAccessToken()) {
      return request<T>(path, options, true);
    }
    tokens.clear();
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? safeJson(text) : null;

  if (!response.ok) {
    const envelope = (payload as { error?: ApiErrorBody } | null)?.error;
    throw new ApiError(
      response.status,
      envelope ?? {
        code: "http_error",
        message: `Request failed (${response.status})`,
      },
    );
  }

  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: <T>(path: string, params?: RequestOptions["params"], signal?: AbortSignal) =>
    request<T>(path, { params, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  upload: <T>(path: string, body: FormData) => request<T>(path, { method: "POST", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /** Unauthenticated — the room QR is the credential. */
  anonymous: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body, anonymous: true }),
  guestGet: <T>(path: string) => request<T>(path, { guest: true }),
  guestPost: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body, guest: true }),
};

// --- shapes the backend returns ----------------------------------------------------

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface BackendUser {
  id: string;
  email: string;
  full_name: string;
  /** owner | gm | manager | supervisor | employee */
  role: string;
  department_id: string | null;
  property_id: string;
  permissions: string[];
}

/** `GET /property` — the branch this user belongs to, as the backend knows it. */
export interface BackendProperty {
  id: string;
  name: string;
  /** Street address. Null is allowed: a property is usable without one. */
  address: string | null;
  city: string;
  timezone: string;
  currency: string;
  total_rooms: number;
  check_in_hour: number;
  check_out_hour: number;
  settings: Record<string, unknown>;
}

/** `GET /property/list` — enough to name a property in the switcher. */
export interface BackendPropertySummary {
  id: string;
  name: string;
  address: string | null;
  city: string;
}

export interface BackendRoomCategoryImage {
  url: string;
  order: number;
  alt_text: string;
}

export interface BackendRoomCategory {
  id: string;
  key: string;
  name: string;
  base_rate: string;
  max_occupancy: number;
  amenities: string[];
  images?: BackendRoomCategoryImage[];
}

export interface BackendRoom {
  id: string;
  number: string;
  floor: number;
  status: "ready" | "occupied" | "dirty" | "cleaning" | "inspection" | "out_of_order";
  category_id: string;
  category_key: string;
  category_name: string;
  status_changed_at: string | null;
  notes: string | null;
  is_occupied?: boolean;
}

export interface BackendRoomBoardFloor {
  floor: number;
  rooms: BackendRoom[];
}

export interface BackendRoomBoard {
  counts: Record<string, number>;
  floors: BackendRoomBoardFloor[];
}

export interface GuestAmenity {
  id: string;
  name: string;
  category: "wellness" | "dining" | "recreation" | "services";
  location: string;
  operating_hours: string;
  is_available: boolean;
  closure_notes?: string | null;
  image_url?: string | null;
}

export const property = {
  /** The signed-in user's own property. */
  current: () => api.get<BackendProperty>("/property"),
  /** Every property this deployment serves. */
  list: () => api.get<BackendPropertySummary[]>("/property/list"),
  /** Public summary for the landing page. */
  publicSummary: (propertyId?: string) =>
    api.get<BackendPropertySummary>(
      "/property/public",
      propertyId ? { property_id: propertyId } : undefined
    ),
  roomCategories: async (propertyId?: string): Promise<BackendRoomCategory[]> => {
    try {
      return await api.get<BackendRoomCategory[]>(
        "/property/public/room-categories",
        propertyId ? { property_id: propertyId } : undefined
      );
    } catch {
      return api.get<BackendRoomCategory[]>("/property/room-categories");
    }
  },
  occupancy: () =>
    api.get<{
      total_rooms: number;
      occupied_rooms: number;
      occupancy_rate: number;
      as_of: string;
    }>("/property/occupancy"),
  departments: () => api.get<DepartmentOut[]>("/property/departments"),
  amenities: () => api.get<ResortAmenity[]>("/property/amenities"),
  public: (id: string) => request<PublicProperty>(`/property/public/${id}`, { anonymous: true }),
  saveAmenity: (amenity: AmenityWrite) => api.put<ResortAmenity>(`/property/amenities/${amenity.key}`, amenity),
  uploadRoomImage: (roomId: string, body: FormData) => api.upload<RoomImage>(`/rooms/${roomId}/images`, body),
  uploadCategoryImage: (categoryId: string, body: FormData) => api.upload<RoomImage>(`/property/room-categories/${categoryId}/images`, body),
  updateImage: (imageId: string, data: Pick<RoomImage, "alt_text" | "position" | "is_primary">) =>
    api.patch<RoomImage>(`/property/images/${imageId}`, data),
};

export interface RoomImage {
  id: string;
  url: string;
  alt_text: string;
  position: number;
  is_primary: boolean;
}

export interface RoomCategory {
  id: string;
  key: string;
  name: string;
  base_rate: string;
  max_occupancy: number;
  amenities: string[];
  images: RoomImage[];
}

export interface ResortAmenity {
  id: string;
  key: string;
  name: string;
  description: string | null;
  location: string | null;
  opening_hours: string | null;
  is_available: boolean;
  closure_reason: string | null;
  closed_until: string | null;
  available_now: boolean;
}

export type AmenityWrite = Omit<ResortAmenity, "id" | "available_now">;

export interface GuestRoom {
  id: string;
  number: string;
  floor: number;
  category_name: string;
  category_amenities: string[];
  images: RoomImage[];
}

export interface PublicProperty {
  id: string;
  name: string;
  address: string | null;
  city: string;
  categories: Pick<RoomCategory, "key" | "name" | "amenities" | "images">[];
  amenities: ResortAmenity[];
}

export const guestProperty = {
  room: () => api.guestGet<GuestRoom>("/guest/room"),
  amenities: () => api.guestGet<ResortAmenity[]>("/guest/amenities"),
};

export const amenities = {
  list: () => api.get<GuestAmenity[]>("/guest/amenities"),
};

export const rooms = {
  list: (params?: { status?: string; floor?: number; category_id?: string }) =>
    api.get<BackendRoom[]>("/rooms", params),
  board: () => api.get<BackendRoomBoard>("/rooms/board"),
  get: (id: string) => api.get<BackendRoom>(`/rooms/${id}`),
  setStatus: (id: string, status: string, note?: string) =>
    api.put<BackendRoom>(`/rooms/${id}/status`, { status, note }),
};

export interface GuestSession {
  token: string;
  expires_in: number;
  room_number: string;
  property_name: string;
  guest_name: string | null;
  stay_id: string;
}

export const auth = {
  async login(email: string, password: string): Promise<BackendUser> {
    const pair = await api.post<TokenPair>("/auth/login", { email, password });
    tokens.set(pair.access_token, pair.refresh_token);
    return auth.me();
  },

  me: () => api.get<BackendUser>("/auth/me"),

  async logout(): Promise<void> {
    const refreshToken = tokens.refresh();
    // Clear this browser's session before the network request. A slow logout must
    // never erase tokens from a subsequent sign-in.
    tokens.clear();
    try {
      // Best effort: the server revokes the session, but a failure here must not leave
      // the user stuck on a screen they have already left.
      if (refreshToken) await api.post("/auth/logout", { refresh_token: refreshToken });
    } catch {
      /* ignore */
    }
  },

  /** Scanning the nightstand QR. No account, no password. */
  async openGuestSession(propertyId: string, roomId: string, qrSecret: string) {
    const session = await api.anonymous<GuestSession>("/guest/session", {
      property_id: propertyId,
      room_id: roomId,
      qr_secret: qrSecret,
    });
    guestTokens.set(session.token);
    return session;
  },

  isSignedIn: () => tokens.access() !== null,
};

// --- Phase 4: Concierge, Escalation, Communications & Requests ---

export interface ConciergeSource {
  id: string;
  title: string;
  category: string;
  score: number;
}

export interface ConciergeMessage {
  id: string;
  question: string;
  answer: string;
  sources: ConciergeSource[] | string[];
  model: string | null;
  outcome: "answered" | "no_context" | "rate_limited" | "unavailable" | "weak_context" | string;
  escalated: boolean;
  escalation_reason: string | null;
  handled_at: string | null;
  created_at: string;
}

export interface RequestDetail {
  id: string;
  kind: "room_service" | "housekeeping" | "amenities" | "maintenance" | "other" | string;
  status: "raised" | "accepted" | "in_progress" | "delivered" | "cancelled" | string;
  room_number: string;
  note: string | null;
  items: Array<{ menu_item_id: string; quantity: number }>;
  total_amount: number | string;
  sla_minutes: number;
  due_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
  rating: number | null;
  created_at: string;
  is_overdue: boolean;
  department_id: string | null;
}

export interface IssueOut {
  id: string;
  room_id: string | null;
  room_number: string | null;
  asset_id: string | null;
  department_id: string | null;
  reported_by: string | null;
  reported_by_guest: boolean;
  summary: string;
  description: string | null;
  category: string;
  severity: string;
  photo_url: string | null;
  status: "reported" | "acknowledged" | "in_progress" | "resolved" | "dismissed" | string;
  duplicate_count: number;
  resolved_at: string | null;
  created_at: string;
}

export interface SentimentSummary {
  samples: number;
  average_sentiment: number;
  label: string;
  negative_share: number;
  top_themes: Array<{ theme?: string; count?: number; sentiment?: number; [key: string]: unknown }>;
}

export interface SentimentTrendItem {
  department_id: string;
  department_name?: string;
  average_sentiment: number;
  count: number;
  [key: string]: unknown;
}

export interface OutboxOut {
  id: string;
  property_id: string;
  channel: "sms" | "whatsapp" | "email" | "in_app" | string;
  recipient: string;
  subject: string | null;
  body: string;
  kind: string;
  status: "queued" | "sending" | "sent" | "delivered" | "failed" | "dead" | string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  created_at: string;
  delivered_at: string | null;
}

export interface OutboxSummary {
  queued: number;
  sent_today: number;
  delivered_today: number;
  failed_today: number;
  dead: number;
  channels: Record<string, number>;
}

export interface DepartmentOut {
  id: string;
  key: string;
  name: string;
  default_sla_minutes: number;
  head_user_id: string | null;
}

export interface StaffTask {
  id: string;
  title: string;
  description: string | null;
  department_id: string;
  assignee_id: string | null;
  room_id: string | null;
  priority: "low" | "normal" | "high" | "urgent" | string;
  status: "open" | "assigned" | "in_progress" | "blocked" | "completed" | "cancelled" | string;
  source: string;
  due_at: string;
  is_overdue: boolean;
  created_at: string;
}

export const concierge = {
  ask: (question: string) =>
    api.guestPost<ConciergeMessage>("/guest-intel/concierge/ask", { question }),
  history: () =>
    api.guestGet<ConciergeMessage[]>("/guest-intel/concierge/history"),
  escalations: (unhandledOnly: boolean = true) =>
    api.get<ConciergeMessage[]>("/guest-intel/concierge/escalations", {
      unhandled_only: unhandledOnly,
    }),
  handleEscalation: (id: string) =>
    api.post<ConciergeMessage>(`/guest-intel/concierge/escalations/${id}/handle`),
  staffAsk: (question: string) =>
    api.post<ConciergeMessage>("/guest-intel/concierge/staff-ask", { question }),
};

export const guestRequests = {
  list: () => api.guestGet<RequestDetail[]>("/guest/requests"),
  create: (body: {
    kind: string;
    note?: string;
    items?: Array<{ menu_item_id: string; quantity: number }>;
  }) => api.guestPost<RequestDetail>("/guest/requests", body),
  reportIssue: (body: {
    summary: string;
    description?: string;
    category?: string;
    severity?: string;
  }) => api.guestPost<IssueOut>("/guest/issues", body),
  rate: (requestId: string, rating: number, comment?: string) =>
    api.guestPost<RequestDetail>(`/guest/requests/${requestId}/rating`, {
      rating,
      comment,
    }),
};

export const staffRequests = {
  list: (params?: { department_id?: string; status?: string }) =>
    api.get<RequestDetail[]>("/requests", params),
  accept: (id: string) => api.post<RequestDetail>(`/requests/${id}/accept`),
  setStatus: (id: string, status: string) =>
    api.put<RequestDetail>(`/requests/${id}/status`, { status }),
};

export const staffIssues = {
  list: (params?: { status?: string }) =>
    api.get<IssueOut[]>("/issues", params),
  setStatus: (id: string, status: string) =>
    api.put<IssueOut>(`/issues/${id}/status`, { status }),
};

export const sentiment = {
  summary: (days: number = 30) =>
    api.get<SentimentSummary>("/guest-intel/sentiment/summary", { days }),
  trend: (days: number = 30) =>
    api.get<SentimentTrendItem[]>("/guest-intel/sentiment/trend", { days }),
};

export const notifications = {
  outbox: (params?: { status?: string; limit?: number }) =>
    api.get<OutboxOut[]>("/notifications/outbox", params),
  summary: () => api.get<OutboxSummary>("/notifications/outbox/summary"),
  retry: (id: string) => api.post<OutboxOut>(`/notifications/outbox/${id}/retry`),
};

export const departments = {
  list: () => api.get<DepartmentOut[]>("/property/departments"),
};

export const staffTasks = {
  list: (params?: { department_id?: string; status?: string }) =>
    api.get<{ counts: Record<string, number>; overdue: number; tasks: StaffTask[] }>(
      "/tasks",
      params
    ),
  create: (body: {
    title: string;
    description?: string;
    department_id: string;
    assignee_id?: string;
    room_id?: string;
    priority?: string;
    due_at?: string;
  }) => api.post<StaffTask>("/tasks", body),
  claim: (id: string) => api.post<StaffTask>(`/tasks/${id}/claim`),
  setStatus: (id: string, status: string) =>
    api.put<StaffTask>(`/tasks/${id}/status`, { status }),
};

