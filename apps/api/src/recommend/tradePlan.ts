import type { LiveSetupCard } from "@wulu/confirmation";
import { buildTradePlanSuccessRate, type TradeSide } from "@wulu/domain";
import { readOpenAiApiKey, readOpenAiModel } from "./openaiEnv.js";
import { openAiConfigured } from "./openaiEnv.js";
import { signalFromCard } from "./fromCard.js";
import type { TradeAction } from "./engine.js";

export interface TradePlanSuccessRate {
  winRatePct: number | null;
  sampleSize: number;
  strategyName: string | null;
  expectancyR: number | null;
  qualityScore10: number | null;
  qualityDisclaimer: string;
  headline: string;
  showWinRatePct: boolean;
}

export interface TradePlanSections {
  whyThisZone: string;
  whatToDoNow: string;
  gatesAndNews: string;
  chartRead: string;
  risks: string[];
  outlook: string;
}

export interface TradePlanPayload {
  symbol: string;
  side: TradeSide;
  action: TradeAction;
  tradingAction: "WAIT" | "ENTER" | "SKIP" | "INVALIDATED";
  sections: TradePlanSections;
  successRate: TradePlanSuccessRate;
  briefSource: "rules" | "model";
  gatesPassed: Array<{ label: string; reason: string }>;
  gatesBlocking: Array<{ label: string; reason: string; status: string }>;
}

function successRateFromCard(card: LiveSetupCard): TradePlanSuccessRate {
  const edge = card.historicalEdge;
  return buildTradePlanSuccessRate({
    sampleSize: edge?.sampleSize ?? 0,
    winRatePct: edge?.winRatePct,
    expectancyR: edge?.expectancyR ?? null,
    edgeStrategyName: edge?.strategyName ?? null,
    activeStrategyName: card.activeTechnique?.strategyName ?? null,
    qualityScore10: card.qualityScore10?.score ?? null,
    qualityDisclaimer: card.qualityScore10?.disclaimer ?? null,
  });
}

function activeTechniqueForPlan(card: LiveSetupCard): Record<string, unknown> | null {
  const t = card.activeTechnique;
  if (!t) return null;
  return {
    strategyId: t.strategyId,
    strategyName: t.strategyName,
    family: t.family,
    phase: t.phase,
    trendContext: t.trendContext,
    entryTriggerDescription: t.entryTriggerDescription,
    statusReason: t.statusReason,
    invalidationRules: t.invalidationRules,
    requiredConfirmations: t.confirmations.filter((c) => c.required),
  };
}

function gateRows(card: LiveSetupCard) {
  const rows = card.matrix.rows.filter((r) => r.requiredForEntry);
  const passed = rows.filter((r) => r.status === "PASS");
  const blocking = rows.filter((r) => r.status === "FAIL" || r.status === "WAITING");
  return {
    passed: passed.map((r) => ({ label: r.label, reason: r.reason })),
    blocking: blocking.map((r) => ({
      label: r.label,
      reason: r.reason,
      status: r.status,
    })),
  };
}

