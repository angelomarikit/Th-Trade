export type MarketSession =
  | "RTH"
  | "PREMARKET"
  | "AFTERHOURS"
  | "CLOSED"
  | "WEEKEND";

export interface SessionSnapshot {
  session: MarketSession;
  /** America/New_York wall clock used for classification */
  etLabel: string;
  isRegularHours: boolean;
  /** True when live confirmation should use tightened rules */
  tightenConfirmation: boolean;
  maxDataAgeMs: number;
  reason: string;
}

/** US equity regular session 09:30–16:00 America/New_York. */
export function classifyUsEquitySession(now: Date = new Date()): SessionSnapshot {
  const parts = etParts(now);
  const etLabel = `${parts.weekday} ${pad(parts.hour)}:${pad(parts.minute)} ET`;

  if (parts.weekday === "Sat" || parts.weekday === "Sun") {
    return {
      session: "WEEKEND",
      etLabel,
      isRegularHours: false,
      tightenConfirmation: false,
      maxDataAgeMs: 0,
      reason: "Weekend — market closed; fail closed on live entry",
    };
  }

  const mins = parts.hour * 60 + parts.minute;
  const rthOpen = 9 * 60 + 30;
  const rthClose = 16 * 60;
  const preOpen = 4 * 60;
  const ahEnd = 20 * 60;

  if (mins >= rthOpen && mins < rthClose) {
    return {
      session: "RTH",
      etLabel,
      isRegularHours: true,
      tightenConfirmation: true,
      maxDataAgeMs: 45_000,
      reason: "Regular trading hours — tightened confirmation + 45s freshness",
    };
  }

  if (mins >= preOpen && mins < rthOpen) {
    return {
      session: "PREMARKET",
      etLabel,
      isRegularHours: false,
      tightenConfirmation: false,
      maxDataAgeMs: 120_000,
      reason: "Premarket — wider freshness; ENTRY ACTIVE still requires full confirmation",
    };
  }

  if (mins >= rthClose && mins < ahEnd) {
    return {
      session: "AFTERHOURS",
      etLabel,
      isRegularHours: false,
      tightenConfirmation: false,
      maxDataAgeMs: 180_000,
      reason: "After hours — quotes often stale/wide; prefer NO TRADE / DATA NOT VERIFIED",
    };
  }

  return {
    session: "CLOSED",
    etLabel,
    isRegularHours: false,
    tightenConfirmation: false,
    maxDataAgeMs: 0,
    reason: "Outside extended hours — fail closed",
  };
}

export interface ConfirmationProfile {
  session: MarketSession;
  minRelativeVolume: number;
  maxSpreadPct: number;
  /** During RTH, conflicting regime/sector blocks entry */
  requireRegimeAlignmentForEntry: boolean;
  requireSectorAlignmentForEntry: boolean;
  minRewardToRisk: number;
  maxDataAgeMs: number;
  reason: string;
}

export function confirmationProfileForSession(
  session: SessionSnapshot = classifyUsEquitySession(),
): ConfirmationProfile {
  if (session.session === "RTH") {
    return {
      session: session.session,
      minRelativeVolume: 1.5,
      maxSpreadPct: 0.2,
      requireRegimeAlignmentForEntry: true,
      requireSectorAlignmentForEntry: false,
      minRewardToRisk: 1.8,
      maxDataAgeMs: session.maxDataAgeMs,
      reason: session.reason,
    };
  }

  // Extended / closed — do not loosen entry rules; freshness handled separately
  return {
    session: session.session,
    minRelativeVolume: 1.2,
    maxSpreadPct: 0.35,
    requireRegimeAlignmentForEntry: false,
    requireSectorAlignmentForEntry: false,
    minRewardToRisk: 1.5,
    maxDataAgeMs: session.maxDataAgeMs,
    reason: session.reason,
  };
}

function etParts(now: Date): {
  weekday: string;
  hour: number;
  minute: number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    weekday: bag.weekday ?? "",
    hour: Number(bag.hour),
    minute: Number(bag.minute),
  };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
