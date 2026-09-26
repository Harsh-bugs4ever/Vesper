"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, auth, guestTokens, type GuestSession } from "@/lib/api";
import { GuestAmenitiesSection } from "@/components/guest/guest-amenities-section";

type MenuItem = { id: string; name: string; description: string | null; price: number; is_veg: boolean; is_available: boolean };
type Menu = { currency: string; categories: Record<string, MenuItem[]> };
type Request = { id: string; kind: string; status: string; note: string | null; total_amount: number; due_at: string; rating: number | null; items: { menu_item_id: string; quantity: number }[] };

const SESSION_KEY = "vesper_guest_room";

export default function GuestRoomPage() {
  const [session, setSession] = useState<GuestSession | null>(null);
  const [opening, setOpening] = useState(true);
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
      guestTokens.clear();
      void auth.openGuestSession(property, room, secret).then((opened) => {
        if (cancelled) return;
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(opened));
        window.history.replaceState(null, "", window.location.pathname);
        setSession(opened);
      }).catch((error: unknown) => { if (!cancelled) setSessionError(error instanceof Error ? error.message : "This room code could not be opened."); }).finally(() => { if (!cancelled) setOpening(false); });
    } else {
      try {
        const saved = window.sessionStorage.getItem(SESSION_KEY);
        if (saved && guestTokens.access()) setSession(JSON.parse(saved) as GuestSession);
      } catch { window.sessionStorage.removeItem(SESSION_KEY); }
      setOpening(false);
    }
    return () => { cancelled = true; };
  }, []);

  const key = ["guest-room-requests", session?.stay_id];
  const menu = useQuery({ queryKey: ["guest-room-menu", session?.stay_id], enabled: !!session, queryFn: () => api.get<Menu>("/guest/menu") });
  const requests = useQuery({ queryKey: key, enabled: !!session, queryFn: () => api.get<Request[]>("/guest/requests"), refetchInterval: 10_000 });
  const create = useMutation({
    mutationFn: (body: { kind: string; note?: string; items?: { menu_item_id: string; quantity: number }[] }) => api.post<Request>("/guest/requests", body),
    onSuccess: () => { client.invalidateQueries({ queryKey: key }); setNote(""); setOrderNote(""); setCart({}); },
  });
  const rate = useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: number }) => api.post<Request>(`/guest/requests/${id}/rating`, { rating }),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  const items = Object.values(menu.data?.categories ?? {}).flat();
  const cartItems = Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([id, quantity]) => ({ menu_item_id: id, quantity }));
  const total = cartItems.reduce((sum, line) => sum + Number(items.find((item) => item.id === line.menu_item_id)?.price ?? 0) * line.quantity, 0);

  if (opening) return <main className="flex min-h-screen items-center justify-center bg-sage-50 p-6 text-sage-800" role="status">Opening your room…</main>;
  if (!session) return <main className="flex min-h-screen items-center justify-center bg-sage-50 p-6"><div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm"><h1 className="font-serif text-3xl text-sage-950">Your room portal</h1><p className="mt-4 text-sm text-sage-700">Scan the QR code in your room to open your stay and request service.</p>{sessionError && <p role="alert" className="mt-4 text-sm text-rose-700">{sessionError}</p>}</div></main>;

  return <main className="min-h-screen bg-sage-50 px-4 py-8 text-sage-950 sm:px-6"><div className="mx-auto max-w-3xl space-y-6">
    <header className="rounded-2xl bg-sage-800 p-6 text-white sm:p-8"><p className="text-xs uppercase tracking-[0.25em] text-sage-100">Vesper · {session.property_name}</p><h1 className="mt-3 font-serif text-4xl">Welcome to room {session.room_number}</h1><p className="mt-2 text-sm text-sage-100">{session.guest_name ? `Good to have you here, ${session.guest_name}. ` : ""}What can we help with?</p></header>
    <section className="rounded-2xl border border-sand-200 bg-white p-5 sm:p-6" aria-labelledby="service-heading"><h2 id="service-heading" className="font-serif text-2xl">Request a service</h2><form className="mt-4 space-y-4" onSubmit={(event) => { event.preventDefault(); create.mutate({ kind, note: note.trim() || undefined }); }}><label className="block text-sm text-sage-700">Service<select value={kind} onChange={(event) => setKind(event.target.value)} className="mt-1 block w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sage-950"><option value="housekeeping">Housekeeping</option><option value="amenities">Amenities or towels</option><option value="maintenance">Maintenance</option><option value="other">Something else</option></select></label><label className="block text-sm text-sage-700">Details<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} placeholder="Tell us what you need" className="mt-1 block w-full rounded-lg border border-sand-300 px-3 py-2 text-sage-950" /></label><button type="submit" disabled={create.isPending} className="rounded-lg bg-sage-700 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">Send request</button></form></section>
    <section className="rounded-2xl border border-sand-200 bg-white p-5 sm:p-6" aria-labelledby="menu-heading"><h2 id="menu-heading" className="font-serif text-2xl">Room service</h2>{menu.isPending ? <p role="status" className="mt-4 text-sm">Loading menu…</p> : menu.isError ? <p role="alert" className="mt-4 text-sm text-rose-700">{menu.error instanceof Error ? menu.error.message : "Could not load menu."}</p> : items.length === 0 ? <p className="mt-4 text-sm text-sage-700">The room-service menu is currently unavailable.</p> : <><div className="mt-4 space-y-3">{Object.entries(menu.data?.categories ?? {}).map(([category, categoryItems]) => <div key={category}><h3 className="mt-5 text-sm font-semibold capitalize text-sage-800">{category.replaceAll("_", " ")}</h3>{categoryItems.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 border-b border-sand-100 py-3"><div><p className="text-sm font-medium">{item.name} {item.is_veg && <span className="text-xs text-sage-600">· Vegetarian</span>}</p>{item.description && <p className="mt-1 text-xs text-sage-700">{item.description}</p>}<p className="mt-1 text-xs">₹{Number(item.price).toLocaleString("en-IN")}</p></div><div className="flex shrink-0 items-center gap-2"><button type="button" aria-label={`Remove one ${item.name}`} disabled={!cart[item.id]} onClick={() => setCart((value) => ({ ...value, [item.id]: Math.max(0, (value[item.id] ?? 0) - 1) }))} className="rounded border border-sand-300 px-2 py-1 disabled:opacity-40">−</button><span className="w-5 text-center text-sm">{cart[item.id] ?? 0}</span><button type="button" aria-label={`Add one ${item.name}`} disabled={!item.is_available || (cart[item.id] ?? 0) >= 20} onClick={() => setCart((value) => ({ ...value, [item.id]: (value[item.id] ?? 0) + 1 }))} className="rounded border border-sand-300 px-2 py-1 disabled:opacity-40">+</button></div></div>)}</div>)}</div><label className="mt-4 block text-sm text-sage-700">Order notes<input value={orderNote} onChange={(event) => setOrderNote(event.target.value)} maxLength={500} className="mt-1 block w-full rounded-lg border border-sand-300 px-3 py-2" /></label><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm">Subtotal ₹{total.toLocaleString("en-IN")}</p><button type="button" disabled={cartItems.length === 0 || create.isPending} onClick={() => create.mutate({ kind: "room_service", note: orderNote.trim() || undefined, items: cartItems })} className="rounded-lg bg-sage-700 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">Place order</button></div></>}</section>
    {create.isError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{create.error instanceof Error ? create.error.message : "Could not send your request."}</p>}
    <section className="rounded-2xl border border-sand-200 bg-white p-5 sm:p-6" aria-labelledby="requests-heading"><div className="flex items-center justify-between"><h2 id="requests-heading" className="font-serif text-2xl">Your requests</h2><button type="button" onClick={() => requests.refetch()} className="text-xs underline">Refresh</button></div>{requests.isPending ? <p role="status" className="mt-4 text-sm">Loading requests…</p> : requests.isError ? <p role="alert" className="mt-4 text-sm text-rose-700">{requests.error instanceof Error ? requests.error.message : "Could not load requests."}</p> : requests.data?.length ? <ul className="mt-4 divide-y divide-sand-200">{requests.data.map((request) => <li key={request.id} className="py-4"><div className="flex justify-between gap-3"><p className="text-sm font-medium capitalize">{request.kind.replaceAll("_", " ")}</p><span className="text-xs capitalize text-sage-700">{request.status.replaceAll("_", " ")}</span></div>{request.note && <p className="mt-1 text-xs text-sage-700">{request.note}</p>}<p className="mt-1 text-xs text-sage-600">Due {new Date(request.due_at).toLocaleTimeString("en-IN")}{Number(request.total_amount) > 0 ? ` · ₹${Number(request.total_amount).toLocaleString("en-IN")}` : ""}</p>{request.status === "delivered" && request.rating == null && <div className="mt-3 flex gap-2" role="group" aria-label="Rate service">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" disabled={rate.isPending} onClick={() => rate.mutate({ id: request.id, rating })} className="rounded border border-sand-300 px-2 py-1 text-xs">{rating} ★</button>)}</div>}{request.rating != null && <p className="mt-2 text-xs text-sage-700">Your rating: {request.rating}/5</p>}</li>)}</ul> : <p className="mt-4 text-sm text-sage-700">No requests yet.</p>}{rate.isError && <p role="alert" className="mt-3 text-sm text-rose-700">{rate.error instanceof Error ? rate.error.message : "Could not save rating."}</p>}</section>
    <GuestAmenitiesSection isGuestPortal className="rounded-2xl border border-sand-200 bg-white p-5 sm:p-6" />
  </div></main>;
}
