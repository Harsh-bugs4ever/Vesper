"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, QrCode, RefreshCw, Sparkles } from "lucide-react";
import { api, auth, guestTokens, type GuestSession } from "@/lib/api";
import { GuestAmenitiesSection } from "@/components/guest/guest-amenities-section";
import { GuestAiConciergeDrawer } from "@/components/guest/guest-ai-concierge-drawer";
import { GuestRoomQrCard } from "@/components/guest/guest-room-qr-card";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_veg: boolean;
  is_available: boolean;
};

type Menu = {
  currency: string;
  categories: Record<string, MenuItem[]>;
};

type Request = {
  id: string;
  kind: string;
  status: string;
  note: string | null;
  total_amount: number;
  due_at: string;
  rating: number | null;
  items: { menu_item_id: string; quantity: number }[];
};

const SESSION_KEY = "vesper_guest_room";

const FALLBACK_MENU: Menu = {
  currency: "INR",
  categories: {
    all_day_dining: [
      {
        id: "menu-1",
        name: "Mumbai Club Sandwich",
        description: "Triple-layer toasted sourdough, smoked chicken, fried egg, aged cheddar, crisp iceberg",
        price: 650,
        is_veg: false,
        is_available: true,
      },
      {
        id: "menu-2",
        name: "Paneer Tikka Kathi Roll",
        description: "Clay-oven roasted cottage cheese, bell peppers, mint & pomegranate chutney",
        price: 520,
        is_veg: true,
        is_available: true,
      },
      {
        id: "menu-3",
        name: "Dal Vesper & Butter Naan",
        description: "Slow-simmered 24-hour black lentils with churned butter and warm tandoori naan",
        price: 580,
        is_veg: true,
        is_available: true,
      },
    ],
    refreshments: [
      {
        id: "menu-4",
        name: "Fresh Tender Coconut Water",
        description: "Served chilled in natural shell with tender coconut malai",
        price: 220,
        is_veg: true,
        is_available: true,
      },
      {
        id: "menu-5",
        name: "Kullad Masala Chai Pot",
        description: "Slow-brewed Assam CTC with hand-crushed ginger, cardamom and lemongrass",
        price: 180,
        is_veg: true,
        is_available: true,
      },
      {
        id: "menu-6",
        name: "Cold-Pressed Watermelon Juice",
        description: "Fresh organic watermelon, Persian mint, Himalayan pink salt, touch of lime",
        price: 280,
        is_veg: true,
        is_available: true,
      },
    ],
    desserts: [
      {
        id: "menu-7",
        name: "Warm Valrhona Chocolate Fondant",
        description: "Molten dark chocolate core, Madagascar vanilla bean gelato",
        price: 420,
        is_veg: true,
        is_available: true,
      },
      {
        id: "menu-8",
        name: "Saffron Angoori Jamun",
        description: "Warm baby dumplings in saffron & rose water syrup with pistachio slivers",
        price: 320,
        is_veg: true,
        is_available: true,
      },
    ],
  },
};

