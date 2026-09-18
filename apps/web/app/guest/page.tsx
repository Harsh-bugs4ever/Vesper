"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Utensils,
  Sparkles,
  MessageSquare,
  Clock,
  ArrowRightLeft,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { RoleSwitcherModal } from "@/components/layout/role-switcher-modal";

export default function GuestPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [orderSent, setOrderSent] = useState(false);

  const handleOrderBreakfast = () => {
    setOrderSent(true);
    showToast({
      title: "Order Placed: 2x Club Sandwiches & Coffee",
      description: "Kitchen has accepted your request. SLA timer started: 25 mins.",
      type: "success",
    });
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-sand-950 pb-16">
      {/* Luxury Guest Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-sand-200 px-4 py-3 shadow-soft">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sage-700 flex items-center justify-center text-gold-300 font-serif font-bold text-xl">
              V
            </div>
            <div>
              <h1 className="text-sm font-bold text-sand-950 font-serif leading-none">
                Madh Island Beach Resort
              </h1>
              <span className="text-[11px] text-sage-800 font-semibold flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Room 412 · Deluxe Ocean View
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="gold" className="text-[10px] py-0 px-2">
              Guest QR Token
            </Badge>
            <button
              onClick={() => setShowRoleModal(true)}
              className="p-1.5 rounded-lg border border-sand-200 bg-sand-50 text-sand-600 hover:text-sand-900"
              title="Switch Perspective"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Guest Main Content */}
      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* Welcome Card */}
        <div className="bg-gradient-to-br from-sage-700 via-sage-800 to-sage-900 text-white p-5 rounded-2xl shadow-card relative overflow-hidden">
          <div className="relative z-10 space-y-1.5">
            <span className="text-[11px] font-semibold text-gold-300 uppercase tracking-wider">
              Good Morning · Namaste
            </span>
            <h2 className="text-2xl font-bold font-serif">Welcome to Room 412</h2>
            <p className="text-xs text-sage-100 leading-relaxed">
              Order dining, request housekeeping, or ask your AI Concierge — without installing an app or logging in.
            </p>
          </div>
        </div>

        {/* Quick Service Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card
            onClick={handleOrderBreakfast}
            className="cursor-pointer hover:border-gold-300 hover:shadow-card transition-all"
          >
            <CardContent className="p-4 flex flex-col justify-between h-28">
              <div className="p-2 rounded-lg bg-gold-50 text-gold-700 w-fit">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-sand-950">In-Room Dining</h4>
                <p className="text-[10px] text-sand-500">Club sandwiches, coffee</p>
              </div>
            </CardContent>
          </Card>

          <Card
            onClick={() =>
              showToast({
                title: "Housekeeping Request Dispatched",
                description: "Fresh towels and room freshening queued for floor attendant.",
                type: "success",
              })
            }
            className="cursor-pointer hover:border-sage-300 hover:shadow-card transition-all"
          >
            <CardContent className="p-4 flex flex-col justify-between h-28">
              <div className="p-2 rounded-lg bg-sage-50 text-sage-700 w-fit">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-sand-950">Housekeeping</h4>
                <p className="text-[10px] text-sand-500">Towels, toiletries, cleaning</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Request Live Status */}
        {orderSent && (
          <Card className="border-emerald-300 bg-emerald-50/40 p-4 animate-in fade-in">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">
                    Breakfast Order In Preparation
                  </h4>
                  <p className="text-[11px] text-emerald-800">
                    2x Club Sandwiches · Est. arrival 09:45 AM (Kitchen SLA running)
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* AI Concierge Chat Preview */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gold-100 text-gold-800">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-sand-950">Vesper AI Concierge</h4>
                <p className="text-[10px] text-sand-500">RAG model · Instant answers</p>
              </div>
            </div>
            <Badge variant="sage" className="text-[10px]">
              Available 24/7
            </Badge>
          </div>

          <div className="p-3 rounded-xl bg-sand-50 border border-sand-200 text-xs text-sand-700 space-y-2">
            <div className="bg-white p-2 rounded-lg border border-sand-200 text-right text-sand-900 font-medium">
              "What time does the oceanfront infinity pool close?"
            </div>
            <div className="p-2 text-sage-900 font-medium">
              "The infinity pool at Madh Island Beach Resort is open until 8:30 PM this evening. Towels and pool bar drinks are complimentary for Ocean Wing guests!"
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              placeholder="Ask about spa timings, dinner..."
              className="flex-1 px-3 py-2 rounded-lg border border-sand-200 text-xs bg-white focus:outline-none focus:border-sage-500"
            />
            <Button size="sm" variant="default">
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Card>

        {/* Return to Admin Link */}
        <div className="text-center pt-2">
          <button
            onClick={() => router.push("/admin")}
            className="text-xs font-semibold text-sage-700 hover:text-sage-900 hover:underline"
          >
            &larr; Return to Resort Admin Deck
          </button>
        </div>
      </main>

      <RoleSwitcherModal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
      />
    </div>
  );
}
