import { api } from "@/lib/api";
import type { OverviewData } from "@/components/connected/connected-overview";

type Forecast = { stay_date: string; predicted_occupancy: number; lower_bound: number; upper_bound: number; predicted_adr: number; confidence: number; model_name: string };
type RateNight = { stay_date: string; rate: number; is_override: boolean; source: string; predicted_occupancy: number | null };
type RateCard = { room_category_id: string; name: string; base_rate: number; nights: RateNight[] };
type Booking = { id: string; reference: string; status: string; check_in_date: string; check_out_date: string; total_amount: number; rate: number };
type Request = { id: string; kind: string; status: string; room_number: string; total_amount: number; created_at: string; due_at: string; is_overdue: boolean };
type Item = { id: string; sku: string; name: string; supplier: string | null; lead_time_days: number; quantity: number; minimum_quantity: number; unit_cost: number; category: string };
type Order = { id: string; item_id: string; supplier: string | null; status: string; quantity: number; unit_cost: number; total_cost: number; expected_on: string | null; created_at: string };
type Guest = { id: string; full_name: string; loyalty_tier: string; email: string | null; city: string | null; is_vip: boolean };
type Attendance = { id: string; user_id: string; work_date: string; checked_in_at: string; checked_out_at: string | null; worked_minutes: number; is_late: boolean };
type AttendanceTeam = { work_date: string; expected: number; present: number; late: number; absent: number; records: Attendance[] };
type SentimentSummary = { samples: number; average_sentiment: number; label: string; negative_share: number; top_themes: { theme: string; count: number }[] };
type SentimentTrend = { department_id: string; points: { date: string; average_sentiment: number; samples: number }[] };
type Offer = { id: string; guest_id: string; offer_type: string; status: string; discount_pct: number; estimated_value: number; expires_on: string | null };
type RateHistory = { id: string; stay_date: string; new_rate: number; previous_rate: number | null; source: string; created_at: string };

