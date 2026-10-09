/**
 * Deterministic recommendation from existing confirmation card.
 * OpenAI may only narrate — never upgrade past fail-closed states.
 */

export type Recommendation =
  | "NO_TRADE"
  | "WATCH"
  | "PREPARE"
  | "ACTIONABLE"
  | "AVOID";

/** Client-facing trade directive derived from recommendation + side */
export type TradeAction = "BUY" | "SELL" | "WAIT";

export type ConfidenceBand = "Low" | "Medium" | "High";

export interface RecommendInput {
  status: string;
  state?: string;
  dataFresh: boolean;
  session?: string | null;
  conditionsPassed: number;
  conditionsTotal: number;
  rewardToRisk: number;
  setupScore: number;
  waitingFor: string[];
  edgeSampleSize?: number | null;
  edgeExpectancyR?: number | null;
}

export interface DeterministicRecommendation {
  recommendation: Recommendation;
  confidence: ConfidenceBand;
  reasons: string[];
  blockers: string[];
}

/** Only ACTIONABLE becomes BUY (long) or SELL (short). Everything else is WAIT. */
export function toTradeAction(
  side: "LONG" | "SHORT",
  recommendation: Recommendation,
): TradeAction {
  if (recommendation !== "ACTIONABLE") return "WAIT";
  return side === "SHORT" ? "SELL" : "BUY";
}

export function deriveRecommendation(input: RecommendInput): DeterministicRecommendation {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const status = (input.status ?? "").toUpperCase();
  const session = (input.session ?? "").toUpperCase();

  if (!input.dataFresh || status.includes("DATA NOT VERIFIED")) {
    blockers.push("Market data not verified or stale — fail closed");
    return {
      recommendation: "NO_TRADE",
      confidence: "High",
      reasons: ["Confirmation engine requires fresh verified data"],
      blockers,
    };
  }

  if (session === "CLOSED" || session === "WEEKEND") {
    blockers.push(`Session is ${session || "closed"}`);
    return {
      recommendation: "NO_TRADE",
      confidence: "High",
      reasons: ["Regular trading hours required for actionable equity signals"],
      blockers,
    };
  }

  if (status.includes("MISSED")) {
    blockers.push("Setup marked MISSED");
    return {
      recommendation: "AVOID",
      confidence: "Medium",
      reasons: ["Entry window likely passed"],
      blockers,
    };
  }

  const passRatio =
    input.conditionsTotal > 0 ? input.conditionsPassed / input.conditionsTotal : 0;

  if (
    input.edgeSampleSize != null &&
    input.edgeSampleSize > 0 &&
    input.edgeExpectancyR != null &&
    input.edgeExpectancyR < 0
  ) {
    blockers.push("Historical expectancy negative for matched family");
  }

  if (status.includes("ENTRY ACTIVE") && passRatio >= 0.8 && input.rewardToRisk >= 1.5) {
    if (blockers.length) {
      return {
        recommendation: "PREPARE",
        confidence: "Medium",
        reasons: [
          "Entry-active status but edge/regime caution applies",
          `R:R ${input.rewardToRisk.toFixed(2)}`,
          `Score ${input.setupScore}/100`,
        ],
        blockers,
      };
    }
    reasons.push("ENTRY ACTIVE with majority gates passed");
    reasons.push(`R:R ${input.rewardToRisk.toFixed(2)}`);
    reasons.push(`Setup score ${input.setupScore}/100`);
    return {
      recommendation: "ACTIONABLE",
      confidence: input.setupScore >= 70 ? "High" : "Medium",
      reasons,
      blockers,
    };
  }

  if (status.includes("NEAR ACTIVE") || passRatio >= 0.5) {
    reasons.push("Setup approaching confirmation");
    if (input.waitingFor.length) {
      blockers.push(...input.waitingFor.slice(0, 4));
    }
    return {
      recommendation: passRatio >= 0.7 ? "PREPARE" : "WATCH",
      confidence: "Medium",
      reasons,
      blockers,
    };
  }

  return {
    recommendation: "WATCH",
    confidence: "Low",
    reasons: ["Insufficient confirmation for entry"],
    blockers: input.waitingFor.slice(0, 4),
  };
}

export async function narrateRecommendation(input: {
  symbol: string;
  side: "LONG" | "SHORT";
  action: TradeAction;
  deterministic: DeterministicRecommendation;
  setupSummary: Record<string, unknown>;
  deep?: boolean;
}): Promise<string> {
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  const fallback = buildFallbackBrief(
    input.symbol,
    input.side,
    input.action,
    input.deterministic,
  );

  if (!apiKey) {
    return fallback;
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const system = `You write automatic Signal Recommendation briefs for WULU Scanner.
The trade action (BUY / SELL / WAIT) and internal status are already decided from live scanner data.
Rules:
- First line MUST be: Signal Recommendation: BUY|SELL|WAIT
- Second line: Status: <ENUM> · Confidence: <band>
- You MUST NOT change BUY/SELL/WAIT or invent an entry when action is WAIT.
- Analyze ONLY the provided scanner payload.
- Never invent prices, news, or win-probability percentages.
- Be direct: for BUY/SELL state trigger, zone, stop, targets; for WAIT state what is blocking.
- Signals only — no automatic orders. Not financial advice.`;

  const user = JSON.stringify(
    {
      symbol: input.symbol,
      side: input.side,
      action: input.action,
      status: input.deterministic.recommendation,
      confidence: input.deterministic.confidence,
      reasons: input.deterministic.reasons,
      blockers: input.deterministic.blockers,
      scannerSetup: input.setupSummary,
      depth: input.deep ? "deep" : "standard",
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
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Produce a ${input.deep ? "detailed" : "short"} automatic Signal Recommendation (max ${input.deep ? 260 : 120} words) for ${input.symbol}. Action must remain ${input.action}.`,
          },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[openai] HTTP ${res.status}: ${body.slice(0, 200)}`);
      return fallback;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || fallback;
  } catch (err) {
    console.warn("[openai] request failed", err);
    return fallback;
  }
}

export function buildFallbackBrief(
  symbol: string,
  side: "LONG" | "SHORT",
  action: TradeAction,
  d: DeterministicRecommendation,
): string {
  const lines = [
    `Signal Recommendation: ${action}`,
    `Status: ${d.recommendation} · Confidence: ${d.confidence}`,
    `${symbol} ${side}`,
    ...d.reasons.map((r) => `• ${r}`),
  ];
  if (d.blockers.length) {
    lines.push("Blockers:");
    lines.push(...d.blockers.map((b) => `• ${b}`));
  }
  if (action === "BUY") {
    lines.push("Directive: BUY bias — levels from scanner only if you choose to execute manually.");
  } else if (action === "SELL") {
    lines.push("Directive: SELL bias — levels from scanner only if you choose to execute manually.");
  } else {
    lines.push("Directive: WAIT — do not enter until confirmation clears.");
  }
  lines.push(
    "Automatic Signal Recommendation from Wulu scanner data. No orders are placed. Not financial advice.",
  );
  return lines.join("\n");
}
