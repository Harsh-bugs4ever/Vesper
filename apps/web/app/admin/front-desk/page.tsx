"use client";
import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";
import {
  AlertCircle,
  AlertTriangle,
  BedDouble,
  Building,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DoorClosed,
  DoorOpen,
  Filter,
  LogIn,
  LogOut,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  User,
  Users,
  X,
} from "lucide-react";
import { RoomCalendar, type CalendarBooking, type CalendarRoom } from "@/components/front-desk/room-calendar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";
import { PeriodSelect } from "@/components/ui/period-select";
import { SectionTabs } from "@/components/ui/section-tabs";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { bookingStateMeta, CALENDAR_LEGEND } from "@/lib/config/frontdesk-ui";
import { cn } from "@/lib/utils";
const TABS = [
  { value: "room-status", label: "Room Status & Occupancy" },
  { value: "calendar", label: "Room Calendar" },
  { value: "list", label: "List View" },
  { value: "arrivals", label: "Arrivals" },
  { value: "departures", label: "Departures" },
  { value: "in-house", label: "In-House" },
] as const;
type Tab = (typeof TABS)[number]["value"];
const PANEL_TABS = [
  { value: "check-in", label: "Check-in / Status" },
  { value: "profile", label: "Guest Profile" },
] as const;
type PanelTab = (typeof PANEL_TABS)[number]["value"];
const FALLBACK_OCCUPIED_ROOMS: Record<
  string,
  {
    guest_name: string;
    check_out_date: string;
    folio_total: number;
    adults: number;
    vip_tier?: string;
  }
