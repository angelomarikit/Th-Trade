import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { JournalEntry, JournalQuery, JournalStore, SignalOutcome } from "./types.js";

/**
 * SQLite-backed journal using Node's built-in node:sqlite (no native addon).
 */
export class SqliteJournalStore implements JournalStore {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS signal_journal (
        id TEXT PRIMARY KEY,
        decision_at TEXT NOT NULL,
        recorded_at TEXT NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        state TEXT NOT NULL,
        strategy_id TEXT,
        json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_journal_symbol ON signal_journal(symbol);
      CREATE INDEX IF NOT EXISTS idx_journal_state ON signal_journal(state);
      CREATE INDEX IF NOT EXISTS idx_journal_decision ON signal_journal(decision_at);
    `);
  }

  insert(entry: JournalEntry): void {
    this.db
      .prepare(
        `INSERT INTO signal_journal (id, decision_at, recorded_at, symbol, side, state, strategy_id, json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.decisionAt,
        entry.recordedAt,
        entry.symbol,
        entry.side,
        entry.state,
        entry.strategyId,
        JSON.stringify(entry),
      );
  }

  getById(id: string): JournalEntry | null {
    const row = this.db
      .prepare(`SELECT json FROM signal_journal WHERE id = ?`)
      .get(id) as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as JournalEntry) : null;
  }

  updateOutcome(id: string, outcome: SignalOutcome): boolean {
    const existing = this.getById(id);
    if (!existing) return false;
    const updated: JournalEntry = { ...existing, outcome };
    this.db
      .prepare(`UPDATE signal_journal SET json = ? WHERE id = ?`)
      .run(JSON.stringify(updated), id);
    return true;
  }

  list(query: JournalQuery = {}): JournalEntry[] {
    const { sql, params } = buildFilter(query);
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const rows = this.db
      .prepare(
        `SELECT json FROM signal_journal WHERE ${sql} ORDER BY decision_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as Array<{ json: string }>;
    return rows.map((r) => JSON.parse(r.json) as JournalEntry);
  }

  count(query: JournalQuery = {}): number {
    const { sql, params } = buildFilter(query);
    const row = this.db
      .prepare(`SELECT COUNT(*) AS c FROM signal_journal WHERE ${sql}`)
      .get(...params) as { c: number };
    return row.c;
  }

  close(): void {
    this.db.close();
  }
}

type SqlParam = string | number | null;

function buildFilter(query: JournalQuery): { sql: string; params: SqlParam[] } {
  const clauses = ["1=1"];
  const params: SqlParam[] = [];
  if (query.symbol) {
    clauses.push("symbol = ?");
    params.push(query.symbol.toUpperCase());
  }
  if (query.state) {
    clauses.push("state = ?");
    params.push(query.state);
  }
  if (query.strategyId) {
    clauses.push("strategy_id = ?");
    params.push(query.strategyId);
  }
  if (query.from) {
    clauses.push("decision_at >= ?");
    params.push(query.from);
  }
  if (query.to) {
    clauses.push("decision_at <= ?");
    params.push(query.to);
  }
  return { sql: clauses.join(" AND "), params };
}

export class MemoryJournalStore implements JournalStore {
  private readonly rows = new Map<string, JournalEntry>();

  insert(entry: JournalEntry): void {
    this.rows.set(entry.id, entry);
  }

  getById(id: string): JournalEntry | null {
    return this.rows.get(id) ?? null;
  }

  updateOutcome(id: string, outcome: SignalOutcome): boolean {
    const existing = this.rows.get(id);
    if (!existing) return false;
    this.rows.set(id, { ...existing, outcome });
    return true;
  }

  list(query: JournalQuery = {}): JournalEntry[] {
    let items = [...this.rows.values()];
    if (query.symbol) items = items.filter((e) => e.symbol === query.symbol!.toUpperCase());
    if (query.state) items = items.filter((e) => e.state === query.state);
    if (query.strategyId) items = items.filter((e) => e.strategyId === query.strategyId);
    if (query.from) items = items.filter((e) => e.decisionAt >= query.from!);
    if (query.to) items = items.filter((e) => e.decisionAt <= query.to!);
    items.sort((a, b) => b.decisionAt.localeCompare(a.decisionAt));
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    return items.slice(offset, offset + limit);
  }

  count(query: JournalQuery = {}): number {
    return this.list({ ...query, limit: 1_000_000, offset: 0 }).length;
  }

  close(): void {
    this.rows.clear();
  }
}
