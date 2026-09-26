"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
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
  TriangleAlert,
  X,
} from "lucide-react";

const Scanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((module) => module.Scanner),
  { ssr: false, loading: () => <p className="py-6 text-sm text-sand-600">Opening camera…</p> },
);

import { VesperMark } from "@/components/layout/vesper-mark";
import { Button } from "@/components/ui/button";
import { api, auth, type GuestSession } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface ActiveRoomOption {
  property_id: string;
  property_name: string;
  room_id: string;
  room_number: string;
  qr_secret: string;
  guest_name: string;
  category: string;
  floor: number;
  stay_id: string;
}

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
  const [activeRooms, setActiveRooms] = useState<ActiveRoomOption[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomsError, setRoomsError] = useState("");
  const [selectedRoomIndex, setSelectedRoomIndex] = useState(0);
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [copied, setCopied] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const loadActiveRooms = async () => {
    setLoadingRooms(true);
    setRoomsError("");
    try {
      const rooms = await api.get<ActiveRoomOption[]>("/guest/active-rooms");
      setActiveRooms(rooms || []);
      setSelectedRoomIndex(0);
    } catch (err) {
      setRoomsError(
        err instanceof Error ? err.message : "Could not fetch active checked-in rooms."
      );
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    void loadActiveRooms();
  }, []);

  const selectedRoom = activeRooms[selectedRoomIndex] ?? null;

  const qrUrl = selectedRoom
    ? `${origin}/guest/room?property_id=${selectedRoom.property_id}&room_id=${selectedRoom.room_id}&qr_secret=${selectedRoom.qr_secret}`
    : "";

  const handleCopyLink = async () => {
    if (!qrUrl) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // ignore clipboard error
    }
  };

  const handleLaunchSession = async (room: ActiveRoomOption | null) => {
    if (!room) return;
    setIsOpening(true);
    setActionError(null);
    setScanStatus(null);
    try {
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
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to open guest session. Stay may have expired or checked out."
      );
    } finally {
      setIsOpening(false);
    }
  };

  const handleCameraScan = (codes: { rawValue: string }[]) => {
    if (!codes || codes.length === 0) return;
    const raw = codes[0].rawValue;
    setScanStatus(`Scanned QR code detected...`);

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
          .catch((err) => {
            setActionError(
              err instanceof Error ? err.message : "Invalid or expired QR code scanned."
            );
          })
          .finally(() => {
            setIsOpening(false);
          });
      } else {
        setActionError("Scanned QR does not contain valid Vesper room credentials.");
      }
    } catch {
      setActionError("Scanned content is not a valid URL.");
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
            Scan your nightstand QR code to open your verified stay, request room service, and track service requests in real time.
          </p>
        </div>

        {/* Room Preset Switcher */}
        {loadingRooms ? (
          <div className="mt-8 flex flex-col items-center justify-center gap-2 py-6 text-sand-600">
            <RefreshCw className="h-5 w-5 animate-spin text-sage-700" />
            <p className="text-xs">Loading active in-house rooms…</p>
          </div>
        ) : roomsError ? (
          <div className="mt-8 rounded-2xl bg-rose-50 p-4 text-center text-xs text-rose-700">
            <TriangleAlert className="mx-auto mb-1 h-5 w-5" />
            <p>{roomsError}</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={loadActiveRooms}
                className="font-semibold underline hover:text-rose-900"
              >
                Retry
              </button>
              <span className="text-sand-400">·</span>
              <button
                type="button"
                onClick={() => {
                  const demoSession: GuestSession = {
                    property_id: "demo-vesper-resort",
                    property_name: "Vesper Beach Resort & Spa",
                    room_id: "room-405",
                    room_number: "405",
                    stay_id: "stay-demo-405",
                    guest_name: "Rohan Mehta",
                    token: "demo-token-room-405",
                  };
                  guestTokens.set(demoSession.token);
                  onOpenSession?.(demoSession);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-sage-800 px-3 py-1.5 font-medium text-white hover:bg-sage-900 transition"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>Launch Room 405 (Demo)</span>
              </button>
            </div>
          </div>
        ) : activeRooms.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-sand-200 bg-sand-50/60 p-6 text-center">
            <Bed className="mx-auto mb-2 h-6 w-6 text-sand-500" />
            <p className="text-sm font-medium text-sage-900">No active in-house stays</p>
            <p className="mt-1 text-xs text-sand-600">
              Check in a guest from the Front Desk to generate real nightstand QR codes.
            </p>
            <button
              type="button"
              onClick={loadActiveRooms}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-sand-300 bg-white px-3 py-1.5 text-xs font-medium text-sage-800 shadow-sm hover:bg-sand-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh Rooms</span>
            </button>
          </div>
        ) : (
          <div className="relative mt-8">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wider text-sand-500">
                In-House Stay Nightstands ({activeRooms.length})
              </label>
              <button
                type="button"
                onClick={loadActiveRooms}
                className="inline-flex items-center gap-1 text-xs text-sage-700 hover:text-sage-950"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Refresh</span>
              </button>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {activeRooms.map((room, idx) => {
                const isSelected = idx === selectedRoomIndex;
                return (
                  <button
                    key={room.stay_id}
                    type="button"
                    onClick={() => {
                      setSelectedRoomIndex(idx);
                      setActionError(null);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all",
                      isSelected
                        ? "bg-sage-800 text-white shadow-sm ring-2 ring-sage-800 ring-offset-2"
                        : "border border-sand-200 bg-sand-50/60 text-sand-700 hover:border-sand-300 hover:bg-sand-100"
                    )}
                  >
                    <Bed className="h-3.5 w-3.5" />
                    <span>Room {room.room_number}</span>
                    <span
                      className={cn(
                        "text-[10px]",
                        isSelected ? "text-sage-200" : "text-sand-400"
                      )}
                    >
                      · {room.guest_name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Nightstand Tent Plaque (Visual Card) */}
        {selectedRoom && (
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
                  {selectedRoom.category} · Floor {selectedRoom.floor}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] uppercase tracking-wider text-sand-500">
                  Guest in Residence
                </span>
                <p className="font-serif text-sm font-semibold text-sage-900">
                  {selectedRoom.guest_name}
                </p>
                <p className="text-[11px] text-emerald-700 font-medium">Active In-House</p>
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
        )}

        {/* Security & Secret Explainer Footer */}
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-sand-200/60 bg-sand-50/40 p-3.5 text-left text-xs text-sand-600">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-sage-700" />
          <p>
            <strong className="font-semibold text-sage-950">Zero-Login QR Security:</strong> Each nightstand QR encodes a high-entropy secret rotated at checkout. Guests scan once for instantaneous access without passwords or room card apps.
          </p>
        </div>

        {actionError && (
          <p role="alert" className="mt-4 text-center text-xs font-medium text-rose-700">
            {actionError}
          </p>
        )}

        {sessionError && (
          <p role="alert" className="mt-4 text-center text-xs font-medium text-rose-700">
            {sessionError}
          </p>
        )}
      </div>
    </div>
  );
}
