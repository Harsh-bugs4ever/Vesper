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
  const guestRequest =
    guest ||
    (path.startsWith("/guest/") &&
      path !== "/guest/session" &&
      path !== "/guest/active-rooms");
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
  assignments?: { property_id: string; department_id: string | null }[];
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

function getPublicProperty(propertyId: string): Promise<PublicProperty>;
function getPublicProperty(propertyId?: undefined): Promise<BackendPropertySummary>;
function getPublicProperty(propertyId?: string): Promise<BackendPropertySummary | PublicProperty>;
function getPublicProperty(propertyId?: string): Promise<BackendPropertySummary | PublicProperty> {
  return propertyId
    ? request<PublicProperty>(`/property/public/${propertyId}`, { anonymous: true })
    : request<BackendPropertySummary>("/property/public", { anonymous: true });
}

export const property = {
  /** The signed-in user's own property. */
  current: () => api.get<BackendProperty>("/property"),
  /** Every property this deployment serves. */
  list: () => api.get<BackendPropertySummary[]>("/property/list"),
  /** Public summary, or full public content when a property ID is supplied. */
  public: getPublicProperty,
  amenities: () => api.get<ResortAmenity[]>("/property/amenities"),
  saveAmenity: (amenity: AmenityWrite) => api.put<ResortAmenity>(`/property/amenities/${amenity.key}`, amenity),
  uploadRoomImage: (roomId: string, body: FormData) => api.upload<RoomImage>(`/rooms/${roomId}/images`, body),
  uploadCategoryImage: (categoryId: string, body: FormData) => api.upload<RoomImage>(`/property/room-categories/${categoryId}/images`, body),
  updateImage: (imageId: string, data: Pick<RoomImage, "alt_text" | "position" | "is_primary">) =>
    api.patch<RoomImage>(`/property/images/${imageId}`, data),
  /** Room categories belonging to this property (calls public endpoint first, falls back to authenticated). */
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
};

export const rooms = {
  list: (params?: { status?: string; floor?: number; category_id?: string }) =>
    api.get<BackendRoom[]>("/rooms", params),
  board: () => api.get<BackendRoomBoard>("/rooms/board"),
  get: (id: string) => api.get<BackendRoom>(`/rooms/${id}`),
  setStatus: (id: string, status: string, note?: string) =>
    api.put<BackendRoom>(`/rooms/${id}/status`, { status, note }),
};

