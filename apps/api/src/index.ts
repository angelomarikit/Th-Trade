import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import {
  calculatePositionSize,
  loadFeatureFlags,
  POSITION_SIZE_NOT_CALCULATED_MESSAGE,
  type TradeSide,
} from "@wulu/domain";
import { EXECUTION_POLICY, hasAlpacaCredentials, loadAlpacaCredentials } from "@wulu/market-data";
import { createNewsServiceFromEnv } from "@wulu/news";
import { listStrategies } from "@wulu/strategies";
import { summarizeJournal } from "@wulu/journal";
import { formatBestContractCard } from "@wulu/options";
import {
  createMarketDataFromEnv,
  createOptionsEngineFromEnv,
  createSetupScannerFromEnv,
} from "@wulu/scanner";
import { getPlan, PAID_TIERS, PLANS, type PlanTier } from "./billing/plans.js";
import {
  AuthError,
  assignPlan,
  getOrCreateProfile,
  isSupabaseConfigured,
  requireUser,
  spendCredits,
  getSupabaseAdmin,
} from "./billing/supabaseAdmin.js";
import { buildAutomaticSignal, buildSetupSnapshot } from "./recommend/fromCard.js";


const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: path.join(rootDir, ".env") });
process.env.JOURNAL_ROOT = process.env.JOURNAL_ROOT ?? rootDir;

const port = Number(process.env.PORT ?? 8787);
const corsOrigin = process.env.CORS_ORIGIN ?? "*";

