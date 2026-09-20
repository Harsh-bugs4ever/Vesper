"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The right-hand detail panel: a booking, a guest, a stock movement.
 *
 * A drawer rather than a full page because every one of these is opened from a list the
 * person wants to stay in — closing it should put them back on the same row, not at the
 * top of a re-fetched table. Radix handles the focus trap, scroll lock and Escape.
 *
 * On phones it takes the full width, which is the only readable option below ~480px.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-in fade-in fixed inset-0 z-50 bg-sand-950/25 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            "animate-in slide-in-from-bottom-5 fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-sand-200 bg-white shadow-elevated",
            "sm:max-w-md"
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-sand-200/80 px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="font-serif text-xl font-semibold leading-tight text-sand-950">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-0.5 text-xs text-sand-600">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="rounded-lg p-1.5 text-sand-500 transition-colors hover:bg-sand-100 hover:text-sand-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-sand-200/80 px-5 py-4">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
