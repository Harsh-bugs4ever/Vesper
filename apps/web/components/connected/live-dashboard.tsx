"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";
import { OccupancyForecastChart } from "@/components/charts/occupancy-forecast-chart";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";

type Occupancy = { total_rooms: number; occupied_rooms: number; occupancy_rate: number; as_of: string };
type FrontDeskDay = { date: string; arrivals: unknown[]; departures: unknown[]; in_house_count: number };
type Inventory = { total_items: number; low_stock_items: number; expiring_items: number };
type Request = { id: string; kind: string; status: string; room_number: string; is_overdue: boolean; created_at: string };
type Forecast = { stay_date: string; predicted_occupancy: number; lower_bound: number; upper_bound: number; model_name: string };

function ResultCard({ label, value, detail, href }: { label: string; value: string; detail: string; href: string }) {
  return <Link href={href} className="rounded-xl border border-sand-200 bg-white p-5 transition-colors hover:border-sage-400"><p className="text-xs text-sage-700">{label}</p><p className="mt-3 font-serif text-3xl text-sage-950">{value}</p><p className="mt-2 text-xs text-sage-600">{detail}</p></Link>;
}

export function LiveDashboard() {
  const { user } = useAuth();
  const scope = [user.propertyId, user.id];
  const occupancy = useQuery({ queryKey: ["dashboard-occupancy", ...scope], queryFn: () => api.get<Occupancy>("/property/occupancy"), refetchInterval: 60_000 });
  const frontDesk = useQuery({ queryKey: ["dashboard-frontdesk", ...scope], queryFn: () => api.get<FrontDeskDay>("/bookings/today"), refetchInterval: 60_000 });
  const inventory = useQuery({ queryKey: ["dashboard-inventory", ...scope], queryFn: () => api.get<Inventory>("/inventory/summary"), refetchInterval: 60_000 });
  const requests = useQuery({ queryKey: ["dashboard-requests", ...scope], queryFn: () => api.get<Request[]>("/requests"), refetchInterval: 30_000 });
  const forecast = useQuery({ queryKey: ["dashboard-forecast", ...scope], queryFn: () => api.get<Forecast[]>("/revenue/forecast", { days: 14 }), staleTime: 60_000 });
  const open = requests.data?.filter((request) => !["delivered", "cancelled"].includes(request.status));
  const forecastPoints = forecast.data?.map((row) => ({
    date: new Date(`${row.stay_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    occupancy: Math.round(row.predicted_occupancy * 100),
    range: [Math.round(row.lower_bound * 100), Math.round(row.upper_bound * 100)] as [number, number],
  })) ?? [];
  const errors = [occupancy, frontDesk, inventory, requests, forecast].filter((query) => query.isError);

  return <div className="space-y-6">
    <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description={`Current operations at ${user.propertyName}.`} meta={new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })} />
    <p className="text-xs text-sage-700">Live resort data · figures refresh automatically</p>
    {errors.length > 0 && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Some live data could not be loaded. Unavailable figures show a dash; no sample values are substituted. <button type="button" className="ml-2 underline" onClick={() => { occupancy.refetch(); frontDesk.refetch(); inventory.refetch(); requests.refetch(); forecast.refetch(); }}>Retry</button></div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ResultCard label="Occupied rooms" value={occupancy.data ? `${occupancy.data.occupied_rooms} / ${occupancy.data.total_rooms}` : "—"} detail={occupancy.data ? `${Math.round(occupancy.data.occupancy_rate * 100)}% occupancy now` : "Awaiting property data"} href="/admin/rooms" />
      <ResultCard label="Arrivals today" value={frontDesk.data ? String(frontDesk.data.arrivals.length) : "—"} detail={frontDesk.data ? `${frontDesk.data.departures.length} departures today` : "Awaiting front-desk data"} href="/admin/front-desk" />
      <ResultCard label="Open guest requests" value={open ? String(open.length) : "—"} detail={open ? `${open.filter((request) => request.is_overdue).length} overdue` : "Awaiting service requests"} href="/admin/requests" />
      <ResultCard label="Low-stock items" value={inventory.data ? String(inventory.data.low_stock_items) : "—"} detail={inventory.data ? `${inventory.data.total_items} tracked items` : "Awaiting inventory data"} href="/admin/inventory" />
    </div>
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Panel><PanelHeader title="Occupancy forecast" description="Next 14 days from the revenue API" /><PanelBody className="pt-4">{forecast.isPending ? <p role="status" className="py-12 text-center text-sm text-sage-700">Loading forecast…</p> : forecastPoints.length > 0 ? <><OccupancyForecastChart data={forecastPoints} /><p className="mt-3 text-xs text-sage-600">Model: {forecast.data?.[0]?.model_name}</p></> : <p className="py-12 text-center text-sm text-sage-700">No forecast is available yet.</p>}<Link href="/admin/forecast" className="mt-4 inline-block text-sm font-medium text-sage-800 underline">View forecast details</Link></PanelBody></Panel>
      <Panel><PanelHeader title="Recent requests" description="Latest activity from occupied rooms" /><PanelBody className="pt-4">{requests.isPending ? <p role="status" className="py-10 text-sm text-sage-700">Loading requests…</p> : requests.data?.length ? <ul className="divide-y divide-sand-200">{[...requests.data].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5).map((request) => <li key={request.id} className="py-3"><p className="text-sm font-medium capitalize text-sage-950">Room {request.room_number} · {request.kind.replaceAll("_", " ")}</p><p className="mt-1 text-xs capitalize text-sage-600">{request.status.replaceAll("_", " ")}{request.is_overdue ? " · Overdue" : ""}</p></li>)}</ul> : <p className="py-10 text-sm text-sage-700">No requests yet.</p>}<Link href="/admin/requests" className="mt-4 inline-block text-sm font-medium text-sage-800 underline">Open request inbox</Link></PanelBody></Panel>
    </div>
  </div>;
}
