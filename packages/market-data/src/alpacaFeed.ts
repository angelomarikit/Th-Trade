export type AlpacaStockFeed = "sip" | "iex";

/** Official SIP websocket endpoint (use when streaming is added). */
export const ALPACA_SIP_STREAM_URL = "wss://stream.data.alpaca.markets/v2/sip";

/**
 * Active stock data feed. Defaults to SIP — do not silently downgrade to IEX.
 * Set ALPACA_DATA_FEED=iex only for accounts without SIP entitlement.
 */
export function resolveAlpacaFeed(env: NodeJS.ProcessEnv = process.env): AlpacaStockFeed {
  const raw = (env.ALPACA_DATA_FEED ?? "sip").trim().toLowerCase();
  if (raw === "iex") return "iex";
  return "sip";
}

export interface SipEntitlementProbe {
  configuredFeed: AlpacaStockFeed;
  streamUrl: string;
  ok: boolean;
  detail: string;
  probedAt: string;
}

/** Validates SIP REST access (quotes + bars) without logging credentials. */
export async function probeSipEntitlement(input: {
  baseUrl: string;
  apiKeyId: string;
  apiSecretKey: string;
  fetchImpl?: typeof fetch;
  feed?: AlpacaStockFeed;
}): Promise<SipEntitlementProbe> {
  const feed = input.feed ?? "sip";
  const fetchImpl = input.fetchImpl ?? fetch;
  const base = input.baseUrl.replace(/\/$/, "");
  const headers = {
    "APCA-API-KEY-ID": input.apiKeyId,
    "APCA-API-SECRET-KEY": input.apiSecretKey,
    Accept: "application/json",
  };
  const probedAt = new Date().toISOString();

  if (feed !== "sip") {
    return {
      configuredFeed: feed,
      streamUrl: ALPACA_SIP_STREAM_URL,
      ok: false,
      detail: `ALPACA_DATA_FEED=${feed} — consolidated SIP strategies require feed=sip`,
      probedAt,
    };
  }

  try {
    const quoteUrl = `${base}/v2/stocks/SPY/quotes/latest?feed=sip`;
    const quoteRes = await fetchImpl(quoteUrl, { headers });
    if (quoteRes.status === 403 || quoteRes.status === 401) {
      const body = await quoteRes.text().catch(() => "");
      return {
        configuredFeed: "sip",
        streamUrl: ALPACA_SIP_STREAM_URL,
        ok: false,
        detail: `SIP quote denied HTTP ${quoteRes.status}: ${body.slice(0, 120)}`,
        probedAt,
      };
    }
    if (!quoteRes.ok) {
      return {
        configuredFeed: "sip",
        streamUrl: ALPACA_SIP_STREAM_URL,
        ok: false,
        detail: `SIP quote HTTP ${quoteRes.status}`,
        probedAt,
      };
    }

    const barsUrl =
      `${base}/v2/stocks/SPY/bars?timeframe=1Day&limit=5&adjustment=raw&feed=sip&sort=desc`;
    const barsRes = await fetchImpl(barsUrl, { headers });
    if (!barsRes.ok) {
      return {
        configuredFeed: "sip",
        streamUrl: ALPACA_SIP_STREAM_URL,
        ok: false,
        detail: `SIP bars HTTP ${barsRes.status}`,
        probedAt,
      };
    }
    const barsJson = (await barsRes.json()) as { bars?: unknown[] };
    if (!Array.isArray(barsJson.bars) || barsJson.bars.length === 0) {
      return {
        configuredFeed: "sip",
        streamUrl: ALPACA_SIP_STREAM_URL,
        ok: false,
        detail: "SIP bars returned empty for SPY",
        probedAt,
      };
    }

    return {
      configuredFeed: "sip",
      streamUrl: ALPACA_SIP_STREAM_URL,
      ok: true,
      detail: "SIP REST quotes and daily bars OK for SPY",
      probedAt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      configuredFeed: "sip",
      streamUrl: ALPACA_SIP_STREAM_URL,
      ok: false,
      detail: message.slice(0, 200),
      probedAt,
    };
  }
}
