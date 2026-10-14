import type { BarsResponse } from "./api";

const PREFIX = "wulu:bars:v2:";
const TTL_MS = 45_000;

function key(symbol: string, timeframe: string, extendedHours = false): string {
  return `${PREFIX}${symbol.toUpperCase()}:${timeframe}:${extendedHours ? "all" : "rth"}`;
}

export function readBarsCache(symbol: string, timeframe: string, extendedHours = false): BarsResponse | null {
  try {
    const raw = sessionStorage.getItem(key(symbol, timeframe, extendedHours));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: BarsResponse };
    if (!parsed?.data?.bars?.length || Date.now() - parsed.at > TTL_MS) {
      sessionStorage.removeItem(key(symbol, timeframe, extendedHours));
      return null;
    }
    if (parsed.data.symbol?.toUpperCase() !== symbol.toUpperCase()) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeBarsCache(
  symbol: string,
  timeframe: string,
  data: BarsResponse,
  extendedHours = false,
): void {
  try {
    sessionStorage.setItem(
      key(symbol, timeframe, extendedHours),
      JSON.stringify({ at: Date.now(), data }),
    );
  } catch {
    /* quota / private mode */
  }
}
