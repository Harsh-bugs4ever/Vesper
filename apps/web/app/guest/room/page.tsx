"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  LogOut,
  Minus,
  Plus,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
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
  items: { menu_item_id: string; name?: string; quantity: number; unit_price?: number }[];
};

const SESSION_KEY = "vesper_guest_room";

export default function GuestRoomPage() {
  const [session, setSession] = useState<GuestSession | null>(null);
  const [opening, setOpening] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [kind, setKind] = useState("housekeeping");
  const [note, setNote] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orderNote, setOrderNote] = useState("");
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
                : "This room session could not be opened. Stay may have expired or checked out."
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
    refetchInterval: 5_000,
    retry: 1,
  });

  const create = useMutation({
    mutationFn: async (body: {
      kind: string;
      note?: string;
      items?: { menu_item_id: string; quantity: number }[];
    }) => {
      return await api.post<Request>("/guest/requests", body);
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
      return await api.post<Request>(`/guest/requests/${id}/rating`, { rating });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });

  const handleLeaveSession = () => {
    guestTokens.clear();
    window.sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  const isSessionTerminated =
    (requests.error &&
      (requests.error.message.includes("403") ||
        requests.error.message.toLowerCase().includes("checked out") ||
        requests.error.message.toLowerCase().includes("ended"))) ||
    (menu.error &&
      (menu.error.message.includes("403") ||
        menu.error.message.toLowerCase().includes("checked out") ||
        menu.error.message.toLowerCase().includes("ended")));

  const menuCategories = menu.data?.categories ?? {};
  const allMenuItems = Object.values(menuCategories).flat();

  const cartItems = Object.entries(cart)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({ menu_item_id: id, quantity }));

  const cartTotal = cartItems.reduce((sum, line) => {
    const item = allMenuItems.find((i) => i.id === line.menu_item_id);
    return sum + Number(item?.price ?? 0) * line.quantity;
  }, 0);

  if (opening) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-sand-50 p-6 text-sage-800"
        role="status"
      >
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-sage-700" />
          <p className="text-sm font-medium">Connecting to your verified room session…</p>
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
                Your verified stay is active. What can we assist you with today?
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

        {/* Stay Ended or Checked Out Alert */}
        {isSessionTerminated && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div className="text-xs">
              <p className="font-semibold text-sm">Stay Checked Out or Session Expired</p>
              <p className="mt-1 text-rose-700">
                This room stay has been checked out by the front desk. In-room services and requests are only available during an active stay.
              </p>
              <button
                type="button"
                onClick={handleLeaveSession}
                className="mt-2 font-medium underline hover:text-rose-950"
              >
                Return to QR scanner
              </button>
            </div>
          </div>
        )}

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
              if (create.isPending) return;
              create.mutate({ kind, note: note.trim() || undefined });
            }}
          >
            <label className="block text-sm font-medium text-sage-800">
              Service Category
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-sand-300 bg-white px-3.5 py-2.5 text-sm text-sage-950 shadow-sm focus:border-sage-600 focus:outline-none focus:ring-1 focus:ring-sage-600"
              >
                <option value="housekeeping">Housekeeping · Fresh Linens & Room Refresh</option>
                <option value="amenities">Amenities · Extra Towels & Luxury Toiletries</option>
                <option value="maintenance">Maintenance · AC, Lighting, or Plumbing</option>
                <option value="other">Front Desk · Luggage, Concierge, or Inquiries</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-sage-800">
              Instructions or Details
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
              disabled={create.isPending || !!isSessionTerminated}
              className="rounded-xl bg-sage-800 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-sage-900 disabled:opacity-50"
            >
              {create.isPending ? "Submitting request…" : "Send request"}
            </button>
          </form>

          {create.isError && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700"
            >
              {create.error instanceof Error
                ? create.error.message
                : "Could not submit your request."}
            </p>
          )}
        </section>

        {/* Room Service Menu Section */}
        <section
          className="rounded-3xl border border-sand-200 bg-white p-6 shadow-sm sm:p-8"
          aria-labelledby="menu-heading"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 id="menu-heading" className="font-serif text-2xl text-sage-950">
                In-room dining
              </h2>
              <p className="text-xs text-sand-600">Freshly prepared and delivered to your door</p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-sage-800 bg-sand-100 px-2.5 py-1 rounded-full">
              Kitchen Live
            </span>
          </div>

          {menu.isLoading ? (
            <div className="mt-8 flex flex-col items-center justify-center gap-2 py-8 text-sand-500">
              <RefreshCw className="h-6 w-6 animate-spin text-sage-700" />
              <p className="text-xs font-medium">Loading live kitchen menu & availability…</p>
            </div>
          ) : menu.isError ? (
            <div className="mt-6 rounded-2xl bg-rose-50 p-4 text-center text-xs text-rose-700">
              <UtensilsCrossed className="mx-auto mb-1 h-5 w-5" />
              <p className="font-semibold">Unable to load dining menu</p>
              <p className="mt-1">
                {menu.error instanceof Error
                  ? menu.error.message
                  : "Please contact room service via Front Desk."}
              </p>
              <button
                type="button"
                onClick={() => menu.refetch()}
                className="mt-2 font-medium underline hover:text-rose-900"
              >
                Retry Loading Menu
              </button>
            </div>
          ) : Object.keys(menuCategories).length === 0 ? (
            <div className="mt-6 rounded-2xl border border-sand-200 bg-sand-50/50 p-6 text-center text-xs text-sand-600">
              <UtensilsCrossed className="mx-auto mb-1.5 h-6 w-6 text-sand-400" />
              <p className="font-medium text-sage-900">No menu items currently available</p>
              <p className="mt-1">The kitchen is currently updating today&apos;s culinary offerings.</p>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {Object.entries(menuCategories).map(([category, items]) => (
                <div key={category} className="space-y-3">
                  <h3 className="border-b border-sand-200 pb-1.5 text-xs font-semibold uppercase tracking-wider text-sage-800">
                    {category.replaceAll("_", " ")}
                  </h3>
                  <div className="divide-y divide-sand-100">
                    {items.map((item) => {
                      const isSoldOut = !item.is_available;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-4 py-3.5"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <p
                                className={cn(
                                  "text-sm font-medium",
                                  isSoldOut ? "text-sand-500 line-through" : "text-sage-950"
                                )}
                              >
                                {item.name}
                              </p>
                              {item.is_veg && (
                                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 border border-emerald-200">
                                  Veg
                                </span>
                              )}
                              {isSoldOut && (
                                <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-200">
                                  Sold Out
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="max-w-md text-xs text-sand-600">
                                {item.description}
                              </p>
                            )}
                            <p className="font-mono text-xs font-semibold text-sage-900">
                              ₹{Number(item.price).toLocaleString("en-IN")}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              aria-label={`Remove one ${item.name}`}
                              disabled={!cart[item.id] || isSoldOut}
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
                              disabled={isSoldOut || (cart[item.id] ?? 0) >= 20}
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
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="mt-6 border-t border-sand-200 pt-5">
                <label className="block text-sm font-medium text-sage-800">
                  Kitchen Notes & Dietary Preferences
                  <input
                    value={orderNote}
                    onChange={(event) => setOrderNote(event.target.value)}
                    maxLength={500}
                    placeholder="Dietary requests (e.g. less spice, extra napkins, cutlery for 2)..."
                    className="mt-1.5 block w-full rounded-xl border border-sand-300 px-3.5 py-2 text-sm shadow-sm focus:border-sage-600 focus:outline-none focus:ring-1 focus:ring-sage-600"
                  />
                </label>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-base font-medium text-sage-950">
                    Subtotal:{" "}
                    <strong className="font-serif text-lg font-bold">
                      ₹{cartTotal.toLocaleString("en-IN")}
                    </strong>
                  </p>
                  <button
                    type="button"
                    disabled={cartItems.length === 0 || create.isPending || !!isSessionTerminated}
                    onClick={() => {
                      if (create.isPending) return;
                      create.mutate({
                        kind: "room_service",
                        note: orderNote.trim() || undefined,
                        items: cartItems,
                      });
                    }}
                    className="rounded-xl bg-sage-800 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-sage-900 disabled:opacity-50"
                  >
                    {create.isPending ? "Submitting order…" : "Place order"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Requests Tracker Section */}
        <section
          className="rounded-3xl border border-sand-200 bg-white p-6 shadow-sm sm:p-8"
          aria-labelledby="requests-heading"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 id="requests-heading" className="font-serif text-2xl text-sage-950">
                Your requests & orders
              </h2>
              <p className="text-xs text-sand-500">Live backend sync every 5s</p>
            </div>
            <button
              type="button"
              onClick={() => requests.refetch()}
              className="inline-flex items-center gap-1 text-xs font-medium text-sage-700 hover:text-sage-950"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {requests.isLoading ? (
            <div className="mt-4 flex items-center justify-center gap-2 py-6 text-xs text-sand-500">
              <RefreshCw className="h-4 w-4 animate-spin text-sage-700" />
              <span>Loading orders…</span>
            </div>
          ) : (requests.data && requests.data.length > 0) ? (
            <ul className="mt-5 divide-y divide-sand-200">
              {requests.data.map((request) => {
                const statusColor =
                  request.status === "delivered"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : request.status === "accepted" || request.status === "in_progress"
                    ? "bg-blue-50 text-blue-800 border-blue-200"
                    : request.status === "cancelled"
                    ? "bg-sand-100 text-sand-600 border-sand-200"
                    : "bg-amber-50 text-amber-800 border-amber-200";

                const statusLabel =
                  request.status === "delivered"
                    ? "Delivered & Complete"
                    : request.status === "accepted"
                    ? "Accepted by Staff"
                    : request.status === "in_progress"
                    ? "In Progress"
                    : request.status === "cancelled"
                    ? "Cancelled"
                    : "Received · In Queue";

                return (
                  <li key={request.id} className="py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold capitalize text-sage-950">
                          {request.kind.replaceAll("_", " ")}
                        </p>
                        <span className="text-[10px] font-mono text-sand-500">
                          #{request.id.slice(0, 8)}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium border",
                          statusColor
                        )}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    {request.items && request.items.length > 0 && (
                      <p className="mt-1 text-xs font-medium text-sage-800">
                        {request.items
                          .map((i) => `${i.name || "Item"} ×${i.quantity}`)
                          .join(", ")}
                      </p>
                    )}

                    {request.note && (
                      <p className="mt-1 text-xs text-sand-700">{request.note}</p>
                    )}

                    <div className="mt-1 flex items-center gap-3 text-xs text-sand-500">
                      <span>
                        Due{" "}
                        {new Date(request.due_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {Number(request.total_amount) > 0 && (
                        <span>· ₹{Number(request.total_amount).toLocaleString("en-IN")}</span>
                      )}
                    </div>

                    {request.status === "delivered" && request.rating == null && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs font-medium text-sand-700">Rate service:</span>
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
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-sand-600">No requests placed during this stay yet.</p>
          )}

          {rate.isError && (
            <p role="alert" className="mt-3 text-xs font-medium text-rose-700">
              {rate.error instanceof Error
                ? rate.error.message
                : "Could not submit rating."}
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
