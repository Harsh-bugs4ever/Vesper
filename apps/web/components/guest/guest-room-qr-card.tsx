"use client";

import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Bed,
  Camera,
  Check,
  Compass,
  Copy,
  ExternalLink,
  KeyRound,
  Maximize2,
  Printer,
  QrCode,
  RefreshCw,
  Scan,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Scanner } from "@yudiel/react-qr-scanner";

import { VesperMark } from "@/components/layout/vesper-mark";
import { Button } from "@/components/ui/button";
import { auth, guestTokens, type GuestSession } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface DemoRoomOption {
  property_id: string;
  room_id: string;
  room_number: string;
  qr_secret: string;
  guest_name: string;
  category: string;
  floor: number;
  view: string;
}

export const DEMO_ROOM_OPTIONS: DemoRoomOption[] = [
  {
    property_id: "7b4c6e9a-5f32-4d1e-8b9a-1c3d5e7f9a2b",
    room_id: "8c5d7e0b-6f43-4e2f-9c0b-2d4e6f8a0b3c",
    room_number: "412",
    qr_secret: "secret_ocean_villa_412_demo",
    guest_name: "Aaditya Sharma",
    category: "Deluxe Ocean Villa",
    floor: 4,
    view: "Sunset Arabian Sea View",
  },
  {
    property_id: "7b4c6e9a-5f32-4d1e-8b9a-1c3d5e7f9a2b",
    room_id: "9d6e8f1c-7a54-4f3a-0d1c-3e5f7a9b1c4d",
    room_number: "204",
    qr_secret: "secret_palm_suite_204_demo",
    guest_name: "Sarah Jenkins",
    category: "Royal Heritage Suite",
    floor: 2,
    view: "Private Lagoon & Garden",
  },
  {
    property_id: "7b4c6e9a-5f32-4d1e-8b9a-1c3d5e7f9a2b",
    room_id: "0e7f9a2d-8b65-4a4b-1e2d-4f6a8b0c2d5e",
    room_number: "601",
    qr_secret: "secret_penthouse_601_demo",
    guest_name: "Vikram Singhania",
    category: "Presidential Beachfront Villa",
    floor: 6,
    view: "Panoramic Oceanfront Terrace",
  },
];

interface GuestRoomQrCardProps {
  onOpenSession?: (session: GuestSession) => void;
  sessionError?: string;
  className?: string;
}

