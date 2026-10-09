import { NewsService } from "./NewsService.js";
import { AlpacaNewsProvider } from "./providers/alpaca.js";
import { MockNewsProvider } from "./providers/mock.js";
import type { NewsProvider } from "./NewsProvider.js";

export type NewsProviderName = "mock" | "alpaca";

export function createNewsProvider(
  name: NewsProviderName = "mock",
  env: NodeJS.ProcessEnv = process.env,
): NewsProvider {
  switch (name) {
    case "mock":
      return new MockNewsProvider();
    case "alpaca":
      return new AlpacaNewsProvider({
        apiKeyId: (env.ALPACA_API_KEY_ID ?? "").trim(),
        apiSecretKey: (env.ALPACA_API_SECRET_KEY ?? "").trim(),
        baseUrl: env.ALPACA_NEWS_BASE_URL ?? env.ALPACA_DATA_BASE_URL,
      });
    default: {
      const _exhaustive: never = name;
      throw new Error(`Unknown news provider: ${_exhaustive}`);
    }
  }
}

export function createNewsServiceFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): NewsService {
  const name = (env.NEWS_PROVIDER ?? "mock").toLowerCase() as NewsProviderName;
  if (name !== "mock" && name !== "alpaca") {
    throw new Error(`NEWS_PROVIDER must be mock|alpaca, got ${env.NEWS_PROVIDER}`);
  }
  return new NewsService({ provider: createNewsProvider(name, env) });
}
