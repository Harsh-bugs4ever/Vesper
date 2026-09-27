"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowRight,
  BedDouble,
  Check,
  Copy,
  Crown,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UtensilsCrossed,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  auth,
  guestTokens,
  type DemoRoomQrInfo,
  type GuestSession,
} from "@/lib/api";
import {
  DEMO_GUEST_PREFERENTIAL,
  DEMO_GUEST_PRESIDENTIAL,
  createGuestSessionFromPersona,
} from "@/lib/demo/guest-demo";
import { cn } from "@/lib/utils";

const Scanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((module) => module.Scanner),
  {
    ssr: false,
    loading: () => (
      <p className="py-4 text-xs font-medium text-sand-600">Opening camera scanner…</p>
    ),
  }
);

interface Props {
  onOpenSession?: (session: GuestSession) => void;
  sessionError?: string;
  className?: string;
}

export function GuestRoomQrCard({ onOpenSession, sessionError, className }: Props) {
  const [roomInfo, setRoomInfo] = useState<DemoRoomQrInfo | null>(null);
  const [availableRooms, setAvailableRooms] = useState<DemoRoomQrInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [customHost, setCustomHost] = useState("");
  const [showNetworkSettings, setShowNetworkSettings] = useState(false);

  // 1-Click Launch Presentation Demo Personas
  const handleLaunchDemo = (persona = DEMO_GUEST_PREFERENTIAL) => {
    const session = createGuestSessionFromPersona(persona);
    guestTokens.set(session.token);
    if (onOpenSession) {
      onOpenSession(session);
    } else if (typeof window !== "undefined") {
      window.sessionStorage.setItem("vesper_guest_room", JSON.stringify(session));
      window.location.assign("/guest/room");
    }
  };

  // Fetch verified active checked-in room credentials from backend
  const loadDemoRoom = async () => {
    setLoading(true);
    setError("");
    try {
      const room = await auth.getDemoRoomQr();
      setRoomInfo(room);
      try {
        const allRooms = await auth.getDemoRooms();
        if (allRooms && allRooms.length > 0) {
          setAvailableRooms(allRooms);
        }
      } catch {
        // Ignore multi-room listing error
      }
    } catch (err) {
      console.warn("Could not fetch active room from backend, using default fallback:", err);
      setRoomInfo({
        property_id: "00000000-0000-0000-0000-000000000001",
        property_name: "Vesper Luxury Resort & Spa",
        room_id: "00000000-0000-0000-0000-000000000412",
        room_number: "412",
        qr_secret: "vesper_demo_room_secret",
        guest_name: "Alex Rivera",
        category: "Ocean View Deluxe Suite",
        floor: 4,
        stay_id: "stay_demo_001",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDemoRoom();
  }, []);

  // Compute the URL encoded in the QR code
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const effectiveHost = customHost.trim() || origin;

  const qrUrl = roomInfo
    ? `${effectiveHost}/guest/room?property_id=${roomInfo.property_id}&room_id=${roomInfo.room_id}&qr_secret=${roomInfo.qr_secret}`
    : "";

  // Handle camera scan result
  const handleScan = (codes: { rawValue: string }[]) => {
    if (opening || !codes.length) return;
    setOpening(true);
    setError("");
    try {
      const raw = codes[0].rawValue;
      let property = roomInfo?.property_id || "00000000-0000-0000-0000-000000000001";
      let room = roomInfo?.room_id || "00000000-0000-0000-0000-000000000412";
      let secret = roomInfo?.qr_secret || "vesper_demo_room_secret";

      if (raw.includes("property_id=")) {
        try {
          const parsed = new URL(raw, origin);
          property = parsed.searchParams.get("property_id") || property;
          room = parsed.searchParams.get("room_id") || room;
          secret = parsed.searchParams.get("qr_secret") || secret;
        } catch {
          // ignore URL parse errors
        }
      }

      void auth
        .openGuestSession(property, room, secret)
        .then((session) => {
          setScanning(false);
          try {
            window.sessionStorage.setItem("vesper_guest_room", JSON.stringify(session));
          } catch {
            /* ignore */
          }
          if (onOpenSession) {
            onOpenSession(session);
          } else {
            window.location.assign("/guest/room");
          }
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Could not open guest room session.");
        })
        .finally(() => setOpening(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid QR code.");
      setOpening(false);
    }
  };

  // 1-Click direct demo entrance without needing phone camera
  const handleDirectEnter = async () => {
    if (!roomInfo || opening) return;
    setOpening(true);
    setError("");
    try {
      const session = await auth.openGuestSession(
        roomInfo.property_id,
        roomInfo.room_id,
        roomInfo.qr_secret
      );
      try {
        window.sessionStorage.setItem("vesper_guest_room", JSON.stringify(session));
      } catch {
        /* ignore */
      }
      if (onOpenSession) {
        onOpenSession(session);
      } else {
        window.location.assign("/guest/room");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not open guest room session."
      );
    } finally {
      setOpening(false);
    }
  };

  const handleCopyLink = () => {
    if (!qrUrl) return;
    void navigator.clipboard.writeText(qrUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={cn("mx-auto max-w-xl space-y-6", className)}>
      {/* 1. Quick Presentation VIP Demo Mode */}
      <section className="overflow-hidden rounded-3xl border-2 border-gold-300/80 bg-gradient-to-br from-sand-900 via-sage-950 to-sand-950 p-6 text-white shadow-xl shadow-sage-950/20 sm:p-7">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-gold-400/40 bg-gold-500/20 text-gold-300">
            <Crown className="h-4 w-4" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300">
            VIP Presentation Mode
          </span>
        </div>

        <h2 className="mt-3 font-serif text-2xl font-bold sm:text-3xl">
          Preview Guest Experience
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-sand-300 sm:text-sm">
          Launch a verified luxury room session instantly. Showcase in-room dining, preferential VIP perks, live order tracking, and the autonomous AI concierge.
        </p>

        <div className="mt-5 space-y-3">
          {/* Preferential Gold Elite Demo */}
          <button
            type="button"
            onClick={() => handleLaunchDemo(DEMO_GUEST_PREFERENTIAL)}
            className="group relative flex w-full items-center justify-between rounded-2xl border border-gold-400/60 bg-gradient-to-r from-gold-500/30 via-gold-500/20 to-transparent p-4 text-left transition hover:border-gold-300 hover:bg-gold-500/30 active:scale-[0.99]"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  Rohan Mehta · Suite 405
                </span>
                <span className="rounded-full bg-gold-400/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold-200">
                  Gold Elite VIP
                </span>
              </div>
              <p className="mt-1 text-xs text-sand-300">
                Executive Ocean Suite · Pre-approved 2 PM late checkout &amp; Jain preferences
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-gold-300 transition-transform group-hover:translate-x-1" />
          </button>

          {/* Presidential Villa Demo */}
          <button
            type="button"
            onClick={() => handleLaunchDemo(DEMO_GUEST_PRESIDENTIAL)}
            className="group relative flex w-full items-center justify-between rounded-2xl border border-sand-700/80 bg-white/5 p-4 text-left transition hover:border-sand-500 hover:bg-white/10 active:scale-[0.99]"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  Meera Kapoor · Villa 501
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                  Presidential Villa
                </span>
              </div>
              <p className="mt-1 text-xs text-sand-300">
                Top Floor Villa · Private plunge pool, 24/7 butler service &amp; helipad access
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-sand-400 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      {/* 2. Physical In-Room Nightstand QR Code & Camera Scanner */}
      <section className="overflow-hidden rounded-3xl border border-sand-300/80 bg-gradient-to-b from-white to-sand-50/50 p-4 sm:p-6 lg:p-8 shadow-xl shadow-sage-950/5">
        {/* Top Resort Banner */}
        <div className="flex items-center justify-between border-b border-sand-200/80 pb-3 sm:pb-4">
          <div className="flex items-center gap-1.5 sm:gap-2 text-sage-800">
            <QrCode className="h-4 w-4 sm:h-5 sm:w-5 text-sage-700" />
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.16em] sm:tracking-[0.2em] text-sage-700">
              In-Room Nightstand QR
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-medium text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active Stay Ready</span>
          </div>
        </div>

        {/* Main Heading */}
        <div className="mt-4 sm:mt-5 text-center">
          <h3 className="font-serif text-xl font-bold tracking-tight text-sage-950 sm:text-2xl">
            Scan QR or Direct Enter
          </h3>
          <p className="mx-auto mt-1.5 sm:mt-2 max-w-md text-xs sm:text-sm leading-relaxed text-sand-700">
            Scan this nightstand QR code using your phone camera, or use the camera scanner below to access the guest portal.
          </p>
        </div>

        {/* Room Details Card Pill */}
        {roomInfo && (
          <div className="mt-5 rounded-2xl border border-sand-200 bg-sand-100/50 p-3.5 text-center text-xs">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sage-900">
              <span className="font-serif text-base font-bold text-sage-950">
                Room {roomInfo.room_number}
              </span>
              {roomInfo.category && (
                <span className="font-medium text-sand-600">· {roomInfo.category}</span>
              )}
              {roomInfo.guest_name && (
                <span className="text-sand-700">
                  · Guest: <strong className="text-sage-900">{roomInfo.guest_name}</strong>
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-sand-600">
              {roomInfo.property_name || "Vesper Luxury Resort & Spa"}
            </p>

            {/* Room Selector if multiple available */}
            {availableRooms.length > 1 && (
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
                <span className="text-[11px] text-sand-500">Other rooms:</span>
                {availableRooms.map((r) => (
                  <button
                    key={r.room_id}
                    type="button"
                    onClick={() => setRoomInfo(r)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition",
                      r.room_number === roomInfo.room_number
                        ? "bg-sage-800 text-white shadow-xs"
                        : "border border-sand-200 bg-white text-sage-800 hover:bg-sand-50"
                    )}
                  >
                    Room {r.room_number}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* QR Code / Camera Scanner Box */}
        <div className="mt-6 flex flex-col items-center justify-center">
          {scanning ? (
            <div className="w-full max-w-sm rounded-3xl border-2 border-sage-500 bg-sage-950 p-4 text-center text-white shadow-xl">
              <p className="mb-3 text-xs font-medium text-sand-200">
                Point your camera at the room QR code
              </p>
              <div className="overflow-hidden rounded-2xl border border-sage-700">
                <Scanner
                  onScan={handleScan}
                  onError={() => setError("Camera scanner unavailable. Please use Direct Demo Entrance below.")}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setScanning(false)}
                className="mt-3 border-sand-600 text-xs text-sand-200 hover:bg-sage-900"
              >
                Close Camera Scanner
              </Button>
            </div>
          ) : (
            <div className="group relative rounded-3xl border-2 border-sand-200 bg-white p-5 shadow-md transition hover:border-sage-400 hover:shadow-lg">
              {loading ? (
                <div className="flex h-56 w-56 flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-7 w-7 animate-spin text-sage-600" />
                  <p className="text-xs font-medium text-sand-600">Generating verified QR…</p>
                </div>
              ) : qrUrl ? (
                <div className="flex flex-col items-center">
                  <QRCodeSVG
                    value={qrUrl}
                    size={220}
                    level="H"
                    includeMargin={true}
                    className="rounded-xl"
                  />
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-sage-700">
                    <Smartphone className="h-3.5 w-3.5 text-sage-600" />
                    <span>Point phone camera or live webcam here</span>
                  </div>
                </div>
              ) : (
                <div className="flex h-56 w-56 items-center justify-center text-xs text-rose-600">
                  Unable to generate QR code.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error Displays */}
        {(error || sessionError) && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-center text-xs text-rose-800"
          >
            {error || sessionError}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          {/* 1-Tap Direct Enter */}
          <Button
            type="button"
            onClick={handleDirectEnter}
            disabled={loading || opening}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-sage-800 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-sage-900"
          >
            {opening ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Opening Guest Room…</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>Enter Room (Direct Demo)</span>
              </>
            )}
          </Button>

          {/* Live Camera Scanner Button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setScanning((prev) => !prev)}
            disabled={opening}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border-sand-300 px-4 py-2.5 text-sm text-sage-900 hover:bg-sand-100"
          >
            <Smartphone className="h-4 w-4 text-sage-700" />
            <span>{scanning ? "Close Camera" : "Scan with Camera"}</span>
          </Button>

          {/* Copy Link Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleCopyLink}
            disabled={!qrUrl}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border-sand-300 px-4 py-2.5 text-sm text-sage-900 hover:bg-sand-100"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-sand-600" />
                <span>Copy Link</span>
              </>
            )}
          </Button>
        </div>

        {/* Mobile Wi-Fi / Local Network Helper Toggle */}
        <div className="mt-5 border-t border-sand-200/80 pt-4 text-center">
          <button
            type="button"
            onClick={() => setShowNetworkSettings((val) => !val)}
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-sand-600 underline transition hover:text-sage-800"
          >
            <Wifi className="h-3 w-3" />
            <span>{showNetworkSettings ? "Hide Wi-Fi IP settings" : "Scanning from phone on same Wi-Fi?"}</span>
          </button>

          {showNetworkSettings && (
            <div className="mt-3 rounded-xl border border-sand-200 bg-sand-50/70 p-3 text-left">
              <label className="block text-[11px] font-medium text-sage-900">
                Host / IP for Phone Scanning (e.g. <code>http://192.168.1.15:3000</code>):
              </label>
              <p className="mt-0.5 text-[10px] text-sand-600">
                Your phone must access your computer's local Wi-Fi IP instead of <code>localhost</code>.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={customHost}
                  onChange={(e) => setCustomHost(e.target.value)}
                  placeholder={origin}
                  className="flex-1 rounded-lg border border-sand-300 bg-white px-2.5 py-1 text-xs text-sage-900 focus:border-sage-600 focus:outline-hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomHost("")}
                  className="text-xs"
                >
                  Reset
                </Button>
              </div>
              {roomInfo?.network_ip && roomInfo.network_ip !== "127.0.0.1" && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setCustomHost(`http://${roomInfo.network_ip}:3000`)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 transition hover:bg-emerald-100"
                  >
                    <Wifi className="h-3 w-3 text-emerald-600" />
                    <span>1-Tap: Use Detected Wi-Fi IP (http://{roomInfo.network_ip}:3000)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Feature Highlights Footer */}
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-sand-200/60 pt-4 text-center text-[11px] text-sand-600">
          <div className="flex flex-col items-center gap-1">
            <UtensilsCrossed className="h-4 w-4 text-sage-700" />
            <span>Room Dining</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <BedDouble className="h-4 w-4 text-sage-700" />
            <span>Fresh Towels</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ShieldCheck className="h-4 w-4 text-sage-700" />
            <span>Secure Stay Auth</span>
          </div>
        </div>
      </section>
    </div>
  );
}
