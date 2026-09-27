"use client";

import React, { useState } from "react";
import {
  Bed,
  Car,
  CheckCircle2,
  Clock,
  Compass,
  Crown,
  Leaf,
  LogOut,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  VolumeX,
  Waves,
  Zap,
} from "lucide-react";
import {
  type GuestPersona,
  DEMO_GUEST_PREFERENTIAL,
  DEMO_GUEST_PRESIDENTIAL,
  addDemoRequest,
  resetDemoGuestData,
} from "@/lib/demo/guest-demo";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface GuestDemoBannerProps {
  persona: GuestPersona;
  onSwitchPersona: (persona: GuestPersona) => void;
  onResetDemo: () => void;
  onExitDemo: () => void;
  onOpenConcierge?: () => void;
  onQuickAddJainMeal?: () => void;
}

export function GuestDemoBanner({
  persona,
  onSwitchPersona,
  onResetDemo,
  onExitDemo,
  onOpenConcierge,
  onQuickAddJainMeal,
}: GuestDemoBannerProps) {
  const { showToast } = useToast();
  const [triggeringCheckout, setTriggeringCheckout] = useState(false);

  const isRohan = persona.roomNumber === "405";

  const handleSimulateLateCheckout = () => {
    setTriggeringCheckout(true);
    try {
      addDemoRequest(persona.roomNumber, {
        kind: "other",
        note: `Express 2:00 PM Late Checkout request submitted via Presentation Demo trigger. Pre-approved by GM Arjun Mehta (${persona.tier} privilege).`,
      });
      showToast({
        title: "⚡ Presentation Trigger: Late Checkout Confirmed",
        description: `Express 2:00 PM checkout granted for Suite ${persona.roomNumber}. Keycards automatically updated.`,
        type: "success",
      });
    } finally {
      setTimeout(() => setTriggeringCheckout(false), 600);
    }
  };

  return (
    <aside
      aria-label="Presentation Demo Controls"
      className="relative overflow-hidden rounded-3xl border-2 border-gold-400/60 bg-gradient-to-br from-sand-900 via-sage-950 to-sand-950 p-6 text-white shadow-xl shadow-sage-950/20 sm:p-7"
    >
      {/* Decorative luxury background glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        {/* Left Column: Guest Identity & VIP Tier */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/50 bg-gold-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gold-200">
              <Crown className="h-3.5 w-3.5 text-gold-300" />
              Preferential Demo Mode
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-sand-200">
              Room {persona.roomNumber} · {persona.category}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3" />
              Verified Stay Active
            </span>
          </div>

          <div>
            <h2 className="font-serif text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Guest: {persona.name}
            </h2>
            <p className="mt-1 text-xs text-sand-300 sm:text-sm">
              <strong className="text-gold-200">{persona.tier}</strong> · {persona.propertyName}
            </p>
          </div>

          {/* Active VIP Preferences Strip */}
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-sand-400">
              Active Guest Preferences &amp; Perks
            </p>
            <div className="flex flex-wrap gap-2">
              {persona.preferences.map((pref) => {
                const IconComponent =
                  pref.iconName === "Waves"
                    ? Waves
                    : pref.iconName === "Clock"
                    ? Clock
                    : pref.iconName === "Leaf"
                    ? Leaf
                    : pref.iconName === "Bed"
                    ? Bed
                    : pref.iconName === "VolumeX"
                    ? VolumeX
                    : pref.iconName === "Car"
                    ? Car
                    : pref.iconName === "UtensilsCrossed"
                    ? UtensilsCrossed
                    : pref.iconName === "Compass"
                    ? Compass
                    : Sparkles;

                return (
                  <span
                    key={pref.label}
                    title={pref.desc}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sand-600/40 bg-sand-900/60 px-2.5 py-1 text-xs text-sand-200 backdrop-blur"
                  >
                    <IconComponent className="h-3 w-3 text-gold-400" />
                    <span>{pref.label}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Presentation Triggers & Suite Switcher */}
        <div className="flex flex-col gap-3 lg:items-end">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sand-400">
            Presentation Quick Actions
          </p>

          <div className="flex flex-wrap gap-2">
            {/* Simulate Late Checkout Trigger */}
            <button
              type="button"
              disabled={triggeringCheckout}
              onClick={handleSimulateLateCheckout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gold-400/50 bg-gradient-to-r from-gold-600/30 to-gold-500/20 px-3.5 py-2 text-xs font-semibold text-gold-200 shadow-sm transition hover:bg-gold-500/30 active:scale-95 disabled:opacity-50"
            >
              <Zap className={`h-3.5 w-3.5 text-gold-300 ${triggeringCheckout ? "animate-spin" : ""}`} />
              <span>Simulate Late Checkout (2 PM)</span>
            </button>

            {/* Quick Add Jain Meal (if Rohan 405) */}
            {isRohan && onQuickAddJainMeal && (
              <button
                type="button"
                onClick={onQuickAddJainMeal}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3.5 py-2 text-xs font-semibold text-emerald-200 shadow-sm transition hover:bg-emerald-900/50 active:scale-95"
              >
                <Leaf className="h-3.5 w-3.5 text-emerald-400" />
                <span>Quick Add Jain Dinner</span>
              </button>
            )}

            {/* Open AI Concierge Drawer */}
            {onOpenConcierge && (
              <button
                type="button"
                onClick={onOpenConcierge}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sand-600/40 bg-white/10 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-white/20 active:scale-95"
              >
                <Sparkles className="h-3.5 w-3.5 text-gold-300" />
                <span>Open AI Concierge</span>
              </button>
            )}
          </div>

          {/* Persona Switcher & Controls */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                if (isRohan) {
                  onSwitchPersona(DEMO_GUEST_PRESIDENTIAL);
                } else {
                  onSwitchPersona(DEMO_GUEST_PREFERENTIAL);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sand-700 bg-sand-900/80 px-3 py-1.5 text-xs font-medium text-sand-300 transition hover:bg-sand-800 hover:text-white"
            >
              <RefreshCw className="h-3 w-3 text-gold-400" />
              <span>{isRohan ? "Switch to Suite 501 (Presidential)" : "Switch to Suite 405 (Preferential)"}</span>
            </button>

            <button
              type="button"
              onClick={onResetDemo}
              title="Reset all demo orders and conversation to initial state"
              className="inline-flex items-center gap-1.5 rounded-xl border border-sand-700 bg-sand-900/80 px-3 py-1.5 text-xs font-medium text-sand-300 transition hover:bg-sand-800 hover:text-white"
            >
              <RotateCcw className="h-3 w-3 text-sand-400" />
              <span>Reset State</span>
            </button>

            <button
              type="button"
              onClick={onExitDemo}
              title="Return to standard QR Scanner screen"
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-800/60 bg-rose-950/40 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-900/50"
            >
              <LogOut className="h-3 w-3 text-rose-400" />
              <span>Exit Demo</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
