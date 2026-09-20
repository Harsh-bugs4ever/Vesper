import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Plain tabular type — no zebra striping, no vertical rules.
 *
 * Numeric columns pass `align="right"` so figures line up on their units, which is the
 * only alignment that lets someone compare a column at a glance.
 */
function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-sand-200/80", className)} {...props} />;
}

function TH({
  className,
  align = "left",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-3 pb-2.5 text-xs font-medium text-sand-500 first:pl-0 last:pr-0",
        align === "right" ? "text-right" : "text-left",
        className
      )}
      {...props}
    />
  );
}

function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-sand-100", className)} {...props} />;
}

function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors hover:bg-sand-50/70", className)} {...props} />;
}

function TD({
  className,
  align = "left",
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" }) {
  return (
    <td
      className={cn(
        "whitespace-nowrap px-3 py-2.5 text-sand-800 first:pl-0 last:pr-0",
        align === "right" ? "text-right tabular-nums" : "text-left",
        className
      )}
      {...props}
    />
  );
}

export { Table, THead, TH, TBody, TR, TD };