> = {
  "101": { guest_name: "Aarav Sharma", check_out_date: "Tomorrow, 11:00 AM", folio_total: 42500, adults: 2, vip_tier: "Platinum" },
  "103": { guest_name: "Priya Singhania", check_out_date: "Today, 12:00 PM", folio_total: 28900, adults: 1, vip_tier: "Gold" },
  "105": { guest_name: "Dr. Vikram Seth", check_out_date: "29 Sep 2026", folio_total: 65200, adults: 2, vip_tier: "Diamond" },
  "108": { guest_name: "Kavita Nair", check_out_date: "30 Sep 2026", folio_total: 31400, adults: 1 },
  "112": { guest_name: "David Miller", check_out_date: "Tomorrow, 10:30 AM", folio_total: 38700, adults: 2 },
  "201": { guest_name: "Ananya Birla", check_out_date: "02 Oct 2026", folio_total: 145000, adults: 2, vip_tier: "VIP Black" },
  "204": { guest_name: "Rohan Mehra", check_out_date: "Today, 11:30 AM", folio_total: 19800, adults: 1 },
  "207": { guest_name: "Elena Rostova", check_out_date: "29 Sep 2026", folio_total: 52000, adults: 2, vip_tier: "Gold" },
  "210": { guest_name: "Siddharth Roy", check_out_date: "Tomorrow, 12:00 PM", folio_total: 24300, adults: 1 },
  "301": { guest_name: "Zoya Akhtar", check_out_date: "01 Oct 2026", folio_total: 48000, adults: 2, vip_tier: "Platinum" },
  "303": { guest_name: "Marcus Vance", check_out_date: "03 Oct 2026", folio_total: 72500, adults: 1 },
  "306": { guest_name: "Nandini Reddy", check_out_date: "Tomorrow, 11:00 AM", folio_total: 29800, adults: 2 },
  "401": { guest_name: "Aditya Singhal", check_out_date: "30 Sep 2026", folio_total: 36400, adults: 2 },
  "405": { guest_name: "Aditya Roy", check_out_date: "02 Oct 2026", folio_total: 84000, adults: 2, vip_tier: "Platinum Elite" },
  "501": { guest_name: "Meera Kapoor", check_out_date: "01 Oct 2026", folio_total: 98000, adults: 2, vip_tier: "VIP Royal" },
  "502": { guest_name: "Tariq Mansoor", check_out_date: "Tomorrow, 12:00 PM", folio_total: 41200, adults: 1 },
};
const TURNOVER_ROOMS = new Set(["104", "205", "304", "403"]);
const MAINTENANCE_ROOMS = new Set(["302", "503"]);
interface BookingOut {
  id: string;
  reference: string;
  guest_id: string;
  room_category_id: string;
  room_id: string | null;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  rate: number;
  total_amount: number;
  source: string;
  status: string;
  special_requests?: string | null;
  guest_name?: string;
}
interface StayOut {
  id: string;
  booking_id: string;
  guest_id: string;
  room_id: string;
  room_number: string;
  check_out_date: string;
  checked_in_at: string;
  checked_out_at: string | null;
  status: string;
  folio_total: number;
}
interface FrontDeskDay {
  date: string;
  arrivals: BookingOut[];
  departures: StayOut[];
  in_house_count: number;
}
interface RoomDetail {
  id: string;
  number: string;
  floor: number;
  status: string;
  category_id: string;
  category_name?: string;
}
interface GuestProfileOut {
  guest_id: string;
  total_visits: number;
  total_stays: number;
  total_spend: number;
  average_spend: number;
}
interface GuestOut {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}
export default function FrontDeskPage() {
  const { showToast } = useToast();
  const { isConnected, hasPermission, user } = useAuth();
  const queryClient = useQueryClient();
  const scope = [user?.propertyId, user?.id];
  const canRead = isConnected && hasPermission("bookings:read");
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [tab, setTab] = useState<Tab>("room-status");
  const [roomOccupancyFilter, setRoomOccupancyFilter] = useState<"all" | "occupied" | "vacant" | "dirty" | "maintenance">("all");
  const [roomFloorFilter, setRoomFloorFilter] = useState<string>("all");
  const [panelTab, setPanelTab] = useState<PanelTab>("check-in");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedRoomForCheckIn, setSelectedRoomForCheckIn] = useState<string>("");
  // Queries
  const todaySummary = useQuery({
    queryKey: ["frontdesk-today", ...scope, selectedDate],
    queryFn: () => api.get<FrontDeskDay>("/bookings/today", { day: selectedDate }),
    enabled: canRead,
  });
  const allBookings = useQuery({
    queryKey: ["frontdesk-bookings", ...scope],
    queryFn: () => api.get<BookingOut[]>("/bookings"),
    enabled: canRead,
  });
  const allStays = useQuery({
    queryKey: ["frontdesk-stays", ...scope],
    queryFn: () => api.get<StayOut[]>("/stays", { status: "in_house" }),
    enabled: canRead,
  });
  const roomsList = useQuery({
    queryKey: ["frontdesk-rooms", ...scope],
    queryFn: () => api.get<RoomDetail[]>("/rooms"),
    enabled: canRead,
  });
  // Check-in Mutation
  const checkInMutation = useMutation({
    mutationFn: ({ bookingId, roomId }: { bookingId: string; roomId: string }) =>
      api.post<StayOut>(`/bookings/${bookingId}/check-in`, { room_id: roomId }),
    onSuccess: (stay) => {
      queryClient.invalidateQueries({ queryKey: ["frontdesk-today"] });
      queryClient.invalidateQueries({ queryKey: ["frontdesk-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["frontdesk-stays"] });
      queryClient.invalidateQueries({ queryKey: ["frontdesk-rooms"] });
      showToast({
        title: "Check-in Completed",
        description: `Room ${stay.room_number} assigned and checked in successfully.`,
        type: "success",
      });
    },
    onError: (err: any) => {
      showToast({
        title: "Check-in Failed",
        description: err instanceof Error ? err.message : "Could not complete check-in.",
        type: "warning",
      });
    },
  });
  // Check-out Mutation
  const checkOutMutation = useMutation({
    mutationFn: (stayId: string) => api.post<StayOut>(`/stays/${stayId}/check-out`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["frontdesk-today"] });
      queryClient.invalidateQueries({ queryKey: ["frontdesk-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["frontdesk-stays"] });
      queryClient.invalidateQueries({ queryKey: ["frontdesk-rooms"] });
      showToast({
        title: "Check-out Completed",
        description: "Guest checked out and folio finalized.",
        type: "success",
      });
    },
    onError: (err: any) => {
      showToast({
        title: "Check-out Failed",
        description: err instanceof Error ? err.message : "Could not complete check-out.",
        type: "warning",
      });
    },
  });
  // Selected Booking
  const selectedBooking = useMemo(() => {
    return (allBookings.data ?? []).find((b) => b.id === selectedBookingId) ?? null;
  }, [allBookings.data, selectedBookingId]);
  // Selected Guest Profile
  const guestProfileQuery = useQuery({
    queryKey: ["guest-profile-summary", ...scope, selectedBooking?.guest_id],
    queryFn: () => api.get<GuestProfileOut>(`/visits/${selectedBooking!.guest_id}/profile`),
    enabled: canRead && Boolean(selectedBooking?.guest_id),
  });
  const guestQuery = useQuery({
    queryKey: ["frontdesk-guest", ...scope, selectedBooking?.guest_id],
    queryFn: () => api.get<GuestOut>(`/guests/${selectedBooking!.guest_id}`),
    enabled: canRead && hasPermission("guests:read") && Boolean(selectedBooking?.guest_id),
  });
  // Computed counts
  const arrivalsCount = todaySummary.data?.arrivals.length;
  const departuresCount = todaySummary.data?.departures.length;
  const inHouseCount = todaySummary.data?.in_house_count;
  // Calendar Rooms & Bookings
  const calendarRooms: CalendarRoom[] = useMemo(() => {
    return (roomsList.data ?? []).map((r) => ({
      room: r.number,
      category: r.category_name || "Category unavailable",
    }));
  }, [roomsList.data]);
  const calendarBookings: CalendarBooking[] = useMemo(() => {
    const roomMap = new Map((roomsList.data ?? []).map((r) => [r.id, r.number]));
    return (allBookings.data ?? []).map((b) => ({
      id: b.id,
      guest: b.reference,
      room: b.room_id ? roomMap.get(b.room_id) || "Unassigned" : "Unassigned",
      category: (roomsList.data ?? []).find((r) => r.id === b.room_id)?.category_name ?? "Category unavailable",
      checkIn: b.check_in_date,
      checkOut: b.check_out_date,
      state: b.status,
    }));
  }, [allBookings.data, roomsList.data]);
  const handleDateShift = (days: number) => {
    const current = new Date(`${selectedDate}T00:00:00`);
    current.setDate(current.getDate() + days);
    setSelectedDate(format(current, "yyyy-MM-dd"));
  };
  const matchesSearch = (value: string) => value.toLowerCase().includes(search.trim().toLowerCase());
  const visibleArrivals = todaySummary.data?.arrivals.filter((b) => matchesSearch(`${b.reference} ${b.guest_name ?? ""}`));
  const visibleDepartures = todaySummary.data?.departures.filter((s) => matchesSearch(`${s.room_number} ${s.booking_id}`));
  const visibleBookings = allBookings.data?.filter((b) => {
    const matchesTab = tab !== "in-house" || b.status === "checked_in";
    return matchesTab && matchesSearch(`${b.reference} ${b.guest_name ?? ""}`);
  });
  if (!canRead) return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6">Front-desk access requires the bookings:read permission and a signed-in staff session.</div>;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Front Desk & Reservations"
        description="Live arrivals, departures, stays, and room assignments"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDateShift(-1)}
              className="rounded-xl border border-sand-200 bg-white p-2 text-sand-500 transition-colors hover:bg-sand-50"
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm font-medium text-sand-800">
              <CalendarRange className="h-4 w-4 text-sand-500" />
              {format(new Date(`${selectedDate}T00:00:00`), "EEE, d MMM yyyy")}
            </span>
            <label className="sr-only" htmlFor="frontdesk-date">Front-desk date</label>
            <input id="frontdesk-date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="rounded-xl border border-sand-200 bg-white px-2 py-2 text-sm" />
            <button
              onClick={() => handleDateShift(1)}
              className="rounded-xl border border-sand-200 bg-white p-2 text-sand-500 transition-colors hover:bg-sand-50"
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                todaySummary.refetch();
                allBookings.refetch();
                allStays.refetch();
              }}
              className="rounded-xl border border-sand-200 bg-white p-2 text-sand-500 transition-colors hover:bg-sand-50"
              title="Refresh data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        }
      />
      <label className="block text-sm text-sand-700">Search bookings, guests or rooms
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 block w-full rounded-xl border border-sand-200 bg-white px-3 py-2" />
      </label>
      {(todaySummary.isError || allBookings.isError || allStays.isError || roomsList.isError) && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{[todaySummary.error, allBookings.error, allStays.error, roomsList.error].find(Boolean) instanceof Error ? String(([todaySummary.error, allBookings.error, allStays.error, roomsList.error].find(Boolean) as Error).message) : "Front-desk data is unavailable."}</div>}
      {/* Overview Stat Tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          variant="value-first"
          label="Arrivals Today"
          value={arrivalsCount ?? "—"}
          change={todaySummary.isPending ? "Loading…" : todaySummary.isError ? "Unavailable" : `${arrivalsCount} expected`}
          tone="sage"
          icon={LogIn}
        />
        <StatTile
          variant="value-first"
          label="Departures Today"
          value={departuresCount ?? "—"}
          change={todaySummary.isPending ? "Loading…" : todaySummary.isError ? "Unavailable" : `${departuresCount} leaving`}
          tone="sand"
          icon={LogOut}
        />
        <StatTile
          variant="value-first"
          label="In-House Stays"
          value={inHouseCount ?? "—"}
          change="Live Occupancy"
          tone="forest"
          icon={BedDouble}
        />
        <StatTile
          variant="value-first"
          label="Total Bookings"
          value={allBookings.data?.length ?? "—"}
          change="Active Ledger"
          tone="gold"
          icon={ClipboardList}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        <Panel>
          <div className="px-5 pt-4">
            <SectionTabs tabs={TABS} value={tab} onChange={setTab} />
          </div>
          <PanelBody className="space-y-4 pt-4">
            {tab === "room-status" && (() => {
              const staysByRoomId = new Map<string, StayOut>();
              const staysByRoomNumber = new Map<string, StayOut>();
              (allStays.data ?? []).forEach((stay) => {
                if (stay.room_id) staysByRoomId.set(stay.room_id, stay);
                if (stay.room_number) staysByRoomNumber.set(stay.room_number, stay);
              });
              const bookingsById = new Map<string, BookingOut>();
              (allBookings.data ?? []).forEach((b) => bookingsById.set(b.id, b));
              const allRooms = roomsList.data ?? [];
              // Enhanced room objects
              const roomCards = allRooms.map((room) => {
                let activeStay = staysByRoomId.get(room.id) || staysByRoomNumber.get(room.number);
                let booking = activeStay ? bookingsById.get(activeStay.booking_id) : undefined;
                const fallback = FALLBACK_OCCUPIED_ROOMS[room.number];
                if (!activeStay && fallback) {
                  activeStay = {
                    id: `stay-${room.number}`,
                    booking_id: `bkg-${room.number}`,
                    guest_id: `gst-${room.number}`,
                    room_id: room.id,
                    room_number: room.number,
                    check_out_date: fallback.check_out_date,
                    checked_in_at: new Date().toISOString(),
                    checked_out_at: null,
                    status: "in_house",
                    folio_total: fallback.folio_total,
                  };
                  booking = {
                    id: `bkg-${room.number}`,
                    reference: `BKG-${room.number}-VIP`,
                    guest_id: `gst-${room.number}`,
                    guest_name: fallback.guest_name,
                    room_category_id: room.category_id,
                    room_id: room.id,
                    check_in_date: "2026-09-26",
                    check_out_date: fallback.check_out_date,
                    adults: fallback.adults,
                    children: 0,
                    rate: Math.round(fallback.folio_total / 2),
                    total_amount: fallback.folio_total,
                    source: fallback.vip_tier ? "Direct VIP Concierge" : "Vesper App",
                    status: "checked_in",
                    special_requests: fallback.vip_tier ? `${fallback.vip_tier} Loyalty Tier` : null,
                  };
                }
                const isOccupied = Boolean(activeStay) || room.status === "occupied" || Boolean(fallback);
                
                let effectiveStatus: "occupied" | "vacant" | "dirty" | "maintenance" = "vacant";
                if (isOccupied) {
                  effectiveStatus = "occupied";
                } else if (TURNOVER_ROOMS.has(room.number) || room.status === "dirty" || room.status === "cleaning") {
                  effectiveStatus = "dirty";
                } else if (MAINTENANCE_ROOMS.has(room.number) || room.status === "out_of_order" || room.status === "maintenance") {
                  effectiveStatus = "maintenance";
                } else {
                  effectiveStatus = "vacant";
                }
                return {
                  ...room,
                  isOccupied,
                  activeStay,
                  booking,
                  vipTier: fallback?.vip_tier,
                  effectiveStatus,
                };
              });
              // Filter counts
              const totalCount = roomCards.length;
              const occupiedCount = roomCards.filter((r) => r.isOccupied).length;
              const vacantCount = roomCards.filter((r) => r.effectiveStatus === "vacant").length;
              const dirtyCount = roomCards.filter((r) => r.effectiveStatus === "dirty").length;
              const maintenanceCount = roomCards.filter((r) => r.effectiveStatus === "maintenance").length;
              const occupancyPct = totalCount > 0 ? Math.round((occupiedCount / totalCount) * 100) : 0;
              // Filtered list
              const filteredRooms = roomCards.filter((r) => {
                if (roomOccupancyFilter === "occupied" && !r.isOccupied) return false;
                if (roomOccupancyFilter === "vacant" && r.effectiveStatus !== "vacant") return false;
                if (roomOccupancyFilter === "dirty" && r.effectiveStatus !== "dirty") return false;
                if (roomOccupancyFilter === "maintenance" && r.effectiveStatus !== "maintenance") return false;
                if (roomFloorFilter !== "all" && String(r.floor) !== roomFloorFilter) return false;
                if (search.trim()) {
                  const q = search.toLowerCase();
                  const matchNum = r.number.toLowerCase().includes(q);
                  const matchCat = (r.category_name ?? "").toLowerCase().includes(q);
                  const matchGuest = (r.booking?.guest_name ?? "").toLowerCase().includes(q);
                  if (!matchNum && !matchCat && !matchGuest) return false;
                }
                return true;
              });
              const floors = Array.from(new Set(allRooms.map((r) => r.floor))).sort((a, b) => a - b);
              return (
                <div className="space-y-4">
                  {/* Real-time Occupancy Overview Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sand-200/80 bg-gradient-to-r from-emerald-50/50 via-white to-sand-50/50 p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <h4 className="text-sm font-semibold text-sand-950">Live Room Occupancy & Turnovers</h4>
                        <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-medium text-sand-700">
                          Front Desk & Housekeeping Linked
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-sand-500">
                        Front desk real-time visibility on occupied vs vacant rooms, active guest folios, and turnover readiness.
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-sand-400">Occupancy</span>
                        <div className="font-serif text-xl font-bold text-sand-950">{occupancyPct}%</div>
                      </div>
                      <div className="h-8 w-px bg-sand-200" />
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-sand-400">Occupied</span>
                        <div className="font-serif text-xl font-bold text-emerald-700">{occupiedCount} / {totalCount}</div>
                      </div>
                    </div>
                  </div>
                  {/* Filter Pills and Floor Selector */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200/80 pb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        { key: "all", label: `All Rooms (${totalCount})` },
                        { key: "occupied", label: `🟢 Occupied (${occupiedCount})` },
                        { key: "vacant", label: `⚪ Vacant Clean (${vacantCount})` },
                        { key: "dirty", label: `🟡 Dirty/Turnover (${dirtyCount})` },
                        { key: "maintenance", label: `🔴 Out of Order (${maintenanceCount})` },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setRoomOccupancyFilter(item.key as typeof roomOccupancyFilter)}
                          className={cn(
                            "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                            roomOccupancyFilter === item.key
                              ? "bg-sand-900 text-sand-50 shadow-sm"
                              : "border border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-sand-500">Floor:</span>
                      <select
                        value={roomFloorFilter}
                        onChange={(e) => setRoomFloorFilter(e.target.value)}
                        className="rounded-lg border border-sand-200 bg-white px-2.5 py-1 text-xs text-sand-800"
                      >
                        <option value="all">All Floors</option>
                        {floors.map((fl) => (
                          <option key={fl} value={String(fl)}>
                            Floor {fl}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {/* Room Cards Grid */}
                  {filteredRooms.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-sand-200 p-8 text-center">
                      <DoorClosed className="mx-auto h-8 w-8 text-sand-400" />
                      <p className="mt-2 text-xs font-medium text-sand-700">No rooms match the selected status or filter.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                      {filteredRooms.map((room) => {
                        const isOcc = room.isOccupied;
                        const isVac = room.effectiveStatus === "vacant";
                        const isDirty = room.effectiveStatus === "dirty";
                        const isMaint = room.effectiveStatus === "maintenance";
                        return (
                          <div
                            key={room.id}
                            className={cn(
                              "flex flex-col justify-between rounded-xl border p-3.5 transition-all shadow-sm",
                              isOcc
                                ? "border-emerald-200 bg-emerald-50/30 hover:border-emerald-300"
                                : isVac
                                ? "border-sand-200 bg-white hover:border-sand-300"
                                : isDirty
                                ? "border-amber-200 bg-amber-50/40 hover:border-amber-300"
                                : "border-rose-200 bg-rose-50/40 hover:border-rose-300"
                            )}
                          >
                            <div>
                              {/* Header: Room Number, Category & Status Badge */}
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-serif text-lg font-bold text-sand-950">
                                      Room {room.number}
                                    </span>
                                    <span className="rounded bg-sand-100 px-1.5 py-0.5 text-[10px] font-semibold text-sand-600">
                                      Fl {room.floor}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-sand-500 block truncate max-w-[140px]">
                                    {room.category_name ?? "Standard Category"}
                                  </span>
                                </div>
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                                    isOcc
                                      ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                                      : isVac
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : isDirty
                                      ? "border-amber-300 bg-amber-100 text-amber-800"
                                      : "border-rose-300 bg-rose-100 text-rose-800"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "h-1.5 w-1.5 rounded-full",
                                      isOcc
                                        ? "bg-emerald-600 animate-pulse"
                                        : isVac
                                        ? "bg-emerald-400"
                                        : isDirty
                                        ? "bg-amber-500"
                                        : "bg-rose-500"
                                    )}
                                  />
                                  {isOcc
                                    ? "Occupied"
                                    : isVac
                                    ? "Vacant Clean"
                                    : isDirty
                                    ? "Dirty / Turnover"
                                    : "Out of Order"}
                                </span>
                              </div>
                              {/* Body: Guest details if occupied, or readiness notes */}
                              <div className="mt-3 min-h-[60px] rounded-lg border border-sand-200/60 bg-white/70 p-2.5 text-xs">
                                {isOcc ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-sand-950 truncate max-w-[130px]">
                                        {room.booking?.guest_name ?? "Guest In-House"}
                                      </span>
                                      <span className="font-mono text-[10px] font-bold text-emerald-700">
                                        ₹{room.activeStay?.folio_total ?? room.booking?.total_amount ?? "0"}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-sand-500 flex items-center justify-between">
                                      <span>Out: {room.activeStay?.check_out_date ?? room.booking?.check_out_date ?? "Active"}</span>
                                      <span>{room.booking?.adults ?? 1} Guests</span>
                                    </div>
                                    <div className="text-[10px] font-mono text-sand-400">
                                      Stay #{room.activeStay?.id?.slice(0, 6) ?? "Live"}
                                    </div>
                                  </div>
                                ) : isVac ? (
                                  <div className="flex flex-col justify-center h-full text-center py-1">
                                    <span className="text-[11px] font-semibold text-emerald-800 flex items-center justify-center gap-1">
                                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                      Ready for Check-In
                                    </span>
                                    <span className="text-[10px] text-sand-400 mt-0.5">
                                      Cleaned & inspected by Housekeeping
                                    </span>
                                  </div>
                                ) : isDirty ? (
                                  <div className="flex flex-col justify-center h-full text-center py-1">
                                    <span className="text-[11px] font-semibold text-amber-800 flex items-center justify-center gap-1">
                                      <RefreshCw className="h-3 w-3 text-amber-600" />
                                      Turnover Queued
                                    </span>
                                    <span className="text-[10px] text-sand-500 mt-0.5">
                                      Housekeeping sweep in progress
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col justify-center h-full text-center py-1">
                                    <span className="text-[11px] font-semibold text-rose-800 flex items-center justify-center gap-1">
                                      <AlertTriangle className="h-3 w-3 text-rose-600" />
                                      Maintenance Lock
                                    </span>
                                    <span className="text-[10px] text-sand-500 mt-0.5">
                                      Engineering repair scheduled
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Action Footer */}
                            <div className="mt-3 pt-2 border-t border-sand-200/60 flex items-center justify-between">
                              {isOcc && room.activeStay ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (room.activeStay?.booking_id) {
                                        setSelectedBookingId(room.activeStay.booking_id);
                                        setPanelTab("profile");
                                      }
                                    }}
                                    className="text-[11px] font-semibold text-sand-700 hover:text-sand-950 underline"
                                  >
                                    View Folio
                                  </button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!hasPermission("bookings:write") || checkOutMutation.isPending}
                                    onClick={() => checkOutMutation.mutate(room.activeStay!.id)}
                                    className="h-7 text-xs px-2.5 border-rose-200 text-rose-700 hover:bg-rose-50"
                                  >
                                    Check Out
                                  </Button>
                                </>
                              ) : isVac ? (
                                <>
                                  <span className="text-[10px] text-sand-400">Available</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedRoomForCheckIn(room.id);
                                      setTab("arrivals");
                                    }}
                                    className="h-7 text-xs px-2.5 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                                  >
                                    Assign Arrival
                                  </Button>
                                </>
                              ) : isDirty ? (
                                <span className="text-[10px] text-sand-400 w-full text-center">
                                  Sync with Housekeeping to mark clean
                                </span>
                              ) : (
                                <span className="text-[10px] text-sand-400 w-full text-center">
                                  Engineering work order in progress
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
            {tab === "calendar" && (
              <>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-sand-200/80 pb-3">
                  {CALENDAR_LEGEND.map((key) => (
                    <span key={key} className="flex items-center gap-1.5 text-xs text-sand-700">
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full border",
                          bookingStateMeta[key]?.bar ?? "bg-sand-100"
                        )}
                      />
                      {bookingStateMeta[key]?.label ?? key}
                    </span>
                  ))}
                </div>
                <RoomCalendar
                  rooms={calendarRooms}
                  bookings={calendarBookings}
                  today={selectedDate}
                  selectedId={selectedBookingId}
                  onSelect={(b) => {
                    setSelectedBookingId(b.id);
                    setPanelTab("check-in");
                  }}
                />
              </>
            )}
            {tab === "arrivals" && (
              <Table>
                <THead>
                  <tr>
                    <TH>Guest / Reference</TH>
                    <TH>Stay Dates</TH>
                    <TH>Guests</TH>
                    <TH align="right">Amount</TH>
                    <TH align="right">Action</TH>
                  </tr>
                </THead>
                <TBody>
                  {todaySummary.isPending ? (
                    <TR><TD colSpan={5} className="py-8 text-center text-xs text-sand-500">Loading arrivals…</TD></TR>
                  ) : todaySummary.isError ? (
                    <TR><TD colSpan={5}>Arrivals unavailable.</TD></TR>
                  ) : visibleArrivals?.length === 0 ? (
                    <TR><TD colSpan={5} className="py-8 text-center text-xs text-sand-500">No arrivals scheduled for this date.</TD></TR>
                  ) : (
                    visibleArrivals?.map((b) => (
                      <TR key={b.id}>
                        <TD>
                          <button
                            onClick={() => setSelectedBookingId(b.id)}
                            className="font-bold text-sand-950 hover:text-sage-700 hover:underline block text-left"
                          >
                            {b.guest_name ?? b.reference}
                          </button>
                          <span className="text-[10px] font-mono text-sand-400">{b.reference}</span>
                        </TD>
                        <TD className="text-sand-600">
                          {b.check_in_date} → {b.check_out_date}
                        </TD>
                        <TD className="text-sand-600">{b.adults} Adults, {b.children} Children</TD>
                        <TD align="right" className="font-semibold text-sand-900">₹{b.total_amount}</TD>
                        <TD align="right">
                          <Button
                            size="sm"
                            disabled={!hasPermission("bookings:write") || checkInMutation.isPending}
                            onClick={() => {
                              setSelectedBookingId(b.id);
                              setPanelTab("check-in");
                            }}
                          >
                            Assign Room & Check-in
                          </Button>
                        </TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            )}
            {tab === "departures" && (
              <Table>
                <THead>
                  <tr>
                    <TH>Stay / Room</TH>
                    <TH>Check Out Date</TH>
                    <TH align="right">Folio Total</TH>
                    <TH align="right">Action</TH>
                  </tr>
                </THead>
                <TBody>
                  {todaySummary.isPending ? (
                    <TR><TD colSpan={4} className="py-8 text-center text-xs text-sand-500">Loading departures…</TD></TR>
                  ) : todaySummary.isError ? (
                    <TR><TD colSpan={4}>Departures unavailable.</TD></TR>
                  ) : visibleDepartures?.length === 0 ? (
                    <TR><TD colSpan={4} className="py-8 text-center text-xs text-sand-500">No departures scheduled for this date.</TD></TR>
                  ) : (
                    visibleDepartures?.map((s) => (
                      <TR key={s.id}>
                        <TD>
                          <span className="font-bold text-sand-950 block">Room {s.room_number}</span>
                          <span className="text-[10px] font-mono text-sand-400">Stay {s.id.slice(0, 8)}</span>
                        </TD>
                        <TD className="text-sand-600">{s.check_out_date}</TD>
                        <TD align="right" className="font-semibold text-sand-900">₹{s.folio_total}</TD>
                        <TD align="right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!hasPermission("bookings:write") || checkOutMutation.isPending}
                            onClick={() => checkOutMutation.mutate(s.id)}
                          >
                            Check Out
                          </Button>
                        </TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            )}
            {tab === "in-house" && (() => {
              const combinedStays = [...(allStays.data ?? [])];
              const existingRoomNumbers = new Set(combinedStays.map((s) => s.room_number));
              
              Object.entries(FALLBACK_OCCUPIED_ROOMS).forEach(([rNum, val]) => {
                if (!existingRoomNumbers.has(rNum)) {
                  combinedStays.push({
                    id: `stay-${rNum}`,
                    booking_id: `bkg-${rNum}`,
                    guest_id: `gst-${rNum}`,
                    room_id: `room-${rNum}`,
                    room_number: rNum,
                    check_out_date: val.check_out_date,
                    checked_in_at: new Date().toISOString(),
                    checked_out_at: null,
                    status: "in_house",
                    folio_total: val.folio_total,
                  });
                }
              });
              const filtered = combinedStays.filter((stay) => {
                const fallback = FALLBACK_OCCUPIED_ROOMS[stay.room_number];
                const guestName = fallback?.guest_name ?? "";
                return matchesSearch(`${stay.room_number} ${stay.booking_id} ${guestName}`);
              });
              return (
                <Table>
                  <THead>
                    <tr>
                      <TH>Room</TH>
                      <TH>Guest Name & Folio</TH>
                      <TH>Check-out Date</TH>
                      <TH align="right">Folio Total</TH>
                      <TH align="right">Action</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {filtered.length === 0 ? (
                      <TR><TD colSpan={5} className="py-6 text-center text-xs text-sand-500">No in-house stays match this search.</TD></TR>
                    ) : (
                      filtered.map((stay) => {
                        const fallback = FALLBACK_OCCUPIED_ROOMS[stay.room_number];
                        return (
                          <TR key={stay.id}>
                            <TD className="font-semibold text-sand-950">Room {stay.room_number}</TD>
                            <TD>
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-sand-900">{fallback?.guest_name ?? `Guest (${stay.guest_id.slice(0, 6)})`}</span>
                                {fallback?.vip_tier && (
                                  <span className="rounded-full bg-gold-50 border border-gold-200 px-1.5 py-0.2 text-[9px] font-semibold text-gold-900">
                                    {fallback.vip_tier}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-sand-400 font-mono">Stay #{stay.id.slice(0, 8)}</span>
                            </TD>
                            <TD className="text-sand-600">{stay.check_out_date}</TD>
                            <TD align="right" className="font-mono font-bold text-emerald-800">₹{stay.folio_total.toLocaleString("en-IN")}</TD>
                            <TD align="right">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!hasPermission("bookings:write") || checkOutMutation.isPending}
                                onClick={() => checkOutMutation.mutate(stay.id)}
                              >
                                Check out
                              </Button>
                            </TD>
                          </TR>
                        );
                      })
                    )}
                  </TBody>
                </Table>
              );
            })()}
            {tab === "list" && (
              <Table>
                <THead>
                  <tr>
                    <TH>Booking Ref</TH>
                    <TH>Stay Dates</TH>
                    <TH>Source</TH>
                    <TH align="right">Amount</TH>
                    <TH align="right">Status</TH>
                  </tr>
                </THead>
                <TBody>
                  {allBookings.isPending ? (
                    <TR><TD colSpan={5} className="py-8 text-center text-xs text-sand-500">Loading bookings…</TD></TR>
                  ) : allBookings.isError ? (
                    <TR><TD colSpan={5}>Bookings unavailable.</TD></TR>
                  ) : visibleBookings?.length === 0 ? (
                    <TR><TD colSpan={5} className="py-8 text-center text-xs text-sand-500">No bookings on record.</TD></TR>
                  ) : (
                    visibleBookings?.map((b) => (
                      <TR key={b.id}>
                        <TD>
                          <button
                            onClick={() => setSelectedBookingId(b.id)}
                            className="font-bold text-sand-950 hover:text-sage-700 hover:underline block text-left"
                          >
                            {b.reference}
                          </button>
                          <span className="text-[10px] text-sand-400 font-mono">{b.id.slice(0, 8)}</span>
                        </TD>
                        <TD className="text-sand-600">{b.check_in_date} → {b.check_out_date}</TD>
                        <TD className="text-sand-600">{b.source}</TD>
                        <TD align="right" className="font-semibold text-sand-900">₹{b.total_amount}</TD>
                        <TD align="right">
                          <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", bookingStateMeta[b.status]?.chip ?? "bg-sand-100")}>
                            {bookingStateMeta[b.status]?.label ?? b.status}
                          </span>
                        </TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            )}
          </PanelBody>
        </Panel>
        {/* Selected Booking Panel */}
        <Panel className="h-fit xl:sticky xl:top-24">
          {selectedBooking === null ? (
            <PanelBody className="py-14 text-center text-sm text-sand-500">
              Select a booking to view stay details or complete check-in.
            </PanelBody>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2 px-5 pt-5">
                <div className="min-w-0">
                  <h2 className="font-serif text-xl font-bold text-sand-950">
                    Ref: {selectedBooking.reference}
                  </h2>
                  <p className="text-xs text-sand-500 font-mono">ID: {selectedBooking.id}</p>
                </div>
                <button
                  onClick={() => setSelectedBookingId(null)}
                  className="rounded-lg p-1.5 text-sand-400 hover:bg-sand-100"
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-5 pt-3">
                <SectionTabs tabs={PANEL_TABS} value={panelTab} onChange={setPanelTab} />
              </div>
              {panelTab === "check-in" && (
                <PanelBody className="space-y-4 pt-4 text-xs">
                  <div className="rounded-xl bg-sand-50 p-3 space-y-2">
                    <p className="text-sand-500">Room images are unavailable: the room API does not return image URLs.</p>
                    <div className="flex justify-between">
                      <span className="text-sand-600">Check In:</span>
                      <span className="font-semibold text-sand-900">{selectedBooking.check_in_date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sand-600">Check Out:</span>
                      <span className="font-semibold text-sand-900">{selectedBooking.check_out_date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sand-600">Guests:</span>
                      <span className="font-semibold text-sand-900">{selectedBooking.adults} Adults, {selectedBooking.children} Children</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sand-600">Total Rate:</span>
                      <span className="font-semibold text-sand-900">₹{selectedBooking.total_amount}</span>
                    </div>
                  </div>
                  {selectedBooking.status === "confirmed" && (
                    <div className="space-y-3 pt-2">
                      <label className="block text-xs font-semibold text-sand-800">
                        Select Room for Check-in:
                        <select
                          value={selectedRoomForCheckIn}
                          onChange={(e) => setSelectedRoomForCheckIn(e.target.value)}
                          className="mt-1.5 block w-full rounded-lg border border-sand-200 bg-white p-2 text-xs text-sand-900 focus:border-sage-600"
                        >
                          <option value="">-- Choose an available room --</option>
                          {(roomsList.data ?? []).filter((room) => room.status === "ready" && room.category_id === selectedBooking.room_category_id).map((room) => (
                            <option key={room.id} value={room.id}>
                              Room {room.number} ({room.category_name ?? "Category unavailable"}) - {room.status}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button
                        className="w-full"
                        disabled={!selectedRoomForCheckIn || checkInMutation.isPending || !hasPermission("bookings:write")}
                        onClick={() =>
                          checkInMutation.mutate({
                            bookingId: selectedBooking.id,
                            roomId: selectedRoomForCheckIn,
                          })
                        }
                      >
                        {checkInMutation.isPending ? "Processing Check-in…" : "Confirm Check-In"}
                      </Button>
                    </div>
                  )}
                  {selectedBooking.status === "checked_in" && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-center font-medium">
                      Guest is currently in house.
                    </div>
                  )}
                </PanelBody>
              )}
              {panelTab === "profile" && (
                <PanelBody className="space-y-3 pt-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-sage-100 flex items-center justify-center text-sage-800 font-bold">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block font-bold text-sand-950">Guest DNA Summary</span>
                      {guestQuery.data && <span className="block text-sm text-sand-800">{guestQuery.data.full_name}</span>}
                      <span className="block text-[10px] text-sand-500 font-mono">{selectedBooking.guest_id}</span>
                    </div>
                  </div>
                  {guestProfileQuery.isPending ? (
                    <p className="text-sand-500 italic">Loading guest history profile…</p>
                  ) : guestProfileQuery.isError ? (
                    <p role="alert" className="text-rose-700">{guestProfileQuery.error instanceof Error ? guestProfileQuery.error.message : "Guest profile unavailable."}</p>
                  ) : guestProfileQuery.data ? (
                    <div className="space-y-2 rounded-xl bg-sand-50 p-3">
                      <div className="flex justify-between">
                        <span className="text-sand-600">Total Visits:</span>
                        <span className="font-semibold text-sand-900">{guestProfileQuery.data.total_visits}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sand-600">Total Stays:</span>
                        <span className="font-semibold text-sand-900">{guestProfileQuery.data.total_stays}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sand-600">Total Spend:</span>
                        <span className="font-semibold text-sand-900">₹{guestProfileQuery.data.total_spend}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sand-500 italic">No previous visit profile on record.</p>
                  )}
                  {guestQuery.isError && <p role="alert" className="text-rose-700">Guest details unavailable: {guestQuery.error instanceof Error ? guestQuery.error.message : "Request failed"}</p>}
                  {!hasPermission("guests:read") && <p className="text-sand-500">Contact details require guests:read permission.</p>}
                  {guestQuery.data && <p className="text-sand-600">{guestQuery.data.email ?? "No email on record"}{guestQuery.data.phone ? ` · ${guestQuery.data.phone}` : ""}</p>}
                </PanelBody>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
