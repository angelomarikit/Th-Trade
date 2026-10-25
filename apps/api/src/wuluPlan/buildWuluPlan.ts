import type { LiveSetupCard } from "@wulu/confirmation";
import type { TradeSide } from "@wulu/domain";
import {
  deriveTradingAction,
  enforceOneSideTradingAction,
  outcomeDetailToStatusLabel,
  type SignalOutcomeTracker,
} from "@wulu/confirmation";
import { classifyUsEquitySession } from "@wulu/market-data";
import { openAiConfigured } from "../recommend/openaiEnv.js";
import {
  buildChartContextForPlan,
  type PlanChartBar,
} from "../recommend/chartContextForPlan.js";
import { buildTradePlan, type TradePlanPayload } from "../recommend/tradePlan.js";

export async function buildWuluPlanForCard(input: {
  card: LiveSetupCard;
  side: TradeSide;
  mockRth: boolean;
  labMode: boolean;
  outcomeTracker: SignalOutcomeTracker;
  chart?: { timeframe: string; bars: PlanChartBar[] };
}): Promise<{ tradePlan: TradePlanPayload; tradingAction: ReturnType<typeof deriveTradingAction> }> {
  const { card, side, mockRth, labMode, outcomeTracker, chart } = input;
  const setupTrack = outcomeTracker.onCard(card, null, "LIVE", card.lastCompletedBar);
  const resolvedDetail = setupTrack.resolution?.detail ?? null;
  let displayStatus = resolvedDetail
    ? outcomeDetailToStatusLabel(resolvedDetail)
    : card.statusLabel;
  let tradingAction = deriveTradingAction({
    state: card.state,
    statusLabel: displayStatus,
    userStatus: displayStatus,
    dataFresh: card.dataFresh,
    entryExecutable: card.entryZone.executable,
    outcomeDetail: resolvedDetail,
    rewardToRisk: card.rewardToRisk,
    minRewardToRisk: mockRth ? 0 : undefined,
  });
  tradingAction = enforceOneSideTradingAction({
    selectedSide: side,
    cardSide: card.side,
    tradingAction,
    labMockEnterAuthorizedSide: card.labMockEnterAuthorizedSide ?? null,
    mockEnter: card.mockEnter === true,
  });
  if (labMode && !classifyUsEquitySession().isRegularHours) {
    if (!mockRth) tradingAction = "WAIT";
  }

  const chartContext =
    chart && chart.bars.length > 0
      ? buildChartContextForPlan({
          symbol: card.symbol,
          timeframe: chart.timeframe,
          bars: chart.bars,
          levels: {
            alertAt: card.alertAt,
            entryLow: card.entryZone.low,
            entryHigh: card.entryZone.high,
            stop: card.stop,
            t1: card.target1,
          },
          lastPrice: card.lastPrice,
        })
      : null;

  const tradePlan = await buildTradePlan({
    card,
    side,
    tradingAction,
    withModel: openAiConfigured(),
    chartContext,
  });

  return { tradePlan, tradingAction };
}
