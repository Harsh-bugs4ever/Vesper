import * as React from "react";

/**
 * The closing line of every admin page. Quiet by design: it names the product, the three
 * things it is for, and the build — nothing that competes with the content above it.
 */
export function AdminFooter() {
  return (
    <footer className="mt-10 border-t border-sand-200/80 pt-5">
      <div className="flex flex-col gap-2 text-xs text-sand-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-serif text-base tracking-[0.18em] text-sand-700">VESPER</span>
          <span aria-hidden="true" className="hidden text-sand-300 sm:inline">
            |
          </span>
          <span>People</span>
          <span>Operations</span>
          <span>Memorable Stays</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Version 1.0.0</span>
          <span aria-hidden="true" className="text-sand-300">
            |
          </span>
          <span>Made for a more human hospitality</span>
        </div>
      </div>
    </footer>
  );
}
