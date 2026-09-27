"use client";

import { useEffect, useMemo, useState } from "react";
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
import { GuestUpiPaymentModal } from "@/components/guest/guest-upi-payment-modal";
import { GuestOrderConfirmationModal } from "@/components/guest/guest-order-confirmation-modal";
import { GuestAiDiningRecommendations } from "@/components/guest/guest-ai-dining-recommendations";
import {
  type MenuItem as CatalogMenuItem,
  type OrderItemHistorySummary,
} from "@/lib/dining-catalog";
import { cn } from "@/lib/utils";

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
  items: { menu_item_id: string; name?: string; quantity: number; unit_price?: number; is_veg?: boolean }[];
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

  // UPI Payment & Order Confirmation State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<{
    id: string;
    roomNumber: string;
    guestName?: string;
    items: { name: string; quantity: number; price?: number; is_veg?: boolean }[];
    totalAmount: number;
    txnId: string;
    paymentMethod: string;
    placedAt: string;
    estimatedDeliveryTime: string;
    note?: string;
    hasNonVeg: boolean;
  } | null>(null);


  // AI Order History tracking for food recommendations (e.g. Non-Veg preferences)
  const [orderHistory, setOrderHistory] = useState<OrderItemHistorySummary[]>([]);

  const client = useQueryClient();

  // Load session from URL parameters or session storage
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
        if (saved) {
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

  // Load taste history and stored orders when room is loaded
  useEffect(() => {
    if (!session?.room_number) return;
    try {
      const savedHistory = window.sessionStorage.getItem(
        `vesper_guest_taste_history_${session.room_number}`
      );
      if (savedHistory) {
        setOrderHistory(JSON.parse(savedHistory));
      }

      window.sessionStorage.removeItem(`vesper_guest_orders_${session.room_number}`);
    } catch {
      // Ignore sessionStorage parsing errors
    }
  }, [session?.room_number]);

  const key = ["guest-room-requests", session?.stay_id];

  const menu = useQuery({
    queryKey: ["guest-room-menu", session?.stay_id],
    queryFn: () => api.get<Menu>("/guest/menu"),
    retry: 1,
  });

  const requests = useQuery({
    queryKey: key,
    enabled: !!session && !session.token.startsWith("demo-token-"),
    queryFn: () => api.get<Request[]>("/guest/requests"),
    refetchInterval: (query) => (query.state.error ? false : 5_000),
    retry: false,
  });

  const isSessionTerminated = Boolean(
    requests.error &&
      (requests.error.message.includes("403") ||
        requests.error.message.includes("401") ||
        requests.error.message.toLowerCase().includes("invalid token") ||
        requests.error.message.toLowerCase().includes("unauthorized") ||
        requests.error.message.toLowerCase().includes("checked out") ||
        requests.error.message.toLowerCase().includes("ended"))
  );

  useEffect(() => {
    if (isSessionTerminated) {
      guestTokens.clear();
      window.sessionStorage.removeItem(SESSION_KEY);
      setSession(null);
    }
  }, [isSessionTerminated]);

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

  const masterCatalog = useMemo(() => {
    return Object.entries(menu.data?.categories ?? {}).flatMap(([category, items]) =>
      items.map((item) => ({
        id: item.id,
        name: item.name,
        category: category.includes("dessert") ? "desserts" : category.includes("beverage") ? "beverages" : "mains",
        categoryLabel: category.replaceAll("_", " "),
        description: item.description ?? "",
        price: Number(item.price),
        is_veg: item.is_veg,
        is_available: item.is_available,
        preparationTimeMinutes: 25,
      } as CatalogMenuItem))
    );
  }, [menu.data?.categories]);

  // Robust menu item finder by ID, lowercase ID, or name
  const getMenuItem = (id: string): MenuItem | undefined => {
    if (!id) return undefined;
    const cleanId = String(id).trim().toLowerCase();

    // 1. Direct ID match in masterCatalog
    let match = masterCatalog.find(
      (m) => String(m.id).toLowerCase() === cleanId
    );
    if (match) return match;

    // 2. Name match (case-insensitive)
    match = masterCatalog.find(
      (m) => m.name.toLowerCase().trim() === cleanId
    );
    if (match) return match;

    return undefined;
  };

  const menuCategories = menu.data?.categories ?? {};

  const allMenuItems = masterCatalog;

  const cartItems = Object.entries(cart)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({ menu_item_id: id, quantity }));

  const cartTotal = cartItems.reduce((sum, line) => {
    const item = getMenuItem(line.menu_item_id);
    const unitPrice = Number(item?.price ?? 0);
    return sum + (isNaN(unitPrice) ? 0 : unitPrice) * line.quantity;
  }, 0);

  const totalCartItemCount = cartItems.reduce((sum, line) => sum + line.quantity, 0);

  const cartSummaryString = cartItems
    .map((line) => {
      const item = getMenuItem(line.menu_item_id);
      return `${item?.name || "Gourmet Dish"} ×${line.quantity}`;
    })
    .join(", ");

  const allRequests = requests.data || [];

  // Handle 1-click add to cart from AI recommendation cards
  const handleAddToCartFromAi = (item: CatalogMenuItem | MenuItem) => {
    setCart((prev) => ({
      ...prev,
      [item.id]: (prev[item.id] ?? 0) + 1,
    }));
  };

  const handleOpenPayment = () => {
    if (cartItems.length === 0 || isSessionTerminated) return;
    setIsPaymentModalOpen(true);
  };

  const handleConfirmOrder = () => {
    if (!session || create.isPending) return;
    create.mutate(
      { kind: "room_service", note: orderNote.trim() || undefined, items: cartItems },
      {
        onSuccess: (created) => {
          const orderedItems = cartItems.map((ci) => {
            const item = getMenuItem(ci.menu_item_id);
            return { name: item?.name || "Menu item", quantity: ci.quantity, price: Number(item?.price ?? 0) * ci.quantity, is_veg: item?.is_veg ?? true };
          });
          setConfirmedOrder({
            id: created.id,
            roomNumber: session.room_number,
            guestName: session.guest_name ?? undefined,
            items: orderedItems,
            totalAmount: Number(created.total_amount),
            txnId: "",
            paymentMethod: "Payment pending; arrange with hotel",
            placedAt: new Date().toLocaleTimeString("en-IN"),
            estimatedDeliveryTime: created.due_at ? new Date(created.due_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "To be confirmed",
            note: orderNote.trim() || undefined,
            hasNonVeg: orderedItems.some((item) => !item.is_veg),
          });
          setCart({});
          setOrderNote("");
          setIsPaymentModalOpen(false);
          setIsConfirmationModalOpen(true);
          void client.invalidateQueries({ queryKey: ["guest-requests"] });
        },
      }
    );
  };
  const handleTrackOrder = () => {
    const el = document.getElementById("requests-heading");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

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
              {menu.isError ? "Kitchen menu unavailable" : "Kitchen Live"}
            </span>
          </div>

          {menu.isLoading ? (
            <div className="mt-8 flex flex-col items-center justify-center gap-2 py-8 text-sand-500">
              <RefreshCw className="h-6 w-6 animate-spin text-sage-700" />
              <p className="text-xs font-medium">Loading live kitchen menu & availability…</p>
            </div>
          ) : menu.isError ? (
            <p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
              Could not load the current menu. Please try again before ordering.
            </p>
          ) : (
            <div className="mt-6 space-y-6">
              {/* Dynamic AI Food Recommendations based on user order history */}
              <GuestAiDiningRecommendations
                orderHistory={orderHistory}
                cart={cart}
                availableCatalog={masterCatalog}
                onAddToCart={handleAddToCartFromAi}
              />

              {/* Menu Categories (AI Guest Shield: Automatically conceals 0-stock / depleted items) */}
              {Object.entries(menuCategories).map(([category, items]) => {
                const visibleItems = items.filter((item) => item.is_available !== false);
                if (visibleItems.length === 0) return null;
                return (
                <div key={category} className="space-y-3">
                  <h3 className="border-b border-sand-200 pb-1.5 text-xs font-semibold uppercase tracking-wider text-sage-800">
                    {category.replaceAll("_", " ")}
                  </h3>
                  <div className="divide-y divide-sand-100">
                    {visibleItems.map((item) => {
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
                              {item.is_veg ? (
                                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 border border-emerald-200">
                                  Veg
                                </span>
                              ) : (
                                <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-800 border border-rose-200">
                                  Non-Veg
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
              );
              })}

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
                  <div>
                    <p className="text-base font-medium text-sage-950">
                      Subtotal:{" "}
                      <strong className="font-serif text-lg font-bold">
                        ₹{cartTotal.toLocaleString("en-IN")}
                      </strong>
                    </p>
                    {totalCartItemCount > 0 && (
                      <p className="text-xs text-sand-500">
                        {totalCartItemCount} item{totalCartItemCount > 1 ? "s" : ""} selected · Est. 20–30 min delivery
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={cartItems.length === 0 || !!isSessionTerminated}
                    onClick={handleOpenPayment}
                    className="inline-flex items-center gap-2 rounded-xl bg-sage-800 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-sage-900 disabled:opacity-50"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span>Place order</span>
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
              <p className="text-xs text-sand-500">Live order status and room delivery tracking</p>
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

          {requests.isLoading && allRequests.length === 0 ? (
            <div className="mt-4 flex items-center justify-center gap-2 py-6 text-xs text-sand-500">
              <RefreshCw className="h-4 w-4 animate-spin text-sage-700" />
              <span>Loading orders…</span>
            </div>
          ) : allRequests.length > 0 ? (
            <ul className="mt-5 divide-y divide-sand-200">
              {allRequests.map((request) => {
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
                    ? "Freshly Preparing in Kitchen"
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
                          #{request.id.slice(0, 10)}
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

                    <div className="mt-1.5 flex items-center gap-3 text-xs text-sand-500">
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <Clock className="h-3 w-3" />
                        <span>
                          Expected Delivery:{" "}
                          {new Date(request.due_at).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                      {Number(request.total_amount) > 0 && (
                        <span className="font-semibold text-sage-900">
                          · ₹{Number(request.total_amount).toLocaleString("en-IN")}
                        </span>
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

        {/* Dummy UPI Payment Scanner Modal */}
        <GuestUpiPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          onConfirm={handleConfirmOrder}
          isSubmitting={create.isPending}
          error={create.isError ? (create.error instanceof Error ? create.error.message : "Could not place order.") : undefined}
          amount={cartTotal}
          roomNumber={session.room_number}
          itemsSummary={cartSummaryString}
          itemCount={totalCartItemCount}
        />

        {/* Post-Payment Order Confirmation Modal (with 20-30 min delivery promise) */}
        <GuestOrderConfirmationModal
          isOpen={isConfirmationModalOpen}
          onClose={() => setIsConfirmationModalOpen(false)}
          order={confirmedOrder}
          onTrackOrder={handleTrackOrder}
        />
      </div>
    </main>
  );
}
