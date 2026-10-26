/**
 * Research / live confirmation parameters — override via environment (preview + production).
 * Defaults match WULU owner research brief (Oct 2026).
 */
export interface ConfirmationConfig {
  minRelativeVolume: number;
  minRewardToRisk: number;
  maxSpreadPct: number;
  rsiBullMin: number;
  rsiBearMax: number;
  atrExtensionMultiple: number;
  fiveMinCloseBufferPct: number;
  orbMinutes: number;
  minTechniqueScore: number;
}

export const DEFAULT_CONFIRMATION_CONFIG: ConfirmationConfig = {
  minRelativeVolume: 1.5,
  minRewardToRisk: 2,
  maxSpreadPct: 0.2,
  rsiBullMin: 50,
  rsiBearMax: 50,
  atrExtensionMultiple: 0.5,
  fiveMinCloseBufferPct: 0.0005,
  orbMinutes: 15,
  minTechniqueScore: 25,
};

function num(env: string | undefined, fallback: number): number {
  if (env == null || env.trim() === "") return fallback;
  const n = Number(env);
  return Number.isFinite(n) ? n : fallback;
}

/** Load from process.env when available (Node API); falls back to defaults elsewhere. */
export function loadConfirmationConfig(
  env: Record<string, string | undefined> = typeof process !== "undefined"
    ? (process.env as Record<string, string | undefined>)
    : {},
): ConfirmationConfig {
  const d = DEFAULT_CONFIRMATION_CONFIG;
  return {
    minRelativeVolume: num(env.WULU_MIN_RVOL, d.minRelativeVolume),
    minRewardToRisk: num(env.WULU_MIN_RR, d.minRewardToRisk),
    maxSpreadPct: num(env.WULU_MAX_SPREAD_PCT, d.maxSpreadPct),
    rsiBullMin: num(env.WULU_RSI_BULL_MIN, d.rsiBullMin),
    rsiBearMax: num(env.WULU_RSI_BEAR_MAX, d.rsiBearMax),
    atrExtensionMultiple: num(env.WULU_ATR_EXTENSION, d.atrExtensionMultiple),
    fiveMinCloseBufferPct: num(env.WULU_FIVE_MIN_BUFFER, d.fiveMinCloseBufferPct),
    orbMinutes: num(env.WULU_ORB_MINUTES, d.orbMinutes),
    minTechniqueScore: num(env.WULU_MIN_TECHNIQUE_SCORE, d.minTechniqueScore),
  };
}
