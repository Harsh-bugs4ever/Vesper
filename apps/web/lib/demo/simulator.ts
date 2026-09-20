/**
 * The what-if model behind the simulator screen.
 *
 * Deliberately a small, legible set of elasticities rather than a call to the real
 * engine: the screen's job is to let someone feel the shape of a trade-off, and a model
 * whose assumptions are printed on the page beats a better one that cannot be explained.
 * The assumptions list on screen is generated from these same constants, so the two
 * cannot drift apart.
 */

export interface Baseline {
  arr: number;
  occupancy: number;
  staff: number;
  /** Monthly revenue in rupees. */
  revenue: number;
  profitMargin: number;
  roomsAvailable: number;
}

export const baseline: Baseline = {
  arr: 9_000,
  occupancy: 72,
  staff: 76,
  revenue: 1_20_00_000,
  profitMargin: 0.284,
  roomsAvailable: 302,
};

/** Percentage points of occupancy lost per 1% rate rise. */
const PRICE_ELASTICITY = 0.35;
/** Percentage points of occupancy gained per 1% discount, via volume. */
const DISCOUNT_LIFT = 0.28;
/** Occupancy points gained per 1% more staff, through service quality and turnaround. */
const STAFFING_LIFT = 0.12;
/** Share of revenue that payroll represents at baseline. */
const PAYROLL_SHARE = 0.22;

export interface Scenario {
  priceChange: number;
  staffingChange: number;
  promoDiscount: number;
}

export interface Projection {
  arr: number;
  occupancy: number;
  staff: number;
  revenue: number;
  revpar: number;
  profit: number;
  revenueDeltaPct: number;
  occupancyDeltaPoints: number;
  revparDeltaPct: number;
  profitDeltaPct: number;
  monthly: { month: string; baseline: number; simulated: number }[];
}

const MONTHS = ["Dec 2026", "Jan 2027", "Feb 2027", "Mar 2027"] as const;
/** Seasonality against the baseline month, so the comparison chart is not four flat bars. */
const SEASONALITY = [1.0, 0.875, 0.817, 0.917];

export function project(scenario: Scenario): Projection {
  const { priceChange, staffingChange, promoDiscount } = scenario;

  // Discount is entered as a negative number; treat its magnitude as the discount.
  const discount = Math.abs(promoDiscount);
  const effectivePriceChange = priceChange - discount;

  const arr = Math.round(baseline.arr * (1 + effectivePriceChange / 100));
  const occupancy = Math.max(
    0,
    Math.min(
      100,
      baseline.occupancy -
        priceChange * PRICE_ELASTICITY +
        discount * DISCOUNT_LIFT +
        staffingChange * STAFFING_LIFT
    )
  );

  const staff = Math.round(baseline.staff * (1 + staffingChange / 100));
  const revpar = Math.round((arr * occupancy) / 100);

  const volumeRatio =
    (arr * occupancy) / (baseline.arr * baseline.occupancy);
  const revenue = Math.round(baseline.revenue * volumeRatio);

  // Extra staff cost real money; the profit line has to show that or the simulator
  // becomes an argument for hiring without limit.
  const payrollDelta = baseline.revenue * PAYROLL_SHARE * (staffingChange / 100);
  const profit = Math.round(revenue * baseline.profitMargin - payrollDelta);
  const baselineProfit = baseline.revenue * baseline.profitMargin;

  const pct = (now: number, was: number) => Math.round(((now - was) / was) * 100);

  return {
    arr,
    occupancy: Math.round(occupancy),
    staff,
    revenue,
    revpar,
    profit,
    revenueDeltaPct: pct(revenue, baseline.revenue),
    occupancyDeltaPoints: Math.round(occupancy - baseline.occupancy),
    revparDeltaPct: pct(revpar, Math.round((baseline.arr * baseline.occupancy) / 100)),
    profitDeltaPct: pct(profit, baselineProfit),
    monthly: MONTHS.map((month, index) => ({
      month,
      baseline: Number(((baseline.revenue * SEASONALITY[index]) / 1_00_00_000).toFixed(2)),
      simulated: Number(((revenue * SEASONALITY[index]) / 1_00_00_000).toFixed(2)),
    })),
  };
}

export const PRESETS: Record<string, { label: string; detail: string; scenario: Scenario }> = {
  conservative: {
    label: "Conservative",
    detail: "Small changes, lower risk",
    scenario: { priceChange: 3, staffingChange: 5, promoDiscount: -5 },
  },
  balanced: {
    label: "Balanced",
    detail: "Optimal growth",
    scenario: { priceChange: 10, staffingChange: 15, promoDiscount: -10 },
  },
  aggressive: {
    label: "Aggressive",
    detail: "Maximize revenue",
    scenario: { priceChange: 18, staffingChange: 25, promoDiscount: -18 },
  },
};

/** Stated on screen so nobody reads a projection as a forecast. */
export const ASSUMPTIONS = [
  "Analysis period: 1 Dec 2026 – 31 Mar 2027 (next 4 months)",
  "Room price change applied to all room categories",
  "Staffing change impacts service capacity and guest satisfaction (assumes 5% higher review score)",
  "Promotion discount applied to direct and OTA channels",
  "No major events or external shocks considered",
];
