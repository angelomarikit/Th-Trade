import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import {
  cardToPerformanceRecord,
  resolutionToPerformanceRecord,
  runSignalReplay,
  SignalPersistGate,
  SignalOutcomeTracker,
  buildWatchingSummary,
  deriveTradingAction,
  enforceOneSideTradingAction,
  outcomeDetailToStatusLabel,
} from "@wulu/confirmation";
import {
  calculatePositionSize,
  loadFeatureFlags,
  POSITION_SIZE_NOT_CALCULATED_MESSAGE,
  type TradeSide,
} from "@wulu/domain";
import {
  barEffectiveEndTime,
  classifyUsEquitySession,
  EXECUTION_POLICY,
  hasAlpacaCredentials,
  isAlpacaMarketDataAuthError,
  loadAlpacaCredentials,
  marketDataAuthSoftFailEnabled,
  withAlpacaPriority,
} from "@wulu/market-data";
import { createNewsServiceFromEnv, emptyWhyMoving } from "@wulu/news";
import { searchSymbols } from "@wulu/regime";
import { listStrategies } from "@wulu/strategies";
import { summarizeJournal } from "@wulu/journal";
import { formatBestContractCard } from "@wulu/options";
import { aggregateMeasuredPerformance } from "@wulu/backtest";
import {
  createMarketDataFromEnv,
  createOptionsEngineFromEnv,
  createSetupScannerFromEnv,
  DEFAULT_MONITOR_WATCHLIST,
  isUserVisibleAlertTransition,
  MonitorHub,
  MonitorLimitError,
  normalizeTicker,
  type MonitorSymbolConfig,
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
import { HybridAlertEventStore } from "./monitor/alertStore.js";
import {
  isPreviewDevWatchlist,
  isWuluLabModeEnabled,
  resolveWatchlistPlanMax,
} from "./monitor/planCap.js";
import {
  loadAllMonitorWatchlists,
  loadMonitorWatchlist,
  saveMonitorWatchlist,
} from "./monitor/persistence.js";
import {
  closeOpenTrack,
  loadOpenTracks,
  upsertOpenTrack,
} from "./monitor/openTracks.js";
import {
  canMarkLiveValidated,
  getAlertPreferences,
  getSignalPerformanceRecordById,
  HybridSignalPerformanceStore,
  listValidationAudit,
  markSignalLiveValidated,
  saveAlertPreferences,
} from "./monitor/signalHistory.js";
import { buildAutomaticSignal, buildSetupSnapshot } from "./recommend/fromCard.js";
import { openAiConfigured } from "./recommend/openaiEnv.js";
import { buildWuluPlanForCard } from "./wuluPlan/buildWuluPlan.js";
import { handleWuluPlanPost } from "./wuluPlan/handleWuluPlanRequest.js";
import { writeSetupSessionMemory, type SetupSessionMemory } from "./setupSessionMemory.js";


const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
// Local .env is optional. On Railway/Docker, set Variables in the host dashboard —
// dotenv will report "injected env (0)" when no .env file exists (that is normal).
loadEnv({ path: path.join(rootDir, ".env") });
process.env.JOURNAL_ROOT = process.env.JOURNAL_ROOT ?? rootDir;

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error("[process] unhandledRejection:", message.slice(0, 400));
});

const port = Number(process.env.PORT ?? 8787);
/** Normalize: browsers send Origin without trailing slash. */
const corsOrigin = (process.env.CORS_ORIGIN ?? "*")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean)
  .join(",") || "*";

function envFlag(name: string): string {
  return (process.env[name] ?? "").trim() ? "yes" : "NO";
}

/** Fresh hits skip Alpaca. Stale hits return immediately so the chart is not blocked. */
const barsResponseCache = new Map<string, { at: number; payload: unknown }>();
const barsInflight = new Map<string, Promise<unknown>>();
const BARS_CACHE_MS = 15_000;
const BARS_STALE_MS = 5 * 60_000;
const setupResponseCache = new Map<string, { at: number; payload: unknown }>();
const setupInflight = new Map<string, Promise<unknown>>();
/** Coalesce poll storms — identical setup GETs share one Alpaca scan. */
const SETUP_CACHE_MS = 12_000;
/** Per-symbol setup lifecycle + retest phase on interactive /v1/setup polls. */
const interactiveSetupMemory = new Map<string, SetupSessionMemory>();

function setupStateKey(symbol: string, side: TradeSide): string {
  return `${symbol.toUpperCase()}:${side}`;
}

