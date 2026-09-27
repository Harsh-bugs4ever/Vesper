"use client";

import { Button } from "@/components/ui/button";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  amount: number;
  roomNumber: string;
  itemsSummary: string;
  itemCount: number;
  error?: string;
}

/** The demo has no payment gateway or PMS folio integration. Confirm only the order. */
export function GuestUpiPaymentModal({ isOpen, onClose, onConfirm, isSubmitting, amount, roomNumber, itemsSummary, itemCount, error }: Props) {
  if (!isOpen) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="order-heading" className="fixed inset-0 z-50 flex items-center justify-center bg-sage-950/60 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
        <h2 id="order-heading" className="font-serif text-xl font-bold text-sage-950">Confirm room-service order</h2>
        <p className="text-sm text-sand-700">Room {roomNumber} · {itemCount} items: {itemsSummary}</p>
        <p className="text-lg font-semibold text-sage-950">Estimated menu total: ₹{amount.toLocaleString("en-IN")}</p>
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Demo order only. No online payment is taken or verified. The hotel must confirm any room charge or payment separately at checkout.</p>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="button" onClick={onConfirm} disabled={isSubmitting}>{isSubmitting ? "Placing order…" : "Place demo order"}</Button>
        </div>
      </div>
    </div>
  );
}
