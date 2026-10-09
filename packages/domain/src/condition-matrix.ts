export const CONDITION_IDS = [
  "MARKET_REGIME",
  "SECTOR_ALIGNMENT",
  "RELATIVE_VOLUME",
  "VWAP",
  "STRUCTURE",
  "NEWS_CATALYST",
  "FIVE_MIN_CONFIRMATION",
  "RISK_REWARD",
  "LIQUIDITY",
  "DATA_FRESHNESS",
] as const;

export type ConditionId = (typeof CONDITION_IDS)[number];

export type ConditionStatus = "PASS" | "WAITING" | "FAIL" | "N_A";

export interface ConditionRow {
  id: ConditionId;
  label: string;
  status: ConditionStatus;
  /** Deterministic machine-readable reason — never LLM-invented PASS */
  reason: string;
  /** True if this row must PASS before ENTRY ACTIVE */
  requiredForEntry: boolean;
}

export interface ConditionMatrix {
  rows: ConditionRow[];
  passed: number;
  total: number;
  /** Human lines for "Still waiting for" */
  waitingFor: string[];
  allRequiredPassed: boolean;
}

export const CONDITION_LABELS: Record<ConditionId, string> = {
  MARKET_REGIME: "MARKET REGIME",
  SECTOR_ALIGNMENT: "SECTOR ALIGNMENT",
  RELATIVE_VOLUME: "RELATIVE VOLUME",
  VWAP: "VWAP",
  STRUCTURE: "STRUCTURE",
  NEWS_CATALYST: "NEWS CATALYST",
  FIVE_MIN_CONFIRMATION: "5-MIN CONFIRMATION",
  RISK_REWARD: "R:R",
  LIQUIDITY: "LIQUIDITY",
  DATA_FRESHNESS: "DATA FRESHNESS",
};

export function buildConditionMatrix(rows: ConditionRow[]): ConditionMatrix {
  const relevant = rows.filter((r) => r.status !== "N_A");
  const passed = relevant.filter((r) => r.status === "PASS").length;
  const waitingFor = rows
    .filter((r) => r.status === "WAITING")
    .map((r) => r.reason);
  const required = rows.filter((r) => r.requiredForEntry);
  const allRequiredPassed = required.every((r) => r.status === "PASS");

  return {
    rows,
    passed,
    total: relevant.length,
    waitingFor,
    allRequiredPassed,
  };
}