export const amenities = {
  /**
   * Persisted guest amenity catalogue.
   * If backend endpoint is absent or returns 404, callers display explicit unavailable state.
   */
  list: () => api.get<GuestAmenity[]>("/guest/amenities"),
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
  top_themes: Array<{ theme?: string; count?: number; sentiment?: number;[key: string]: unknown }>;
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

export interface StockItemOut {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minimum_quantity: number;
  reorder_quantity: number;
  unit_cost: number;
  expires_on?: string | null;
  supplier?: string | null;
  lead_time_days: number;
  is_low?: boolean;
  days_to_expiry?: number | null;
}

export interface StockMovementOut {
  id: string;
  item_id: string;
  quantity: number;
  reason: string;
  note?: string | null;
  balance_after: number;
  created_at: string;
}

export interface RequisitionLineOut {
  id: string;
  item_id: string;
  quantity: number;
  unit_cost: number;
  reason: string;
}

export interface RequisitionAuditOut {
  actor_id: string;
  action: string;
  reason: string | null;
  created_at: string;
}

export interface RequisitionOut {
  id: string;
  property_id: string;
  department_id: string;
  requested_by: string;
  responsible_manager_id: string;
  currency: string;
  status: "submitted" | "approved" | "rejected" | "cancelled" | string;
  reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  lines: RequisitionLineOut[];
  history: RequisitionAuditOut[];
  created_at: string;
}

export interface BudgetOut {
  id: string;
  property_id: string;
  department_id: string;
  period_start: string;
  period_end: string;
  currency: string;
  allocated: number;
  committed: number;
  spent: number;
  remaining: number;
}

export interface PurchaseOrderOut {
  id: string;
  department_id: string | null;
  budget_id: string | null;
  request_line_id: string | null;
  currency: string;
  item_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  received_quantity: number;
  returned_quantity: number;
  supplier: string | null;
  status: "suggested" | "approved" | "ordered" | "partially_received" | "received" | "cancelled" | string;
  expected_on: string | null;
  approved_at: string | null;
  received_at: string | null;
  rationale: Record<string, unknown>;
  created_at: string;
}

export const requisitions = {
  submit: (body: { reason?: string; items: Array<{ item_id: string; quantity: number; reason: string }> }) =>
    api.post<RequisitionOut>("/inventory/requisitions", body),
  mine: () => api.get<RequisitionOut[]>("/inventory/requisitions/mine"),
  list: (params?: { department_id?: string }) =>
    api.get<RequisitionOut[]>("/inventory/requisitions", params),
  get: (id: string) => api.get<RequisitionOut>(`/inventory/requisitions/${id}`),
  approve: (id: string, reason: string) =>
    api.post<RequisitionOut>(`/inventory/requisitions/${id}/approve`, { reason }),
  reject: (id: string, reason: string) =>
    api.post<RequisitionOut>(`/inventory/requisitions/${id}/reject`, { reason }),
  cancel: (id: string, reason: string) =>
    api.post<RequisitionOut>(`/inventory/requisitions/${id}/cancel`, { reason }),
};

export const budgets = {
  list: (params?: { department_id?: string }) =>
    api.get<BudgetOut[]>("/inventory/budgets", params),
  create: (body: { department_id: string; period_start: string; period_end: string; currency: string; allocated: number }) =>
    api.post<BudgetOut>("/inventory/budgets", body),
  updateAllocation: (budgetId: string, allocated: number) =>
    api.put<BudgetOut>(`/inventory/budgets/${budgetId}/allocation`, { allocated }),
};

export const purchaseOrders = {
  list: (params?: { status?: string }) =>
    api.get<PurchaseOrderOut[]>("/purchase-orders", params),
  get: (id: string) => api.get<PurchaseOrderOut>(`/purchase-orders/${id}`),
  approve: (id: string, quantity?: number) =>
    api.post<PurchaseOrderOut>(`/purchase-orders/${id}/approve`, quantity ? { quantity } : {}),
  receive: (id: string, body?: { quantity?: number; operation_id?: string }) =>
    api.post<PurchaseOrderOut>(`/purchase-orders/${id}/receive`, body ?? {}),
  returnOrder: (id: string, body: { quantity: number; operation_id: string; reason: string }) =>
    api.post<PurchaseOrderOut>(`/purchase-orders/${id}/return`, body),
  cancel: (id: string) => api.post<PurchaseOrderOut>(`/purchase-orders/${id}/cancel`),
};

export const inventory = {
  items: (params?: { category?: string; low_only?: boolean; expiring_only?: boolean; search?: string }) =>
    api.get<StockItemOut[]>("/inventory/items", params),
  getItem: (id: string) => api.get<StockItemOut>(`/inventory/items/${id}`),
  createItem: (body: {
    sku: string;
    name: string;
    category: string;
    unit?: string;
    quantity?: number;
    minimum_quantity?: number;
    reorder_quantity?: number;
    unit_cost?: number;
    supplier?: string;
    lead_time_days?: number;
    expires_on?: string | null;
    department_id?: string | null;
  }) => api.post<StockItemOut>("/inventory/items", body),
  updateItem: (id: string, body: Partial<StockItemOut>) =>
    api.patch<StockItemOut>(`/inventory/items/${id}`, body),
  moveStock: (id: string, body: { quantity: number; reason: string; note?: string }) =>
    api.post<StockMovementOut>(`/inventory/items/${id}/movements`, body),
  summary: () =>
    api.get<{
      total_items: number;
      low_stock_items: number;
      expiring_items: number;
      stock_value: number;
      pending_suggestions: number;
    }>("/inventory/summary"),
};

// --- Phase 6: Overview, Attendance, Performance, Spatial & Analytics ---

export interface ActionDriver {
  name: string;
  value: string | number;
  direction?: "up" | "down" | "neutral";
  impact?: string;
}

export interface ActionCardDetail {
  id: string;
  kind: string;
  engine: string;
  urgency: "urgent" | "high" | "medium" | "low" | string;
  status: "pending" | "approved" | "executed" | "dismissed" | "snoozed" | string;
  title: string;
  summary: string;
  impact_amount: number;
  confidence: number;
  department_id: string | null;
  drivers: ActionDriver[];
  adjustments?: Record<string, unknown>;
  can_undo?: boolean;
  undo_seconds_left?: number;
  created_at: string;
  expires_at?: string | null;
}

export interface ActionStats {
  pending: number;
  approved: number;
  dismissed: number;
  total: number;
}

export interface DashboardData {
  occupancy: {
    total_rooms: number;
    occupied_rooms: number;
    occupancy_rate: number;
    as_of: string;
  } | null;
  rooms: {
    total: number;
    ready: number;
    occupied: number;
    dirty: number;
    cleaning?: number;
    out_of_order?: number;
  } | null;
  front_desk: {
    arrivals: number;
    departures: number;
    in_house: number;
  } | null;
  requests: {
    open: number;
    overdue: number;
    awaiting_accept: number;
  } | null;
  tasks: {
    overdue: number;
  } | null;
  stock: {
    total_items: number;
    low_stock_items: number;
    expiring_items: number;
  } | null;
  assets: {
    total?: number;
    active_alerts?: number;
    high_criticality_offline?: number;
  } | null;
  sentiment: {
    average_score?: number;
    average_sentiment?: number;
    samples?: number;
    total_reviews?: number;
    positive_pct?: number;
  } | null;
  at_risk_guests: {
    count: number;
  } | null;
  forecast: {
    nights: Array<{
      stay_date: string;
      predicted_occupancy: number;
      lower_bound: number;
      upper_bound: number;
    }>;
    model: string;
    confidence: number;
  } | null;
  outbox: OutboxSummary | null;
  action_queue: ActionStats;
  engines: {
    ready: string[];
    warming: string[];
    cold: string[];
  };
  live_feed: Array<{
    type: string;
    payload: Record<string, unknown>;
    occurred_at: string;
    id: string;
  }>;
  unavailable: string[];
  generated_at: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  work_date: string;
  checked_in_at: string;
  checked_out_at: string | null;
  worked_minutes: number;
  is_late: boolean;
  notes?: string | null;
}

export interface AttendanceTeamSummary {
  work_date: string;
  expected: number;
  present: number;
  late: number;
  absent: number;
  still_on_shift?: number;
  records: AttendanceRecord[];
}

export interface ShiftData {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  department_id?: string | null;
}

export interface LearningEngineReport {
  engine: string;
  display_name?: string;
  cards_created: number;
  approved: number;
  dismissed: number;
  accuracy_pct: number;
  average_confidence: number;
  status: "ready" | "warming" | "cold" | string;
}

export interface ReadinessData {
  ready: string[];
  warming: string[];
  cold: string[];
}

export interface SimulateRequest {
  rate_change_pct: number;
  staffing_change_pct: number;
  promo_discount_pct: number;
  days: number;
}

export interface SimulateResult {
  projected_revenue: number;
  baseline_revenue: number;
  projected_occupancy: number;
  baseline_occupancy: number;
  projected_margin_pct?: number;
  revenue_delta: number;
  occupancy_delta_pct: number;
  assumptions: Record<string, unknown>;
}

export interface StaffingRow {
  department_id: string;
  department_name?: string;
  shift_name: string;
  work_date: string;
  required: number;
  scheduled: number;
  gap: number;
}

export interface LeaveOut {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | string;
  decided_by?: string | null;
  decided_at?: string | null;
  created_at: string;
}

export interface RosterOut {
  id: string;
  week_start: string;
  department_id: string | null;
  status: "draft" | "published" | "archived" | string;
  total_shifts: number;
  total_hours: number;
  created_at: string;
}

export interface RosterEntryOut {
  id: string;
  roster_id: string;
  user_id: string;
  shift_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
}

export interface RosterDetail extends RosterOut {
  entries: RosterEntryOut[];
}

export interface StaffReportOut {
  id: string;
  property_id: string;
  reported_by: string;
  reporter_department_id: string | null;
  department_id: string;
  shift_date: string;
  shift_type: string;
  summary: string;
  highlights: string[];
  issues_encountered: string[];
  handover_notes: string | null;
  status: "draft" | "submitted" | "approved" | string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export const dashboardApi = {
  get: (liveFeed: number = 15) =>
    api.get<DashboardData>("/dashboard", { live_feed: liveFeed }),
};

export const actionCardsApi = {
  list: (params?: { kind?: string; engine?: string; include_decided?: boolean; limit?: number }) =>
    api.get<ActionCardDetail[]>("/cards", params),
  approve: (cardId: string, adjustments?: Record<string, unknown>) =>
    api.post<ActionCardDetail>(`/cards/${cardId}/approve`, { adjustments }),
  dismiss: (cardId: string, reason: string, note?: string) =>
    api.post<ActionCardDetail>(`/cards/${cardId}/dismiss`, { reason, note }),
  claim: (cardId: string) => api.post<ActionCardDetail>(`/cards/${cardId}/claim`),
  snooze: (cardId: string, minutes: number) =>
    api.post<ActionCardDetail>(`/cards/${cardId}/snooze`, { minutes }),
  undo: (cardId: string) => api.post<ActionCardDetail>(`/cards/${cardId}/undo`),
  stats: () => api.get<ActionStats>("/cards/stats"),
};

export const learningApi = {
  list: () => api.get<LearningEngineReport[]>("/learning"),
  readiness: () => api.get<ReadinessData>("/learning/readiness"),
};

export const attendanceApi = {
  me: (days: number = 14) => api.get<AttendanceRecord[]>("/attendance/me", { days }),
  team: (params?: { department_id?: string; work_date?: string }) =>
    api.get<AttendanceTeamSummary>("/attendance/team", params),
  shifts: () => api.get<ShiftData[]>("/attendance/shifts"),
  checkIn: (body: { shift_id?: string; note?: string; location?: string }) =>
    api.post<AttendanceRecord>("/attendance/check-in", body),
  checkOut: (body?: { note?: string }) =>
    api.post<AttendanceRecord>("/attendance/check-out", body ?? {}),
};

export const workforceApi = {
  currentRoster: (week_start?: string) =>
    api.get<RosterDetail | null>("/workforce/rosters/current", week_start ? { week_start } : undefined),
  listRosters: (status?: string) =>
    api.get<RosterOut[]>("/workforce/rosters", status ? { status } : undefined),
  generateRoster: (body: { week_start: string; department_id?: string }) =>
    api.post<RosterDetail>("/workforce/rosters/generate", body),
  publishRoster: (id: string) => api.post<RosterDetail>(`/workforce/rosters/${id}/publish`),
  staffingChart: (rosterId: string) =>
    api.get<StaffingRow[]>(`/workforce/rosters/${rosterId}/staffing`),
  leave: (params?: { status?: string; user_id?: string }) =>
    api.get<LeaveOut[]>("/workforce/leave", params),
  requestLeave: (body: { start_date: string; end_date: string; leave_type: string; reason?: string }) =>
    api.post<LeaveOut>("/workforce/leave", body),
  decideLeave: (leaveId: string, approve: boolean) =>
    api.post<LeaveOut>(`/workforce/leave/${leaveId}/decide`, { approve }),
};

export const reportsApi = {
  list: (departmentId?: string) =>
    api.get<StaffReportOut[]>("/reports", departmentId ? { department_id: departmentId } : undefined),
  mine: () => api.get<StaffReportOut[]>("/reports/mine"),
  create: (body: {
    department_id: string;
    shift_date: string;
    shift_type: string;
    summary: string;
    highlights?: string[];
    issues_encountered?: string[];
    handover_notes?: string;
  }) => api.post<StaffReportOut>("/reports", body),
  approve: (id: string) => api.post<StaffReportOut>(`/reports/${id}/approve`),
};

export const revenueApi = {
  forecast: (days: number = 30) => api.get<any[]>("/revenue/forecast", { days }),
  rateCard: (days: number = 30) => api.get<any[]>("/revenue/rate-card", { days }),
  competitors: (days: number = 14) => api.get<any[]>("/revenue/competitors", { days }),
  simulate: (body: SimulateRequest) => api.post<SimulateResult>("/revenue/simulate", body),
  applyRates: (body: { room_category_id: string; dates: string[]; rate: number; source_card_id?: string }) =>
    api.post<any>("/revenue/rates/apply", body),
  rateHistory: (categoryId?: string, limit: number = 50) =>
    api.get<any[]>("/revenue/rates/history", { category_id: categoryId, limit }),
};

export const roomsApi = {
  board: () => api.get<BackendRoomBoard>("/rooms/board"),
  list: (params?: { status?: string; floor?: number; category_id?: string }) =>
    api.get<BackendRoom[]>("/rooms", params),
  occupancy: () =>
    api.get<{
      total_rooms: number;
      occupied_rooms: number;
      occupancy_rate: number;
      as_of: string;
    }>("/property/occupancy"),
};


