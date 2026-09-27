import { type ClassValue, clsx } from "clsx";
import { format as formatDateFns, isValid } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format untrusted API date values without letting one malformed timestamp crash a page. */
export function safeFormatDate(
  value: string | number | Date | null | undefined,
  pattern: string,
  fallback = "—",
): string {
  if (value == null || value === "") return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? formatDateFns(date, pattern) : fallback;
}
