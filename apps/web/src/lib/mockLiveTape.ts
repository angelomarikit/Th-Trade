/** Deterministic micro-ticks for mock RTH — client only, never sent to the API. */

export const MOCK_TAPE_INTERVAL_MS = 2_500;

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
}): number {
  const { symbol, step, prevClose, anchor } = input;
  if (!Number.isFinite(prevClose) || prevClose <= 0) return prevClose;
  const base = hashSymbol(symbol.toUpperCase());
  const r1 = unitRandom(base + step * 17);
  const r2 = unitRandom(base + step * 31 + 7);
  /** ~0.03–0.12% move per tick — visible but not absurd on a $200 name. */
  const volPct = 0.0003 + r2 * 0.0009;
  const shock = (r1 - 0.5) * 2 * prevClose * volPct;
  const meanRevert = (anchor - prevClose) * 0.035;
  let next = prevClose + shock + meanRevert;
  const band = anchor * 0.015;
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
