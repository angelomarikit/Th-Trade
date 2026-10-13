# SOP — Verified signal outcomes (`liveValidated`)

Use this before any public or launch performance claim.

**Language:** These are **verified signal outcomes** (scanner levels vs market data).  
They are **not** customer trading profits, fills, or broker P/L. WULU does not execute orders.

## Rules

1. Only **LIVE** records (never HISTORICAL_REPLAY).
2. Stored evidence must include **entry zone, stop, targets, timestamps, and outcome**.
3. Backend re-loads market bars and **recomputes** the path (stop/T1/T2). Recorded outcome must match.
4. Geometry must satisfy entry requirements (actionable / ENTRY ACTIVE, data quality OK, ~**2R** to T1).
5. Incomplete evidence → **left unvalidated** (HTTP 422) + audit `VALIDATE_REJECT`.
6. Optional operator `note` is commentary only — **never sufficient alone**.
7. Every attempt writes **who / when / evidence / errors** to `signal_validation_audit` (append-only).

## How

```http
POST /v1/signals/{id}/live-validate
Authorization: Bearer <supabase_access_token>
{ "note": "optional operator comment" }

GET /v1/signals/{id}/validation-audit
Authorization: Bearer <supabase_access_token>
```

Apply migration: `supabase/migrations/20261013_phase7_validation_audit.sql`  
Optional allowlist: Railway `LIVE_VALIDATE_EMAILS=you@company.com`.

## Reporting

| Bucket | Use |
|--------|-----|
| Unvalidated LIVE | Internal soak only |
| REPLAY | Research / backtest only |
| **LIVE_VALIDATED** | Launch “verified signal outcomes” (still needs sample floors) |

Never describe rates as “user profits” or “account returns.”
