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
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

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
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : multipart ? body as FormData : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    // The gateway is down, or the browser is offline. Say which, rather than throwing
    // a bare TypeError from fetch.
    throw new ApiError(0, {
      code: "network_error",
      message: "Could not reach the server. Check that the backend is running.",
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
      return await api.get<BackendRoomCategory[]>("/property/room-categories");
    }
  },
  /** Occupancy count and percentage from backend. */
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
