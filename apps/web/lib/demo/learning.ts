/**
 * Demo data for the AI Learning & Readiness page (Day 9).
 *
 * Tracks the cold-start status of every ML engine in the Vesper stack,
 * recent model retraining events, and shadow-mode audit log entries.
 */

export interface EngineStatus {
  id: string;
  name: string;
  description: string;
  status: "ready" | "warming" | "cold" | "shadow";
  accuracy: number;
  dataPointsIngested: number;
  dataPointsRequired: number;
  lastRetrained: string;
  nextRetraining: string;
  shadowMode: boolean;
  confidenceThreshold: number;
}

export interface TrainingEvent {
  id: string;
  engine: string;
  type: "retrain" | "calibration" | "cold_start" | "data_ingestion";
  description: string;
  timestamp: string;
  durationMs: number;
  metricsImprovement: string;
}

export const engines: EngineStatus[] = [
  {
    id: "eng_prophet",
    name: "Prophet Demand Forecaster",
    description: "Predicts occupancy demand 14–90 days out using time-series decomposition with holiday and event regressors.",
    status: "ready",
    accuracy: 91.4,
    dataPointsIngested: 45_200,
    dataPointsRequired: 10_000,
    lastRetrained: "3 days ago",
    nextRetraining: "In 4 days",
    shadowMode: false,
    confidenceThreshold: 85,
  },
  {
    id: "eng_xgboost",
    name: "XGBoost ADR Optimizer",
    description: "Gradient-boosted pricing model that sets daily room rates based on demand, comp-set, and booking pace.",
    status: "ready",
    accuracy: 88.7,
    dataPointsIngested: 38_400,
    dataPointsRequired: 15_000,
    lastRetrained: "1 day ago",
    nextRetraining: "In 6 days",
    shadowMode: false,
    confidenceThreshold: 82,
  },
  {
    id: "eng_cpsat",
    name: "CP-SAT Roster Solver",
    description: "Constraint-satisfaction scheduler that allocates 180 staff across 3 shifts to minimise gaps and overtime.",
    status: "ready",
    accuracy: 95.2,
    dataPointsIngested: 12_800,
    dataPointsRequired: 5_000,
    lastRetrained: "6 hours ago",
    nextRetraining: "Tomorrow 02:00",
    shadowMode: false,
    confidenceThreshold: 90,
  },
  {
    id: "eng_sentiment",
    name: "Guest Sentiment NLP",
    description: "Transformer-based model that analyses feedback, reviews and chat messages to surface satisfaction scores.",
    status: "warming",
    accuracy: 78.3,
    dataPointsIngested: 6_200,
    dataPointsRequired: 10_000,
    lastRetrained: "12 hours ago",
    nextRetraining: "In 2 days",
    shadowMode: true,
    confidenceThreshold: 75,
  },
  {
    id: "eng_bms",
    name: "BMS Anomaly Detector",
    description: "Isolation-forest model monitoring chiller vibration, bearing temperature and power draw for predictive maintenance.",
    status: "ready",
    accuracy: 93.1,
    dataPointsIngested: 128_400,
    dataPointsRequired: 50_000,
    lastRetrained: "2 days ago",
    nextRetraining: "In 5 days",
    shadowMode: false,
    confidenceThreshold: 88,
  },
  {
    id: "eng_inventory",
    name: "Inventory Auto-Reorder",
    description: "Tracks par-level breaches across F&B and linen stores and generates purchase orders autonomously.",
    status: "cold",
    accuracy: 0,
    dataPointsIngested: 1_200,
    dataPointsRequired: 8_000,
    lastRetrained: "Never",
    nextRetraining: "Pending data",
    shadowMode: true,
    confidenceThreshold: 80,
  },
];

export const recentTrainingEvents: TrainingEvent[] = [
  {
    id: "trn_001",
    engine: "Prophet Demand Forecaster",
    type: "retrain",
    description: "Weekly retrain on 45.2k booking records. MAPE improved from 11.2% → 8.6%.",
    timestamp: "3 days ago",
    durationMs: 42_300,
    metricsImprovement: "+2.6% MAPE reduction",
  },
  {
    id: "trn_002",
    engine: "XGBoost ADR Optimizer",
    type: "retrain",
    description: "Incremental retrain with 1,200 new booking-pace features. R² improved 0.84 → 0.887.",
    timestamp: "1 day ago",
    durationMs: 18_700,
    metricsImprovement: "+4.7% R² improvement",
  },
  {
    id: "trn_003",
    engine: "CP-SAT Roster Solver",
    type: "calibration",
    description: "Constraint weights recalibrated for monsoon staffing surge. Overtime reduced 14% in simulation.",
    timestamp: "6 hours ago",
    durationMs: 8_200,
    metricsImprovement: "−14% projected overtime",
  },
  {
    id: "trn_004",
    engine: "Guest Sentiment NLP",
    type: "data_ingestion",
    description: "Ingested 1,800 new review fragments. Model still in shadow mode; needs 3,800 more for production.",
    timestamp: "12 hours ago",
    durationMs: 5_400,
    metricsImprovement: "+6.1% coverage improvement",
  },
  {
    id: "trn_005",
    engine: "BMS Anomaly Detector",
    type: "retrain",
    description: "Re-fitted isolation forest with 128k sensor readings. False-positive rate dropped to 2.3%.",
    timestamp: "2 days ago",
    durationMs: 31_100,
    metricsImprovement: "−1.8% false-positive rate",
  },
  {
    id: "trn_006",
    engine: "Inventory Auto-Reorder",
    type: "cold_start",
    description: "Cold start: awaiting 6,800 more stock movement records before first training run.",
    timestamp: "Today",
    durationMs: 0,
    metricsImprovement: "Not yet trained",
  },
];