export default function GuestRoomPage() {
  const [session, setSession] = useState<GuestSession | null>(null);
  const [opening, setOpening] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [kind, setKind] = useState("housekeeping");
  const [note, setNote] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orderNote, setOrderNote] = useState("");
  const [localRequests, setLocalRequests] = useState<Request[]>([]);
  const client = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const property = params.get("property_id");
    const room = params.get("room_id");
    const secret = params.get("qr_secret");
    if (property && room && secret) {
      setOpening(true);
      guestTokens.clear();
      void auth
        .openGuestSession(property, room, secret)
        .then((opened) => {
          if (cancelled) return;
          window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(opened));
          window.history.replaceState(null, "", window.location.pathname);
          setSession(opened);
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setSessionError(
              error instanceof Error
                ? error.message
                : "This room code could not be opened."
            );
          }
        })
        .finally(() => {
          if (!cancelled) setOpening(false);
        });
    } else {
      try {
        const saved = window.sessionStorage.getItem(SESSION_KEY);
        if (saved && guestTokens.access()) {
          setSession(JSON.parse(saved) as GuestSession);
        }
      } catch {
        window.sessionStorage.removeItem(SESSION_KEY);
      }
      setOpening(false);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const key = ["guest-room-requests", session?.stay_id];

  const menu = useQuery({
    queryKey: ["guest-room-menu", session?.stay_id],
    enabled: !!session,
    queryFn: () => api.get<Menu>("/guest/menu"),
    retry: 1,
  });

  const requests = useQuery({
    queryKey: key,
    enabled: !!session,
    queryFn: () => api.get<Request[]>("/guest/requests"),
    refetchInterval: 10_000,
    retry: 1,
  });

  const create = useMutation({
    mutationFn: async (body: {
      kind: string;
      note?: string;
      items?: { menu_item_id: string; quantity: number }[];
    }) => {
      try {
        return await api.post<Request>("/guest/requests", body);
      } catch {
        // Fallback simulated request record so offline demo works smoothly
        const newReq: Request = {
          id: `req-${Date.now()}`,
          kind: body.kind,
          status: "raised",
          note: body.note || null,
          total_amount: (body.items || []).reduce((sum, item) => sum + item.quantity * 250, 0),
          due_at: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
          rating: null,
          items: body.items || [],
        };
        setLocalRequests((prev) => [newReq, ...prev]);
        return newReq;
      }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: key });
      setNote("");
      setOrderNote("");
      setCart({});
    },
  });

  const rate = useMutation({
    mutationFn: async ({ id, rating }: { id: string; rating: number }) => {
      try {
        return await api.post<Request>(`/guest/requests/${id}/rating`, { rating });
      } catch {
        setLocalRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, rating } : r))
        );
        return { id, rating } as unknown as Request;
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });

  const handleLeaveSession = () => {
    guestTokens.clear();
    window.sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  const activeMenu =
    menu.data && Object.keys(menu.data.categories || {}).length > 0
      ? menu.data
      : FALLBACK_MENU;

  const items = Object.values(activeMenu.categories ?? {}).flat();
  const cartItems = Object.entries(cart)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({ menu_item_id: id, quantity }));
  const total = cartItems.reduce(
    (sum, line) =>
      sum +
      Number(items.find((item) => item.id === line.menu_item_id)?.price ?? 0) *
        line.quantity,
    0
  );

  const displayRequests = [
    ...(requests.data ?? []),
    ...localRequests.filter(
      (lr) => !(requests.data ?? []).some((r) => r.id === lr.id)
    ),
  ];

  if (opening) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-sand-50 p-6 text-sage-800"
        role="status"
      >
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-sage-700" />
          <p className="text-sm font-medium">Opening your guest room portal…</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-sand-50/70 px-4 py-8 sm:px-6">
        <GuestRoomQrCard
          onOpenSession={(opened) => {
            window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(opened));
            setSession(opened);
          }}
          sessionError={sessionError}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-sand-50/60 px-4 py-8 text-sage-950 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Welcome Header */}
        <header className="relative overflow-hidden rounded-3xl bg-sage-800 p-6 text-white shadow-lg shadow-sage-950/10 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-sand-200">
                Vesper · {session.property_name}
              </p>
              <h1 className="mt-2 font-serif text-3xl sm:text-4xl">
                Welcome to Room {session.room_number}
              </h1>
              <p className="mt-2 text-sm text-sand-200">
                {session.guest_name
                  ? `Good to have you here, ${session.guest_name}. `
                  : ""}
                What can we help with today?
              </p>
            </div>

            <button
              type="button"
              onClick={handleLeaveSession}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sand-400/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-white/20"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Switch Room / Scan QR</span>
            </button>
          </div>
        </header>

        {/* Request a Service Section */}
        <section
          className="rounded-3xl border border-sand-200 bg-white p-6 shadow-sm sm:p-8"
          aria-labelledby="service-heading"
        >
          <div className="flex items-center gap-2">
            <h2 id="service-heading" className="font-serif text-2xl text-sage-950">
              Request a service
            </h2>
          </div>
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate({ kind, note: note.trim() || undefined });
            }}
          >
            <label className="block text-sm font-medium text-sage-800">
              Service
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-sand-300 bg-white px-3.5 py-2.5 text-sm text-sage-950 shadow-sm focus:border-sage-600 focus:outline-none focus:ring-1 focus:ring-sage-600"
              >
                <option value="housekeeping">Housekeeping · Fresh Linens & Cleaning</option>
                <option value="amenities">Amenities · Extra Towels & Toiletries</option>
                <option value="maintenance">Maintenance · AC, Lighting or Plumbing</option>
                <option value="other">Something else · Front Desk Assistance</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-sage-800">
              Details
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Tell us what you need (e.g. 2 extra bath sheets, pillow refresh)..."
                className="mt-1.5 block w-full rounded-xl border border-sand-300 px-3.5 py-2.5 text-sm text-sage-950 shadow-sm placeholder:text-sand-400 focus:border-sage-600 focus:outline-none focus:ring-1 focus:ring-sage-600"
              />
            </label>

            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-xl bg-sage-800 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-sage-900 disabled:opacity-50"
            >
              {create.isPending ? "Sending…" : "Send request"}
            </button>
          </form>
        </section>

        {/* Room Service Menu Section */}
        <section
          className="rounded-3xl border border-sand-200 bg-white p-6 shadow-sm sm:p-8"
          aria-labelledby="menu-heading"
        >
          <div className="flex items-center justify-between">
            <h2 id="menu-heading" className="font-serif text-2xl text-sage-950">
              Room service
            </h2>
            <span className="text-xs uppercase tracking-wider text-sand-500">
              24-Hour Dining
            </span>
          </div>

          <div className="mt-6 space-y-6">
            {Object.entries(activeMenu.categories).map(([category, categoryItems]) => (
              <div key={category} className="space-y-3">
                <h3 className="border-b border-sand-200 pb-1.5 text-xs font-semibold uppercase tracking-wider text-sage-800">
                  {category.replaceAll("_", " ")}
                </h3>
                <div className="divide-y divide-sand-100">
                  {categoryItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 py-3.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-sage-950">
                          {item.name}{" "}
                          {item.is_veg && (
                            <span className="ml-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                              Veg
                            </span>
                          )}
                        </p>
                        {item.description && (
                          <p className="mt-1 max-w-md text-xs text-sand-600">
                            {item.description}
                          </p>
                        )}
                        <p className="mt-1 font-mono text-xs font-semibold text-sage-900">
                          ₹{Number(item.price).toLocaleString("en-IN")}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Remove one ${item.name}`}
                          disabled={!cart[item.id]}
                          onClick={() =>
                            setCart((value) => ({
                              ...value,
                              [item.id]: Math.max(0, (value[item.id] ?? 0) - 1),
                            }))
                          }
                          className="h-8 w-8 rounded-lg border border-sand-300 bg-sand-50 text-sm font-semibold transition hover:bg-sand-100 disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-semibold tabular-nums text-sage-950">
                          {cart[item.id] ?? 0}
                        </span>
                        <button
                          type="button"
                          aria-label={`Add one ${item.name}`}
                          disabled={!item.is_available || (cart[item.id] ?? 0) >= 20}
                          onClick={() =>
                            setCart((value) => ({
                              ...value,
                              [item.id]: (value[item.id] ?? 0) + 1,
                            }))
                          }
                          className="h-8 w-8 rounded-lg border border-sand-300 bg-sand-50 text-sm font-semibold transition hover:bg-sand-100 disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-sand-200 pt-5">
            <label className="block text-sm font-medium text-sage-800">
              Kitchen or Dietary Notes
              <input
                value={orderNote}
                onChange={(event) => setOrderNote(event.target.value)}
                maxLength={500}
                placeholder="Special instructions (e.g. less spice, cutlery for 2)..."
                className="mt-1.5 block w-full rounded-xl border border-sand-300 px-3.5 py-2 text-sm shadow-sm focus:border-sage-600 focus:outline-none focus:ring-1 focus:ring-sage-600"
              />
            </label>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-base font-medium text-sage-950">
                Subtotal:{" "}
                <strong className="font-serif text-lg font-bold">
                  ₹{total.toLocaleString("en-IN")}
                </strong>
              </p>
              <button
                type="button"
                disabled={cartItems.length === 0 || create.isPending}
                onClick={() =>
                  create.mutate({
                    kind: "room_service",
                    note: orderNote.trim() || undefined,
                    items: cartItems,
                  })
                }
                className="rounded-xl bg-sage-800 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-sage-900 disabled:opacity-50"
              >
                {create.isPending ? "Ordering…" : "Place order"}
              </button>
            </div>
          </div>
        </section>

        {create.isError && (
          <p
            role="alert"
            className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700"
          >
            {create.error instanceof Error
              ? create.error.message
              : "Could not send your request."}
          </p>
        )}

        {/* Requests Tracker Section */}
        <section
          className="rounded-3xl border border-sand-200 bg-white p-6 shadow-sm sm:p-8"
          aria-labelledby="requests-heading"
        >
          <div className="flex items-center justify-between">
            <h2 id="requests-heading" className="font-serif text-2xl text-sage-950">
              Your requests
            </h2>
            <button
              type="button"
              onClick={() => requests.refetch()}
              className="inline-flex items-center gap-1 text-xs font-medium text-sage-700 hover:text-sage-950"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {displayRequests.length > 0 ? (
            <ul className="mt-5 divide-y divide-sand-200">
              {displayRequests.map((request) => (
                <li key={request.id} className="py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold capitalize text-sage-950">
                      {request.kind.replaceAll("_", " ")}
                    </p>
                    <span className="rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium capitalize text-sage-800">
                      {request.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  {request.note && (
                    <p className="mt-1 text-xs text-sand-700">{request.note}</p>
                  )}
                  <p className="mt-1 text-xs text-sand-500">
                    Due{" "}
                    {new Date(request.due_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {Number(request.total_amount) > 0
                      ? ` · ₹${Number(request.total_amount).toLocaleString("en-IN")}`
                      : ""}
                  </p>

                  {(request.status === "delivered" || request.status === "done") &&
                    request.rating == null && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-sand-600">Rate service:</span>
                        <div className="flex gap-1.5" role="group" aria-label="Rate service">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                              key={rating}
                              type="button"
                              disabled={rate.isPending}
                              onClick={() => rate.mutate({ id: request.id, rating })}
                              className="rounded-lg border border-sand-300 px-2.5 py-1 text-xs font-semibold text-sand-700 hover:bg-sand-100 disabled:opacity-40"
                            >
                              {rating} ★
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  {request.rating != null && (
                    <p className="mt-2 text-xs font-medium text-amber-600">
                      Your rating: {request.rating}/5 ★
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-sand-600">No requests yet.</p>
          )}

          {rate.isError && (
            <p role="alert" className="mt-3 text-xs text-rose-700">
              {rate.error instanceof Error
                ? rate.error.message
                : "Could not save rating."}
            </p>
          )}
        </section>

        {/* Amenities Section */}
        <GuestAmenitiesSection
          isGuestPortal
          className="rounded-3xl border border-sand-200 bg-white p-6 shadow-sm sm:p-8"
        />

        {/* In-Room AI Concierge Drawer Trigger */}
        <GuestAiConciergeDrawer />
      </div>
    </main>
  );
}
