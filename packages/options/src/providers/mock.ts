import type {
  OptionContract,
  OptionsChainProvider,
  OptionsChainQuery,
} from "../types.js";

/**
 * Offline fixture chain for architecture/tests without options market data entitlement.
 */
export class MockOptionsChainProvider implements OptionsChainProvider {
  readonly name = "mock";

  constructor(private readonly underlyingPrice = 100) {}

  async getChain(query: OptionsChainQuery): Promise<OptionContract[]> {
    const u = query.underlying.toUpperCase();
    const asOf = query.asOf ?? new Date("2026-10-09T15:00:00Z");
    const expirations = [7, 14, 21, 35].map((dte) => {
      const exp = new Date(asOf);
      exp.setUTCDate(exp.getUTCDate() + dte);
      return { dte, expiration: exp.toISOString().slice(0, 10) };
    });

    const strikes = [
      this.underlyingPrice * 0.95,
      this.underlyingPrice * 0.98,
      this.underlyingPrice,
      this.underlyingPrice * 1.02,
      this.underlyingPrice * 1.05,
    ].map((s) => Math.round(s * 2) / 2);

    const out: OptionContract[] = [];
    for (const exp of expirations) {
      for (const strike of strikes) {
        out.push(makeContract(u, "CALL", strike, exp.expiration, exp.dte, this.underlyingPrice));
        out.push(makeContract(u, "PUT", strike, exp.expiration, exp.dte, this.underlyingPrice));
      }
    }

    const minDte = query.minDte ?? 0;
    const maxDte = query.maxDte ?? 365;
    return out.filter((c) => c.dte >= minDte && c.dte <= maxDte);
  }
}

function makeContract(
  underlying: string,
  right: "CALL" | "PUT",
  strike: number,
  expiration: string,
  dte: number,
  spot: number,
): OptionContract {
  const moneyness = right === "CALL" ? spot / strike : strike / spot;
  const approxDelta =
    right === "CALL"
      ? Math.min(0.85, Math.max(0.15, 0.5 + (spot - strike) / spot))
      : -Math.min(0.85, Math.max(0.15, 0.5 + (strike - spot) / spot));

  const intrinsic = Math.max(
    0,
    right === "CALL" ? spot - strike : strike - spot,
  );
  const mid = Math.max(0.15, intrinsic + 1.2 * Math.sqrt(dte / 365) * spot * 0.02);
  const spread = mid * (moneyness > 1.02 || moneyness < 0.98 ? 0.08 : 0.04);
  const bid = Math.max(0.05, mid - spread / 2);
  const ask = bid + spread;
  const volume = Math.floor(200 * moneyness);
  const openInterest = Math.floor(800 * moneyness);

  return {
    symbol: `${underlying}${expiration.replace(/-/g, "")}${right[0]}${strike}`,
    underlying,
    right,
    strike,
    expiration,
    dte,
    delta: approxDelta,
    bid,
    ask,
    mid: (bid + ask) / 2,
    spread: ask - bid,
    spreadPct: ((ask - bid) / ((ask + bid) / 2)) * 100,
    volume,
    openInterest,
    premium: (bid + ask) / 2,
    underlyingSensitivity: Math.abs(approxDelta),
  };
}
