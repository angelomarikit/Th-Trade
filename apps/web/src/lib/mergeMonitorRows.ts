import type { MonitorSnapshot, MonitorSymbolState } from "./api";

/** One row per configured symbol, in watchlist order. */
export function mergeMonitorRows(snap: MonitorSnapshot | null): MonitorSymbolState[] {
  if (!snap) return [];
  const bySymbol = new Map(snap.states.map((s) => [s.symbol, s]));
  const order =
    snap.symbols.length > 0
      ? snap.symbols
      : snap.states.map((s) => ({ symbol: s.symbol, side: s.side as "LONG" | "SHORT" }));
  return order
    .map(({ symbol }) => bySymbol.get(symbol))
    .filter((s): s is MonitorSymbolState => !!s);
}
