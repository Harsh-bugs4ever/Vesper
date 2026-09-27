"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";

import { GuestRoomQrCard } from "@/components/guest/guest-room-qr-card";

export default function GuestQrPortalPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gradient-to-b from-sand-100/60 via-sand-50 to-sage-50/40 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/guest/room"
            className="inline-flex items-center gap-2 rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-xs font-medium text-sand-700 shadow-sm hover:bg-sand-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Go to Room Portal</span>
          </Link>

          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
            <Sparkles className="h-3 w-3 text-amber-600" />
            Demo Nightstand QR Generator
          </span>
        </div>

        <GuestRoomQrCard
          onOpenSession={(session) => {
            try {
              window.sessionStorage.setItem("vesper_guest_room", JSON.stringify(session));
            } catch {
              /* ignore */
            }
            router.push("/guest/room");
          }}
        />
      </div>
    </main>
  );
}