function buildFallbackSections(input: {
  card: LiveSetupCard;
  side: TradeSide;
  action: TradeAction;
  tradingAction: TradePlanPayload["tradingAction"];
}): TradePlanSections {
  const { card, side, action, tradingAction } = input;
  const zone = `${card.entryZone.low.toFixed(2)}–${card.entryZone.high.toFixed(2)}`;
  const geo = card.entryGeometry?.summary;
  const tech = card.activeTechnique;
  const whyThisZone = tech
    ? `${tech.strategyName} (${tech.phase}): ${tech.entryTriggerDescription} Trigger ${card.alertAt.toFixed(2)}; zone ${zone}. ${tech.statusReason}`
    : geo ??
      `${side} setup at trigger ${card.alertAt.toFixed(2)}; entry zone ${zone}. Last ${card.lastPrice.toFixed(2)}.`;

  const { blocking } = gateRows(card);
  const blockText =
    blocking.length > 0
      ? blocking.map((b) => `${b.label}: ${b.reason}`).join("; ")
      : "All required confirmations PASS";

  let whatToDoNow: string;
  switch (tradingAction) {
    case "ENTER":
      whatToDoNow = tech
        ? `Engine: ENTER ${side} on ${tech.strategyName} — all required confirmations passed. Entry ${zone}, stop ${card.stop.toFixed(2)}, T1 ${card.target1.toFixed(2)}. Signal: ${action}. No auto orders.`
        : `Engine: ENTER ${side}. Plan entry ${zone}, stop ${card.stop.toFixed(2)}, T1 ${card.target1.toFixed(2)}. Signal recommendation: ${action}. Size manually — no auto orders.`;
      break;
    case "SKIP":
      whatToDoNow = tech
        ? `SKIP — ${tech.strategyName}: ${tech.statusReason} Blocking: ${blockText}`
        : "Do not chase — skip this signal and wait for a fresh evaluation.";
      break;
    case "INVALIDATED":
      whatToDoNow = tech
        ? `INVALIDATED — ${tech.strategyName}. ${tech.invalidationRules[0] ?? tech.statusReason}`
        : "Stand aside — structure or stop logic invalidated this setup.";
      break;
    default:
      whatToDoNow = tech
        ? `WAIT — ${tech.strategyName} (${tech.phase}). ${tech.statusReason} Still need: ${blockText}. Signal: ${action}.`
        : `Wait — ${card.nearActive.stillWaitingFor.slice(0, 3).join("; ") || blockText}. Signal: ${action}.`;
  }

  const catalyst = card.whyMoving.catalystLabel?.trim();
  const why = card.whyMoving.whyMoving?.trim();
  const newsBit =
    catalyst || why
      ? `${catalyst ?? ""}${why && why !== catalyst ? (catalyst ? " — " : "") + why : ""}. News is context only — never authorizes entry alone.`
      : "No fresh catalyst in the news payload.";

  const gatesAndNews = `${blocking.length ? `Blocking: ${blocking.map((b) => b.label).join(", ")}.` : "All required confirmations PASS."} ${newsBit}`;

  const risks = [
    card.dataFresh ? "Data verified for this evaluation." : "Data not verified — fail closed.",
    card.rewardToRisk < 2 ? `R:R ${card.rewardToRisk.toFixed(2)} below ~2R live ENTER bar.` : `R:R ${card.rewardToRisk.toFixed(2)} to T1.`,
    card.signalIntelligence?.fakeBreakoutWarnings?.length
      ? `Fake-break caution: ${card.signalIntelligence.fakeBreakoutWarnings.map((w) => w.pattern).join("; ")}`
      : "Watch for failed retest or VWAP reclaim against your side.",
  ];

  return {
    whyThisZone,
    whatToDoNow,
    gatesAndNews,
    chartRead: "Chart context not available in rules mode.",
    risks,
    outlook: tech
      ? `${card.statusLabel} · ${tech.strategyName} · ${action} · ${card.session?.session ?? "session unknown"}. Follow engine confirmations, not narrative alone.`
      : `${card.statusLabel} · ${action} bias · ${card.session?.session ?? "session unknown"}. Follow gates, not narrative alone.`,
  };
}

