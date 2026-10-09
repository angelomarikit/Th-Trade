import { describe, expect, it } from "vitest";
import { buildConditionMatrix, type ConditionRow } from "@wulu/domain";
import { decideSetupState, isNearActive } from "../src/stateMachine.js";

function row(
  id: ConditionRow["id"],
  status: ConditionRow["status"],
  requiredForEntry = true,
): ConditionRow {
  return {
    id,
    label: id,
    status,
    reason: status,
    requiredForEntry,
  };
}

describe("setup state machine", () => {
  it("returns DATA_NOT_VERIFIED when freshness fails", () => {
    const matrix = buildConditionMatrix([
      row("DATA_FRESHNESS", "FAIL"),
      row("LIQUIDITY", "PASS"),
      row("RELATIVE_VOLUME", "PASS"),
      row("VWAP", "PASS"),
      row("STRUCTURE", "PASS"),
      row("FIVE_MIN_CONFIRMATION", "PASS"),
      row("RISK_REWARD", "PASS"),
    ]);
    expect(
      decideSetupState({ side: "LONG", matrix, zoneExecutable: true }),
    ).toBe("DATA_NOT_VERIFIED");
  });

  it("returns NEAR_ACTIVE when most required pass but 5m still waiting", () => {
    const matrix = buildConditionMatrix([
      row("DATA_FRESHNESS", "PASS"),
      row("LIQUIDITY", "PASS"),
      row("RELATIVE_VOLUME", "PASS"),
      row("VWAP", "PASS"),
      row("STRUCTURE", "PASS"),
      row("FIVE_MIN_CONFIRMATION", "WAITING"),
      row("RISK_REWARD", "PASS"),
      row("NEWS_CATALYST", "PASS", false),
      row("MARKET_REGIME", "WAITING", false),
      row("SECTOR_ALIGNMENT", "WAITING", false),
    ]);
    expect(isNearActive(matrix)).toBe(true);
    expect(
      decideSetupState({ side: "LONG", matrix, zoneExecutable: true }),
    ).toBe("NEAR_ACTIVE");
  });

  it("never grants ENTRY ACTIVE without zone executable", () => {
    const matrix = buildConditionMatrix([
      row("DATA_FRESHNESS", "PASS"),
      row("LIQUIDITY", "PASS"),
      row("RELATIVE_VOLUME", "PASS"),
      row("VWAP", "PASS"),
      row("STRUCTURE", "PASS"),
      row("FIVE_MIN_CONFIRMATION", "PASS"),
      row("RISK_REWARD", "PASS"),
    ]);
    expect(
      decideSetupState({ side: "LONG", matrix, zoneExecutable: false }),
    ).toBe("MISSED");
  });

  it("grants ENTRY_ACTIVE_LONG only when all required pass and zone ok", () => {
    const matrix = buildConditionMatrix([
      row("DATA_FRESHNESS", "PASS"),
      row("LIQUIDITY", "PASS"),
      row("RELATIVE_VOLUME", "PASS"),
      row("VWAP", "PASS"),
      row("STRUCTURE", "PASS"),
      row("FIVE_MIN_CONFIRMATION", "PASS"),
      row("RISK_REWARD", "PASS"),
    ]);
    expect(
      decideSetupState({ side: "LONG", matrix, zoneExecutable: true }),
    ).toBe("ENTRY_ACTIVE_LONG");
  });

  it("returns INVALIDATED when structureInvalidated is set", () => {
    const matrix = buildConditionMatrix([
      row("DATA_FRESHNESS", "PASS"),
      row("LIQUIDITY", "PASS"),
      row("RELATIVE_VOLUME", "PASS"),
      row("VWAP", "PASS"),
      row("STRUCTURE", "FAIL"),
      row("FIVE_MIN_CONFIRMATION", "WAITING"),
      row("RISK_REWARD", "PASS"),
    ]);
    expect(
      decideSetupState({
        side: "LONG",
        matrix,
        zoneExecutable: true,
        previousState: "NEAR_ACTIVE",
        structureInvalidated: true,
      }),
    ).toBe("INVALIDATED");
  });
});
