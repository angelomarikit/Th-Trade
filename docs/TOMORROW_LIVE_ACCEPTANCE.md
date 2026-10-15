# Tomorrow — first live acceptance test (preview only)

**Production / PR #2:** unchanged  
**Paper trading:** You execute manually (Thinkorswim/paper). WULU sends **signals only** — no orders.

## Before 9:30 AM ET

1. Open **Watchlist** (not Railway API URL):  
   https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/watchlist  
2. Sign in → **Load default six** → confirm **Scan now** / auto refresh (~20s).  
3. Run locally (optional): `node scripts/verify-preview-links.mjs`  
4. Hard refresh if UI looks old (need latest Vercel build on `phase7/scanner-v2-preview`).

## During RTH — what each card must show

| Field | Where |
|-------|--------|
| Symbol + LONG/SHORT | Watchlist card header |
| WAIT / ENTER / SKIP / INVALIDATED | Action badge |
| Lifecycle status | Status chip (WAIT, ENTRY ACTIVE, MISSED, etc.) |
| Price + verified/not | Price line |
| Trigger, entry, stop, T1–T3 | Level grid (shown even when not verified; stale border if not verified) |
| R:R + setup score | Level grid |
| Waiting for | Dedicated line |
| Indicators (6) | Compact grid on card |
| Data timestamp + feed | Price line |

**Scanner** (single symbol): same recommendation panel + chart; use for deep check on MU/TSLA.

## Your 8 checks

| # | Expectation | Trust if… |
|---|-------------|-----------|
| 1 | WAIT → ENTER only after real confirmation | Action stays WAIT until ENTRY ACTIVE + executable + fresh data |
| 2 | Chart ↔ numbers sync | No executable levels while “Updating setup…” banner |
| 3 | Broken setup → INVALIDATED | Stop/structure failure → INVALIDATED action |
| 4 | Missed → SKIP, no chase | MISSED status + SKIP action |
| 5 | Target/stop lifecycle | TARGET HIT / STOP HIT after ENTRY ACTIVE + completed 5m bar |
| 6 | Recent changes | Watchlist table at bottom |
| 7 | Six symbols update | All six cards refresh without scan errors |
| 8 | Mobile = desktop | Same Vercel URL; panel stacks above chart on narrow width |

## When **not** to paper trade off a signal

- **Action = WAIT** or **DATA NOT VERIFIED**  
- **ENTER** but chart/setup stale banner visible  
- **Reward : risk &lt; ~2R** to T1 (matrix should block ENTRY ACTIVE, but verify)  
- You have not seen **Recent changes** fire at least once in the session (optional sanity check)

## After the session

Note any symbol where action, status, price, or levels disagreed — screenshot + time (ET).
