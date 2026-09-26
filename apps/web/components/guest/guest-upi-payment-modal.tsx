"use client";

import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  QrCode,
  ShieldCheck,
  Smartphone,
  Timer,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GuestUpiPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (details: {
    txnId: string;
    amount: number;
    paymentMethod: string;
    paidAt: string;
  }) => void;
  amount: number;
  roomNumber: string;
  itemsSummary: string;
  itemCount: number;
}

export function GuestUpiPaymentModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  amount,
  roomNumber,
  itemsSummary,
  itemCount,
}: GuestUpiPaymentModalProps) {
  const [copied, setCopied] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds

  const upiId = "vesper.dining@icici";
  const payeeName = "Vesper Beach Resort & Spa";
  const txnRef = `VSP-UPI-${Math.floor(100000 + Math.random() * 900000)}`;

  // Standard UPI URI readable by PhonePe, GPay, Paytm
  const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
    payeeName
  )}&am=${amount}&cu=INR&tn=Room_${roomNumber}_Order_${txnRef}`;

  // Countdown timer
  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(300);
      setIsVerifying(false);
      setVerificationSuccess(false);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCopyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignore
    }
  };

  const handleSimulatePayment = (mode: "simulate_scan" | "manual_paid") => {
    setIsVerifying(true);
    // Simulate real bank webhook / payment gateway verification delay (1.5 seconds)
    setTimeout(() => {
      setIsVerifying(false);
      setVerificationSuccess(true);

      setTimeout(() => {
        onPaymentSuccess({
          txnId: txnRef,
          amount,
          paymentMethod: mode === "simulate_scan" ? "UPI QR Instant Scan" : "UPI App Transfer",
          paidAt: new Date().toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
      }, 700);
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upi-payment-heading"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sage-950/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-sand-300 bg-white shadow-2xl transition-all">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-sand-200 bg-sand-50/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sage-800 text-white shadow-sm">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h2 id="upi-payment-heading" className="font-serif text-base font-bold text-sage-950">
                UPI Instant Payment
              </h2>
              <p className="text-[11px] text-sand-600">In-Room Dining · Room {roomNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close UPI payment modal"
            disabled={isVerifying}
            className="rounded-full p-1.5 text-sand-500 hover:bg-sand-200 hover:text-sand-800 transition disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {verificationSuccess ? (
            /* Success Verification State */
            <div className="py-8 text-center space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
                <CheckCircle2 className="h-10 w-10 animate-in zoom-in-75 duration-300" />
              </div>
              <h3 className="font-serif text-xl font-bold text-sage-950">
                UPI Payment Verified!
              </h3>
              <p className="text-xs text-sand-600">
                ₹{amount.toLocaleString("en-IN")} received successfully via UPI. Routing order to the kitchen…
              </p>
            </div>
          ) : isVerifying ? (
            /* Loading Bank State */
            <div className="py-10 text-center space-y-4">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-sage-800" />
              <div className="space-y-1">
                <h3 className="font-serif text-lg font-semibold text-sage-950">
                  Verifying UPI Transaction…
                </h3>
                <p className="text-xs text-sand-600">
                  Communicating with ICICI Bank UPI Gateway for Ref #{txnRef}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Bill Details Box */}
              <div className="rounded-2xl border border-sand-200 bg-sand-50/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-sand-500">
                      Total Payable
                    </span>
                    <p className="font-serif text-2xl font-bold text-sage-950">
                      ₹{amount.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                      <ShieldCheck className="h-3 w-3 text-emerald-600" />
                      Verified Merchant
                    </span>
                    <p className="mt-1 text-[10px] text-sand-500">{payeeName}</p>
                  </div>
                </div>

                <div className="mt-3 border-t border-sand-200/70 pt-2.5 text-xs text-sand-600">
                  <span className="font-medium text-sage-900">{itemCount} items:</span>{" "}
                  <span className="line-clamp-1">{itemsSummary}</span>
                </div>
              </div>

              {/* Dummy UPI Scanner QR Container */}
              <div className="relative rounded-2xl border border-amber-200 bg-linear-to-b from-amber-50/40 via-white to-sand-50/40 p-4 text-center shadow-xs">
                {/* QR Code with animated scan laser effect */}
                <div className="relative mx-auto inline-block rounded-2xl border border-sand-300 bg-white p-3 shadow-md">
                  <QRCodeSVG
                    value={upiUri}
                    size={170}
                    level="H"
                    includeMargin={false}
                    className="mx-auto rounded-lg"
                  />

                  {/* Pulsing Scan Laser Beam */}
                  <div
                    className="pointer-events-none absolute inset-x-2 top-2 bottom-2 overflow-hidden rounded-xl"
                    aria-hidden="true"
                  >
                    <div className="h-0.5 w-full bg-linear-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_10px_rgba(16,185,129,0.9)] animate-pulse" />
                  </div>

                  {/* Center UPI Badge Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="rounded-md border border-amber-400 bg-sage-950 px-2 py-0.5 shadow-sm">
                      <span className="font-mono text-[9px] font-bold tracking-wider text-amber-300">
                        BHIM UPI
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <p className="text-xs font-semibold text-sage-950">
                    Scan using any UPI App
                  </p>
                  <p className="text-[11px] text-sand-500">
                    Open Google Pay, PhonePe, Paytm, or CRED to complete payment
                  </p>
                </div>

                {/* Expiry Countdown */}
                <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-sand-100 px-3 py-1 text-[11px] font-medium text-sand-700">
                  <Timer className="h-3.5 w-3.5 text-sand-600" />
                  <span>QR expires in: <strong className="font-mono text-sage-900">{formatTimer(timeLeft)}</strong></span>
                </div>
              </div>

              {/* UPI ID Copy Card */}
              <div className="flex items-center justify-between rounded-xl border border-sand-200 bg-sand-50/80 px-3.5 py-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-sand-500">
                    Resort UPI ID
                  </span>
                  <p className="font-mono font-medium text-sage-900">{upiId}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUpiId}
                  className="inline-flex items-center gap-1 rounded-lg border border-sand-300 bg-white px-2.5 py-1 text-xs font-medium text-sage-800 shadow-2xs hover:bg-sand-100 transition"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-sand-500" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Interactive Action Buttons */}
              <div className="space-y-2 pt-1">
                {/* 1-Click Simulation Button */}
                <Button
                  type="button"
                  onClick={() => handleSimulatePayment("simulate_scan")}
                  className="w-full h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm shadow-md flex items-center justify-center gap-2 transition"
                >
                  <Smartphone className="h-4 w-4" />
                  <span>Simulate UPI Scan & Pay (₹{amount.toLocaleString("en-IN")})</span>
                </Button>

                {/* Manual I Have Paid Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSimulatePayment("manual_paid")}
                  className="w-full h-10 rounded-xl border-sand-300 text-sage-800 hover:bg-sand-100 text-xs font-medium transition"
                >
                  <Check className="h-3.5 w-3.5 mr-1 text-sand-600" />
                  I have paid from my UPI app
                </Button>
              </div>

              {/* Safe & Secure note */}
              <p className="flex items-center justify-center gap-1 text-[10px] text-sand-500">
                <Lock className="h-3 w-3" />
                <span>256-bit encrypted merchant settlement · Instant kitchen dispatch</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
