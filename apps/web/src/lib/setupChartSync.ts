/** When chart level lines should hide vs the latest setup evaluation. */
export function isSetupChartStale(params: {
  symbol: string;
  setupSymbol?: string | null;
  barsSymbol?: string | null;
  setupEvaluatedAt?: string | null;
  /** When true, never show levels while a scan is in flight for another ticker. */
  loading?: boolean;
}): boolean {
  if (params.loading) return true;

  const sym = params.symbol.trim().toUpperCase();
  const barsSym = params.barsSymbol?.trim().toUpperCase();
  const setupSym = params.setupSymbol?.trim().toUpperCase();

  if (!barsSym || barsSym !== sym) return true;
  if (setupSym && setupSym !== sym) return true;
  // No setup loaded yet — not a stale sync; initial scan still pending.
  if (!setupSym && !params.setupEvaluatedAt) return false;

  const ageMs = params.setupEvaluatedAt
    ? Date.now() - Date.parse(params.setupEvaluatedAt)
    : Number.POSITIVE_INFINITY;

  // Levels always represent the last completed scan — hide when that scan is too old.
  return !Number.isFinite(ageMs) || ageMs > 30_000;
}

/** Chart overlays only when ticker, bars, and setup evaluation align. */
export function canShowSetupChartLevels(params: {
  symbol: string;
  setupSymbol?: string | null;
  barsSymbol?: string | null;
  setupEvaluatedAt?: string | null;
  loading?: boolean;
  dataFresh?: boolean;
}): boolean {
  if (params.dataFresh === false) return false;
  return !isSetupChartStale(params);
}
