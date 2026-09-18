"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  type?: "default" | "success" | "warning" | "error";
  duration?: number; // ms
  undoAction?: () => void;
  undoDuration?: number; // seconds (e.g. 10s)
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, "id">) => string;
  showUndoToast: (title: string, description: string, onUndo: () => void, seconds?: number) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = "toast_" + Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { ...toast, id };
      setToasts((prev) => [...prev, newToast]);

      const duration = toast.duration || 4500;
      setTimeout(() => {
        dismissToast(id);
      }, duration);

      return id;
    },
    [dismissToast]
  );

  const showUndoToast = useCallback(
    (title: string, description: string, onUndo: () => void, seconds = 10) => {
      const id = "undo_toast_" + Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = {
        id,
        title,
        description,
        type: "success",
        duration: seconds * 1000,
        undoDuration: seconds,
        undoAction: () => {
          onUndo();
          dismissToast(id);
        },
      };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        dismissToast(id);
      }, seconds * 1000);

      return id;
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, showUndoToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState<number>(toast.undoDuration || 0);

  useEffect(() => {
    if (!toast.undoDuration) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [toast.undoDuration]);

  const percentage = toast.undoDuration ? (timeLeft / toast.undoDuration) * 100 : 0;

  return (
    <div
      className={cn(
        "pointer-events-auto relative overflow-hidden rounded-xl border p-4 shadow-elevated bg-white transition-all transform animate-in slide-in-from-bottom-5 duration-300",
        toast.undoAction ? "border-gold-300 bg-gold-50/30" : "border-sand-200"
      )}
    >
      <div className="flex items-start gap-3">
        {toast.type === "success" && (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
        )}
        {toast.type === "warning" && (
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        )}
        {toast.type === "error" && (
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
        )}
        {(!toast.type || toast.type === "default") && (
          <Info className="w-5 h-5 text-sage-600 mt-0.5 shrink-0" />
        )}

        <div className="flex-1 pr-2">
          <h4 className="text-sm font-semibold text-sand-950">{toast.title}</h4>
          {toast.description && (
            <p className="text-xs text-sand-600 mt-0.5 leading-relaxed">
              {toast.description}
            </p>
          )}

          {toast.undoAction && (
            <div className="mt-3 flex items-center justify-between gap-3 pt-2 border-t border-gold-200/60">
              <span className="text-[11px] font-medium text-gold-900 flex items-center gap-1">
                Auto-executing in <span className="font-bold">{timeLeft}s</span>
              </span>
              <button
                onClick={toast.undoAction}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-white text-xs font-semibold text-sand-900 border border-gold-300 hover:bg-gold-100/70 transition-colors shadow-xs active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gold-700" />
                Undo Action
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onDismiss}
          className="text-sand-400 hover:text-sand-700 transition-colors p-1"
          aria-label="Dismiss toast"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {toast.undoDuration && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gold-200/40">
          <div
            className="h-full bg-gold-500 transition-all duration-1000 ease-linear"
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
