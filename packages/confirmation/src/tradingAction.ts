import type { SetupState } from "@wulu/domain";
import type { OutcomeDetail } from "./outcomeTracking.js";

export type TradingAction = "WAIT" | "ENTER" | "SKIP" | "INVALIDATED";

export function outcomeDetailToStatusLabel(detail: OutcomeDetail): string {
  switch (detail) {
    case "HIT_STOP":
      return "STOP HIT";
    case "HIT_T1":
      return "TARGET HIT (T1)";
    case "HIT_T2":
      return "TARGET HIT (T2)";
    case "HIT_T3":
      return "TARGET HIT (T3)";
    case "AMBIGUOUS_STOP_AND_TARGET":
      return "STOP/TARGET AMBIGUOUS";
    case "INVALIDATED":
      return "INVALIDATED";
    case "EXPIRED":
      return "SETUP EXPIRED";
    case "OPEN":
      return "ENTRY ACTIVE";
    default:
      return "RESOLVED";
  }
}

export function deriveTradingAction(input: {
  state: SetupState | string;
  statusLabel: string;
  userStatus: string;
  dataFresh: boolean;
  entryExecutable: boolean;
  outcomeDetail?: OutcomeDetail | null;
}): TradingAction {
  if (input.outcomeDetail) {
    if (
      input.outcomeDetail === "HIT_STOP" ||
      input.outcomeDetail === "INVALIDATED" ||
      input.outcomeDetail === "AMBIGUOUS_STOP_AND_TARGET"
    ) {
      return "INVALIDATED";
    }
    if (
      input.outcomeDetail === "HIT_T1" ||
      input.outcomeDetail === "HIT_T2" ||
      input.outcomeDetail === "HIT_T3" ||
      input.outcomeDetail === "EXPIRED"
    ) {
      return "SKIP";
    }
  }

  const u = `${input.userStatus} ${input.statusLabel} ${input.state}`.toUpperCase();
  if (!input.dataFresh || u.includes("DATA NOT VERIFIED")) return "WAIT";
  if (u.includes("STOP HIT") || u.includes("INVALIDATED")) return "INVALIDATED";
  if (u.includes("TARGET HIT")) return "SKIP";
  if (u.includes("MISSED") || u.includes("NO TRADE")) return "SKIP";
  if (
    (u.includes("ENTRY ACTIVE") || u.includes("ENTRY_ACTIVE")) &&
    input.entryExecutable
  ) {
    return "ENTER";
  }
  if (u.includes("ENTRY ACTIVE") && !input.entryExecutable) return "WAIT";
  return "WAIT";
}

/** One-line “what we’re watching” for recommendation panels. */
export function buildWatchingSummary(input: {
  symbol: string;
  side: string;
  strategyName: string | null;
  alertAt: number | null;
  waitingFor: string[];
  tradingAction: TradingAction;
}): string {
  const strat = input.strategyName ? `${input.strategyName}` : `${input.side} setup`;
  const trigger =
    input.alertAt != null && Number.isFinite(input.alertAt)
      ? `trigger ${input.alertAt.toFixed(2)}`
      : "trigger level";
  const missing = input.waitingFor[0];
  if (input.tradingAction === "ENTER") {
    return `Watching ${input.symbol} ${strat} — confirmation met; ${trigger}. Verify live before acting.`;
  }
  if (input.tradingAction === "INVALIDATED") {
    return `Was watching ${input.symbol} ${strat} — setup no longer valid.`;
  }
  if (input.tradingAction === "SKIP") {
    return `${input.symbol} ${strat} — no action (missed, closed, or filters failed).`;
  }
  if (missing) {
    return `Watching ${input.symbol} ${strat} at ${trigger}. Still need: ${missing}`;
  }
  return `Watching ${input.symbol} ${strat} at ${trigger}. Waiting for 5m confirmation and checklist.`;
}
