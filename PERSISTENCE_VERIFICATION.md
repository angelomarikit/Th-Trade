# Supabase persistence verification

**Date:** 2026-10-12

## Migration status

| Object | Status |
|--------|--------|
| `signal_performance_records` | **Present** (probed via service role) |
| `user_alert_preferences` | **Present** |
| `monitor_alert_events.delivery_status` | **Present** |
| `monitor_watchlists` | **Present** (1 row) |

SQL source: `supabase/migrations/20261012_phase3_signal_history.sql` (already applied in production Supabase).

## Counts at verification start

- `signal_performance_records`: ~1465+ LIVE rows (dual-write from Railway already working)
- History survives API memory loss **because rows are in Supabase**, not only Railway RAM

## Restart test

| Step | Result |
|------|--------|
| Marker upsert `persist-check-20261012-0738` | OK (pre-redeploy count ~1553) |
| Railway redeploy tip `1bc9c43` | SUCCESS |
| Marker after redeploy | **FOUND** (Supabase row survived API restart) |
| Conclusion | Signal history is durable in Supabase; not wiped by Railway restart |

## What still resets on Railway restart

- In-memory `SignalOutcomeTracker` open trades (re-opens when ENTRY ACTIVE seen again)
- In-memory alert dedupe set (DB events remain)
- `liveValidated` never auto-flips true
