import type { JournalEntry } from "./types.js";

export interface CalibrationExportRow {
  evaluationId: string;
  journalEntryId: string;
  decisionAt: string;
  recordedAt: string;
  symbol: string;
  side: string;
  state: string;
  statusLabel: string;
  tradingAction: string;
  strategyName: string | null;
  strategyPhase: string | null;
  statusReason: string | null;
  retestPhase: string | null;
  retestReason: string | null;
  htf1h: string | null;
  htf15m: string | null;
  conditionsPassed: number;
  conditionsTotal: number;
  blockingGates: string;
  lastPrice: number;
  alertAt: number;
  stop: number;
  target1: number;
  rewardToRisk: number;
  qualityScore10: number | null;
  session: string | null;
  labMode: boolean;
  mockRth: boolean;
  setupScore: number;
  dataFresh: boolean;
}

export function calibrationRowFromEntry(entry: JournalEntry): CalibrationExportRow {
  const cal = entry.calibration;
  const blocking =
    cal?.matrixSummary.blocking.map((b) => `${b.label}: ${b.reason}`).join(" | ") ??
    entry.features.matrix
      ? Object.entries(entry.features.matrix)
          .filter(([, st]) => st === "FAIL" || st === "WAITING")
          .map(([id, st]) => `${id}:${st}`)
          .join(" | ")
      : "";

  return {
    evaluationId: cal?.evaluationId ?? `${entry.symbol}:${entry.decisionAt}`,
    journalEntryId: entry.id,
    decisionAt: entry.decisionAt,
    recordedAt: entry.recordedAt,
    symbol: entry.symbol,
    side: entry.side,
    state: entry.state,
    statusLabel: entry.statusLabel,
    tradingAction: cal?.tradingAction ?? "",
    strategyName: cal?.activeTechnique?.strategyName ?? entry.strategyName,
    strategyPhase: cal?.activeTechnique?.phase ?? null,
    statusReason: cal?.activeTechnique?.statusReason ?? null,
    retestPhase: cal?.retest?.phase ?? null,
    retestReason: cal?.retest?.reason ?? null,
    htf1h: cal?.matrixSummary.htf1h ?? null,
    htf15m: cal?.matrixSummary.htf15m ?? null,
    conditionsPassed: entry.conditionsPassed,
    conditionsTotal: entry.conditionsTotal,
    blockingGates: blocking,
    lastPrice: cal?.levels.lastPrice ?? entry.features.lastPrice,
    alertAt: cal?.levels.alertAt ?? entry.features.alertAt,
    stop: cal?.levels.stop ?? entry.stop,
    target1: cal?.levels.target1 ?? entry.target1,
    rewardToRisk: cal?.levels.rewardToRisk ?? entry.features.rewardToRisk,
    qualityScore10: cal?.qualityScore10 ?? null,
    session: cal?.session ?? null,
    labMode: cal?.labMode ?? false,
    mockRth: cal?.mockRth ?? false,
    setupScore: entry.setupScore,
    dataFresh: entry.features.dataFresh,
  };
}

export function calibrationRowsFromEntries(entries: JournalEntry[]): CalibrationExportRow[] {
  return entries.map(calibrationRowFromEntry);
}

export function calibrationToCsv(rows: CalibrationExportRow[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!) as (keyof CalibrationExportRow)[];
  const escape = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

export function calibrationToJson(rows: CalibrationExportRow[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: rows.length,
      note: "WULU evaluation calibration export — signals only, not broker fills.",
      rows,
    },
    null,
    2,
  );
}
