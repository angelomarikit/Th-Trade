/** Shared chart timeframe ids for Scanner instrument row and CandleChart toolbar. */
export const CHART_TIMEFRAMES = [
  { id: "1m", label: "1m" },
  { id: "5m", label: "5m" },
  { id: "15m", label: "15m" },
  { id: "1h", label: "1h" },
  { id: "1D", label: "1D" },
] as const;

export type ChartTimeframeId = (typeof CHART_TIMEFRAMES)[number]["id"];
