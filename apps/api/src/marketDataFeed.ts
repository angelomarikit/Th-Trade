import {
  ALPACA_SIP_STREAM_URL,
  AlpacaMarketDataProvider,
  hasAlpacaCredentials,
  loadAlpacaCredentials,
  probeSipEntitlement,
  resolveAlpacaFeed,
  type AlpacaStockFeed,
  type MarketDataProvider,
  type SipEntitlementProbe,
} from "@wulu/market-data";

export function activeAlpacaFeed(market?: MarketDataProvider | null): AlpacaStockFeed {
  if (market instanceof AlpacaMarketDataProvider) return market.activeFeed;
  return resolveAlpacaFeed();
}

export type SipEntitlementStatus = SipEntitlementProbe & {
  realtimeSignalsAllowed: boolean;
};

let cachedProbe: SipEntitlementProbe | null = null;
let cachedAt = 0;
const PROBE_TTL_MS = 5 * 60_000;

export async function getSipEntitlementStatus(force = false): Promise<SipEntitlementStatus> {
  const configuredFeed = resolveAlpacaFeed();
  if (!force && cachedProbe && Date.now() - cachedAt < PROBE_TTL_MS) {
    return {
      ...cachedProbe,
      realtimeSignalsAllowed: cachedProbe.ok && configuredFeed === "sip",
    };
  }

  const creds = loadAlpacaCredentials();
  if (!hasAlpacaCredentials(creds)) {
    const probedAt = new Date().toISOString();
    cachedProbe = {
      configuredFeed,
      streamUrl: ALPACA_SIP_STREAM_URL,
      ok: false,
      detail: "Alpaca credentials missing — cannot probe SIP",
      probedAt,
    };
    cachedAt = Date.now();
    return { ...cachedProbe, realtimeSignalsAllowed: false };
  }

  cachedProbe = await probeSipEntitlement({
    baseUrl: creds.dataBaseUrl,
    apiKeyId: creds.apiKeyId,
    apiSecretKey: creds.apiSecretKey,
    feed: configuredFeed,
  });
  cachedAt = Date.now();
  return {
    ...cachedProbe,
    realtimeSignalsAllowed: cachedProbe.ok && configuredFeed === "sip",
  };
}
