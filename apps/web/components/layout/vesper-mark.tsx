import * as React from "react";

/**
 * The Vesper mark: a four-point star drawn with concave sides, so it reads as an
 * engraved hospitality monogram rather than the "AI sparkle" the same shape usually
 * signals. Drawn here rather than imported from an icon set for exactly that reason.
 */
export function VesperMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 1.5c.55 4.9 1.7 7.35 4.05 8.4 1.4.63 3.2.95 5.45 1.1v2c-2.25.15-4.05.47-5.45 1.1-2.35 1.05-3.5 3.5-4.05 8.4-.55-4.9-1.7-7.35-4.05-8.4-1.4-.63-3.2-.95-5.45-1.1v-2c2.25-.15 4.05-.47 5.45-1.1C10.3 8.85 11.45 6.4 12 1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
