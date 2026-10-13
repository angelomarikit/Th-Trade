import { describe, expect, it } from "vitest";
import { searchSymbols } from "../src/symbolDirectory.js";

describe("searchSymbols", () => {
  it("matches ticker prefix", () => {
    const hits = searchSymbols("NV");
    expect(hits.some((h) => h.symbol === "NVDA")).toBe(true);
    expect(hits[0]?.match).toBe("ticker");
  });

  it("matches company name", () => {
    const hits = searchSymbols("nvidia");
    expect(hits.some((h) => h.symbol === "NVDA" && h.match === "name")).toBe(true);
  });

  it("returns empty for blank", () => {
    expect(searchSymbols("")).toEqual([]);
  });
});
