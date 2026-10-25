import type { ServerResponse } from "node:http";
import type { SignalOutcomeTracker } from "@wulu/confirmation";
import type { TradeSide } from "@wulu/domain";
import { barEffectiveEndTime, type MarketDataProvider, withAlpacaPriority } from "@wulu/market-data";
import { normalizeTicker, type SetupScanner } from "@wulu/scanner";
import { isWuluLabModeEnabled } from "../monitor/planCap.js";
import type { PlanChartBar } from "../recommend/chartContextForPlan.js";
import { buildWuluPlanForCard } from "./buildWuluPlan.js";

export async function handleWuluPlanPost(input: {
  body: {
    symbol?: string;
    side?: string;
    lab?: boolean;
    mockRth?: boolean;
    mockEnter?: boolean;
    chart?: { timeframe?: string; bars?: PlanChartBar[] };
  };
  scanner: SetupScanner;
  marketData: MarketDataProvider;
  outcomeTracker: SignalOutcomeTracker;
  interactiveSetupState: Map<string, import("@wulu/domain").SetupState>;
  setupStateKey: (symbol: string, side: TradeSide) => string;
  json: (res: ServerResponse, code: number, payload: unknown) => void;
  res: ServerResponse;
}): Promise<void> {
  const sym = normalizeTicker((input.body.symbol ?? "").toUpperCase());
  const sideParam = (input.body.side ?? "LONG").toUpperCase();
  if (!sym || (sideParam !== "LONG" && sideParam !== "SHORT")) {
    input.json(input.res, 400, { error: "symbol and side required" });
    return;
  }
  const side = sideParam as TradeSide;
  const labMode = input.body.lab === true && isWuluLabModeEnabled();
  const mockRth = input.body.mockRth === true && labMode;
  const mockEnter = input.body.mockEnter === true && mockRth && labMode;
  const rthBarsOnly = !labMode || mockRth;

  await withAlpacaPriority("interactive", async () => {
    const [bars5m, quote] = await Promise.all([
      input.marketData.getBars({
        symbol: sym,
        timeframe: "5Min",
        limit: labMode ? 120 : 60,
        regularHoursOnly: rthBarsOnly,
      }),
      input.marketData.getQuote(sym),
    ]);
    const lastBar = bars5m.at(-1);
    const lastPrice =
      quote && quote.bid > 0 && quote.ask > 0
        ? (quote.bid + quote.ask) / 2
        : (lastBar?.close ?? 0);
    const bars1m = await input.marketData.getBars({
      symbol: sym,
      timeframe: "1Min",
      limit: labMode ? 120 : 40,
      regularHoursOnly: rthBarsOnly,
    });
    const last1m = bars1m.at(-1) ?? lastBar;
    const snapshot = {
      symbol: sym,
      lastPrice,
      quote,
      bars1m: bars1m.length ? bars1m : bars5m,
      bars5m,
      receivedAt: new Date(),
      marketTimestamp: quote?.timestamp ?? (last1m ? barEffectiveEndTime(last1m) : null),
    };
    const stateKey = input.setupStateKey(sym, side);
    const { card } = await input.scanner.scanWithJournal({
      symbol: sym,
      side,
      preloadedSnapshot: snapshot,
      previousState: input.interactiveSetupState.get(stateKey),
      labMode,
      mockRth,
      mockEnter,
    });
    input.interactiveSetupState.set(stateKey, card.state);

    const clientBars = input.body.chart?.bars?.filter((b) => Number.isFinite(b.close)) ?? [];
    const chart =
      clientBars.length > 0
        ? {
            timeframe: input.body.chart?.timeframe ?? "5m",
            bars: clientBars.slice(-24),
          }
        : undefined;

    const { tradePlan } = await buildWuluPlanForCard({
      card,
      side,
      mockRth,
      labMode,
      outcomeTracker: input.outcomeTracker,
      chart,
    });

    input.json(input.res, 200, {
      tradePlan,
      openaiConfigured: tradePlan.briefSource === "model" || undefined,
      source: "wulu_plan_v1",
    });
  });
}
