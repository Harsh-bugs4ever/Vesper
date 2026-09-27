"use client";

import React from "react";
import {
  BellRing,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Sparkles,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface GuestOrderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
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
  } | null;
  onTrackOrder: () => void;
}

export function GuestOrderConfirmationModal({
  isOpen,
  onClose,
  order,
  onTrackOrder,
}: GuestOrderConfirmationModalProps) {
  if (!isOpen || !order) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-confirmation-heading"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sage-950/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-sand-300 bg-white shadow-2xl transition-all">
        {/* Top Header */}
        <div className="relative bg-sage-800 px-6 py-6 text-white text-center">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close confirmation modal"
            className="absolute top-4 right-4 rounded-full p-1.5 text-sand-300 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-emerald-300 ring-4 ring-white/10 backdrop-blur-md">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <h2
            id="order-confirmation-heading"
            className="mt-3 font-serif text-2xl font-bold tracking-tight text-sand-50"
          >
            Order Placed Successfully!
          </h2>
          <p className="mt-1 text-xs text-sand-200">
            Room {order.roomNumber} · Payment pending
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Prominent Delivery Time Message (20 to 30 mins) */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800">
              <Clock className="h-4 w-4 text-emerald-700 animate-pulse" />
              <span>Requested delivery target</span>
            </div>
            <p className="text-sm font-medium text-emerald-950">
              Your order has reached the hotel. Follow its live status below; delivery timing is confirmed by staff.
            </p>
            <div className="inline-block rounded-full bg-emerald-100/80 px-3 py-1 text-xs font-semibold text-emerald-900">
              Expected Arrival: {order.estimatedDeliveryTime}
            </div>
          </div>

          {/* 3-Step Live Kitchen Progress */}
          <div className="rounded-2xl border border-sand-200 bg-sand-50/50 p-4 space-y-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sand-500">
              Live Preparation Timeline
            </span>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="space-y-1">
                <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white text-[11px] font-bold">
                  ✓
                </div>
                <p className="font-semibold text-sage-950">Order placed</p>
                <p className="text-[10px] text-sand-500">Payment pending</p>
              </div>

              <div className="space-y-1">
                <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white text-[11px] font-bold ring-4 ring-amber-100 animate-pulse">
                  <Flame className="h-3.5 w-3.5" />
                </div>
                <p className="font-semibold text-amber-900">Kitchen Prep</p>
                <p className="text-[10px] text-amber-700 font-medium">20–30 mins</p>
              </div>

              <div className="space-y-1 opacity-60">
                <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full border border-sand-300 bg-white text-sand-600 text-[11px]">
                  3
                </div>
                <p className="font-medium text-sand-700">Room Delivery</p>
                <p className="text-[10px] text-sand-400">At your door</p>
              </div>
            </div>
          </div>

          {/* Order Summary Details */}
          <div className="rounded-2xl border border-sand-200 p-4 text-xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-sand-100 pb-2">
              <span className="font-semibold text-sage-900">Order #{order.id.slice(0, 8)}</span>
              <span className="font-mono font-bold text-sage-950">
                ₹{order.totalAmount.toLocaleString("en-IN")} (payment pending)
              </span>
            </div>

            <div className="space-y-1.5">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sand-700">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        item.is_veg === false ? "bg-rose-500" : "bg-emerald-500"
                      }`}
                    />
                    <span>{item.name}</span>
                  </span>
                  <span className="font-semibold tabular-nums">×{item.quantity}</span>
                </div>
              ))}
            </div>

            {order.note && (
              <p className="border-t border-sand-100 pt-2 text-[11px] text-sand-600 italic">
                Note: {order.note}
              </p>
            )}
          </div>

          {/* AI Tailored Notice */}
          {order.hasNonVeg && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <span className="font-semibold">AI Culinary Concierge Updated:</span>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  We noted your preference for delicious non-vegetarian dining. We have updated your dining menu with exclusive chef-crafted non-veg recommendations!
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button
              type="button"
              onClick={() => {
                onClose();
                onTrackOrder();
              }}
              className="flex-1 rounded-xl bg-sage-800 hover:bg-sage-900 text-white font-medium py-2.5 text-xs shadow-sm flex items-center justify-center gap-1.5"
            >
              <BellRing className="h-3.5 w-3.5" />
              <span>Track Live Status in Requests</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl border-sand-300 text-sage-800 hover:bg-sand-100 text-xs py-2.5"
            >
              Order More Items
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