export function GuestRoomQrCard({
  onOpenSession,
  sessionError,
  className,
}: GuestRoomQrCardProps) {
  const [selectedRoomIndex, setSelectedRoomIndex] = useState(0);
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [copied, setCopied] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);

  const selectedRoom = DEMO_ROOM_OPTIONS[selectedRoomIndex];

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const qrUrl = `${origin}/guest/room?property_id=${selectedRoom.property_id}&room_id=${selectedRoom.room_id}&qr_secret=${selectedRoom.qr_secret}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // ignore clipboard error
    }
  };

  const handleLaunchSession = async (room: DemoRoomOption = selectedRoom) => {
    setIsOpening(true);
    setScanStatus(null);
    try {
      // 1. Try real server authentication if backend is live
      const session = await auth.openGuestSession(
        room.property_id,
        room.room_id,
        room.qr_secret
      );
      if (onOpenSession) {
        onOpenSession(session);
      } else {
        window.location.href = `/guest/room?property_id=${room.property_id}&room_id=${room.room_id}&qr_secret=${room.qr_secret}`;
      }
    } catch (err) {
      console.warn("Live backend QR session unavailable, initializing demo room session", err);
      // 2. Self-contained fallback so demoing is never blocked
      const fallbackSession: GuestSession = {
        token: `vesper_guest_${room.room_number}_${Date.now()}`,
        expires_in: 86400,
        room_number: room.room_number,
        property_name: "Vesper Luxury Resort & Spa",
        guest_name: room.guest_name,
        stay_id: `stay-${room.room_number}`,
      };
      guestTokens.set(fallbackSession.token);
      window.sessionStorage.setItem("vesper_guest_room", JSON.stringify(fallbackSession));
      if (onOpenSession) {
        onOpenSession(fallbackSession);
      } else {
        window.location.reload();
      }
    } finally {
      setIsOpening(false);
    }
  };

  const handleCameraScan = (codes: { rawValue: string }[]) => {
    if (!codes || codes.length === 0) return;
    const raw = codes[0].rawValue;
    setScanStatus(`Scanned code detected: ${raw.slice(0, 40)}...`);

    try {
      const url = new URL(raw, origin);
      const property = url.searchParams.get("property_id");
      const room = url.searchParams.get("room_id");
      const secret = url.searchParams.get("qr_secret");
      if (property && room && secret) {
        setShowScanner(false);
        setIsOpening(true);
        void auth
          .openGuestSession(property, room, secret)
          .then((opened) => {
            if (onOpenSession) {
              onOpenSession(opened);
            } else {
              window.location.href = raw;
            }
          })
          .catch(() => {
            // fallback
            const match = DEMO_ROOM_OPTIONS.find((r) => r.room_id === room) || selectedRoom;
            handleLaunchSession(match);
          });
      }
    } catch {
      // not a full URL, attempt matching room ID directly
      const match = DEMO_ROOM_OPTIONS.find((r) => raw.includes(r.room_number));
      if (match) {
        setShowScanner(false);
        handleLaunchSession(match);
      }
    }
  };

  return (
    <div className={cn("mx-auto max-w-2xl space-y-6", className)}>
      {/* Luxury Nightstand Card Frame */}
      <div className="relative overflow-hidden rounded-3xl border border-sand-200 bg-white p-6 shadow-xl shadow-sand-900/5 sm:p-10">
        {/* Subtle Decorative Background Grain */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-sand-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-sage-100/40 blur-3xl" />

        {/* Card Header & Brand */}
        <div className="relative text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-800 text-sand-100 shadow-md shadow-sage-900/10">
            <VesperMark className="h-6 w-6" />
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.28em] text-sand-600">
            Vesper Luxury Resort & Spa
          </p>
          <h1 className="mt-1 font-serif text-3xl text-sage-950 sm:text-4xl">
            In-Room Guest Portal
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-sand-600">
            Scan your nightstand tent QR code with any smartphone camera to open your stay, request room service, and talk to your AI Concierge.
          </p>
        </div>

        {/* Room Preset Switcher */}
        <div className="relative mt-8">
          <label className="block text-center text-xs font-medium uppercase tracking-wider text-sand-500">
            Select Demo Room Nightstand
          </label>
          <div className="mt-2.5 flex flex-wrap justify-center gap-2">
            {DEMO_ROOM_OPTIONS.map((room, idx) => {
              const isSelected = idx === selectedRoomIndex;
              return (
                <button
                  key={room.room_number}
                  type="button"
                  onClick={() => setSelectedRoomIndex(idx)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all",
                    isSelected
                      ? "bg-sage-800 text-white shadow-sm ring-2 ring-sage-800 ring-offset-2"
                      : "border border-sand-200 bg-sand-50/60 text-sand-700 hover:border-sand-300 hover:bg-sand-100"
                  )}
                >
                  <Bed className="h-3.5 w-3.5" />
                  <span>Room {room.room_number}</span>
                  <span className={cn("text-[10px]", isSelected ? "text-sage-200" : "text-sand-400")}>
                    · {room.category.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nightstand Tent Plaque (Visual Card) */}
        <div className="relative mt-7 rounded-2xl border-2 border-sand-200/90 bg-gradient-to-b from-sand-50/70 to-white p-6 text-center shadow-inner sm:p-8">
          {/* Room Title Strip */}
          <div className="flex items-center justify-between border-b border-sand-200/70 pb-4">
            <div className="text-left">
              <span className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2.5 py-0.5 text-[11px] font-medium text-sage-800">
                <ShieldCheck className="h-3 w-3" /> Stay Verified
              </span>
              <p className="mt-1 font-serif text-xl font-bold text-sage-950 sm:text-2xl">
                Room {selectedRoom.room_number}
              </p>
              <p className="text-xs text-sand-600">
                {selectedRoom.category} · {selectedRoom.view}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wider text-sand-500">
                Guest in Residence
              </span>
              <p className="font-serif text-sm font-semibold text-sage-900">
                {selectedRoom.guest_name}
              </p>
              <p className="text-[11px] text-sand-500">Floor {selectedRoom.floor}</p>
            </div>
          </div>

          {/* High-Resolution SVG QR Code Display */}
          <div className="relative my-6 flex flex-col items-center justify-center">
            <div className="group relative rounded-2xl border border-sand-300 bg-white p-4 shadow-md transition-all hover:border-sage-600 hover:shadow-lg">
              <QRCodeSVG
                value={qrUrl}
                size={220}
                level="H"
                includeMargin={true}
                bgColor="#FFFFFF"
                fgColor="#1E2A27"
              />
              <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-medium text-sand-600">
                <Scan className="h-3.5 w-3.5 text-sage-700" />
                <span>Point your phone camera to scan</span>
              </div>
            </div>
          </div>

          {/* Direct Launch Actions */}
          <div className="space-y-3">
            <Button
              type="button"
              disabled={isOpening}
              onClick={() => handleLaunchSession(selectedRoom)}
              className="w-full bg-sage-800 py-6 text-base font-medium text-white shadow-md shadow-sage-900/15 hover:bg-sage-900"
            >
              {isOpening ? (
                <>
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  Connecting Room {selectedRoom.room_number}…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5 text-amber-300" />
                  Open Room {selectedRoom.room_number} Portal
                </>
              )}
            </Button>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sand-200 bg-white px-3 py-1.5 font-medium text-sand-700 hover:bg-sand-50"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Link Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy QR URL</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowScanner(!showScanner)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sand-200 bg-white px-3 py-1.5 font-medium text-sand-700 hover:bg-sand-50"
              >
                <Camera className="h-3.5 w-3.5 text-sage-700" />
                <span>{showScanner ? "Hide Camera" : "Scan via Camera"}</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sand-200 bg-white px-3 py-1.5 font-medium text-sand-700 hover:bg-sand-50"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Standee</span>
              </button>
            </div>
          </div>

          {/* Active Camera QR Scanner Drawer / Box */}
          {showScanner && (
            <div className="mt-6 overflow-hidden rounded-xl border border-sand-300 bg-black/90 p-4 text-white">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium text-sand-200">
                  Align camera with a physical nightstand QR code:
                </p>
                <button
                  type="button"
                  onClick={() => setShowScanner(false)}
                  className="rounded p-1 text-sand-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mx-auto max-w-xs overflow-hidden rounded-lg">
                <Scanner
                  onScan={handleCameraScan}
                  onError={(err) => console.log("Scanner status", err)}
                />
              </div>
              {scanStatus && (
                <p className="mt-2 text-center text-xs text-amber-300">{scanStatus}</p>
              )}
            </div>
          )}
        </div>

        {/* Security & Secret Explainer Footer */}
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-sand-200/60 bg-sand-50/40 p-3.5 text-left text-xs text-sand-600">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-sage-700" />
          <p>
            <strong className="font-semibold text-sage-950">Zero-Login QR Security:</strong> Each nightstand QR encodes a high-entropy secret rotated at checkout. Guests scan once for instantaneous access without passwords or room card apps.
          </p>
        </div>

        {sessionError && (
          <p role="alert" className="mt-4 text-center text-xs font-medium text-rose-700">
            {sessionError}
          </p>
        )}
      </div>
    </div>
  );
}
