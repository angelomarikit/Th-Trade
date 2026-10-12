# Phase 4 — Supabase migration verification

**Checked:** 2026-10-13 (UTC+8)

| Table | Result |
|-------|--------|
| `public.open_signal_tracks` | Present (count 0 — no open live tracks yet) |
| `public.monitor_alert_dedupe` | Present (keys seeded) |
| `public.signal_performance_records` | Present (~10k+ rows; live write gate active) |

Open tracks continue to dual-write into performance-row mirrors (`track:*`) and the dedicated table when available.
