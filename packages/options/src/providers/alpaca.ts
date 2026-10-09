import type {
  OptionContract,
  OptionRight,
  OptionsChainProvider,
  OptionsChainQuery,
} from "../types.js";

export interface AlpacaOptionsConfig {
  apiKeyId: string;
  apiSecretKey: string;
  baseUrl?: string;
  /** indicative works on basic; opra requires paid entitlement */
  feed?: "indicative" | "opra";
  fetchImpl?: typeof fetch;
}

export class OptionsEntitlementError extends Error {
  readonly status: number;
  constructor(status: number, detail: string) {
    super(`Options data entitlement issue (HTTP ${status}): ${detail}`);
    this.name = "OptionsEntitlementError";
    this.status = status;
  }
}

/**
 * Licensed Alpaca options chain adapter (official API — no scraping).
 * Uses /v1beta1/options/snapshots/{underlying}.
 * Never places orders.
 */
export class AlpacaOptionsChainProvider implements OptionsChainProvider {
  readonly name = "alpaca-options";
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly feed: "indicative" | "opra";

  constructor(private readonly config: AlpacaOptionsConfig) {
    if (!config.apiKeyId || !config.apiSecretKey) {
      throw new Error("AlpacaOptionsChainProvider requires API credentials");
    }
    this.baseUrl = (config.baseUrl ?? "https://data.alpaca.markets").replace(/\/$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.feed = config.feed ?? "indicative";
  }

  async getChain(query: OptionsChainQuery): Promise<OptionContract[]> {
    const underlying = query.underlying.toUpperCase();
    const asOf = query.asOf ?? new Date();
    const minDte = query.minDte ?? 3;
    const maxDte = query.maxDte ?? 45;
    const expGte = addDays(asOf, minDte).toISOString().slice(0, 10);
    const expLte = addDays(asOf, maxDte).toISOString().slice(0, 10);
    const type = query.side === "LONG" ? "call" : "put";

    const params = new URLSearchParams({
      feed: this.feed,
      type,
      expiration_date_gte: expGte,
      expiration_date_lte: expLte,
      limit: "200",
    });

    const url = `${this.baseUrl}/v1beta1/options/snapshots/${encodeURIComponent(underlying)}?${params}`;
    const res = await this.fetchImpl(url, {
      headers: {
        "APCA-API-KEY-ID": this.config.apiKeyId,
        "APCA-API-SECRET-KEY": this.config.apiSecretKey,
        Accept: "application/json",
      },
    });

    if (res.status === 401 || res.status === 403) {
      const body = await res.text().catch(() => "");
      throw new OptionsEntitlementError(
        res.status,
        body.slice(0, 200) ||
          "Options feed not entitled. Use OPTIONS_PROVIDER=mock or upgrade Alpaca options data.",
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Alpaca options HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      snapshots?: Record<string, AlpacaOptionSnapshot>;
    };

    const out: OptionContract[] = [];
    for (const [occ, snap] of Object.entries(data.snapshots ?? {})) {
      const parsed = parseOcc(occ, underlying);
      if (!parsed) continue;
      const dte = daysBetween(asOf, parsed.expiration);
      if (dte < minDte || dte > maxDte) continue;

      const bid = snap.latestQuote?.bp ?? 0;
      const ask = snap.latestQuote?.ap ?? 0;
      if (bid <= 0 && ask <= 0) continue;
      const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : Math.max(bid, ask);
      const spread = Math.max(0, ask - bid);
      const spreadPct = mid > 0 ? (spread / mid) * 100 : 100;
      const delta = snap.greeks?.delta ?? null;

      out.push({
        symbol: occ,
        underlying,
        right: parsed.right,
        strike: parsed.strike,
        expiration: parsed.expiration,
        dte,
        delta,
        bid,
        ask: ask > 0 ? ask : bid,
        mid,
        spread,
        spreadPct,
        volume: snap.latestTrade?.s ?? 0,
        openInterest: snap.openInterest ?? 0,
        premium: mid,
        underlyingSensitivity: delta != null ? Math.abs(delta) : null,
      });
    }
    return out;
  }
}

interface AlpacaOptionSnapshot {
  greeks?: { delta?: number; gamma?: number; theta?: number; vega?: number };
  latestQuote?: { bp?: number; ap?: number; bs?: number; as?: number };
  latestTrade?: { p?: number; s?: number; t?: string };
  openInterest?: number;
  impliedVolatility?: number;
}

/** OCC: ROOT + YYMMDD + C/P + strike*1000 padded */
function parseOcc(
  occ: string,
  underlying: string,
): { right: OptionRight; strike: number; expiration: string } | null {
  const u = underlying.toUpperCase();
  if (!occ.startsWith(u)) return null;
  const rest = occ.slice(u.length);
  const m = rest.match(/^(\d{6})([CP])(\d{8})$/);
  if (!m) return null;
  const yy = Number(m[1]!.slice(0, 2));
  const mm = m[1]!.slice(2, 4);
  const dd = m[1]!.slice(4, 6);
  const year = 2000 + yy;
  const expiration = `${year}-${mm}-${dd}`;
  const right: OptionRight = m[2] === "C" ? "CALL" : "PUT";
  const strike = Number(m[3]) / 1000;
  return { right, strike, expiration };
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function daysBetween(from: Date, expirationYmd: string): number {
  const exp = new Date(`${expirationYmd}T20:00:00Z`);
  return Math.max(0, Math.ceil((exp.getTime() - from.getTime()) / 86_400_000));
}

export function createAlpacaOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): AlpacaOptionsChainProvider {
  return new AlpacaOptionsChainProvider({
    apiKeyId: (env.ALPACA_API_KEY_ID ?? "").trim(),
    apiSecretKey: (env.ALPACA_API_SECRET_KEY ?? "").trim(),
    baseUrl: env.ALPACA_DATA_BASE_URL ?? "https://data.alpaca.markets",
    feed: (env.ALPACA_OPTIONS_FEED as "indicative" | "opra" | undefined) ?? "indicative",
  });
}
