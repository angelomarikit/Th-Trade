import type { RegimeSnapshot } from "./labels.js";

export interface MorningBrief {
  market: RegimeSnapshot["bias"];
  marketRegime: string;
  majorEventsToday: string[];
  candidates: MorningCandidate[];
  regimeReasons: string[];
  strategyGates: RegimeSnapshot["strategyGates"];
  generatedAt: string;
  note: string;
}

export interface MorningCandidate {
  rank: number;
  ticker: string;
  side: string;
  whyMoving: string;
  catalyst: string | null;
  status: string;
  alertAt: number;
  setupScore: number;
}

/** Minimal setup shape for morning ranking (avoids coupling to confirmation package). */
export interface MorningSetupInput {
  symbol: string;
  side: string;
  state: string;
  statusLabel: string;
  whyMoving: { whyMoving: string; catalystLabel: string | null };
  alertAt: number;
  setupScore: { total: number };
}

/**
 * Morning ranked list — only include strongest candidates provided.
 * Never invent events or force five trades.
 */
export function buildMorningBrief(input: {
  regime: RegimeSnapshot;
  setups?: MorningSetupInput[];
  majorEventsToday?: string[];
  maxCandidates?: number;
}): MorningBrief {
  const max = input.maxCandidates ?? 5;
  const ranked = [...(input.setups ?? [])]
    .filter(
      (s) =>
        s.state === "NEAR_ACTIVE" ||
        s.state === "WAIT" ||
        s.state.startsWith("ENTRY_ACTIVE"),
    )
    .sort((a, b) => b.setupScore.total - a.setupScore.total)
    .slice(0, max);

  const events =
    input.majorEventsToday && input.majorEventsToday.length > 0
      ? input.majorEventsToday
      : ["No scheduled event calendar loaded yet (Phase C stub)"];

  return {
    market: input.regime.bias,
    marketRegime: input.regime.primary.replaceAll("_", " "),
    majorEventsToday: events,
    candidates: ranked.map((s, i) => ({
      rank: i + 1,
      ticker: s.symbol,
      side: s.side,
      whyMoving: s.whyMoving.whyMoving,
      catalyst: s.whyMoving.catalystLabel,
      status: s.statusLabel,
      alertAt: s.alertAt,
      setupScore: s.setupScore.total,
    })),
    regimeReasons: input.regime.reasons,
    strategyGates: input.regime.strategyGates,
    generatedAt: input.regime.evaluatedAt,
    note: "Never force trades — empty candidates is a valid morning outcome.",
  };
}

export function formatMorningBriefText(brief: MorningBrief): string {
  const lines = [
    `MARKET:`,
    brief.market,
    `MARKET REGIME:`,
    brief.marketRegime,
    `MAJOR EVENTS TODAY:`,
    ...brief.majorEventsToday.map((e) => `- ${e}`),
  ];

  if (brief.candidates.length === 0) {
    lines.push(`CANDIDATES:`, `NONE — NO TRADE`);
  } else {
    for (const c of brief.candidates) {
      lines.push(
        `#${c.rank} ${c.ticker} — ${c.side}`,
        `WHY MOVING: ${c.whyMoving}`,
        `CATALYST: ${c.catalyst ?? "—"}`,
        `ALERT AT: $${c.alertAt.toFixed(2)}`,
        `STATUS: ${c.status}`,
        `SETUP SCORE: ${c.setupScore}/100`,
        ``,
      );
    }
  }
  return lines.join("\n");
}