async function main() {
  const news = createNewsServiceFromEnv();
  const scanner = createSetupScannerFromEnv();
  const optionsEngine = createOptionsEngineFromEnv();

  const marketData = createMarketDataFromEnv();
  const flags = loadFeatureFlags();
  const alpaca = loadAlpacaCredentials();
  const journal = scanner.signalJournal;
  const supabaseReady = isSupabaseConfigured();
  const openaiReady = Boolean((process.env.OPENAI_API_KEY ?? "").trim());

  const server = createServer(async (req, res) => {
    try {
      applyCors(req, res);
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url ?? "/", `http://localhost:${port}`);

      if (url.pathname === "/health") {
        return json(res, 200, {
          ok: true,
          phase: "G",
          newsProvider: news.providerName,
          marketDataProvider: process.env.MARKET_DATA_PROVIDER ?? "alpaca",
          alpacaFeed: process.env.ALPACA_DATA_FEED ?? "iex",
          alpacaCredentialsPresent: hasAlpacaCredentials(alpaca),
          journalEnabled: journal != null,
          journalCount: journal?.count() ?? 0,
          optionsEngine: flags.optionsEngine,
          featureFlags: flags,
          execution: EXECUTION_POLICY,
          /** Verified: no broker order submission in this app */
          accountEnvironment: "SIGNALS_ONLY",
          positionSizing: POSITION_SIZE_NOT_CALCULATED_MESSAGE,
          supabaseConfigured: supabaseReady,
          openaiConfigured: openaiReady,
          billing: { stripe: "not_wired", mode: "manual_plan_select" },
        });
      }

      if (url.pathname === "/v1/plans" && req.method === "GET") {
        return json(res, 200, {
          plans: Object.values(PLANS),
          stripe: {
            enabled: false,
            note: "Stripe Checkout will replace manual plan select later.",
          },
        });
      }

      if (url.pathname === "/v1/me" && req.method === "GET") {
        if (!supabaseReady) {
          return json(res, 503, { error: "Supabase not configured" });
        }
        try {
          const user = await requireUser(req.headers.authorization);
          const profile = await getOrCreateProfile(user);
          const plan = getPlan(profile.plan_tier);
          return json(res, 200, {
            user: { id: user.id, email: user.email },
            profile,
            plan,
            accountEnvironment: "SIGNALS_ONLY",
          });
        } catch (err) {
          return authError(res, err);
        }
      }

      if (url.pathname === "/v1/billing/select-plan" && req.method === "POST") {
        if (!supabaseReady) {
          return json(res, 503, { error: "Supabase not configured" });
        }
        try {
          const user = await requireUser(req.headers.authorization);
          const body = (await readJson(req)) as { plan?: string };
          const tier = (body.plan ?? "").toLowerCase() as PlanTier;
          if (!PAID_TIERS.includes(tier) && tier !== "free") {
            return json(res, 400, { error: "Invalid plan tier" });
          }
          const profile = await assignPlan(user.id, tier);
          return json(res, 200, {
            profile,
            plan: getPlan(profile.plan_tier),
            note: "Dev/manual subscription until Stripe is wired. Credits reset to plan allowance.",
          });
        } catch (err) {
          return authError(res, err);
        }
      }

      if (url.pathname === "/v1/recommend" && req.method === "POST") {
        try {
          const body = (await readJson(req)) as {
            symbol?: string;
            side?: string;
            deep?: boolean;
          };
          const symbol = (body.symbol ?? "").toUpperCase();
          const sideParam = (body.side ?? "LONG").toUpperCase();
          if (!symbol || (sideParam !== "LONG" && sideParam !== "SHORT")) {
            return json(res, 400, { error: "symbol and side required" });
          }
          const side = sideParam as TradeSide;

          const { card, journalEntry } = await scanner.scanWithJournal({ symbol, side });
          let withModel = Boolean((process.env.OPENAI_API_KEY ?? "").trim());
          let creditsCharged = 0;
          let creditsRemaining: number | null = null;
          let planId: string | null = null;

          if (supabaseReady && req.headers.authorization) {
            try {
              const user = await requireUser(req.headers.authorization);
              const profile = await getOrCreateProfile(user);
              const plan = getPlan(profile.plan_tier);
              planId = plan.id;
              if (!plan.aiEnabled) {
                withModel = false;
              } else {
                const cost = body.deep ? plan.deepAiCreditCost : plan.aiCreditCost;
                if (profile.credits_balance >= cost && withModel) {
                  const updated = await spendCredits({
                    userId: user.id,
                    cost,
                    reason: body.deep ? "signal_recommend_deep" : "signal_recommend",
                    meta: { symbol, side },
                  });
                  creditsCharged = cost;
                  creditsRemaining = updated.credits_balance;
                } else {
                  withModel = false;
                }
              }
            } catch {
              withModel = false;
            }
          } else if (!withModel) {
            withModel = false;
          }

          const signal = await buildAutomaticSignal({
            card,
            side,
            withModelBrief: withModel,
            deep: body.deep === true,
          });

          if (supabaseReady && req.headers.authorization && creditsCharged > 0) {
            try {
              const user = await requireUser(req.headers.authorization);
              await getSupabaseAdmin().from("signal_recommendations").insert({
                user_id: user.id,
                symbol,
                side,
                recommendation: `${signal.action}:${signal.recommendation}`,
                confidence: signal.confidence,
                brief: signal.brief,
                credits_charged: creditsCharged,
                setup_snapshot: {
                  ...buildSetupSnapshot(card),
                  journalEntryId: journalEntry?.id ?? null,
                },
              });
            } catch {
              /* non-fatal */
            }
          }

          return json(res, 200, {
            automatic: true,
            symbol,
            side,
            action: signal.action,
            recommendation: signal.recommendation,
            confidence: signal.confidence,
            reasons: signal.reasons,
            blockers: signal.blockers,
            brief: signal.brief,
            briefSource: signal.briefSource,
            creditsCharged,
            creditsRemaining,
            plan: planId,
            source: "wulu_setup_scanner",
            setup: {
              status: card.statusLabel,
              dataFresh: card.dataFresh,
              session: card.session,
              conditionsPassed: card.conditionsPassed,
              conditionsTotal: card.conditionsTotal,
              lastPrice: card.lastPrice,
              rewardToRisk: card.rewardToRisk,
              setupScore: card.setupScore.total,
              alertAt: card.alertAt,
              entryZone: card.entryZone,
              stop: card.stop,
              t1: card.target1,
              t2: card.target2,
              evaluatedAt: card.evaluatedAt,
            },
            openaiUsed: signal.briefSource === "model",
            disclaimer:
              "Automatic Signal Recommendation from Wulu scanner data. BUY/SELL only when confirmation is ACTIONABLE. No orders are submitted.",
          });
        } catch (err) {
          return authError(res, err);
        }
      }

      if (url.pathname === "/v1/bars" && req.method === "GET") {
        const ticker = url.searchParams.get("ticker");
        if (!ticker) {
          return json(res, 400, { error: "ticker query required" });
        }
        const tfKey = (url.searchParams.get("timeframe") ?? "5m").trim().toLowerCase();
        const timeframeMap: Record<string, "1Min" | "5Min" | "15Min" | "1Day"> = {
          "1m": "1Min",
          "1min": "1Min",
          "5m": "5Min",
          "5min": "5Min",
          "15m": "15Min",
          "15min": "15Min",
          "1d": "1Day",
          "1day": "1Day",
        };
        const timeframe = timeframeMap[tfKey];
        if (!timeframe) {
          return json(res, 400, {
            error: "timeframe must be 1m, 5m, 15m, or 1D (Alpaca-supported)",
          });
        }
        const limit = Math.min(500, Math.max(10, Number(url.searchParams.get("limit") ?? 150)));
        const bars = await marketData.getBars({
          symbol: ticker,
          timeframe,
          limit: Number.isFinite(limit) ? limit : 150,
        });
        return json(res, 200, {
          symbol: ticker.toUpperCase(),
          timeframe,
          provider: process.env.MARKET_DATA_PROVIDER ?? "alpaca",
          feed: process.env.ALPACA_DATA_FEED ?? "iex",
          count: bars.length,
          bars: bars.map((b) => ({
            time: Math.floor(b.timestamp.getTime() / 1000),
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
            volume: b.volume,
            vwap: b.vwap ?? null,
            completed: b.completed,
          })),
        });
      }

      if (url.pathname === "/v1/catalyst" && req.method === "GET") {
        const ticker = url.searchParams.get("ticker");
        if (!ticker) {
          return json(res, 400, { error: "ticker query required" });
        }
        const { event, why } = await news.getCatalystForTicker(ticker);
        return json(res, 200, {
          ticker: ticker.toUpperCase(),
          why,
          event: event
            ? {
                eventId: event.eventId,
                headline: event.headline,
                category: event.category,
                originalSource: event.originalSource,
                originalPublishedAt: event.originalPublishedAt.toISOString(),
                memberCount: event.memberCount,
                scores: event.scores,
                priceReaction: event.priceReaction,
                verified: event.verified,
              }
            : null,
          safety: {
            newsCannotCreateEntryActive: true,
            optionsEngine: flags.optionsEngine,
          },
        });
      }

      if (url.pathname === "/v1/setup" && req.method === "GET") {
        const ticker = url.searchParams.get("ticker");
        const sideParam = (url.searchParams.get("side") ?? "LONG").toUpperCase();
        if (!ticker) {
          return json(res, 400, { error: "ticker query required" });
        }
        if (sideParam !== "LONG" && sideParam !== "SHORT") {
          return json(res, 400, { error: "side must be LONG or SHORT" });
        }
        const side = sideParam as TradeSide;
        const { card, journalEntry } = await scanner.scanWithJournal({ symbol: ticker, side });

        const verifiedRaw = process.env.VERIFIED_ACCOUNT_VALUE;
        const verifiedAccountValue =
          verifiedRaw && verifiedRaw.trim() !== ""
            ? Number(verifiedRaw)
            : null;
        const entryMid = (card.entryZone.low + card.entryZone.high) / 2;
        const sizing = calculatePositionSize({
          verifiedAccountValue,
          entryPrice: entryMid,
          stopPrice: card.stop,
        });

        /** Model brief only when ?brief=1 (user Scan). Polls stay rule-based to avoid credit drain. */
        const wantBrief =
          url.searchParams.get("brief") === "1" ||
          url.searchParams.get("brief") === "true";
        const openaiReady = Boolean((process.env.OPENAI_API_KEY ?? "").trim());
        let withModel = wantBrief && openaiReady;
        let creditsCharged = 0;
        let creditsRemaining: number | null = null;

        if (wantBrief && openaiReady && supabaseReady && req.headers.authorization) {
          try {
            const user = await requireUser(req.headers.authorization);
            const profile = await getOrCreateProfile(user);
            const plan = getPlan(profile.plan_tier);
            if (!plan.aiEnabled) {
              withModel = false;
            } else {
              const cost = plan.aiCreditCost;
              if (profile.credits_balance >= cost) {
                const updated = await spendCredits({
                  userId: user.id,
                  cost,
                  reason: "signal_recommend",
                  meta: { symbol: ticker.toUpperCase(), side, via: "setup" },
                });
                creditsCharged = cost;
                creditsRemaining = updated.credits_balance;
              } else {
                withModel = false;
              }
            }
          } catch {
            withModel = false;
          }
        } else if (!wantBrief) {
          withModel = false;
        }
        // wantBrief + OpenAI, no auth session → still narrate (same as /v1/recommend)

        const signal = await buildAutomaticSignal({
          card,
          side,
          withModelBrief: withModel,
        });

        const signalRecommendation = {
          action: signal.action,
          recommendation: signal.recommendation,
          confidence: signal.confidence,
          reasons: signal.reasons,
          blockers: signal.blockers,
          brief: signal.brief,
          briefSource: signal.briefSource,
          automatic: true as const,
          creditsCharged,
          creditsRemaining,
        };

        return json(res, 200, {
          liveCard: {
            headline: `${card.symbol} — ${card.side}`,
            status: card.statusLabel,
            state: card.state,
            whyMoving: card.whyMoving.whyMoving,
            catalyst: card.whyMoving.catalystLabel,
            newsAgeMinutes: card.whyMoving.newsAgeMinutes,
            priceReaction: card.whyMoving.priceReaction,
            conditions: `${card.conditionsPassed} / ${card.conditionsTotal} CONDITIONS PASSED`,
            conditionsPassed: card.conditionsPassed,
            conditionsTotal: card.conditionsTotal,
            alertAt: card.alertAt,
            waitingFor: card.nearActive.stillWaitingFor,
            entryZone: card.entryZone,
            stop: card.stop,
            t1: card.target1,
            t2: card.target2,
            lastPrice: card.lastPrice,
            rewardToRisk: card.rewardToRisk,
            dataFresh: card.dataFresh,
            evaluatedAt: card.evaluatedAt,
            setupScore: `${card.setupScore.total} / 100`,
            setupScoreValue: card.setupScore.total,
            setupScoreDisclaimer: card.setupScore.disclaimer,
            market: card.regime?.bias ?? null,
            marketRegime: card.regime?.primary ?? null,
            session: card.session,
            matchedStrategies: card.matchedStrategies,
            historicalEdge: card.historicalEdge,
            options: card.options,
          },
          signalRecommendation,
          card,
          journalEntryId: journalEntry?.id ?? null,
          positionSizing: sizing,
          verifiedAccountConfigured: verifiedAccountValue != null && Number.isFinite(verifiedAccountValue),
          accountEnvironment: "SIGNALS_ONLY",
          safety: {
            triggerIsNotEntry: true,
            newsCannotCreateEntryActive: true,
            optionsEngine: flags.optionsEngine,
            automaticOrders: false,
            executionPlatform: EXECUTION_POLICY.platform,
            alpacaRole: EXECUTION_POLICY.alpacaRole,
          },
        });
      }

      if (url.pathname === "/v1/regime" && req.method === "GET") {
        const { brief } = await scanner.morningBrief();
        return json(res, 200, {
          market: brief.market,
          marketRegime: brief.marketRegime,
          reasons: brief.regimeReasons,
          strategyGates: brief.strategyGates,
          generatedAt: brief.generatedAt,
        });
      }

      if (url.pathname === "/v1/morning" && req.method === "GET") {
        const tickersParam = url.searchParams.get("tickers");
        const tickers =
          tickersParam && tickersParam.trim()
            ? tickersParam
                .split(",")
                .map((t) => {
                  const [sym, sideRaw] = t.trim().split(":");
                  const side = (sideRaw ?? "LONG").toUpperCase();
                  return {
                    symbol: (sym ?? "").toUpperCase(),
                    side: (side === "SHORT" ? "SHORT" : "LONG") as TradeSide,
                  };
                })
                .filter((t) => t.symbol.length > 0)
            : [];

        const { brief, text } = await scanner.morningBrief({ tickers });
        return json(res, 200, { brief, text });
      }

      if (url.pathname === "/v1/strategies" && req.method === "GET") {
        return json(res, 200, {
          strategies: listStrategies().map((s) => ({
            id: s.id,
            name: s.name,
            version: s.version,
            family: s.family,
            side: s.side,
            description: s.description,
          })),
          note: "Live matching and backtests share these definitions.",
        });
      }

      if (url.pathname === "/v1/edge" && req.method === "GET") {
        const strategyId = url.searchParams.get("strategy") ?? "VWAP_RECLAIM";
        const ticker = (url.searchParams.get("ticker") ?? "SPY").toUpperCase();
        const snap = await marketData.getSnapshot(ticker);
        const bars = snap.bars5m.length >= 20 ? snap.bars5m : snap.bars1m;
        const { panel, text } = scanner.edge.compute({
          strategyId,
          symbol: ticker,
          bars,
          regimePrimary: url.searchParams.get("regime") ?? undefined,
          includeWalkForward: url.searchParams.get("walkForward") !== "false",
        });
        return json(res, 200, { panel, text });
      }

      if (url.pathname === "/v1/journal" && req.method === "GET") {
        if (!journal) {
          return json(res, 503, { error: "journal not enabled" });
        }
        const symbol = url.searchParams.get("symbol") ?? undefined;
        const state = url.searchParams.get("state") ?? undefined;
        const limit = Number(url.searchParams.get("limit") ?? 50);
        const entries = journal.list({
          symbol,
          state: state as never,
          limit: Number.isFinite(limit) ? limit : 50,
        });
        return json(res, 200, {
          count: journal.count({ symbol, state: state as never }),
          analytics: summarizeJournal(entries),
          entries: entries.map((e) => ({
            id: e.id,
            decisionAt: e.decisionAt,
            symbol: e.symbol,
            side: e.side,
            state: e.state,
            strategyId: e.strategyId,
            setupScore: e.setupScore,
            marketRegime: e.marketRegime,
            hasCatalyst: e.hasCatalyst,
            outcome: e.outcome,
            featureSchemaVersion: e.featureSchemaVersion,
          })),
        });
      }

      if (url.pathname === "/v1/journal/features" && req.method === "GET") {
        if (!journal) {
          return json(res, 503, { error: "journal not enabled" });
        }
        const limit = Number(url.searchParams.get("limit") ?? 100);
        const rows = journal.exportFeatureRows({
          limit: Number.isFinite(limit) ? limit : 100,
        });
        return json(res, 200, {
          note: "Outcomes are separate from features. Do not train labels from future leakage.",
          rows,
        });
      }

      const journalOne = url.pathname.match(/^\/v1\/journal\/([^/]+)$/);
      if (journalOne && req.method === "GET") {
        if (!journal) {
          return json(res, 503, { error: "journal not enabled" });
        }
        const entry = journal.get(journalOne[1]!);
        if (!entry) return json(res, 404, { error: "not found" });
        return json(res, 200, { entry });
      }

      if (url.pathname === "/v1/options" && req.method === "GET") {
        if (!flags.optionsEngine) {
          return json(res, 200, {
            enabled: false,
            eligible: false,
            reason: "FEATURE_OPTIONS_ENGINE=false — options engine disabled",
            automaticOrders: false,
            note: "Set FEATURE_OPTIONS_ENGINE=true only after underlying stock logic is validated.",
          });
        }
        const ticker = (url.searchParams.get("ticker") ?? "NVDA").toUpperCase();
        const sideParam = (url.searchParams.get("side") ?? "LONG").toUpperCase();
        const side = (sideParam === "SHORT" ? "SHORT" : "LONG") as TradeSide;
        const stateParam = url.searchParams.get("underlyingState") ?? "ENTRY_ACTIVE_LONG";
        const result = await optionsEngine.evaluate({
          enabled: true,
          underlyingState: stateParam as never,
          side,
          underlying: ticker,
        });
        return json(res, 200, {
          result,
          text: formatBestContractCard(result),
          automaticOrders: false,
          provider: process.env.OPTIONS_PROVIDER ?? "mock",
        });
      }

      json(res, 404, { error: "not found" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      json(res, 500, { error: message });
    }
  });

  server.listen(port, () => {
    console.log(`Wulu API (Phase G) on http://localhost:${port}`);
    console.log(`News provider: ${news.providerName}`);
    console.log(`Market data: ${process.env.MARKET_DATA_PROVIDER ?? "alpaca"}`);
    console.log(`Journal: ${journal ? "enabled" : "disabled"}`);
    console.log(`Options engine: ${flags.optionsEngine ? "ON" : "OFF (default)"}`);
    console.log(`Supabase: ${supabaseReady ? "configured" : "missing"}`);
    console.log(`OpenAI: ${openaiReady ? "configured" : "missing (rule-based briefs)"}`);
    console.log(`CORS: ${corsOrigin}`);
    console.log("Endpoints:");
    console.log("  GET /health");
    console.log("  GET /v1/plans");
    console.log("  GET /v1/me");
    console.log("  POST /v1/billing/select-plan");
    console.log("  POST /v1/recommend");
    console.log("  GET /v1/bars?ticker=NVDA&timeframe=5m");
    console.log("  GET /v1/setup?ticker=NVDA&side=LONG");
  });
}

function applyCors(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
) {
  const origin = req.headers.origin;
  const allow =
    corsOrigin === "*"
      ? "*"
      : origin && corsOrigin.split(",").map((s) => s.trim()).includes(origin)
        ? origin
        : corsOrigin.split(",")[0]?.trim() || "*";
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Authorization",
  );
  if (allow !== "*") {
    res.setHeader("Vary", "Origin");
  }
}

function json(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.setHeader("Content-Type", "application/json");
  res.writeHead(status);
  res.end(JSON.stringify(body, null, 2));
}

function authError(res: import("node:http").ServerResponse, err: unknown) {
  if (err instanceof AuthError) {
    return json(res, err.status, { error: err.message });
  }
  const message = err instanceof Error ? err.message : "unknown error";
  return json(res, 500, { error: message });
}

function readJson(req: import("node:http").IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
