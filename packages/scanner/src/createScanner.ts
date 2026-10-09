import { createNewsServiceFromEnv } from "@wulu/news";
import {
  createAlpacaMarketDataFromEnv,
  MockMarketDataProvider,
  type MarketDataProvider,
} from "@wulu/market-data";
import { createJournalFromEnv, type SignalJournal } from "@wulu/journal";
import { loadFeatureFlags } from "@wulu/domain";
import {
  createAlpacaOptionsFromEnv,
  MockOptionsChainProvider,
  OptionsEngine,
  OptionsEntitlementError,
  type OptionsChainProvider,
  type OptionsChainQuery,
} from "@wulu/options";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SetupScanner } from "./SetupScanner.js";

export function createMarketDataFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): MarketDataProvider {
  const mode = (env.MARKET_DATA_PROVIDER ?? "alpaca").toLowerCase();
  if (mode === "mock") {
    return new MockMarketDataProvider({
      symbol: "NVDA",
      side: "LONG",
      basePrice: 120,
      aboveVwap: true,
      highVolume: true,
      incompleteFiveMin: true,
    });
  }
  return createAlpacaMarketDataFromEnv(env);
}

/**
 * Options provider selection:
 * - mock (default): offline fixtures
 * - alpaca: licensed snapshots API; falls back to mock on entitlement errors at evaluate-time
 */
export function createOptionsEngineFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): OptionsEngine {
  const providerName = (env.OPTIONS_PROVIDER ?? "mock").toLowerCase();
  if (providerName === "alpaca") {
    try {
      return new OptionsEngine(
        new EntitlementAwareOptionsProvider(createAlpacaOptionsFromEnv(env), env),
      );
    } catch {
      return new OptionsEngine(
        new MockOptionsChainProvider(Number(env.OPTIONS_MOCK_UNDERLYING_PRICE ?? 100)),
      );
    }
  }
  return new OptionsEngine(
    new MockOptionsChainProvider(Number(env.OPTIONS_MOCK_UNDERLYING_PRICE ?? 100)),
  );
}

/** Wraps Alpaca provider; on 401/403 falls back to mock so the app stays usable. */
class EntitlementAwareOptionsProvider implements OptionsChainProvider {
  readonly name = "alpaca-options-with-fallback";
  private readonly fallback: MockOptionsChainProvider;
  private warned = false;

  constructor(
    private readonly primary: OptionsChainProvider,
    env: NodeJS.ProcessEnv,
  ) {
    this.fallback = new MockOptionsChainProvider(
      Number(env.OPTIONS_MOCK_UNDERLYING_PRICE ?? 100),
    );
  }

  async getChain(query: OptionsChainQuery) {
    try {
      return await this.primary.getChain(query);
    } catch (err) {
      if (err instanceof OptionsEntitlementError) {
        if (!this.warned) {
          console.warn(`[options] ${err.message} — falling back to mock chain`);
          this.warned = true;
        }
        return this.fallback.getChain(query);
      }
      throw err;
    }
  }
}

export function createSetupScannerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  journal?: SignalJournal | null,
): SetupScanner {
  const rootGuess = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const j =
    journal === null
      ? null
      : (journal ?? createJournalFromEnv(env, env.JOURNAL_ROOT ?? rootGuess));
  const flags = loadFeatureFlags(env);
  return new SetupScanner(createMarketDataFromEnv(env), createNewsServiceFromEnv(env), {
    journal: j,
    optionsEngine: createOptionsEngineFromEnv(env),
    optionsEnabled: flags.optionsEngine,
  });
}
