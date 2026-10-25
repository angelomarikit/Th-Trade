import type { LiveSetupCard } from "@wulu/confirmation";
import type { TradeSide } from "@wulu/domain";
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
}

export interface TradePlanSections {
  whyThisZone: string;
  whatToDoNow: string;
  gatesAndNews: string;
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
  const q = card.qualityScore10;
  const sample = edge?.sampleSize ?? 0;
  const win =
    sample > 0 && edge?.winRatePct != null && Number.isFinite(edge.winRatePct)
      ? edge.winRatePct
      : null;
  let headline: string;
  if (win != null && sample >= 5) {
    headline = `Historical win rate ${win.toFixed(0)}% (${sample} similar setups)`;
  } else if (win != null && sample > 0) {
    headline = `Early sample: ${win.toFixed(0)}% win (${sample} setups — low confidence)`;
  } else {
    headline = "No matched historical sample for this pattern yet";
  }
  return {
    winRatePct: win,
    sampleSize: sample,
    strategyName: edge?.strategyName ?? null,
    expectancyR: edge?.expectancyR ?? null,
    qualityScore10: q?.score ?? null,
    qualityDisclaimer:
      q?.disclaimer ??
      "Quality score is setup strength (1–10), not win probability. Gates still decide ENTER.",
    headline,
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
  const whyThisZone =
    geo ??
    `${side} setup at trigger ${card.alertAt.toFixed(2)}; entry zone ${zone}. Last ${card.lastPrice.toFixed(2)}.`;

  let whatToDoNow: string;
  switch (tradingAction) {
    case "ENTER":
      whatToDoNow = `Engine: ENTER ${side}. Plan entry ${zone}, stop ${card.stop.toFixed(2)}, T1 ${card.target1.toFixed(2)}. Signal recommendation: ${action}. Size manually — no auto orders.`;
      break;
    case "SKIP":
      whatToDoNow = "Do not chase — skip this signal and wait for a fresh evaluation.";
      break;
    case "INVALIDATED":
      whatToDoNow = "Stand aside — structure or stop logic invalidated this setup.";
      break;
    default:
      whatToDoNow = `Wait — ${card.nearActive.stillWaitingFor.slice(0, 3).join("; ") || "required gates not all PASS"}. Signal: ${action}.`;
  }

  const catalyst = card.whyMoving.catalystLabel?.trim();
  const why = card.whyMoving.whyMoving?.trim();
  const newsBit =
    catalyst || why
      ? `${catalyst ?? ""}${why && why !== catalyst ? (catalyst ? " — " : "") + why : ""}. News is context only — never authorizes entry alone.`
      : "No fresh catalyst in the news payload.";

  const { blocking } = gateRows(card);
  const gatesAndNews = `${blocking.length ? `Blocking: ${blocking.map((b) => b.label).join(", ")}.` : "All required gates PASS."} ${newsBit}`;

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
    risks,
    outlook: `${card.statusLabel} · ${action} bias · ${card.session?.session ?? "session unknown"}. Follow gates, not narrative alone.`,
  };
}

export async function buildTradePlan(input: {
  card: LiveSetupCard;
  side: TradeSide;
  tradingAction: TradePlanPayload["tradingAction"];
  withModel: boolean;
}): Promise<TradePlanPayload> {
  const { card, side, tradingAction, withModel } = input;
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

  const system = `You explain WULU scanner trade plans for human traders.
Rules:
- Use ONLY fields in scannerSetup JSON. Do not invent prices, news, or win-rate percentages.
- winRatePct and successRateHeadline in the payload are authoritative for historical stats; reference them but do not change numbers.
- tradingAction (WAIT/ENTER/SKIP/INVALIDATED) and action (BUY/SELL/WAIT) are fixed — do not upgrade WAIT to ENTER.
- News never alone justifies entry.
- Respond with a single JSON object (no markdown) with keys:
  whyThisZone (string, 2-4 sentences),
  whatToDoNow (string, clear steps),
  gatesAndNews (string, gates + catalyst context),
  risks (array of 2-4 short strings),
  outlook (string, 1-2 sentences).`;

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
    if (!res.ok) return null;
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
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
      outlook: String(parsed.outlook ?? ""),
    };
  } catch {
    return null;
  }
}
