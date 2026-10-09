import path from "node:path";
import { SignalJournal } from "./SignalJournal.js";
import { MemoryJournalStore, SqliteJournalStore } from "./sqliteStore.js";

export function createJournalFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): SignalJournal {
  const mode = (env.JOURNAL_STORE ?? "sqlite").toLowerCase();
  if (mode === "memory") {
    return new SignalJournal(new MemoryJournalStore());
  }
  const dbPath =
    env.JOURNAL_DB_PATH ??
    path.join(cwd, "data", "journal", "signals.sqlite");
  return new SignalJournal(new SqliteJournalStore(dbPath));
}
