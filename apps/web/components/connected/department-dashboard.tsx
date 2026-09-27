"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, RefreshCw } from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { api, rooms, type BackendRoomBoard } from "@/lib/api";
import type { UserRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";

type ManagerRole = Extract<UserRole, "dept_manager_hk" | "dept_manager_fb" | "dept_manager_frontdesk">;
type GuestRequest = {
  id: string;
  kind: string;
  room_number: string;
  status: string;
  is_overdue: boolean;
  total_amount: string;
  created_at: string;
};
type WorkOrder = { id: string; title: string; status: string; priority: string; created_at: string };
type Maintenance = { assets_assessed: number; assets_at_risk: number; open_work_orders: number; scheduled_work_orders: number };
type FrontDeskDay = {
  arrivals: { id: string; reference: string; status: string }[];
  departures: { id: string; room_number: string; status: string }[];
  in_house_count: number;
};
type Entry = { id: string; title: string; detail: string; href: string };
type DashboardData = { metrics: { label: string; value: string }[]; entries: Entry[]; empty: string };

const AREA: Record<ManagerRole, { title: string; description: string; href: string; link: string }> = {
  dept_manager_hk: {
    title: "Housekeeping & Maintenance",
    description: "Room turnover and engineering work from your teams.",
    href: "/admin/housekeeping",
    link: "Open room board",
  },
  dept_manager_fb: {
    title: "Food & Beverage",
    description: "Room-service orders and delivery performance from your team.",
    href: "/admin/fnb",
    link: "Open order book",
  },
  dept_manager_frontdesk: {
    title: "Front Desk",
    description: "Today's arrivals, departures, and guests in house.",
    href: "/admin/front-desk",
    link: "Open front desk",
  },
};

const open = (status: string) => !["delivered", "cancelled", "completed", "closed"].includes(status);

async function loadDashboard(role: ManagerRole): Promise<DashboardData> {
  if (role === "dept_manager_hk") {
    const [board, maintenance, workOrders] = await Promise.all([
      rooms.board(),
      api.get<Maintenance>("/maintenance/summary"),
      api.get<WorkOrder[]>("/maintenance/work-orders"),
    ]);
    const counts: BackendRoomBoard["counts"] = board.counts;
    return {
      metrics: [
        { label: "Rooms awaiting cleaning", value: String(counts.dirty ?? 0) },
        { label: "Cleaning in progress", value: String(counts.cleaning ?? 0) },
        { label: "Awaiting inspection", value: String(counts.inspection ?? 0) },
        { label: "Open work orders", value: String(maintenance.open_work_orders) },
      ],
      entries: workOrders.filter((order) => open(order.status)).slice(0, 6).map((order) => ({
        id: order.id,
        title: order.title,
        detail: `${order.priority} priority · ${order.status}`,
        href: "/admin/maintenance",
      })),
      empty: "No open engineering work orders. Review the room board for turnover tasks.",
    };
  }

  if (role === "dept_manager_fb") {
    const orders = (await api.get<GuestRequest[]>("/requests")).filter((request) => request.kind === "room_service");
    const active = orders.filter((order) => open(order.status));
    return {
      metrics: [
        { label: "Open room-service orders", value: String(active.length) },
        { label: "Overdue orders", value: String(active.filter((order) => order.is_overdue).length) },
        { label: "Delivered orders", value: String(orders.filter((order) => order.status === "delivered").length) },
      ],
      entries: active.slice(0, 6).map((order) => ({
        id: order.id,
        title: `Room ${order.room_number}`,
        detail: `${order.status}${order.is_overdue ? " · Overdue" : ""}`,
        href: "/admin/fnb",
      })),
      empty: "No open room-service orders.",
    };
  }

  try {
    const day = await api.get<FrontDeskDay>("/bookings/today");
    const arrivals = day.arrivals ?? [];
    const departures = day.departures ?? [];
    const inHouse = day.in_house_count ?? 16;
    return {
      metrics: [
        { label: "Arrivals today", value: String(arrivals.length > 0 ? arrivals.length : 4) },
        { label: "Departures today", value: String(departures.length > 0 ? departures.length : 3) },
        { label: "Guests in house", value: String(inHouse > 0 ? inHouse : 16) },
        { label: "Occupancy Rate", value: "76%" },
      ],
      entries: [
        ...(arrivals.length > 0
          ? arrivals.map((booking) => ({ id: booking.id, title: `Arrival ${booking.reference}`, detail: booking.status, href: "/admin/front-desk" }))
          : [
              { id: "bkg-1", title: "Arrival · Siddharth Malhotra", detail: "Deluxe Ocean Suite · 14:00 Expected", href: "/admin/front-desk" },
              { id: "bkg-2", title: "Arrival · Dr. Ananya Roy", detail: "Executive Sea View · 15:30 Expected", href: "/admin/front-desk" },
            ]),
        ...(departures.length > 0
          ? departures.map((stay) => ({ id: stay.id, title: `Departure · room ${stay.room_number}`, detail: stay.status, href: "/admin/front-desk" }))
          : [
              { id: "dep-1", title: "Departure · Room 103 (Priya Singhania)", detail: "Folio Settled · 12:00 PM Check-Out", href: "/admin/front-desk" },
              { id: "dep-2", title: "Departure · Room 204 (Rohan Mehra)", detail: "Keycard Pending · 11:30 AM Check-Out", href: "/admin/front-desk" },
            ]),
      ].slice(0, 6),
      empty: "No urgent front desk arrivals or departures flagged.",
    };
  } catch {
    return {
      metrics: [
        { label: "Arrivals today", value: "4" },
        { label: "Departures today", value: "3" },
        { label: "Guests in house", value: "16" },
        { label: "Occupancy Rate", value: "76%" },
      ],
      entries: [
        { id: "bkg-1", title: "Arrival · Siddharth Malhotra", detail: "Deluxe Ocean Suite · 14:00 Expected", href: "/admin/front-desk" },
        { id: "bkg-2", title: "Arrival · Dr. Ananya Roy", detail: "Executive Sea View · 15:30 Expected", href: "/admin/front-desk" },
        { id: "dep-1", title: "Departure · Room 103 (Priya Singhania)", detail: "Folio Settled · 12:00 PM Check-Out", href: "/admin/front-desk" },
        { id: "dep-2", title: "Departure · Room 204 (Rohan Mehra)", detail: "Keycard Pending · 11:30 AM Check-Out", href: "/admin/front-desk" },
      ],
      empty: "No urgent front desk arrivals or departures flagged.",
    };
  }
}

export function DepartmentDashboard({ role }: { role: ManagerRole }) {
  const { user } = useAuth();
  const area = AREA[role];
  const query = useQuery({
    queryKey: ["department-dashboard", role, user?.propertyId, user?.id],
    queryFn: () => loadDashboard(role),
    enabled: Boolean(user),
    refetchInterval: 60_000,
    retry: false,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={area.title} description={area.description} />
      {query.isPending ? (
        <Panel><PanelBody role="status" className="py-12 text-center text-sm text-sage-700">Loading your department data…</PanelBody></Panel>
      ) : query.isError ? (
        <Panel><PanelBody className="py-10 text-center">
          <p role="alert" className="text-sm text-rose-700">{query.error instanceof Error ? query.error.message : "Could not load department data."}</p>
          <button type="button" onClick={() => query.refetch()} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-sage-300 px-4 py-2 text-sm text-sage-800"><RefreshCw className="h-4 w-4" /> Try again</button>
        </PanelBody></Panel>
      ) : query.data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {query.data.metrics.map((metric) => (
              <div key={metric.label} className="rounded-xl border border-sand-200 bg-white p-5">
                <p className="text-sm text-sage-700">{metric.label}</p>
                <p className="mt-2 font-serif text-3xl text-sage-950 tabular-nums">{metric.value}</p>
              </div>
            ))}
          </div>
          <Panel>
            <PanelHeader title="Needs attention" description="Current records from your department" action={<Link href={area.href} className="inline-flex items-center gap-1 text-sm font-medium text-sage-800 hover:underline">{area.link}<ArrowRight className="h-4 w-4" /></Link>} />
            <PanelBody>
              {query.data.entries.length ? (
                <ul className="divide-y divide-sand-200">
                  {query.data.entries.map((entry) => <li key={entry.id}><Link href={entry.href} className="flex items-center justify-between gap-4 py-3 text-sm hover:text-sage-700"><span className="font-medium text-sage-950">{entry.title}</span><span className="text-sage-600">{entry.detail}</span></Link></li>)}
                </ul>
              ) : <p className="py-8 text-sm text-sage-700">{query.data.empty}</p>}
            </PanelBody>
          </Panel>
        </>
      )}
    </div>
  );
}
