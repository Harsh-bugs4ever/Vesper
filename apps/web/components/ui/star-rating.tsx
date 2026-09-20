"use client";

import * as React from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Stars, either as a control or as a read-only display.
 *
 * Interactive mode is a radio group rather than five buttons: the options are mutually
 * exclusive and a keyboard user should be able to arrow between them, which is exactly
 * what a radio group gives. Hover only previews — nothing commits until a click.
 */
export function StarRating({
  value,
  onChange,
  size = "md",
  label,
  className,
}: {
  value: number;
  /** Omit for a read-only display. */
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const readOnly = onChange === undefined;
  const shown = hovered ?? value;

  const starSize = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-4 w-4" : "h-6 w-6";

  if (readOnly) {
    return (
      <span
        className={cn("inline-flex items-center gap-0.5", className)}
        role="img"
        aria-label={`${value} out of 5`}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              starSize,
              star <= value ? "fill-gold-400 text-gold-400" : "fill-none text-sand-300"
            )}
          />
        ))}
      </span>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={label ?? "Rating"}
      className={cn("inline-flex items-center gap-1", className)}
      onMouseLeave={() => setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onFocus={() => setHovered(star)}
          onBlur={() => setHovered(null)}
          className="rounded-md p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500"
        >
          <Star
            className={cn(
              starSize,
              "transition-colors",
              star <= shown ? "fill-gold-400 text-gold-400" : "fill-none text-sand-300"
            )}
          />
        </button>
      ))}
    </div>
  );
}