async function main() {
  console.log(
    `[env] ALPACA_API_KEY_ID=${envFlag("ALPACA_API_KEY_ID")} ` +
      `ALPACA_API_SECRET_KEY=${envFlag("ALPACA_API_SECRET_KEY")} ` +
      `NEWS_PROVIDER=${process.env.NEWS_PROVIDER ?? "(unset)"} ` +
      `MARKET_DATA_PROVIDER=${process.env.MARKET_DATA_PROVIDER ?? "(unset)"}`,
  );

  const news = createNewsServiceFromEnv();
  const scanner = createSetupScannerFromEnv();
  const optionsEngine = createOptionsEngineFromEnv();
  const alertStore = new HybridAlertEventStore();
  const signalPerformanceStore = new HybridSignalPerformanceStore();
  const outcomeTracker = new SignalOutcomeTracker();
  /** Prevents every ~40s tick from inserting a near-identical LIVE history row. */
  const livePersistGate = new SignalPersistGate();
  const monitorHub = new MonitorHub(scanner, {
    maxSymbols: Number(process.env.MONITOR_MAX_SYMBOLS ?? 12),
    intervalMs: Number(process.env.MONITOR_INTERVAL_MS ?? 20_000),
    feed: process.env.ALPACA_DATA_FEED ?? "iex",
    alertStore,
    onSignalCard: (card, userId) => {
      const uid = userId === "default" ? null : userId;
      const track = outcomeTracker.onCard(card, uid, "LIVE", card.lastCompletedBar);
      const forcePersist = Boolean(track.opened || track.resolution);
      if (forcePersist || livePersistGate.shouldPersist(card, uid)) {
        signalPerformanceStore.record(cardToPerformanceRecord(card, "LIVE", uid));
      }
      if (track.opened) {
        signalPerformanceStore.upsert({
          ...cardToPerformanceRecord(card, "LIVE", uid),
          id: track.opened.id,
          actionable: true,
          outcomeStatus: "UNKNOWN",
          confirmationSummary: [
            "outcomeDetail:OPEN",
            `entryPrice:${track.opened.entryPrice}`,
            ...card.nearActive.stillWaitingFor.slice(0, 6),
          ],
        });
        void upsertOpenTrack(track.opened);
      } else if (track.resolution == null) {
        // Persist bars_elapsed progress for still-open tracks
        const open = outcomeTracker.listOpen().find((t) => t.setupId === card.setupId && t.userId === uid);
        if (open) void upsertOpenTrack(open);
      }
      if (track.resolution) {
        signalPerformanceStore.upsert(
          resolutionToPerformanceRecord(track.resolution, card, "LIVE", uid),
        );
        void closeOpenTrack(track.resolution.id);
      }
      return track;
    },
    persistWatchlist: async (userId, symbols) => {
      await saveMonitorWatchlist(userId, symbols);
    },
  });

  const marketData = createMarketDataFromEnv();
  console.log(
    `[market-data] provider=${marketData.name} authSoftFail=${marketDataAuthSoftFailEnabled() ? "on" : "off"}`,
  );
  const flags = loadFeatureFlags();
  const alpaca = loadAlpacaCredentials();
  const journal = scanner.signalJournal;
  const supabaseReady = isSupabaseConfigured();
  const openaiReady = openAiConfigured();

  // Resume persisted watchlists + open tracks + alert dedupe after deploy/restart.
  try {
    const dedupeN = await alertStore.seedFromDatabase();
    console.log(`[alerts] seeded ${dedupeN} durable dedupe key(s)`);
  } catch (err) {
    console.warn(
      "[alerts] dedupe seed skipped:",
      err instanceof Error ? err.message : String(err),
    );
  }
  try {
    const openTracks = await loadOpenTracks();
    const n = outcomeTracker.hydrate(openTracks);
    if (n > 0) console.log(`[outcomes] restored ${n} open signal track(s)`);
  } catch (err) {
    console.warn(
      "[outcomes] open-track resume skipped:",
      err instanceof Error ? err.message : String(err),
    );
  }
  try {
    const rows = await loadAllMonitorWatchlists();
    for (const row of rows) {
      monitorHub.restoreSession(row.userId, row.symbols);
    }
    if (rows.length > 0) {
      console.log(`[monitor] restored ${rows.length} persisted watchlist(s)`);
      const deferMs = Math.max(0, Number(process.env.MONITOR_START_DELAY_MS ?? 90_000));
      if (deferMs > 0) {
        console.log(`[monitor] start deferred ${deferMs}ms so chart/setup requests get headroom`);
        setTimeout(() => monitorHub.start(), deferMs);
      } else {
        monitorHub.start();
      }
    }
  } catch (err) {
    console.warn(
      "[monitor] resume skipped:",
      err instanceof Error ? err.message : String(err),
    );
  }

  async function resolveMonitorSession(
    authHeader: string | undefined,
    opts?: { requireAuth?: boolean },
  ): Promise<string> {
    if (supabaseReady && authHeader) {
      try {
        const user = await requireUser(authHeader);
        return user.id;
      } catch (err) {
        if (opts?.requireAuth) throw err;
      }
    }
    if (opts?.requireAuth && supabaseReady) {
      throw new AuthError(401, "Sign in required to manage a persistent watchlist");
    }
    return "default";
  }

  async function refreshBarsCache(
    cacheKey: string,
    ticker: string,
    timeframe: "1Min" | "5Min" | "15Min" | "1Hour" | "1Day",
    safeLimit: number,
    regularHoursOnly: boolean,
  ): Promise<unknown> {
    const existing = barsInflight.get(cacheKey);
    if (existing) return existing;
    const job = (async () => {
      const started = Date.now();
      let bars;
      try {
        bars = await marketData.getBars({
          symbol: ticker,
          timeframe,
          limit: safeLimit,
          regularHoursOnly,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[bars] refresh failed ${ticker} ${timeframe}: ${message.slice(0, 200)}`);
        if (isAlpacaMarketDataAuthError(err) || /401 Authorization Required/i.test(message)) {
          const payload = {
            symbol: ticker.toUpperCase(),
            timeframe,
            provider: process.env.MARKET_DATA_PROVIDER ?? "alpaca",
            feed: process.env.ALPACA_DATA_FEED ?? "iex",
            count: 0,
            bars: [] as unknown[],
            timings: { alpacaMs: Date.now() - started },
            error: "Alpaca authentication failed — check API keys on the host",
          };
          barsResponseCache.set(cacheKey, { at: Date.now(), payload });
          return payload;
        }
        throw err;
      }
      const alpacaMs = Date.now() - started;
      const payload = {
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
        timings: { alpacaMs },
      };
      barsResponseCache.set(cacheKey, { at: Date.now(), payload });
      return payload;
    })().finally(() => {
      barsInflight.delete(cacheKey);
    });
    barsInflight.set(cacheKey, job);
    return job;
  }

  const server = createServer((req, res) => {
    void handleHttpRequest(req, res).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[http] unhandled:", message.slice(0, 300));
      if (!res.headersSent) {
        applyCors(req, res);
        json(res, 500, { error: "internal server error" });
      }
    });
  });

  async function handleHttpRequest(
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
  ) {
    try {
      applyCors(req, res);
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url ?? "/", `http://localhost:${port}`);

      if (url.pathname === "/" && req.method === "GET") {
        const railwayEnv = (process.env.RAILWAY_ENVIRONMENT ?? "").toLowerCase();
        const isPreviewService =
          railwayEnv === "preview" ||
          (process.env.NEWS_PROVIDER ?? "").toLowerCase() === "alpaca";
        const previewWeb =
          (process.env.PREVIEW_WEB_URL ?? "").trim() ||
          "https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app";
        const productionWeb =
          (process.env.PRODUCTION_WEB_URL ?? "").trim() ||
          "https://web-tawny-iota-56.vercel.app";
        return json(res, 200, {
          service: "wulu-api",
          message:
            "This URL is the JSON API only. Open the web app links below in your browser — do not expect HTML here.",
          environment: isPreviewService ? "preview" : "production",
          webApp: isPreviewService ? previewWeb : productionWeb,
          pages: isPreviewService
            ? {
                login: `${previewWeb}/login`,
                overview: `${previewWeb}/`,
                scanner: `${previewWeb}/scanner`,
                watchlist: `${previewWeb}/watchlist`,
                charts: `${previewWeb}/charts`,
                signals: `${previewWeb}/signals`,
              }
            : {
                login: `${productionWeb}/login`,
                overview: `${productionWeb}/`,
                scanner: `${productionWeb}/scanner`,
                watchlist: `${productionWeb}/watchlist`,
              },
          health: "/health",
          exampleSetup: "/v1/setup?ticker=SPY&side=LONG&fast=1",
        });
      }

      if (url.pathname === "/health") {
        return json(res, 200, {
          ok: true,
          phase: "G",
          /** Railway injects these; useful to confirm which git commit is live */
          gitCommit:
            (process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT ?? "").trim() || null,
          gitCommitMessage:
            (process.env.RAILWAY_GIT_COMMIT_MESSAGE ?? "").trim() || null,
          newsProvider: news.providerName,
          marketDataProvider: process.env.MARKET_DATA_PROVIDER ?? "alpaca",
          alpacaFeed: process.env.ALPACA_DATA_FEED ?? "iex",
          supportsFastSetup: true,
          barsCacheMs: BARS_CACHE_MS,
          alpacaInteractivePriority: true,
          alpacaCredentialsPresent: hasAlpacaCredentials(alpaca),
          marketDataAuthSoftFail: marketDataAuthSoftFailEnabled(),
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
          monitor: {
            ...monitorHub.metrics(),
            maxSymbols: Number(process.env.MONITOR_MAX_SYMBOLS ?? 12),
            intervalMs: Number(process.env.MONITOR_INTERVAL_MS ?? 20_000),
            automaticOrders: false,
            previewDevWatchlist: isPreviewDevWatchlist(),
            wuluLabModeEnabled: isWuluLabModeEnabled(),
            effectiveWatchlistMax: resolveWatchlistPlanMax(null),
          },
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
          let withModel = openAiConfigured();
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
        await withAlpacaPriority("interactive", async () => {
        const ticker = url.searchParams.get("ticker");
        if (!ticker) {
          return json(res, 400, { error: "ticker query required" });
        }
        const tfKey = (url.searchParams.get("timeframe") ?? "5m").trim().toLowerCase();
        const timeframeMap: Record<string, "1Min" | "5Min" | "15Min" | "1Hour" | "1Day"> = {
          "1m": "1Min",
          "1min": "1Min",
          "5m": "5Min",
          "5min": "5Min",
          "15m": "15Min",
          "15min": "15Min",
          "1h": "1Hour",
          "1hour": "1Hour",
          "1d": "1Day",
          "1day": "1Day",
        };
        const timeframe = timeframeMap[tfKey];
        if (!timeframe) {
          return json(res, 400, {
            error: "timeframe must be 1m, 5m, 15m, 1h, or 1D (Alpaca-supported)",
          });
        }
        const limit = Math.min(2000, Math.max(10, Number(url.searchParams.get("limit") ?? 150)));
        const safeLimit = Number.isFinite(limit) ? limit : 150;
        const extended = url.searchParams.get("session") === "all";
        const regularHoursOnly = !extended;
        const cacheKey = `${ticker.toUpperCase()}|${timeframe}|${safeLimit}|${extended ? "all" : "rth"}`;
        const cached = barsResponseCache.get(cacheKey);
        const age = cached ? Date.now() - cached.at : Infinity;
        if (cached && age < BARS_CACHE_MS) {
          return json(res, 200, cached.payload);
        }
        if (cached && age < BARS_STALE_MS) {
          refreshBarsCache(cacheKey, ticker, timeframe, safeLimit, regularHoursOnly).catch(
            (err) => {
              const message = err instanceof Error ? err.message : String(err);
              console.warn(
                `[bars] stale background refresh failed ${ticker}: ${message.slice(0, 200)}`,
              );
            },
          );
          return json(res, 200, cached.payload);
        }
        const pending =
          barsInflight.get(cacheKey) ??
          refreshBarsCache(cacheKey, ticker, timeframe, safeLimit, regularHoursOnly);
        try {
          const payload = await pending;
          return json(res, 200, payload);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return json(res, 502, {
            error: message.slice(0, 300),
            symbol: ticker.toUpperCase(),
            provider: process.env.MARKET_DATA_PROVIDER ?? "alpaca",
          });
        }
        });
        return;
      }

      if (url.pathname === "/v1/catalyst" && req.method === "GET") {
        const ticker = url.searchParams.get("ticker");
        if (!ticker) {
          return json(res, 400, { error: "ticker query required" });
        }
        let catalyst: Awaited<ReturnType<typeof news.getCatalystForTicker>> = {
          event: null,
          why: emptyWhyMoving(),
        };
        try {
          catalyst = await news.getCatalystForTicker(ticker);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[news] catalyst ${ticker}: ${message.slice(0, 160)}`);
        }
        const { event, why } = catalyst;
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

      if (url.pathname === "/v1/wulu-plan" && req.method === "POST") {
        try {
          const body = (await readJson(req)) as Parameters<typeof handleWuluPlanPost>[0]["body"];
          await handleWuluPlanPost({
            body,
            scanner,
            marketData,
            outcomeTracker,
            interactiveSetupMemory,
            setupStateKey,
            json,
            res,
          });
        } catch (err) {
          return authError(res, err);
        }
        return;
      }

      if (url.pathname === "/v1/setup" && req.method === "GET") {
        const ticker = url.searchParams.get("ticker");
        const sideParam = (url.searchParams.get("side") ?? "LONG").toUpperCase();
        if (!ticker) {
          return json(res, 400, { error: "ticker query required" });
        }
        const sym = normalizeTicker(ticker);
        if (!sym) {
          return json(res, 400, {
            error: "Invalid ticker symbol. Use 1–10 letters (e.g. AAPL).",
            automaticOrders: false,
          });
        }
        if (sideParam !== "LONG" && sideParam !== "SHORT") {
          return json(res, 400, { error: "side must be LONG or SHORT" });
        }
        const side = sideParam as TradeSide;
        const wantBriefEarly =
          url.searchParams.get("brief") === "1" || url.searchParams.get("brief") === "true";
        const wantPlanEarly =
          url.searchParams.get("plan") === "1" || url.searchParams.get("plan") === "true";
        const wantLabEarly =
          url.searchParams.get("lab") === "1" || url.searchParams.get("lab") === "true";
        const labModeEarly = wantLabEarly && isWuluLabModeEnabled();
        const mockRthEarly =
          (url.searchParams.get("mockRth") === "1" ||
            url.searchParams.get("mockRth") === "true") &&
          labModeEarly;
        const mockEnterEarly =
          (url.searchParams.get("mockEnter") === "1" ||
            url.searchParams.get("mockEnter") === "true") &&
          mockRthEarly &&
          labModeEarly;
        const useFastEarly =
          url.searchParams.get("fast") === "1" || url.searchParams.get("fast") === "true";
        const refEarly = url.searchParams.get("referencePrice") ?? "";
        const setupCacheKey = `${sym}|${side}|${labModeEarly}|${mockRthEarly}|${mockEnterEarly}|${useFastEarly}|${refEarly}`;
        if (!wantBriefEarly && !wantPlanEarly) {
          const hit = setupResponseCache.get(setupCacheKey);
          if (hit && Date.now() - hit.at < SETUP_CACHE_MS) {
            return json(res, 200, hit.payload);
          }
          const pending = setupInflight.get(setupCacheKey);
          if (pending) {
            try {
              return json(res, 200, await pending);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              return json(res, 502, {
                error:
                  "Could not complete scan for this symbol. Check the ticker or try again in a moment.",
                detail: message.slice(0, 240),
                automaticOrders: false,
              });
            }
          }
        }

        let setupJob = withAlpacaPriority("interactive", async () => {
        try {
        const wantLab =
          url.searchParams.get("lab") === "1" || url.searchParams.get("lab") === "true";
        const labMode = wantLab && isWuluLabModeEnabled();
        const wantMockRth =
          url.searchParams.get("mockRth") === "1" ||
          url.searchParams.get("mockRth") === "true";
        const mockRth = wantMockRth && labMode;
        const wantMockEnter =
          url.searchParams.get("mockEnter") === "1" ||
          url.searchParams.get("mockEnter") === "true";
        const mockEnter = wantMockEnter && mockRth && labMode;
        const useFastSnapshot =
          url.searchParams.get("fast") === "1" || url.searchParams.get("fast") === "true";
        let card: Awaited<ReturnType<typeof scanner.scanWithJournal>>["card"];
        let journalEntry: Awaited<ReturnType<typeof scanner.scanWithJournal>>["journalEntry"];
        const rthBarsOnly = !labMode || mockRth;
        if (useFastSnapshot || labMode) {
          const bars5mLimit = useFastSnapshot ? 45 : labMode ? 120 : 45;
          const bars1mLimit = useFastSnapshot ? 30 : labMode ? 120 : 30;
          const [bars5m, quote, bars15m, bars1h] = await Promise.all([
            marketData.getBars({
              symbol: sym,
              timeframe: "5Min",
              limit: bars5mLimit,
              regularHoursOnly: rthBarsOnly,
            }),
            marketData.getQuote(sym),
            marketData.getBars({
              symbol: sym,
              timeframe: "15Min",
              limit: useFastSnapshot ? 24 : 32,
              regularHoursOnly: rthBarsOnly,
            }),
            marketData.getBars({
              symbol: sym,
              timeframe: "1Hour",
              limit: 24,
              regularHoursOnly: rthBarsOnly,
            }),
          ]);
          const lastBar = bars5m.at(-1);
          const lastPrice =
            quote && quote.bid > 0 && quote.ask > 0
              ? (quote.bid + quote.ask) / 2
              : (lastBar?.close ?? 0);
          const skip1mForFastLive = useFastSnapshot && !labMode && !mockRth;
          const bars1m = skip1mForFastLive
            ? bars5m
            : await marketData.getBars({
                symbol: sym,
                timeframe: "1Min",
                limit: bars1mLimit,
                regularHoursOnly: rthBarsOnly,
              });
          const last1m = bars1m.at(-1) ?? lastBar;
          let livePx = lastPrice;
          const refParam = url.searchParams.get("referencePrice");
          const refPx = refParam ? Number(refParam) : NaN;
          if (Number.isFinite(refPx) && refPx > 0) {
            livePx = refPx;
          }
          const snapshot = {
            symbol: sym,
            lastPrice: livePx,
            quote,
            bars1m: bars1m.length ? bars1m : bars5m,
            bars5m,
            bars15m,
            bars1h,
            receivedAt: new Date(),
            marketTimestamp:
              quote?.timestamp ?? (last1m ? barEffectiveEndTime(last1m) : null),
          };
          if (labMode && Number.isFinite(refPx) && refPx > 0 && snapshot.quote) {
            snapshot.quote = {
              ...snapshot.quote,
              bid: refPx * 0.9995,
              ask: refPx * 1.0005,
            };
          }
          const stateKey = setupStateKey(sym, side);
          const mem = interactiveSetupMemory.get(stateKey);
          ({ card, journalEntry } = await scanner.scanWithJournal({
            symbol: sym,
            side,
            preloadedSnapshot: snapshot,
            previousState: mem?.state,
            previousRetestPhase: mem?.retestPhase,
            previousRetestLevel: mem?.retestLevel,
            labMode,
            mockRth,
            mockEnter,
          }));
          writeSetupSessionMemory(interactiveSetupMemory, stateKey, card);
        } else {
          const stateKey = setupStateKey(sym, side);
          const mem = interactiveSetupMemory.get(stateKey);
          ({ card, journalEntry } = await scanner.scanWithJournal({
            symbol: sym,
            side,
            previousState: mem?.state,
            previousRetestPhase: mem?.retestPhase,
            previousRetestLevel: mem?.retestLevel,
            labMode,
            mockRth,
            mockEnter,
          }));
          writeSetupSessionMemory(interactiveSetupMemory, stateKey, card);
        }

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
        const wantPlan =
          url.searchParams.get("plan") === "1" ||
          url.searchParams.get("plan") === "true";
        const openaiReady = openAiConfigured();
        let withModelBrief = wantBrief && openaiReady;
        let creditsCharged = 0;
        let creditsRemaining: number | null = null;

        if (wantBrief && openaiReady && supabaseReady && req.headers.authorization) {
          try {
            const user = await requireUser(req.headers.authorization);
            const profile = await getOrCreateProfile(user);
            const planTier = getPlan(profile.plan_tier);
            if (!planTier.aiEnabled) {
              withModelBrief = false;
            } else {
              const cost = planTier.aiCreditCost;
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
                withModelBrief = false;
              }
            }
          } catch {
            withModelBrief = false;
          }
        } else if (!wantBrief) {
          withModelBrief = false;
        }
        // wantBrief + OpenAI, no auth session → still narrate brief (same as /v1/recommend)

        const signal = await buildAutomaticSignal({
          card,
          side,
          withModelBrief: withModelBrief,
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
          /** Lab sim RTH: waive 2R SKIP so drills show WAIT/ENTER from other gates. */
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
          if (mockRth) {
            if (!displayStatus.toUpperCase().includes("SIM RTH")) {
              displayStatus = `SIM RTH · ${displayStatus}`;
            }
          } else {
            tradingAction = "WAIT";
            if (!displayStatus.toUpperCase().includes("LAB TEST")) {
              displayStatus = `LAB TEST · ${displayStatus}`;
            }
          }
        }
        const strategyName =
          card.matchedStrategies[0]?.strategyName ??
          card.historicalEdge?.strategyName ??
          null;
        const watchingSummary = buildWatchingSummary({
          symbol: card.symbol,
          side: card.side,
          strategyName,
          alertAt: card.alertAt,
          waitingFor: card.nearActive.stillWaitingFor,
          tradingAction,
          rewardToRisk: card.rewardToRisk,
        });

        const tradePlan = wantPlan
          ? (
              await buildWuluPlanForCard({
                card,
                side,
                mockRth,
                labMode,
                outcomeTracker,
              })
            ).tradePlan
          : undefined;

        const setupPayload = {
          liveCard: {
            symbol: card.symbol,
            side: card.side,
            headline: `${card.symbol} — ${card.side}`,
            status: displayStatus,
            tradingAction,
            watchingSummary,
            outcomeDetail: resolvedDetail,
            outcomeR: setupTrack.resolution?.outcomeR ?? null,
            marketDataAt:
              card.nearActive.dataTimestamp ??
              card.lastCompletedBar?.timestamp ??
              card.evaluatedAt,
            dataFeed: process.env.ALPACA_DATA_FEED ?? "iex",
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
            t3: card.target3 ?? null,
            lastPrice: card.lastPrice,
            qualityScore10: card.qualityScore10?.score ?? null,
            qualityScore10Disclaimer: card.qualityScore10?.disclaimer ?? null,
            matrixChecklist: card.matrix.rows.map((r) => ({
              id: r.id,
              label: r.label,
              status: r.status,
              requiredForEntry: r.requiredForEntry,
              reason: r.reason,
            })),
            indicatorChecklist: card.indicatorChecklist,
            entryGeometry: card.entryGeometry ?? null,
            quoteTransparency: card.quoteTransparency ?? null,
            rewardToRisk: card.rewardToRisk,
            dataFresh: card.dataFresh,
            dataFreshReason: card.dataFreshReason ?? null,
            labMode: card.labMode ?? false,
            mockRth: card.mockRth ?? false,
            mockEnter: card.mockEnter ?? false,
            labMockEnterAuthorizedSide: card.labMockEnterAuthorizedSide ?? null,
            labDisclaimer: card.labDisclaimer ?? null,
            marketDataStatus: card.marketDataStatus ?? null,
            evaluatedAt: card.evaluatedAt,
            setupScore: `${card.setupScore.total} / 100`,
            setupScoreValue: card.setupScore.total,
            setupScoreDisclaimer: card.setupScore.disclaimer,
            market: card.regime?.bias ?? null,
            marketRegime: card.regime?.primary ?? null,
            session: card.session,
            matchedStrategies: card.matchedStrategies,
            activeTechnique: card.activeTechnique,
            historicalEdge: card.historicalEdge,
            options: card.options,
            nearActive: {
              active: card.nearActive.active,
              trigger: card.nearActive.trigger,
              distanceToTriggerAbs: card.nearActive.distanceToTriggerAbs,
              distanceToTriggerPct: card.nearActive.distanceToTriggerPct,
              distanceLabel: card.nearActive.distanceLabel,
              conditionsPassed: card.nearActive.conditionsPassed,
              conditionsTotal: card.nearActive.conditionsTotal,
              stillWaitingFor: card.nearActive.stillWaitingFor,
              confirmationRequirement: card.nearActive.confirmationRequirement,
              permissionToEnter: card.nearActive.permissionToEnter,
              dataTimestamp: card.nearActive.dataTimestamp,
              setupQualityScore: card.nearActive.setupQualityScore,
            },
            relativeMomentum: card.relativeMomentum,
          },
          signalRecommendation,
          tradePlan: tradePlan ?? null,
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
        };
        if (!wantBrief && !wantPlan) {
          setupResponseCache.set(setupCacheKey, { at: Date.now(), payload: setupPayload });
        }
        return setupPayload;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn("[setup] scan failed:", message.slice(0, 200));
          throw err;
        }
        });
        if (!wantBriefEarly && !wantPlanEarly) {
          setupInflight.set(setupCacheKey, setupJob);
          setupJob = setupJob.finally(() => setupInflight.delete(setupCacheKey));
        }
        try {
          const payload = await setupJob;
          return json(res, 200, payload);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return json(res, 502, {
            error:
              "Could not complete scan for this symbol. Check the ticker or try again in a moment.",
            detail: message.slice(0, 240),
            automaticOrders: false,
          });
        }
      }

      // ── Phase 2: server-side multi-stock monitor ─────────────────────────
      if (url.pathname === "/v1/monitor" && req.method === "GET") {
        try {
          const sessionId = await resolveMonitorSession(req.headers.authorization);
          // Restore from DB on first GET if memory empty (post-restart / new process)
          if (sessionId !== "default" && monitorHub.get(sessionId).list().length === 0) {
            const stored = await loadMonitorWatchlist(sessionId);
            if (stored?.length) {
              monitorHub.restoreSession(sessionId, stored);
              monitorHub.start();
            }
          }
          let planMax = resolveWatchlistPlanMax(null);
          if (sessionId !== "default" && supabaseReady) {
            try {
              const user = await requireUser(req.headers.authorization);
              const profile = await getOrCreateProfile(user);
              planMax = resolveWatchlistPlanMax(profile.plan_tier);
            } catch {
              // keep default cap; GET stays readable
            }
          }
          return json(res, 200, {
            ...monitorHub.snapshot(sessionId),
            hub: monitorHub.metrics(),
            defaultWatchlist: DEFAULT_MONITOR_WATCHLIST,
            planMax,
          });
        } catch (err) {
          return authError(res, err);
        }
      }

      if (url.pathname === "/v1/monitor/watchlist" && req.method === "PUT") {
        try {
          const sessionId = await resolveMonitorSession(req.headers.authorization, {
            requireAuth: supabaseReady,
          });
          const body = (await readJson(req)) as {
            symbols?: Array<{ symbol?: string; side?: string }>;
          };
          const items: MonitorSymbolConfig[] = (body.symbols ?? []).map((s) => ({
            symbol: (s.symbol ?? "").trim().toUpperCase(),
            side: (s.side === "SHORT" ? "SHORT" : "LONG") as TradeSide,
          }));
          let planMax = resolveWatchlistPlanMax(null);
          if (sessionId !== "default" && supabaseReady) {
            const user = await requireUser(req.headers.authorization);
            const profile = await getOrCreateProfile(user);
            planMax = resolveWatchlistPlanMax(profile.plan_tier);
          }
          if (items.filter((i) => i.symbol).length > planMax) {
            return json(res, 400, {
              error: `Plan limit: max ${planMax} monitored symbols`,
              planMax,
              automaticOrders: false,
            });
          }
          const snap = await monitorHub.setWatchlist(sessionId, items);
          return json(res, 200, { ...snap, hub: monitorHub.metrics(), planMax });
        } catch (err) {
          if (err instanceof MonitorLimitError) {
            return json(res, 400, { error: err.message });
          }
          return authError(res, err);
        }
      }

      if (url.pathname === "/v1/monitor/symbols" && req.method === "POST") {
        try {
          const sessionId = await resolveMonitorSession(req.headers.authorization, {
            requireAuth: supabaseReady,
          });
          const body = (await readJson(req)) as {
            symbol?: string;
            side?: string;
            replace?: string;
          };
          const symbol = normalizeTicker(body.symbol ?? "");
          if (!symbol) {
            return json(res, 400, {
              error: "Invalid or missing symbol. Use 1–10 letters (e.g. AAPL).",
            });
          }
          const side = (body.side === "SHORT" ? "SHORT" : "LONG") as TradeSide;
          const replace = normalizeTicker(body.replace ?? "");
          let planMax = resolveWatchlistPlanMax(null);
          if (sessionId !== "default" && supabaseReady) {
            const user = await requireUser(req.headers.authorization);
            const profile = await getOrCreateProfile(user);
            planMax = resolveWatchlistPlanMax(profile.plan_tier);
          }
          const mon = monitorHub.get(sessionId);
          const onList = mon.list().some((s) => s.symbol === symbol);
          if (!replace && !onList && mon.list().length >= planMax) {
            return json(res, 400, {
              error: `Plan limit: max ${planMax} monitored symbols. Remove one or upgrade your plan.`,
              planMax,
              automaticOrders: false,
            });
          }
          const snap = replace
            ? await monitorHub.replaceSymbol(sessionId, replace, symbol, side)
            : await monitorHub.addSymbol(sessionId, symbol, side);
          return json(res, 200, { ...snap, hub: monitorHub.metrics(), planMax });
        } catch (err) {
          if (err instanceof MonitorLimitError) {
            return json(res, 400, { error: err.message });
          }
          if (err instanceof Error && err.message.includes("watchlist")) {
            return json(res, 400, { error: err.message });
          }
          return authError(res, err);
        }
      }

      if (url.pathname.startsWith("/v1/monitor/symbols/") && req.method === "DELETE") {
        try {
          const sessionId = await resolveMonitorSession(req.headers.authorization, {
            requireAuth: supabaseReady,
          });
          const symbol = decodeURIComponent(url.pathname.slice("/v1/monitor/symbols/".length))
            .trim()
            .toUpperCase();
          if (!symbol) return json(res, 400, { error: "symbol required" });
          const snap = await monitorHub.removeSymbol(sessionId, symbol);
          return json(res, 200, { ...snap, hub: monitorHub.metrics() });
        } catch (err) {
          return authError(res, err);
        }
      }

      if (url.pathname === "/v1/monitor/tick" && req.method === "POST") {
        await monitorHub.tick({ force: true });
        const sessionId = await resolveMonitorSession(req.headers.authorization);
        return json(res, 200, {
          ...monitorHub.snapshot(sessionId),
          hub: monitorHub.metrics(),
        });
      }

      if (url.pathname === "/v1/monitor/events" && req.method === "GET") {
        try {
          const sessionId = await resolveMonitorSession(req.headers.authorization, {
            requireAuth: supabaseReady,
          });
          const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
          const raw = await monitorHub.listAlerts(sessionId, limit);
          const events = raw.filter((e) =>
            isUserVisibleAlertTransition(e.previousStatus, e.newStatus),
          );
          const prefs =
            sessionId !== "default"
              ? await getAlertPreferences(sessionId)
              : await getAlertPreferences("default");
          const audit =
            url.searchParams.get("audit") === "1" || url.searchParams.get("view") === "audit";
          const visible = audit ? raw : events;
          return json(res, 200, {
            count: visible.length,
            events: visible,
            view: audit ? "audit" : "user",
            delivery: "recorded_for_in_app_and_optional_browser",
            preferences: prefs,
            note: "Status-change events are recorded. SMS/email/push senders are not wired. Automatic orders remain disabled. Signals are not live-validated until RTH confirmation.",
            automaticOrders: false,
          });
        } catch (err) {
          return authError(res, err);
        }
      }

      if (url.pathname === "/v1/alert-preferences" && req.method === "GET") {
        try {
          const sessionId = await resolveMonitorSession(req.headers.authorization, {
            requireAuth: supabaseReady,
          });
          const prefs = await getAlertPreferences(sessionId);
          return json(res, 200, {
            preferences: prefs,
            channelsSupported: ["in_app", "browser"],
            channelsNotWired: ["email", "sms", "push"],
            automaticOrders: false,
          });
        } catch (err) {
          return authError(res, err);
        }
      }

      if (url.pathname === "/v1/alert-preferences" && req.method === "PUT") {
        try {
          const sessionId = await resolveMonitorSession(req.headers.authorization, {
            requireAuth: true,
          });
          const body = (await readJson(req)) as {
            inAppEnabled?: boolean;
            browserEnabled?: boolean;
          };
          const prefs = await saveAlertPreferences(sessionId, {
            inAppEnabled: body.inAppEnabled,
            browserEnabled: body.browserEnabled,
          });
          return json(res, 200, {
            preferences: prefs,
            note: "Email/SMS/push cannot be enabled until delivery providers are wired.",
            automaticOrders: false,
          });
        } catch (err) {
          return authError(res, err);
        }
      }

      if (url.pathname === "/v1/monitor/defaults" && req.method === "POST") {
        try {
          const sessionId = await resolveMonitorSession(req.headers.authorization, {
            requireAuth: supabaseReady,
          });
          let planMax = resolveWatchlistPlanMax(null);
          if (sessionId !== "default" && supabaseReady) {
            const user = await requireUser(req.headers.authorization);
            const profile = await getOrCreateProfile(user);
            planMax = resolveWatchlistPlanMax(profile.plan_tier);
          }
          const starter = DEFAULT_MONITOR_WATCHLIST.slice(0, planMax);
          const snap = await monitorHub.setWatchlist(sessionId, starter);
          const capNote =
            starter.length < DEFAULT_MONITOR_WATCHLIST.length
              ? `Loaded ${starter.length} starter symbols (your plan allows ${planMax}).`
              : "Loaded default six starter symbols.";
          return json(res, 200, {
            ...snap,
            hub: monitorHub.metrics(),
            planMax,
            note: capNote,
          });
        } catch (err) {
          if (err instanceof MonitorLimitError) {
            return json(res, 400, { error: err.message });
          }
          return authError(res, err);
        }
      }

      if (url.pathname === "/v1/replay" && req.method === "GET") {
        const ticker = (url.searchParams.get("ticker") ?? "").trim().toUpperCase();
        const sideParam = (url.searchParams.get("side") ?? "LONG").toUpperCase();
        if (!ticker) return json(res, 400, { error: "ticker query required" });
        if (sideParam !== "LONG" && sideParam !== "SHORT") {
          return json(res, 400, { error: "side must be LONG or SHORT" });
        }
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 78), 150);
        const bars5m = await marketData.getBars({
          symbol: ticker,
          timeframe: "5Min",
          limit,
        });
        const replay = runSignalReplay({
          symbol: ticker,
          side: sideParam as TradeSide,
          bars5m,
        });
        // Record replay transitions, last step, opens/resolutions (labeled HISTORICAL_REPLAY).
        const replayIndexes = new Set<number>(
          replay.transitions.map((t) => t.barIndex),
        );
        if (replay.steps.length > 0) {
          replayIndexes.add(replay.steps.length - 1);
        }
        for (const idx of replayIndexes) {
          const step = replay.steps[idx];
          if (step) {
            signalPerformanceStore.record(
              cardToPerformanceRecord(step.card, "HISTORICAL_REPLAY", null),
            );
          }
        }
        for (const resolution of replay.outcomes) {
          const step =
            replay.steps.find((s) => s.asOf === resolution.resolvedAt) ??
            replay.steps[replay.steps.length - 1];
          if (step) {
            signalPerformanceStore.upsert(
              resolutionToPerformanceRecord(
                resolution,
                step.card,
                "HISTORICAL_REPLAY",
                null,
              ),
            );
            void closeOpenTrack(resolution.id);
          }
        }
        for (const open of replay.openTracks) {
          void upsertOpenTrack(open);
          signalPerformanceStore.upsert({
            ...cardToPerformanceRecord(
              replay.steps.find((s) => s.card.setupId === open.setupId)?.card ??
                replay.steps[replay.steps.length - 1]!.card,
              "HISTORICAL_REPLAY",
              null,
            ),
            id: open.id,
            actionable: true,
            outcomeStatus: "UNKNOWN",
            confirmationSummary: [
              "outcomeDetail:OPEN",
              `entryPrice:${open.entryPrice}`,
              `stop:${open.stop}`,
              `target1:${open.target1}`,
              `target2:${open.target2}`,
              `target3:${open.target3 ?? ""}`,
              `barsElapsed:${open.barsElapsed}`,
              `source:${open.source}`,
              `setupId:${open.setupId}`,
            ],
          });
        }
        return json(res, 200, {
          ...replay,
          automaticOrders: false,
          feed: process.env.ALPACA_DATA_FEED ?? "iex",
          liveValidated: false,
          note: "HISTORICAL REPLAY — NOT LIVE. Hypothetical outcomes on 5m bars are not a published win rate.",
        });
      }

      if (url.pathname === "/v1/signal-outcomes" && req.method === "GET") {
        const open = outcomeTracker.listOpen();
        return json(res, 200, {
          open,
          count: open.length,
          automaticOrders: false,
          note: "Open tracked entries awaiting stop/target resolution. Outcomes are hypothetical until RTH-validated.",
        });
      }

      if (url.pathname === "/v1/signal-performance" && req.method === "GET") {
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
        let userId: string | null = null;
        try {
          userId = await resolveMonitorSession(req.headers.authorization);
          if (userId === "default") userId = null;
        } catch {
          userId = null;
        }
        const records = await signalPerformanceStore.listMerged(limit, userId);
        const summary = await signalPerformanceStore.summaryMerged(userId);
        return json(res, 200, {
          summary,
          records,
          note: "Foundation counts only — not a published win rate. liveValidated stays false until RTH confirmation. LIVE vs HISTORICAL_REPLAY labeled per record.",
          automaticOrders: false,
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

      if (url.pathname === "/v1/rank" && req.method === "GET") {
        const tickersParam = url.searchParams.get("tickers");
        if (!tickersParam?.trim()) {
          return json(res, 400, { error: "tickers query required (comma-separated)" });
        }
        const tickers = tickersParam.split(",").map((t) => t.trim()).filter(Boolean);
        const ranked = await scanner.rankWatchlist(tickers);
        return json(res, 200, {
          feed: process.env.ALPACA_DATA_FEED ?? "iex",
          provider: process.env.MARKET_DATA_PROVIDER ?? "alpaca",
          disclaimer:
            "Relative-momentum ranking is context only. Green with the market ≠ relatively strong. Ranking never grants entry permission.",
          count: ranked.length,
          ranked,
        });
      }

      if (url.pathname === "/v1/opportunities" && req.method === "GET") {
        const topN = Math.min(Number(url.searchParams.get("top") ?? 15), 40);
        const confirmTop = Math.min(Number(url.searchParams.get("confirm") ?? 0), 8);
        const universeParam = url.searchParams.get("universe");
        const universe = universeParam?.trim()
          ? universeParam.split(",").map((t) => t.trim()).filter(Boolean)
          : undefined;
        try {
          const result = await scanner.discoverOpportunities({
            universe,
            topN,
            confirmTop,
          });
          return json(res, 200, result);
        } catch (err) {
          return json(res, 502, {
            error: err instanceof Error ? err.message : String(err),
            automaticOrders: false,
          });
        }
      }

      if (url.pathname === "/v1/monitor/promote" && req.method === "POST") {
        try {
          const sessionId = await resolveMonitorSession(req.headers.authorization, {
            requireAuth: supabaseReady,
          });
          const body = (await readJson(req)) as {
            symbols?: Array<{ symbol?: string; side?: string }>;
          };
          const items = (body.symbols ?? [])
            .map((s) => ({
              symbol: String(s.symbol ?? "")
                .trim()
                .toUpperCase(),
              side: (String(s.side ?? "LONG").toUpperCase() === "SHORT"
                ? "SHORT"
                : "LONG") as TradeSide,
            }))
            .filter((s) => s.symbol.length > 0);
          if (items.length === 0) {
            return json(res, 400, { error: "symbols array required" });
          }

          // Phase 7: enforce plan watchlist cap (in addition to hub MONITOR_MAX_SYMBOLS)
          let planMax = resolveWatchlistPlanMax(null);
          let planTier = "hub";
          if (sessionId !== "default" && supabaseReady) {
            const user = await requireUser(req.headers.authorization);
            const profile = await getOrCreateProfile(user);
            const plan = getPlan(profile.plan_tier);
            planMax = resolveWatchlistPlanMax(profile.plan_tier);
            planTier = plan.id;
          }
          const existing = new Set(
            monitorHub
              .get(sessionId)
              .list()
              .map((s) => s.symbol),
          );
          const toAdd = items.filter((i) => !existing.has(i.symbol));
          if (existing.size + toAdd.length > planMax) {
            return json(res, 400, {
              error: `Plan limit: max ${planMax} monitored symbols (${planTier}). Upgrade or remove symbols first.`,
              planMax,
              planTier,
              current: existing.size,
              automaticOrders: false,
            });
          }

          let snap = await monitorHub.addSymbol(sessionId, items[0]!.symbol, items[0]!.side);
          for (const item of items.slice(1)) {
            snap = await monitorHub.addSymbol(sessionId, item.symbol, item.side);
          }
          return json(res, 200, {
            ...snap,
            hub: monitorHub.metrics(),
            planMax,
            note: "Promoted into deep monitor — confirmation gates unchanged. Ranking is not ENTRY permission.",
            automaticOrders: false,
          });
        } catch (err) {
          if (err instanceof MonitorLimitError) {
            return json(res, 400, { error: err.message });
          }
          return authError(res, err);
        }
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

      if (url.pathname === "/v1/symbols/search" && req.method === "GET") {
        const q = url.searchParams.get("q") ?? "";
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 12), 1), 25);
        const results = searchSymbols(q, limit);
        return json(res, 200, {
          query: q,
          count: results.length,
          results,
          note: "Curated liquid universe typeahead — not a full exchange directory.",
          automaticOrders: false,
        });
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

      // Phase 6: multi-strategy historical compare on the same bars
      if (url.pathname === "/v1/backtest/compare" && req.method === "GET") {
        const ticker = (url.searchParams.get("ticker") ?? "SPY").toUpperCase();
        const strategiesParam = url.searchParams.get("strategies");
        const strategyIds = strategiesParam?.trim()
          ? strategiesParam.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined;
        const snap = await marketData.getSnapshot(ticker);
        const bars = snap.bars5m.length >= 20 ? snap.bars5m : snap.bars1m;
        const compared = scanner.edge.compareStrategies({
          symbol: ticker,
          bars,
          strategyIds,
          regimePrimary: url.searchParams.get("regime") ?? undefined,
        });
        return json(res, 200, {
          ticker,
          barCount: bars.length,
          count: compared.length,
          strategies: compared.map((c) => ({
            strategyId: c.panel.strategyId,
            strategyName: c.panel.strategyName,
            sampleSize: c.panel.sampleSize,
            winRatePct: c.panel.winRatePct,
            expectancyR: c.panel.expectancyR,
            walkForward: c.panel.walkForward ?? null,
            disclaimer: c.panel.disclaimer,
          })),
          disclaimer:
            "Historical backtest compare — not live performance. Insufficient samples show null rates. Auto-trading disabled.",
          automaticOrders: false,
        });
      }

      // Phase 6/7: measured performance from durable signal history
      if (url.pathname === "/v1/measured-performance" && req.method === "GET") {
        const sourceParam = (url.searchParams.get("source") ?? "ALL").toUpperCase();
        const source =
          sourceParam === "LIVE" ||
          sourceParam === "HISTORICAL_REPLAY" ||
          sourceParam === "LIVE_VALIDATED"
            ? sourceParam
            : "ALL";
        const minSample = Math.min(
          Math.max(Number(url.searchParams.get("minSample") ?? 20), 5),
          200,
        );
        const records = await signalPerformanceStore.listMerged(500, null);
        const report = aggregateMeasuredPerformance(records, {
          source: source as "LIVE" | "HISTORICAL_REPLAY" | "LIVE_VALIDATED" | "ALL",
          minSampleForRate: minSample,
        });
        return json(res, 200, {
          ...report,
          recordsConsidered: records.length,
          note:
            source === "LIVE_VALIDATED"
              ? "Verified signal outcomes only (market-evidence + audit). Not executed customer trading profits. Auto-trading disabled."
              : "Foundation measured stats from stored rows — not a marketed accuracy claim. Not customer trading P/L.",
          outcomeKind: "verified_signal_outcomes",
          notCustomerTradingProfits: true,
        });
      }

      // Phase 7: evidence-backed live validation (note alone is never enough)
      if (
        url.pathname.startsWith("/v1/signals/") &&
        url.pathname.endsWith("/live-validate") &&
        req.method === "POST"
      ) {
        if (!supabaseReady) {
          return json(res, 503, { error: "Supabase not configured" });
        }
        try {
          const user = await requireUser(req.headers.authorization);
          if (!canMarkLiveValidated(user.email ?? undefined)) {
            return json(res, 403, {
              error: "Not authorized to live-validate (check LIVE_VALIDATE_EMAILS)",
            });
          }
          const id = decodeURIComponent(
            url.pathname.slice("/v1/signals/".length, -"/live-validate".length),
          );
          if (!id) return json(res, 400, { error: "signal id required" });
          const body = (await readJson(req).catch(() => ({}))) as { note?: string };

          const existing = await getSignalPerformanceRecordById(id);
          if (!existing) {
            return json(res, 404, { error: "Signal record not found", leftUnvalidated: true });
          }

          // Load market bars to re-verify path (entry/stop/targets → outcome)
          let bars: Array<{ high: number; low: number; close: number; timestamp: string }> = [];
          try {
            const snap = await marketData.getSnapshot(existing.symbol);
            bars = (snap.bars5m.length ? snap.bars5m : snap.bars1m).map((b) => ({
              high: b.high,
              low: b.low,
              close: b.close,
              timestamp: b.timestamp.toISOString(),
            }));
          } catch (err) {
            return json(res, 400, {
              error: "Could not load market data for evidence verification",
              detail: err instanceof Error ? err.message : String(err),
              leftUnvalidated: true,
            });
          }

          const result = await markSignalLiveValidated({
            id,
            note: body.note,
            actorUserId: user.id,
            actorEmail: user.email ?? null,
            bars,
          });
          if (!result.ok) {
            return json(res, 422, {
              error: result.error,
              errors: result.errors,
              evidence: result.evidence,
              leftUnvalidated: true,
              outcomeKind: "verified_signal_outcomes",
              notCustomerTradingProfits: true,
              automaticOrders: false,
            });
          }
          return json(res, 200, {
            record: result.record,
            evidence: result.evidence,
            validatedBy: result.validatedBy,
            validatedAt: result.validatedAt,
            automaticOrders: false,
            outcomeKind: "verified_signal_outcomes",
            notCustomerTradingProfits: true,
            note:
              "Verified signal outcome recorded with market evidence + audit. Not a customer trading profit. Use measured-performance?source=LIVE_VALIDATED.",
          });
        } catch (err) {
          return authError(res, err);
        }
      }

      if (
        url.pathname.startsWith("/v1/signals/") &&
        url.pathname.endsWith("/validation-audit") &&
        req.method === "GET"
      ) {
        if (!supabaseReady) {
          return json(res, 503, { error: "Supabase not configured" });
        }
        try {
          await requireUser(req.headers.authorization);
          const id = decodeURIComponent(
            url.pathname.slice("/v1/signals/".length, -"/validation-audit".length),
          );
          const audit = await listValidationAudit(id);
          return json(res, 200, {
            signalId: id,
            audit,
            note: "Append-only validation history. Verified signal outcomes ≠ executed trades.",
            automaticOrders: false,
          });
        } catch (err) {
          return authError(res, err);
        }
      }

      if (url.pathname === "/v1/journal" && req.method === "GET") {
        if (!journal) {
          return json(res, 503, { error: "journal not enabled" });
        }
        const symbol = url.searchParams.get("symbol") ?? undefined;
        const sideParam = url.searchParams.get("side")?.toUpperCase();
        const side =
          sideParam === "LONG" || sideParam === "SHORT" ? (sideParam as "LONG" | "SHORT") : undefined;
        const state = url.searchParams.get("state") ?? undefined;
        const limit = Number(url.searchParams.get("limit") ?? 50);
        const listQuery = {
          symbol,
          side,
          state: state as never,
          limit: Number.isFinite(limit) ? limit : 50,
        };
        const entries = journal.list(listQuery);
        return json(res, 200, {
          count: journal.count({ symbol, side, state: state as never }),
          analytics: summarizeJournal(entries),
          entries: entries.map((e) => ({
            id: e.id,
            evaluationId: e.calibration?.evaluationId ?? null,
            decisionAt: e.decisionAt,
            symbol: e.symbol,
            side: e.side,
            state: e.state,
            statusLabel: e.statusLabel,
            strategyId: e.strategyId,
            strategyName: e.calibration?.activeTechnique?.strategyName ?? e.strategyName,
            strategyPhase: e.calibration?.activeTechnique?.phase ?? null,
            statusReason: e.calibration?.activeTechnique?.statusReason ?? null,
            tradingAction: e.calibration?.tradingAction ?? null,
            retestPhase: e.calibration?.retest?.phase ?? null,
            retestReason: e.calibration?.retest?.reason ?? null,
            qualityScore10: e.calibration?.qualityScore10 ?? null,
            conditionsPassed: e.conditionsPassed,
            conditionsTotal: e.conditionsTotal,
            blockingGates:
              e.calibration?.matrixSummary?.blocking?.slice(0, 4).map((b) => ({
                id: b.id,
                label: b.label,
                reason: b.reason,
              })) ?? [],
            setupScore: e.setupScore,
            marketRegime: e.marketRegime,
            hasCatalyst: e.hasCatalyst,
            outcome: e.outcome,
            featureSchemaVersion: e.featureSchemaVersion,
            calibrationSchemaVersion: e.calibration?.schemaVersion ?? null,
          })),
        });
      }

      if (url.pathname === "/v1/journal/calibration/export" && req.method === "GET") {
        if (!journal) {
          return json(res, 503, { error: "journal not enabled" });
        }
        const symbol = url.searchParams.get("symbol") ?? undefined;
        const from = url.searchParams.get("from") ?? undefined;
        const to = url.searchParams.get("to") ?? undefined;
        const limit = Number(url.searchParams.get("limit") ?? 5000);
        const formatParam = (url.searchParams.get("format") ?? "json").toLowerCase();
        const format = formatParam === "csv" ? "csv" : "json";
        const entries = journal.list({
          symbol,
          from,
          to,
          limit: Number.isFinite(limit) ? limit : 5000,
        });
        const body = journal.exportCalibration(
          { symbol, from, to, limit: Number.isFinite(limit) ? limit : 5000 },
          format,
        );
        if (format === "csv") {
          res.writeHead(200, {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="wulu-calibration-${new Date().toISOString().slice(0, 10)}.csv"`,
            "Access-Control-Allow-Origin": corsOrigin === "*" ? "*" : corsOrigin,
          });
          res.end(body);
          return;
        }
        return json(res, 200, {
          count: entries.length,
          rows: journal.exportCalibrationRows({ symbol, from, to, limit: Number.isFinite(limit) ? limit : 5000 }),
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
  }

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
    console.log("  POST /v1/wulu-plan");
    console.log("  GET /v1/bars?ticker=NVDA&timeframe=5m");
    console.log("  GET /v1/setup?ticker=NVDA&side=LONG");
    console.log("  GET /v1/monitor");
    console.log("  PUT /v1/monitor/watchlist");
    console.log("  POST /v1/monitor/symbols");
    console.log("  DELETE /v1/monitor/symbols/:ticker");
    console.log("  POST /v1/monitor/tick");
    console.log("  GET /v1/monitor/events");
    console.log("  POST /v1/monitor/defaults");
    console.log("  GET /v1/replay?ticker=NVDA&side=LONG");
    console.log("  GET /v1/opportunities?top=15&confirm=0");
    console.log("  POST /v1/monitor/promote");
    console.log("  GET /v1/backtest/compare?ticker=NVDA");
    console.log("  GET /v1/measured-performance?source=LIVE_VALIDATED");
    console.log("  POST /v1/signals/:id/live-validate");
    console.log("  GET /v1/symbols/search?q=NVDA");
    console.log("  GET /v1/signal-performance");
    console.log("  GET /v1/signal-outcomes");
    console.log("  GET/PUT /v1/alert-preferences");
  });

  const shutdown = () => {
    monitorHub.stopAll();
    server.close();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function isCorsOriginAllowed(origin: string, allowed: string[]): boolean {
  if (!origin) return false;
  if (allowed.includes("*") || allowed.includes(origin)) return true;
  const previewWeb = (process.env.PREVIEW_WEB_URL ?? "").trim().replace(/\/+$/, "");
  if (previewWeb && origin === previewWeb) return true;
  // Vercel Preview / branch aliases for this project (shared Railway API).
  if (/^https:\/\/[\w.-]+-supporttoptiersoluts-projects\.vercel\.app$/i.test(origin)) {
    return true;
  }
  if (allowed.some((a) => a === "https://*.vercel.app" || a === "*.vercel.app")) {
    return /^https:\/\/[\w.-]+\.vercel\.app$/i.test(origin);
  }
  return false;
}

function applyCors(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
) {
  const origin = (req.headers.origin ?? "").replace(/\/+$/, "");
  const allowed = corsOrigin === "*" ? ["*"] : corsOrigin.split(",");
  const allow =
    corsOrigin === "*"
      ? "*"
      : origin && isCorsOriginAllowed(origin, allowed)
        ? origin
        : allowed[0] || "*";
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
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
