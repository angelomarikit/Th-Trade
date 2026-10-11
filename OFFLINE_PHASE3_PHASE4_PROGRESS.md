# Offline Phase 3 finish + Phase 4 start

**Date:** 2026-10-12  
**Intent:** Continue building without waiting for US market open. RTH signal verification remains a separate gate.

## Safety (unchanged)

- Automatic brokerage orders: **disabled**
- `liveValidated` on performance records: **always false** until RTH operator confirmation
- Replay labeled **HISTORICAL REPLAY — NOT LIVE**
- No published win-rate claims

## Done in this pass

1. **Supabase migration** `supabase/migrations/20261012_phase3_signal_history.sql`
   - `signal_performance_records`
   - `user_alert_preferences`
   - delivery columns on `monitor_alert_events`
2. **Hybrid signal history store** (memory + Supabase dual-write)
3. **Alert preferences API** `GET/PUT /v1/alert-preferences`
4. **Delivery planning** on alert record (in_app / browser_pending only — no SMS/email senders)
5. **UI**
   - Alerts page → server events + browser notification opt-in
   - Signals page → performance summary, history table, historical replay runner
   - Watchlist / Settings copy updated for Phase 3 + history links

## Operator action required

Apply the migration in Supabase SQL editor (production):

`supabase/migrations/20261012_phase3_signal_history.sql`

Until applied, history still works in-memory on the API process (lost on Railway restart).

## Still pending (needs RTH)

- Live breakout / fake-breakout / ENTRY ACTIVE confirmation during market hours
- Marking any signal `liveValidated = true`
- Measuring real accuracy

## Next (can stay offline)

- Email/SMS/push providers (cost review before purchase)
- Outcome tracking (stop/target hit after entry)
- Richer mobile notification UX
