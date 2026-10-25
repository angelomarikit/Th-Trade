/** Deterministic lab tape — client only, never sent to the API. */

import type { ChartTimeframeId } from "./chartTimeframes";

/** Real-time RTH: one lab tick per chart bar period (1m → ~60s between updates). */
export const MOCK_TAPE_RTH_REALTIME = true;

const PERIOD_MS: Record<ChartTimeframeId, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "1D": 86_400_000,
};

export function barPeriodMs(chartTf: string): number {
  const id = chartTf as ChartTimeframeId;
  return PERIOD_MS[id] ?? 60_000;
}

/**
 * How often the lab tape may nudge the forming candle — matches RTH bar cadence.
 * 1h/1D charts: at most once per real minute (SIP replay has no live hourly stream).
 */
export function mockTapeIntervalMs(chartTf: string): number {
  const period = barPeriodMs(chartTf);
  if (period >= 3_600_000) return 60_000;
  if (MOCK_TAPE_RTH_REALTIME) return period;
  return Math.max(period, 15_000);
}

function hashSymbol(symbol: string): number {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i++) {
    h ^= symbol.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function unitRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function tickSimulatedPrice(input: {
  symbol: string;
  step: number;
  prevClose: number;
  anchor: number;
  /** Scale down moves when ticks are RTH-spaced (default 1). */
  moveScale?: number;
}): number {
  const { symbol, step, prevClose, anchor } = input;
  const scale = input.moveScale ?? 1;
  if (!Number.isFinite(prevClose) || prevClose <= 0) return prevClose;
  const base = hashSymbol(symbol.toUpperCase());
  const r1 = unitRandom(base + step * 17);
  const r2 = unitRandom(base + step * 31 + 7);
  /** Small intrabar move — one step per bar period, not HFT. */
  const volPct = (0.00008 + r2 * 0.00025) * scale;
  const shock = (r1 - 0.5) * 2 * prevClose * volPct;
  const meanRevert = (anchor - prevClose) * 0.012 * scale;
  let next = prevClose + shock + meanRevert;
  const band = anchor * 0.008;
  next = Math.max(anchor - band, Math.min(anchor + band, next));
  return Math.round(next * 100) / 100;
}

export function mockTapeActive(
  mockTradingMode: boolean,
  mockLiveRthMode: boolean,
  labTestDataMode: boolean,
): boolean {
  return mockTradingMode && mockLiveRthMode && labTestDataMode;
}

/** Human label for settings / banner. */
export function mockTapeCadenceLabel(chartTf: string): string {
  const ms = mockTapeIntervalMs(chartTf);
  if (ms >= 60_000) {
    const min = Math.round(ms / 60_000);
    return min === 1 ? "~1 min per update (RTH 1m bar)" : `~${min} min per update (RTH ${chartTf} bar)`;
  }
  return `~${Math.round(ms / 1000)}s per update`;
}
