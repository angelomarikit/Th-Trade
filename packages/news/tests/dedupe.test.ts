import { describe, expect, it } from "vitest";
import { buildCatalystEvents } from "../src/buildCatalystEvent.js";
import { clusterNewsItems } from "../src/dedupe/cluster.js";
import { defaultMockItems } from "../src/providers/mock.js";

describe("news deduplication", () => {
  it("clusters many duplicate NVDA headlines into one event", () => {
    const items = defaultMockItems();
    const nvda = items.filter((i) => i.tickers.includes("NVDA"));
    expect(nvda.length).toBeGreaterThanOrEqual(4);

    const clusters = clusterNewsItems(nvda);
    expect(clusters.length).toBe(1);
    expect(clusters[0]!.length).toBe(nvda.length);

    const events = buildCatalystEvents(nvda);
    expect(events).toHaveLength(1);
    expect(events[0]!.memberCount).toBe(nvda.length);

    const importanceReasons = events[0]!.scores.catalystImportance.reasons.join(" ");
    expect(importanceReasons).toMatch(/ignored for importance|deduped/i);
  });

  it("does not multiply importance by repetition count", () => {
    const items = defaultMockItems().filter((i) => i.tickers.includes("NVDA"));
    const one = buildCatalystEvents([items[0]!])[0]!;
    const many = buildCatalystEvents(items)[0]!;
    expect(many.scores.catalystImportance.score).toBe(one.scores.catalystImportance.score);
  });
});