export async function buildTradePlan(input: {
  card: LiveSetupCard;
  side: TradeSide;
  tradingAction: TradePlanPayload["tradingAction"];
  withModel: boolean;
  chartContext?: Record<string, unknown> | null;
}): Promise<TradePlanPayload> {
  const { card, side, tradingAction, withModel, chartContext } = input;
  const { action, snapshot } = signalFromCard(card, side);
  const successRate = successRateFromCard(card);
  const gates = gateRows(card);
  const fallback = buildFallbackSections({ card, side, action, tradingAction });

  if (!withModel || !openAiConfigured()) {
    return {
      symbol: card.symbol,
      side,
      action,
      tradingAction,
      sections: fallback,
      successRate,
      briefSource: "rules",
      gatesPassed: gates.passed,
      gatesBlocking: gates.blocking,
    };
  }

  const modelSections = await narrateTradePlanSections({
    symbol: card.symbol,
    side,
    action,
    tradingAction,
    setupSummary: {
      ...snapshot,
      tradingAction,
      qualityScore10: card.qualityScore10?.score ?? null,
      qualityScore10Disclaimer: card.qualityScore10?.disclaimer ?? null,
      successRateHeadline: successRate.headline,
      winRatePct: successRate.winRatePct,
      sampleSize: successRate.sampleSize,
      showWinRatePct: successRate.showWinRatePct,
      activeTechnique: activeTechniqueForPlan(card),
      gatesPassed: gates.passed,
      gatesBlocking: gates.blocking,
      chartContext: chartContext ?? null,
      relativeMomentum: card.relativeMomentum,
      indicatorChecklist: card.indicatorChecklist?.map((r) => ({
        label: r.label,
        bias: r.bias,
        gateStatus: r.gateStatus,
        explanation: r.explanation,
      })),
      signalIntelligence: card.signalIntelligence
        ? {
            falseBreakoutRisk: card.signalIntelligence.falseBreakoutRisk,
            actionHint: card.signalIntelligence.actionHint,
            entryModel: card.signalIntelligence.entryModel,
            fakeBreakoutWarnings: card.signalIntelligence.fakeBreakoutWarnings?.map((w) => ({
              pattern: w.pattern,
              severity: w.severity,
              evidence: w.evidence,
            })),
          }
        : null,
    },
  });

  return {
    symbol: card.symbol,
    side,
    action,
    tradingAction,
    sections: modelSections ?? fallback,
    successRate,
    briefSource: modelSections ? "model" : "rules",
    gatesPassed: gates.passed,
    gatesBlocking: gates.blocking,
  };
}

async function narrateTradePlanSections(input: {
  symbol: string;
  side: TradeSide;
  action: TradeAction;
  tradingAction: TradePlanPayload["tradingAction"];
  setupSummary: Record<string, unknown>;
}): Promise<TradePlanSections | null> {
  const apiKey = readOpenAiApiKey();
  if (!apiKey) return null;

  const system = `You are WULU desk — explain trade plans from scanner + chart context JSON.
Rules:
- activeTechnique (when present) is the authoritative strategy: use its strategyName, phase, statusReason, entryTriggerDescription, and requiredConfirmations. Do NOT invent a different strategy or entry thesis.
- Use ONLY fields in scannerSetup (including chartContext when present). Do not invent prices, news, or win-rate percentages.
- If showWinRatePct is false, do not quote a win-rate percentage; use successRateHeadline verbatim.
- winRatePct and successRateHeadline are authoritative when showWinRatePct is true; do not change numbers.
- tradingAction and action are fixed — never upgrade WAIT to ENTER.
- whatToDoNow must match tradingAction and cite the same blocking confirmations as gatesBlocking in scannerSetup when WAIT/SKIP.
- News never alone justifies entry.
- chartRead must describe structure from chartContext (trend, VWAP side, zone vs price, recent bars). If chartContext.barCount is 0, say chart data was not attached.
- Respond with one JSON object (no markdown):
  whyThisZone, whatToDoNow, gatesAndNews, chartRead, risks (array), outlook.`;

  const user = JSON.stringify(
    {
      symbol: input.symbol,
      side: input.side,
      action: input.action,
      tradingAction: input.tradingAction,
      scannerSetup: input.setupSummary,
    },
    null,
    2,
  );

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: readOpenAiModel(),
        temperature: 0.25,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Write the trade plan JSON for ${input.symbol} ${input.side}.`,
          },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[wulu-plan] OpenAI HTTP ${res.status}: ${body.slice(0, 200)}`);
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TradePlanSections>;
    if (!parsed.whyThisZone || !parsed.whatToDoNow) return null;
    return {
      whyThisZone: String(parsed.whyThisZone),
      whatToDoNow: String(parsed.whatToDoNow),
      gatesAndNews: String(parsed.gatesAndNews ?? ""),
      chartRead: String(parsed.chartRead ?? ""),
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
      outlook: String(parsed.outlook ?? ""),
    };
  } catch (err) {
    console.warn("[wulu-plan] OpenAI parse failed", err);
    return null;
  }
}
