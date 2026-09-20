import {
  Apple,
  Bath,
  BedDouble,
  Beef,
  Coffee,
  Droplets,
  Milk,
  Package,
  Shirt,
  Sparkles,
  Wheat,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Demo store-room stock.
 *
 * Status is derived from `onHand`, `minimum` and `expiresOn` rather than stored: a
 * stored flag and a changing quantity are two facts that will eventually disagree, and
 * the one that goes stale is always the one someone acts on.
 */

export type StockCategory = "Food & Beverage" | "Linen" | "Toiletries" | "Housekeeping" | "Parts";

export interface StockItem {
  sku: string;
  name: string;
  category: StockCategory;
  unit: string;
  onHand: number;
  minimum: number;
  unitCost: number;
  supplier: string;
  /** ISO date; only perishables carry one. */
  expiresOn?: string;
  lastUpdated: string;
  icon: LucideIcon;
}

export type StockStatus = "out" | "low" | "expiring" | "ok";

export const stockStatusMeta: Record<StockStatus, { label: string; chip: string }> = {
  out: { label: "Out of Stock", chip: "border-rose-300 bg-rose-50 text-rose-700" },
  low: { label: "Low Stock", chip: "border-gold-300 bg-gold-50 text-gold-800" },
  expiring: { label: "Expiring Soon", chip: "border-sand-300 bg-sand-100 text-sand-800" },
  ok: { label: "In Stock", chip: "border-sage-200 bg-sage-50 text-sage-800" },
};

/** Within this many days of expiry, an item is worth flagging. */
export const EXPIRY_WINDOW_DAYS = 30;

export function stockStatus(item: StockItem, today: Date): StockStatus {
  if (item.onHand <= 0) return "out";
  if (item.onHand < item.minimum) return "low";
  if (item.expiresOn) {
    const days = Math.ceil((new Date(item.expiresOn).getTime() - today.getTime()) / 86_400_000);
    if (days <= EXPIRY_WINDOW_DAYS) return "expiring";
  }
  return "ok";
}

/** Colour behind the item thumbnail, by category. */
export const categoryTint: Record<StockCategory, string> = {
  "Food & Beverage": "bg-gold-50 text-gold-700",
  Linen: "bg-sage-50 text-sage-700",
  Toiletries: "bg-sand-100 text-sand-700",
  Housekeeping: "bg-emerald-50 text-emerald-700",
  Parts: "bg-rose-50 text-rose-600",
};

const SUPPLIERS = [
  "Gokul Dairy",
  "Blue Tokai",
  "Bombay Linen Co.",
  "Aroma Essentials",
  "SleepWell Contract",
  "Cool Care Services",
  "Theobroma Supply",
  "Metro Cash & Carry",
] as const;

export const SUPPLIER_FILTERS = ["All Suppliers", ...SUPPLIERS];

export const STOCK_CATEGORIES: StockCategory[] = [
  "Food & Beverage",
  "Linen",
  "Toiletries",
  "Housekeeping",
  "Parts",
];

type Seed = [string, string, StockCategory, string, number, number, number, string, string | undefined, string, LucideIcon];

// sku, name, category, unit, onHand, minimum, unitCost, supplier, expiresOn, lastUpdated, icon
const SEEDS: Seed[] = [
  ["FNB-001", "Fresh Tomatoes", "Food & Beverage", "kg", 12, 25, 48, "Metro Cash & Carry", "2026-11-20", "18 Nov 2026", Apple],
  ["FNB-002", "Basmati Rice (5kg)", "Food & Beverage", "kg", 48, 20, 420, "Metro Cash & Carry", "2027-01-15", "18 Nov 2026", Wheat],
  ["FNB-003", "Chicken Breast (Frozen)", "Food & Beverage", "kg", 8, 15, 320, "Metro Cash & Carry", "2026-12-05", "18 Nov 2026", Beef],
  ["FNB-004", "Olive Oil (1L)", "Food & Beverage", "units", 24, 10, 890, "Metro Cash & Carry", "2027-02-12", "17 Nov 2026", Droplets],
  ["FNB-005", "Organic Coffee Beans", "Food & Beverage", "kg", 4, 5, 740, "Blue Tokai", "2026-12-01", "18 Nov 2026", Coffee],
  ["FNB-006", "Paneer (Fresh)", "Food & Beverage", "kg", 11, 6, 420, "Gokul Dairy", "2026-11-23", "18 Nov 2026", Milk],
  ["FNB-007", "Multigrain Bread", "Food & Beverage", "loaves", 9, 14, 68, "Theobroma Supply", "2026-11-22", "18 Nov 2026", Wheat],
  ["FNB-008", "Full Cream Milk (1L)", "Food & Beverage", "units", 86, 40, 72, "Gokul Dairy", "2026-11-21", "18 Nov 2026", Milk],
  ["FNB-009", "Butter (500g)", "Food & Beverage", "units", 32, 15, 310, "Gokul Dairy", "2027-01-08", "17 Nov 2026", Milk],
  ["FNB-010", "Assam Tea Leaves", "Food & Beverage", "kg", 18, 8, 640, "Blue Tokai", "2027-06-30", "16 Nov 2026", Coffee],

  ["LIN-001", "Bath Towel (White)", "Linen", "pcs", 120, 50, 340, "Bombay Linen Co.", undefined, "18 Nov 2026", Shirt],
  ["LIN-002", "Bed Sheet (King)", "Linen", "pcs", 28, 40, 1_150, "Bombay Linen Co.", undefined, "17 Nov 2026", BedDouble],
  ["LIN-003", "Pillow Cover", "Linen", "pcs", 85, 30, 220, "Bombay Linen Co.", undefined, "16 Nov 2026", BedDouble],
  ["LIN-004", "Hand Towel", "Linen", "pcs", 210, 80, 140, "Bombay Linen Co.", undefined, "18 Nov 2026", Shirt],
  ["LIN-005", "Bed Sheet (Twin)", "Linen", "pcs", 96, 60, 880, "Bombay Linen Co.", undefined, "15 Nov 2026", BedDouble],
  ["LIN-006", "Bath Robe", "Linen", "pcs", 44, 30, 1_480, "Bombay Linen Co.", undefined, "14 Nov 2026", Shirt],
  ["LIN-007", "Table Linen (Banquet)", "Linen", "pcs", 62, 40, 760, "Bombay Linen Co.", undefined, "12 Nov 2026", Shirt],

  ["TOI-001", "Shampoo (30ml)", "Toiletries", "pcs", 200, 100, 22, "Aroma Essentials", "2027-01-10", "18 Nov 2026", Bath],
  ["TOI-002", "Bath Soap (50g)", "Toiletries", "pcs", 35, 60, 18, "Aroma Essentials", "2026-11-25", "18 Nov 2026", Bath],
  ["TOI-003", "Dental Kit", "Toiletries", "pcs", 500, 200, 26, "Aroma Essentials", "2027-02-18", "16 Nov 2026", Bath],
  ["TOI-004", "Body Lotion (30ml)", "Toiletries", "pcs", 210, 60, 26, "Aroma Essentials", "2027-03-02", "17 Nov 2026", Bath],
  ["TOI-005", "Bath Slippers", "Toiletries", "pairs", 34, 80, 45, "Aroma Essentials", undefined, "18 Nov 2026", Bath],
  ["TOI-006", "Shower Cap", "Toiletries", "pcs", 380, 150, 8, "Aroma Essentials", undefined, "15 Nov 2026", Bath],
  ["TOI-007", "Shaving Kit", "Toiletries", "pcs", 145, 100, 32, "Aroma Essentials", "2027-04-20", "14 Nov 2026", Bath],

  ["HKP-001", "Floor Cleaner (5L)", "Housekeeping", "units", 26, 12, 480, "Metro Cash & Carry", undefined, "18 Nov 2026", Sparkles],
  ["HKP-002", "Glass Cleaner (1L)", "Housekeeping", "units", 9, 15, 180, "Metro Cash & Carry", undefined, "17 Nov 2026", Sparkles],
  ["HKP-003", "Microfibre Cloth", "Housekeeping", "pcs", 240, 100, 45, "Metro Cash & Carry", undefined, "16 Nov 2026", Sparkles],
  ["HKP-004", "Garbage Bags (Large)", "Housekeeping", "rolls", 58, 30, 210, "Metro Cash & Carry", undefined, "18 Nov 2026", Package],
  ["HKP-005", "Air Freshener", "Housekeeping", "units", 72, 40, 165, "Aroma Essentials", "2027-05-11", "13 Nov 2026", Sparkles],
  ["HKP-006", "Disinfectant (5L)", "Housekeeping", "units", 0, 10, 620, "Metro Cash & Carry", undefined, "17 Nov 2026", Droplets],

  ["PRT-001", "AC Filter (Split 1.5T)", "Parts", "pcs", 0, 8, 560, "Cool Care Services", undefined, "17 Nov 2026", Wrench],
  ["PRT-002", "Chiller Bearing Kit", "Parts", "kits", 2, 2, 12_400, "Cool Care Services", undefined, "14 Nov 2026", Wrench],
  ["PRT-003", "LED Bulb (9W)", "Parts", "pcs", 180, 80, 120, "Metro Cash & Carry", undefined, "16 Nov 2026", Wrench],
  ["PRT-004", "Door Lock Battery", "Parts", "pcs", 64, 40, 95, "Metro Cash & Carry", undefined, "15 Nov 2026", Wrench],
  ["PRT-005", "Mattress Protector", "Parts", "pcs", 24, 20, 890, "SleepWell Contract", undefined, "18 Nov 2026", BedDouble],
  ["PRT-006", "Pillow (Microfibre)", "Parts", "pcs", 52, 40, 620, "SleepWell Contract", undefined, "18 Nov 2026", BedDouble],
  ["PRT-007", "Shower Head", "Parts", "pcs", 12, 15, 1_240, "Cool Care Services", undefined, "12 Nov 2026", Droplets],
  ["PRT-008", "Tap Cartridge", "Parts", "pcs", 38, 20, 410, "Cool Care Services", undefined, "11 Nov 2026", Wrench],
];

export const stock: StockItem[] = SEEDS.map(
  ([sku, name, category, unit, onHand, minimum, unitCost, supplier, expiresOn, lastUpdated, icon]) => ({
    sku,
    name,
    category,
    unit,
    onHand,
    minimum,
    unitCost,
    supplier,
    expiresOn,
    lastUpdated,
    icon,
  })
);

export type SortKey = "onHand" | "minimum" | "expiresOn" | "status" | "lastUpdated";
