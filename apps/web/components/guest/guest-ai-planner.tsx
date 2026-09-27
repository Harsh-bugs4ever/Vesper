"use client";

import { useEffect, useState } from "react";
import { Clock3, Compass, Loader2, MapPin, Sparkles } from "lucide-react";
import { guestPlanner, type GuestPlannerResponse } from "@/lib/api";

interface Props {
  stayId: string;
  disabled?: boolean;
}

export function GuestAiPlanner({ stayId, disabled = false }: Props) {
  const [plan, setPlan] = useState("");
  const [result, setResult] = useState<GuestPlannerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(`vesper_guest_plan_${stayId}`);
      setResult(saved ? JSON.parse(saved) as GuestPlannerResponse : null);
    } catch {
      setResult(null);
    }
  }, [stayId]);

  async function generate(existingPlan: string) {
    if (loading || disabled) return;
    setLoading(true);
    setError("");
    try {
      const next = await guestPlanner.create(existingPlan);
      setResult(next);
      window.sessionStorage.setItem(`vesper_guest_plan_${stayId}`, JSON.stringify(next));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create your plan. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="guest-planner-heading" className="rounded-3xl border border-gold-200 bg-gradient-to-br from-white via-sand-50 to-gold-50/50 p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-gold-100 p-3 text-gold-700"><Sparkles className="h-6 w-6" aria-hidden="true" /></span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-800">Make the most of your stay</p>
          <h2 id="guest-planner-heading" className="mt-1 font-serif text-2xl text-sage-950">Your AI day planner</h2>
          <p className="mt-1 text-sm text-sand-700">Share what you had in mind, or let us create a day around the resort for you.</p>
        </div>
      </div>

      <form className="mt-6 space-y-3" onSubmit={(event) => { event.preventDefault(); void generate(plan.trim()); }}>
        <label htmlFor="guest-plan" className="block text-sm font-semibold text-sage-900">I already have a plan</label>
        <textarea
          id="guest-plan"
          value={plan}
          onChange={(event) => setPlan(event.target.value)}
          maxLength={600}
          rows={2}
          disabled={disabled || loading}
          placeholder="For example: pool in the morning, spa later, then dinner"
          className="w-full rounded-xl border border-sand-300 bg-white px-4 py-3 text-sm text-sage-950 placeholder:text-sand-400 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20 disabled:opacity-60"
        />
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={!plan.trim() || disabled || loading} className="inline-flex items-center gap-2 rounded-xl bg-sage-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sage-900 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Improve my plan
          </button>
          <button type="button" onClick={() => void generate("")} disabled={disabled || loading} className="inline-flex items-center gap-2 rounded-xl border border-sand-300 bg-white px-4 py-2.5 text-sm font-semibold text-sage-800 hover:border-gold-500 hover:bg-gold-50 disabled:cursor-not-allowed disabled:opacity-50">
            <Compass className="h-4 w-4" /> I don&apos;t have a plan — make one
          </button>
        </div>
      </form>

      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {result && (
        <div className="mt-6 border-t border-sand-200 pt-5" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-800">Suggested for {result.day}</p>
          <p className="mt-1 text-sm text-sage-900">{result.summary}</p>
          {result.stops.length > 0 && (
            <ol className="mt-4 space-y-3">
              {result.stops.map((stop) => (
                <li key={`${stop.time}-${stop.amenity}`} className="flex gap-3 rounded-2xl border border-sand-200 bg-white p-4">
                  <div className="w-14 shrink-0 pt-0.5 text-sm font-bold text-sage-800">{stop.time}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-sage-950">{stop.amenity}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${stop.crowd === "Quieter" ? "bg-emerald-50 text-emerald-800" : stop.crowd === "Busier" ? "bg-amber-50 text-amber-800" : "bg-sand-100 text-sand-700"}`}>{stop.crowd} estimate</span>
                    </div>
                    <p className="mt-1 text-xs text-sand-700">{stop.reason}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-sand-600">
                      {stop.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{stop.location}</span>}
                      {stop.opening_hours && <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{stop.opening_hours}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-4 text-xs leading-relaxed text-sand-600">{result.crowd_note}</p>
        </div>
      )}
    </section>
  );
}
