export interface MarketDataCredentials {
  apiKeyId: string;
  apiSecretKey: string;
  dataBaseUrl: string;
}

export function loadAlpacaCredentials(
  env: NodeJS.ProcessEnv = process.env,
): MarketDataCredentials {
  return {
    apiKeyId: (env.ALPACA_API_KEY_ID ?? "").trim(),
    apiSecretKey: (env.ALPACA_API_SECRET_KEY ?? "").trim(),
    dataBaseUrl: env.ALPACA_DATA_BASE_URL ?? "https://data.alpaca.markets",
  };
}

export function hasAlpacaCredentials(creds: MarketDataCredentials): boolean {
  return Boolean(creds.apiKeyId && creds.apiSecretKey);
}

/** Explicit non-goals until separately authorized. */
export const EXECUTION_POLICY = {
  automaticOrders: false,
  platform: "thinkorswim" as const,
  alpacaRole: "market_data_and_news" as const,
};
