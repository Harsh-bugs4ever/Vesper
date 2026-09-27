"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type Twin = {
  department_name: string;
  manager: { name: string; email: string } | null;
  staff_count: number;
  staff: Array<{ name: string; employee_code: string | null }>;
  days: Array<{ date: string; booked_rooms: number; forecast_rooms: number; lower_rooms: number; upper_rooms: number; forecast_source: string; rain_mm: number | null; max_temp_c: number | null; staff_needed: number; staff_needed_low: number; staff_needed_high: number; staff_available: number; staff_gap: number; demand_multiplier: number }>;
  inventory: Array<{ name: string; unit: string; on_hand: number; minimum: number; at_risk: boolean; projected_shortfall: number | null; projection_note: string }>;
  summary: { peak_forecast_rooms: number; peak_staff_gap: number; stock_below_minimum: number };
  location: { city: string; latitude: number | null; longitude: number | null; source: string };
  weather_status: string;
  social_status: string;
  public_reports: Array<{ title: string; url: string; source: string }>;
  model: { status: string; model: string | null; insight: string | null };
  weather_model: { status: string; samples: number; mae?: number | null; baseline_mae?: number | null; uncertainty?: number | null; used_for_scenario: boolean };
  method: string;
};

export function GmDigitalTwin({ departmentId }: { departmentId: string }) {
  const [rain, setRain] = useState(0);
  const [heat, setHeat] = useState(0);
  const [scenario, setScenario] = useState({ rain: 0, heat: 0 });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["gm-digital-twin", departmentId, scenario.rain, scenario.heat],
    queryFn: () => api.get<Twin>("/dashboard/digital-twin", {
      department_id: departmentId, rain_delta_mm: scenario.rain, heat_delta_c: scenario.heat,
    }),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });

  if (isLoading) return <div className="rounded-xl border border-sand-200 bg-white p-5 text-sm text-sand-600">Loading 14-day department scenario…</div>;
  if (isError || !data) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">Scenario unavailable. <button type="button" onClick={() => refetch()} className="underline">Retry</button></div>;

  const lat = data.location.latitude;
  const lon = data.location.longitude;
  const mapUrl = lat != null && lon != null
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.035}%2C${lat - 0.025}%2C${lon + 0.035}%2C${lat + 0.025}&layer=mapnik&marker=${lat}%2C${lon}`
    : null;

  return <section className="space-y-5 rounded-2xl border border-sage-200 bg-white p-5" aria-label={`${data.department_name} digital twin`}>
    <div>
      <h3 className="font-serif text-xl font-semibold text-sage-950">14-day department outlook</h3>
      <p className="mt-1 text-xs text-sand-600">{data.method}</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl bg-sand-50 p-4"><p className="text-xs text-sand-600">Department manager</p><p className="mt-1 font-semibold">{data.manager?.name ?? "Unassigned"}</p><p className="text-xs text-sand-500">{data.manager?.email ?? "Assign a department head"}</p></div>
      <div className="rounded-xl bg-sand-50 p-4"><p className="text-xs text-sand-600">Staff in department</p><p className="mt-1 text-2xl font-semibold">{data.staff_count}</p><p className="text-xs text-sand-500">{data.staff.map(s => s.name).join(", ") || "No assigned staff"}</p></div>
      <div className="rounded-xl bg-sand-50 p-4"><p className="text-xs text-sand-600">Peak estimated coverage gap</p><p className="mt-1 text-2xl font-semibold">{data.summary.peak_staff_gap}</p><p className="text-xs text-sand-500">Compared with active department headcount, not shift availability</p></div>
    </div>
    <p className="text-xs text-sand-500">Estimated financial gain is unavailable because this view has no validated department margin or conversion model. Use the demand, coverage, and stock estimates for planning.</p>
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-3">
        <h4 className="font-semibold">Weather what-if</h4>
        <label className="block text-sm">Extra daily rain: {rain} mm<input type="range" min="-20" max="100" step="5" value={rain} onChange={e => setRain(Number(e.target.value))} className="mt-2 w-full" /></label>
        <label className="block text-sm">Temperature change: {heat} °C<input type="range" min="-10" max="10" step="1" value={heat} onChange={e => setHeat(Number(e.target.value))} className="mt-2 w-full" /></label>
        <button type="button" className="rounded-lg bg-sage-800 px-4 py-2 text-sm font-semibold text-white" onClick={() => setScenario({ rain, heat })}>Run scenario</button>
        <p className="text-xs text-sand-500">Weather feed: {data.weather_status.replaceAll("_", " ")}. Weather model: {data.weather_model.used_for_scenario ? `learned from ${data.weather_model.samples} historical days (holdout error ${data.weather_model.mae} work items/day; estimated 90% error band ±${data.weather_model.uncertainty})` : `bounded scenario assumption (${data.weather_model.status.replaceAll("_", " ")})`}. Live bookings and stock are never edited.</p>
      </div>
      <div>
        <h4 className="mb-2 font-semibold">{data.location.city} conditions map</h4>
        {mapUrl ? <div className="relative"><iframe title={`${data.location.city} area map`} src={mapUrl} loading="lazy" className="h-52 w-full rounded-xl border border-sand-200" /><div className="absolute bottom-2 left-2 rounded-lg bg-white/95 px-3 py-2 text-xs shadow">Area weather · first forecast day: {data.days[0]?.rain_mm == null ? "unavailable" : `${data.days[0].rain_mm} mm rain, ${data.days[0].max_temp_c} °C`}</div></div> : <p className="rounded-xl bg-sand-50 p-4 text-sm">Location could not be geocoded.</p>}
        <p className="mt-1 text-xs text-sand-500">Map marker: {data.location.source === "property_coordinates" ? "configured resort coordinates" : "city center (exact resort coordinates unavailable)"}. Weather applies to this area.</p>
      </div>
    </div>
    <div className="overflow-x-auto">
      <h4 className="mb-2 font-semibold">Bookings, demand and capacity</h4>
      <table className="min-w-full text-left text-xs"><thead><tr className="border-b border-sand-200 text-sand-500"><th className="p-2">Date</th><th className="p-2">Confirmed rooms</th><th className="p-2">Forecast rooms (range)</th><th className="p-2">Rain / heat</th><th className="p-2">Staff needed (range)</th><th className="p-2">Gap</th></tr></thead><tbody>{data.days.map(day => <tr key={day.date} className="border-b border-sand-100"><td className="p-2">{day.date}</td><td className="p-2">{day.booked_rooms}</td><td className="p-2">{day.forecast_rooms} ({day.lower_rooms}–{day.upper_rooms})</td><td className="p-2">{day.rain_mm == null ? "Unavailable" : `${day.rain_mm} mm / ${day.max_temp_c} °C`}</td><td className="p-2">{day.staff_needed} ({day.staff_needed_low}–{day.staff_needed_high})</td><td className={`p-2 font-semibold ${day.staff_gap ? "text-rose-700" : "text-emerald-700"}`}>{day.staff_gap}</td></tr>)}</tbody></table>
    </div>
    <div className="grid gap-5 lg:grid-cols-2">
      <div><h4 className="mb-2 font-semibold">Department stock</h4>{data.inventory.length ? <ul className="space-y-2 text-sm">{data.inventory.map(item => <li key={item.name} className="rounded-lg bg-sand-50 p-2"><div className="flex justify-between gap-3"><span>{item.name}</span><span className={item.at_risk ? "font-semibold text-rose-700" : "text-sand-600"}>{item.on_hand} {item.unit} / min {item.minimum}</span></div><p className="mt-1 text-xs text-sand-500">{item.projected_shortfall != null && item.projected_shortfall > 0 ? `Estimated 14-day shortage: ${item.projected_shortfall} ${item.unit}. ` : ""}{item.projection_note}</p></li>)}</ul> : <p className="text-sm text-sand-500">No stock items assigned to this department.</p>}<p className="mt-2 text-xs text-sand-500">Projected shortages use recorded consumption only; items without history remain unknown.</p></div>
      <div><h4 className="mb-2 font-semibold">Public weather and travel reports</h4><p className="mb-2 text-xs text-sand-500">Source: {data.social_status === "public_news_rss" ? "Google News RSS" : "GDELT public news"}. Status: {data.social_status.replaceAll("_", " ")}. Reports are signals, not verified incidents at the resort.</p>{data.public_reports.length ? <ul className="space-y-2 text-sm">{data.public_reports.map(report => <li key={report.url}><a href={report.url} target="_blank" rel="noopener noreferrer" className="text-sage-800 underline">{report.title}</a><span className="ml-2 text-xs text-sand-500">{report.source}</span></li>)}</ul> : <p className="text-sm text-sand-500">No matching public reports available.</p>}</div>
    </div>
    <div className="rounded-xl bg-sage-50 p-4 text-sm"><p className="font-semibold">Nugen aligned-model insight</p><p className="mt-1">{data.model.insight ?? (data.model.status === "not_configured" ? "Awaiting aligned model credentials. Scenario estimates above use the documented rules." : "Aligned-model inference is currently unavailable.")}</p><p className="mt-1 text-xs text-sand-500">Status: {data.model.status.replaceAll("_", " ")}</p></div>
  </section>;
}
