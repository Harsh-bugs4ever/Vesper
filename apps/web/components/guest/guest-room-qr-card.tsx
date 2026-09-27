"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { auth, type GuestSession } from "@/lib/api";
import { cn } from "@/lib/utils";

const Scanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((module) => module.Scanner),
  { ssr: false, loading: () => <p>Opening camera…</p> },
);

interface Props {
  onOpenSession?: (session: GuestSession) => void;
  sessionError?: string;
  className?: string;
}

export function GuestRoomQrCard({ onOpenSession, sessionError, className }: Props) {
  const [scanning, setScanning] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  const handleScan = (codes: { rawValue: string }[]) => {
    if (opening || !codes.length) return;
    setOpening(true);
    setError("");
    try {
      const url = new URL(codes[0].rawValue);
      if (url.origin !== window.location.origin || url.pathname !== "/guest/room") {
        throw new Error("This is not a Vesper room QR code.");
      }
      const property = url.searchParams.get("property_id");
      const room = url.searchParams.get("room_id");
      const secret = url.searchParams.get("qr_secret");
      if (!property || !room || !secret) throw new Error("Room QR code is incomplete.");
      void auth.openGuestSession(property, room, secret).then((session) => {
        setScanning(false);
        if (onOpenSession) onOpenSession(session);
        else window.location.assign(url.pathname + url.search);
      }).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not open room session.");
      }).finally(() => setOpening(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid QR code.");
      setOpening(false);
    }
  };

  return (
    <section className={cn("mx-auto max-w-md rounded-3xl border border-sand-200 bg-white p-6 text-center shadow-sm", className)}>
      <h2 className="font-serif text-2xl font-semibold text-sage-950">Open your room</h2>
      <p className="mt-2 text-sm text-sand-700">Scan the QR code provided in your room. Access is available only during your stay.</p>
      <Button type="button" className="mt-5" onClick={() => setScanning((value) => !value)} disabled={opening}>
        {scanning ? "Close camera" : "Scan room QR"}
      </Button>
      {scanning && <div className="mx-auto mt-5 max-w-xs"><Scanner onScan={handleScan} onError={() => setError("Camera unavailable. Open the room QR link directly.")} /></div>}
      {(error || sessionError) && <p role="alert" className="mt-4 text-sm text-rose-700">{error || sessionError}</p>}
    </section>
  );
}
