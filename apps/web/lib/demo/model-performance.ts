/**
 * Demo accuracy data for the learning page.
 *
 * Two numbers per engine, kept apart on purpose. **Confidence** is what the model says
 * about itself; **acceptance rate** is how often a human agreed with it. A model can be
 * confident and ignored, and that gap is the most useful thing on the screen — it is
 * the difference between a model that is wrong and one that nobody trusts.
 */

export interface EngineScore {
  id: string;
  name: string;
  description: string;
  confidence: number;
  acceptanceRate: number;
}

export const engines: EngineScore[] = [
  {
    id: "demand",
    name: "Demand Forecast Engine",
    description: "Predicts room demand and occupancy",
    confidence: 87,
    acceptanceRate: 76,
  },
  {
    id: "pricing",
    name: "Dynamic Pricing Engine",
    description: "Recommends optimal room rates",
    confidence: 82,
    acceptanceRate: 68,
  },
  {
    id: "segmentation",
    name: "Guest Segmentation",
    description: "Classifies and segments guests",
    confidence: 79,
    acceptanceRate: 71,
  },
  {
    id: "cancellation",
    name: "Cancellation Risk Model",
    description: "Predicts likelihood of cancellations",
    confidence: 85,
    acceptanceRate: 63,
  },
];

export interface AccuracyPoint {
  date: string;
  predicted: number;
  actual: number;
}

export const accuracy: AccuracyPoint[] = [
  { date: "1 Nov", predicted: 46, actual: 44 },
  { date: "2 Nov", predicted: 52, actual: 49 },
  { date: "3 Nov", predicted: 58, actual: 55 },
  { date: "4 Nov", predicted: 64, actual: 62 },
  { date: "5 Nov", predicted: 66, actual: 68 },
  { date: "6 Nov", predicted: 70, actual: 66 },
  { date: "7 Nov", predicted: 68, actual: 64 },
  { date: "8 Nov", predicted: 64, actual: 61 },
  { date: "9 Nov", predicted: 61, actual: 58 },
  { date: "10 Nov", predicted: 58, actual: 60 },
  { date: "11 Nov", predicted: 62, actual: 59 },
  { date: "12 Nov", predicted: 66, actual: 63 },
  { date: "13 Nov", predicted: 72, actual: 69 },
  { date: "14 Nov", predicted: 76, actual: 74 },
  { date: "15 Nov", predicted: 78, actual: 76 },
  { date: "16 Nov", predicted: 74, actual: 72 },
  { date: "17 Nov", predicted: 70, actual: 68 },
  { date: "18 Nov", predicted: 66, actual: 64 },
  { date: "19 Nov", predicted: 63, actual: 61 },
  { date: "20 Nov", predicted: 61, actual: 63 },
  { date: "21 Nov", predicted: 65, actual: 62 },
  { date: "22 Nov", predicted: 68, actual: 66 },
  { date: "23 Nov", predicted: 66, actual: 69 },
  { date: "24 Nov", predicted: 62, actual: 59 },
  { date: "25 Nov", predicted: 65, actual: 60 },
  { date: "26 Nov", predicted: 69, actual: 74 },
  { date: "27 Nov", predicted: 71, actual: 68 },
  { date: "28 Nov", predicted: 78, actual: 72 },
  { date: "29 Nov", predicted: 78, actual: 75 },
  { date: "30 Nov", predicted: 72, actual: 70 },
];

export interface PredictionOutcome {
  date: string;
  predictedOccupancy: number;
  actualOccupancy: number;
  predictedRevenue: number;
  actualRevenue: number;
}

/** Within this many points, a prediction counts as accurate. */
export const ACCURACY_TOLERANCE = 4;

export const outcomes: PredictionOutcome[] = [
  { date: "30 Nov 2026", predictedOccupancy: 72, actualOccupancy: 70, predictedRevenue: 12_40_000, actualRevenue: 12_10_000 },
  { date: "29 Nov 2026", predictedOccupancy: 78, actualOccupancy: 75, predictedRevenue: 13_10_000, actualRevenue: 12_60_000 },
  { date: "28 Nov 2026", predictedOccupancy: 78, actualOccupancy: 72, predictedRevenue: 13_20_000, actualRevenue: 12_00_000 },
  { date: "27 Nov 2026", predictedOccupancy: 71, actualOccupancy: 68, predictedRevenue: 11_90_000, actualRevenue: 11_40_000 },
  { date: "26 Nov 2026", predictedOccupancy: 69, actualOccupancy: 74, predictedRevenue: 11_50_000, actualRevenue: 12_20_000 },
  { date: "25 Nov 2026", predictedOccupancy: 65, actualOccupancy: 60, predictedRevenue: 11_00_000, actualRevenue: 10_20_000 },
  { date: "24 Nov 2026", predictedOccupancy: 62, actualOccupancy: 59, predictedRevenue: 10_80_000, actualRevenue: 10_10_000 },
  { date: "23 Nov 2026", predictedOccupancy: 66, actualOccupancy: 69, predictedRevenue: 11_20_000, actualRevenue: 11_90_000 },
  { date: "22 Nov 2026", predictedOccupancy: 73, actualOccupancy: 71, predictedRevenue: 12_30_000, actualRevenue: 11_80_000 },
  { date: "21 Nov 2026", predictedOccupancy: 75, actualOccupancy: 78, predictedRevenue: 12_60_000, actualRevenue: 13_10_000 },
];

export const keyMetrics = {
  avgActual: 74,
  avgPredicted: 76,
  meanAbsoluteError: 4.8,
  rSquared: 0.89,
  /** Above this MAE, the banner stops saying accuracy is fine. */
  maeTarget: 6.0,
};

export const lastUpdated = "30 Nov 2026, 09:30 AM";
