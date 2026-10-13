# SOP — Marking outcomes `liveValidated`

Use this before any public or launch win-rate claim.

## Rules

1. Only **LIVE** records (never HISTORICAL_REPLAY).
2. Outcome must already be **resolved** (WIN / LOSS / HIT_T* / STOPPED / TIME_STOP) with an `outcome_r` when applicable.
3. Operator watched the setup during **regular market hours** (or can prove RTH fills/levels from the stored card).
4. Confirmation gates were not bypassed (min 2R, fail-closed data quality).
5. Auto-trading remains **disabled** — validation is about signal quality, not broker fills.

## How

```http
POST /v1/signals/{id}/live-validate
Authorization: Bearer <supabase_access_token>
{ "note": "RTH 2026-10-14 watched ENTRY→T1 on NVDA LONG" }
```

Optional allowlist: set Railway `LIVE_VALIDATE_EMAILS=you@company.com`.

## Reporting

- Unvalidated LIVE → soak / ops only  
- REPLAY → research only  
- **`source=LIVE_VALIDATED`** → only bucket for launch marketing claims (still needs sample floors)
