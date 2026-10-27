import { describe, expect, it } from "vitest";
import { ALPACA_SIP_STREAM_URL, resolveAlpacaFeed } from "../src/alpacaFeed.js";

describe("resolveAlpacaFeed", () => {
  it("defaults to sip when env unset", () => {
    expect(resolveAlpacaFeed({})).toBe("sip");
  });

  it("honors explicit iex", () => {
    expect(resolveAlpacaFeed({ ALPACA_DATA_FEED: "iex" })).toBe("iex");
  });

  it("exports SIP stream URL", () => {
    expect(ALPACA_SIP_STREAM_URL).toContain("/v2/sip");
  });
});