const money = (value: number) => `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const pct = (value: number) => `${Math.round(value * 100)}%`;
const date = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const metric = (label: string, value: string, detail?: string) => ({ label, value, detail });

export async function loadForecast(): Promise<OverviewData> {
  const forecasts = await api.get<Forecast[]>("/revenue/forecast", { days: 90 });
  const mean = forecasts.length ? forecasts.reduce((sum, row) => sum + row.predicted_occupancy, 0) / forecasts.length : 0;
  return {
    metrics: [metric("Forecast nights", String(forecasts.length)), metric("Average projected occupancy", forecasts.length ? pct(mean) : "—"), metric("Model", forecasts[0]?.model_name ?? "Awaiting forecast")],
    columns: [{ key: "stay", label: "Stay date" }, { key: "occupancy", label: "Projected occupancy" }, { key: "range", label: "Likely range" }, { key: "adr", label: "Projected ADR" }, { key: "confidence", label: "Confidence" }, { key: "model", label: "Model" }],
    rows: forecasts.map((row) => ({ id: row.stay_date, stay: date(row.stay_date), occupancy: pct(row.predicted_occupancy), range: `${pct(row.lower_bound)}–${pct(row.upper_bound)}`, adr: money(row.predicted_adr), confidence: pct(row.confidence), model: row.model_name })),
    emptyMessage: "No forecast has been generated yet. Generate one from the revenue engine before reviewing demand.",
    note: "Forecast values come from the backend. The model column distinguishes a baseline estimate from a trained forecast.",
  };
}

export async function loadDemandCalendar(): Promise<OverviewData> {
  const categories = await api.get<RateCard[]>("/revenue/rate-card", { days: 30 });
  const rows = categories.flatMap((category) => category.nights.map((night) => ({ id: `${category.room_category_id}-${night.stay_date}`, stay: date(night.stay_date), category: category.name, occupancy: night.predicted_occupancy == null ? "—" : pct(night.predicted_occupancy), rate: money(night.rate), source: night.is_override ? "Manual override" : night.source })));
  return {
    metrics: [metric("Room categories", String(categories.length)), metric("Priced nights", String(rows.length)), metric("Manual overrides", String(rows.filter((row) => row.source === "Manual override").length))],
    columns: [{ key: "stay", label: "Stay date" }, { key: "category", label: "Room category" }, { key: "occupancy", label: "Projected occupancy" }, { key: "rate", label: "Nightly rate" }, { key: "source", label: "Price source" }],
    rows,
    emptyMessage: "No nightly rates are available yet.",
  };
}

export async function loadFinancials(): Promise<OverviewData> {
  const bookings = await api.get<Booking[]>("/bookings");
  const active = bookings.filter((row) => row.status !== "cancelled" && row.status !== "no_show");
  const total = active.reduce((sum, row) => sum + Number(row.total_amount), 0);
  return {
    metrics: [metric("Booked room value", money(total), "Across the returned booking records"), metric("Bookings", String(active.length)), metric("Cancelled / no-show", String(bookings.length - active.length))],
    columns: [{ key: "reference", label: "Reference" }, { key: "arrival", label: "Arrival" }, { key: "departure", label: "Departure" }, { key: "status", label: "Status" }, { key: "value", label: "Booked value" }],
    rows: bookings.map((row) => ({ id: row.id, reference: row.reference, arrival: date(row.check_in_date), departure: date(row.check_out_date), status: row.status, value: money(row.total_amount) })),
    note: "The API does not yet provide a finance ledger, expenses, payroll cost, or actual margin. Booked room value is not recognized revenue.",
  };
}

export async function loadFoodAndBeverage(): Promise<OverviewData> {
  const requests = (await api.get<Request[]>("/requests")).filter((row) => row.kind === "room_service");
  const open = requests.filter((row) => !["delivered", "cancelled"].includes(row.status));
  return {
    metrics: [metric("Open room-service orders", String(open.length)), metric("Overdue orders", String(open.filter((row) => row.is_overdue).length)), metric("Delivered order value", money(requests.filter((row) => row.status === "delivered").reduce((sum, row) => sum + Number(row.total_amount), 0)))],
    columns: [{ key: "room", label: "Room" }, { key: "placed", label: "Placed" }, { key: "status", label: "Status" }, { key: "due", label: "Due" }, { key: "amount", label: "Amount" }],
    rows: requests.map((row) => ({ id: row.id, room: row.room_number, placed: new Date(row.created_at).toLocaleString("en-IN"), status: row.status, due: new Date(row.due_at).toLocaleString("en-IN"), amount: money(row.total_amount) })),
    note: "This is the room-service order book. Outlet covers and kitchen prep times need additional backend records.",
  };
}

export async function loadSuppliers(): Promise<OverviewData> {
  const items = await api.get<Item[]>("/inventory/items");
  const groups = new Map<string, { items: number; low: number; lead: number; value: number }>();
  for (const item of items) {
    const name = item.supplier?.trim() || "Unassigned";
    const current = groups.get(name) ?? { items: 0, low: 0, lead: 0, value: 0 };
    current.items += 1;
    current.low += Number(item.quantity) <= Number(item.minimum_quantity) ? 1 : 0;
    current.lead += Number(item.lead_time_days);
    current.value += Number(item.quantity) * Number(item.unit_cost);
    groups.set(name, current);
  }
  return {
    metrics: [metric("Suppliers", String(groups.size)), metric("Stock items", String(items.length)), metric("Items at or below minimum", String(items.filter((row) => Number(row.quantity) <= Number(row.minimum_quantity)).length))],
    columns: [{ key: "supplier", label: "Supplier" }, { key: "items", label: "Items supplied" }, { key: "low", label: "Low-stock items" }, { key: "lead", label: "Average lead time" }, { key: "value", label: "Current stock value" }],
    rows: [...groups].map(([supplier, group]) => ({ id: supplier, supplier, items: group.items, low: group.low, lead: `${Math.round(group.lead / group.items)} days`, value: money(group.value) })),
    note: "Supplier names and lead times come from inventory items. Contracts, contact details, and delivery reliability are not yet exposed by the API.",
  };
}

export async function loadPurchaseOrders(): Promise<OverviewData> {
  const [orders, items] = await Promise.all([api.get<Order[]>("/purchase-orders"), api.get<Item[]>("/inventory/items")]);
  const names = new Map(items.map((item) => [item.id, item.name]));
  return {
    metrics: [metric("Open orders", String(orders.filter((row) => ["suggested", "approved", "ordered"].includes(row.status)).length)), metric("Total ordered value", money(orders.reduce((sum, row) => sum + Number(row.total_cost), 0))), metric("Received", String(orders.filter((row) => row.status === "received").length))],
    columns: [{ key: "item", label: "Item" }, { key: "supplier", label: "Supplier" }, { key: "quantity", label: "Quantity" }, { key: "value", label: "Value" }, { key: "status", label: "Status" }, { key: "expected", label: "Expected" }],
    rows: orders.map((row) => ({ id: row.id, item: names.get(row.item_id) ?? row.item_id, supplier: row.supplier ?? "—", quantity: Number(row.quantity), value: money(row.total_cost), status: row.status, expected: row.expected_on ? date(row.expected_on) : "—" })),
    emptyMessage: "No purchase orders have been raised yet.",
  };
}

export async function loadFeedback(): Promise<OverviewData> {
  const [summary, trends] = await Promise.all([api.get<SentimentSummary>("/guest-intel/sentiment/summary", { days: 30 }), api.get<SentimentTrend[]>("/guest-intel/sentiment/trend", { days: 30 })]);
  const rows = trends.flatMap((department) => department.points.map((point) => ({ id: `${department.department_id}-${point.date}`, date: date(point.date), department: department.department_id, sentiment: Number(point.average_sentiment).toFixed(2), samples: point.samples })));
  return {
    metrics: [metric("Reviews sampled", String(summary.samples)), metric("Average sentiment", summary.samples ? summary.average_sentiment.toFixed(2) : "—"), metric("Negative share", pct(summary.negative_share)), metric("Overall label", summary.label)],
    columns: [{ key: "date", label: "Date" }, { key: "department", label: "Department ID" }, { key: "sentiment", label: "Average sentiment" }, { key: "samples", label: "Samples" }],
    rows,
    note: "Sentiment is aggregated by department and date. Individual comments require a separate, permission-controlled review endpoint.",
  };
}

export async function loadLoyalty(): Promise<OverviewData> {
  const guests = await api.get<Guest[]>("/guests");
  const tiers = new Set(guests.map((guest) => guest.loyalty_tier));
  return {
    metrics: [metric("Guests returned", String(guests.length)), metric("Tiers represented", String(tiers.size)), metric("VIP guests", String(guests.filter((guest) => guest.is_vip).length))],
    columns: [{ key: "name", label: "Guest" }, { key: "tier", label: "Loyalty tier" }, { key: "vip", label: "VIP" }, { key: "city", label: "City" }],
    rows: guests.map((guest) => ({ id: guest.id, name: guest.full_name, tier: guest.loyalty_tier, vip: guest.is_vip ? "Yes" : "No", city: guest.city ?? "—" })),
    note: "The guest API stores a tier only. Points earning, redemption, benefits, and enrollment cannot be managed until those backend capabilities exist. The API returns at most 200 guests here.",
  };
}

export async function loadPayroll(): Promise<OverviewData> {
  const team = await api.get<AttendanceTeam>("/attendance/team");
  return {
    metrics: [metric("Present today", String(team.present)), metric("Late", String(team.late)), metric("Absent", String(team.absent)), metric("Recorded hours", `${(team.records.reduce((sum, row) => sum + row.worked_minutes, 0) / 60).toFixed(1)} h`)],
    columns: [{ key: "employee", label: "Employee ID" }, { key: "date", label: "Work date" }, { key: "checkIn", label: "Checked in" }, { key: "checkOut", label: "Checked out" }, { key: "hours", label: "Hours worked" }, { key: "late", label: "Late" }],
    rows: team.records.map((row) => ({ id: row.id, employee: row.user_id, date: date(row.work_date), checkIn: new Date(row.checked_in_at).toLocaleTimeString("en-IN"), checkOut: row.checked_out_at ? new Date(row.checked_out_at).toLocaleTimeString("en-IN") : "On shift", hours: (row.worked_minutes / 60).toFixed(1), late: row.is_late ? "Yes" : "No" })),
    note: "This is an attendance view. The backend has no pay rates, overtime calculation, payslips, or payroll run API; no amounts are inferred.",
  };
}

export async function loadReports(): Promise<OverviewData> {
  const [bookings, orders, requests] = await Promise.all([api.get<Booking[]>("/bookings"), api.get<Order[]>("/purchase-orders"), api.get<Request[]>("/requests")]);
  const rows = [
    { id: "bookings", area: "Reservations", count: bookings.length, value: money(bookings.reduce((sum, row) => sum + Number(row.total_amount), 0)), measure: "Booked room value" },
    { id: "requests", area: "Guest requests", count: requests.length, value: money(requests.reduce((sum, row) => sum + Number(row.total_amount), 0)), measure: "Request value" },
    { id: "purchases", area: "Purchase orders", count: orders.length, value: money(orders.reduce((sum, row) => sum + Number(row.total_cost), 0)), measure: "Order value" },
  ];
  return {
    metrics: [metric("Bookings", String(bookings.length)), metric("Guest requests", String(requests.length)), metric("Purchase orders", String(orders.length))],
    columns: [{ key: "area", label: "Area" }, { key: "count", label: "Records" }, { key: "measure", label: "Measure" }, { key: "value", label: "Value" }],
    rows,
    note: "These are current operational totals from three APIs, not a reconciled financial report or a year-over-year comparison.",
  };
}

export async function loadRevenueInsights(): Promise<OverviewData> {
  const history = await api.get<RateHistory[]>("/revenue/rates/history");
  const changed = history.filter((row) => row.previous_rate != null);
  return {
    metrics: [metric("Rate changes", String(history.length)), metric("Increases", String(changed.filter((row) => Number(row.new_rate) > Number(row.previous_rate)).length)), metric("Decreases", String(changed.filter((row) => Number(row.new_rate) < Number(row.previous_rate)).length))],
    columns: [{ key: "date", label: "Stay date" }, { key: "previous", label: "Previous rate" }, { key: "new", label: "New rate" }, { key: "change", label: "Change" }, { key: "source", label: "Source" }],
    rows: history.map((row) => ({ id: row.id, date: date(row.stay_date), previous: row.previous_rate == null ? "Base rate" : money(row.previous_rate), new: money(row.new_rate), change: row.previous_rate == null ? "—" : money(Number(row.new_rate) - Number(row.previous_rate)), source: row.source })),
    note: "This page explains recorded rate changes. Attribution of occupancy and revenue movement needs a historical comparison API.",
  };
}
