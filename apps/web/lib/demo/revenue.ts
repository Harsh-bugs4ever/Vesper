import type { ForecastPoint } from "@/components/charts/occupancy-forecast-chart";

/**
 * Demo revenue data for the November pricing window.
 *
 * The forecast runs 1–30 Nov and peaks on Saturday the 22nd, which is the date the rate
 * recommendation is built around — the two have to agree, or the screen argues with
 * itself in front of whoever is being shown it.
 */

const NOVEMBER_OCCUPANCY: [number, number, number][] = [
  // [day, forecast %, half-width of the confidence interval]
  [1, 41, 8],
  [2, 48, 8],
  [3, 52, 8],
  [4, 56, 9],
  [5, 55, 9],
  [6, 51, 9],
  [7, 50, 9],
  [8, 57, 9],
  [9, 62, 9],
  [10, 65, 10],
  [11, 67, 10],
  [12, 65, 10],
  [13, 69, 10],
  [14, 72, 10],
  [15, 75, 11],
  [16, 78, 11],
  [17, 80, 11],
  [18, 83, 11],
  [19, 85, 11],
  [20, 84, 11],
  [21, 86, 11],
  [22, 87, 12],
  [23, 83, 12],
  [24, 80, 12],
  [25, 76, 12],
  [26, 72, 13],
  [27, 66, 13],
  [28, 61, 13],
  [29, 58, 14],
  [30, 62, 14],
];

export const novemberForecast: ForecastPoint[] = NOVEMBER_OCCUPANCY.map(([day, value, spread]) => ({
  date: `${day} Nov`,
  occupancy: value,
  // Clamp: occupancy cannot exceed 100%, and a band that runs past it is a lie about
  // what the model can predict.
  range: [Math.max(0, value - spread), Math.min(100, value + spread)],
}));

/** Occupancy above which the property is effectively sold out. */
export const SOLD_OUT_THRESHOLD = 90;

export interface CategoryRow {
  category: string;
  inventory: number;
  occupancy: number;
  adr: number;
  revenue: number;
  trend: number[];
}

export const roomCategories: CategoryRow[] = [
  {
    category: "Standard",
    inventory: 40,
    occupancy: 68,
    adr: 6_800,
    revenue: 18_50_000,
    trend: [58, 61, 60, 64, 63, 66, 68],
  },
  {
    category: "Deluxe",
    inventory: 30,
    occupancy: 82,
    adr: 9_800,
    revenue: 24_10_000,
    trend: [70, 72, 75, 74, 78, 80, 82],
  },
  {
    category: "Executive",
    inventory: 20,
    occupancy: 76,
    adr: 12_500,
    revenue: 18_80_000,
    trend: [68, 71, 70, 73, 72, 75, 76],
  },
  {
    category: "Suite",
    inventory: 10,
    occupancy: 90,
    adr: 18_200,
    revenue: 16_40_000,
    trend: [76, 79, 82, 81, 85, 88, 90],
  },
  {
    category: "Premium",
    inventory: 8,
    occupancy: 88,
    adr: 24_000,
    revenue: 16_90_000,
    trend: [74, 78, 80, 83, 84, 86, 88],
  },
];

export interface CompetitorRow {
  hotel: string;
  currentRate: number;
  weekendRate: number;
  /** Percentage above our weekend rate; null for our own row. */
  difference: number | null;
}

export const competitors: CompetitorRow[] = [
  { hotel: "The Orchid Grand", currentRate: 9_800, weekendRate: 11_200, difference: null },
  { hotel: "Taj Santacruz", currentRate: 12_500, weekendRate: 14_000, difference: 25 },
  { hotel: "ITC Maratha", currentRate: 11_800, weekendRate: 13_500, difference: 21 },
  { hotel: "Novotel Mumbai Juhu", currentRate: 10_900, weekendRate: 12_200, difference: 9 },
  { hotel: "Courtyard by Marriott", currentRate: 11_200, weekendRate: 13_000, difference: 16 },
];

export const rateRecommendation = {
  roomType: "Deluxe Room",
  forDate: "Sat, 22 Nov 2026",
  currentRate: 9_800,
  suggestedRate: 11_200,
  upliftPct: 14,
  expectedImpact: 48_000,
  impactBasis: "Additional revenue (4 rooms x 2 nights)",
  priceFloor: 8_500,
  priceCeiling: 14_000,
  drivers: [
    "High projected demand (87% occupancy)",
    "Coldplay concert in Mumbai",
    "Competitor rates 12–18% higher",
    "Limited inventory (only 4 rooms left)",
  ],
};
