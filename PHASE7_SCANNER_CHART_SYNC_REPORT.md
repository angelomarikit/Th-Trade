# WULU Update Report — Scanner Chart / Price Sync

**Date:** 2026-10-13 (UTC+8)  
**Prepared for:** WULU / Angelo  
**Branch:** `phase7/scanner-v2-preview`  
**PR:** https://github.com/angelomarikit/Th-Trade/pull/2 (**OPEN — do not merge until approved**)  
**Safety:** `automaticOrders=false` · min ~2R unchanged · liveValidated unchanged  

---

## Executive summary

After the Phase 7 redesign merge to production, Angelo reported that **MU’s header price (~943–946) did not match the chart (~1028)**.

Engineering confirmed this was **not** a wrong-ticker API bug. It was mainly a **frontend refresh mismatch**: the header used live setup quotes, while the chart candles stayed on the first load until you changed ticker or timeframe.

A fix is live on a **preview branch only**. Production remains on the previously merged redesign until you approve this preview.

---

## Live URLs

| Surface | URL | Notes |
|---------|-----|--------|
| **This preview (test here)** | https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app | Chart sync fix |
| Preview tip deploy | https://web-q42xliea8-supporttoptiersoluts-projects.vercel.app | Same build (`75cebdd`) |
| Production (unchanged by this PR) | https://web-tawny-iota-56.vercel.app | Last merged redesign |
| API | https://th-trade-production.up.railway.app | Shared Railway backend |
| Pull request | https://github.com/angelomarikit/Th-Trade/pull/2 | Do not merge yet |

---

## Root cause (MU header vs chart)

| Source | Endpoint / path | Refresh behavior (before fix) |
|--------|-----------------|--------------------------------|
| Header / setup / levels | `GET /v1/setup` → `liveCard.lastPrice` (Alpaca quote mid or trade) | Updated every ~20s poll |
| Chart candles | `GET /v1/bars` → last candle `close` | Only when **symbol** or **timeframe** changed |

So the header could show a fresh quote (~943) while the chart still showed an older bar close (~1028).

Secondary issue: every poll cleared setup data (`setData(null)`), so the UI could briefly fall back to **unguarded** bar closes (including a previous symbol’s bars during a switch).

### Feed note (separate from the bug)

Railway market data defaults to Alpaca **IEX** (`ALPACA_DATA_FEED=iex`). Even after the sync fix, prices can still differ slightly from Thinkorswim / SIP-consolidated charts. That is feed entitlement, not a wrong-symbol bug. SIP upgrade is optional and separate.

---

## What we changed (preview only)

| Change | Detail |
|--------|--------|
| Bars co-refresh | After every successful setup fetch, reload `/v1/bars` for the current symbol/timeframe |
| Soft poll refresh | Same-symbol polls keep existing candles until new bars arrive (less flicker) |
| Symbol hygiene | Clear setup + bars only when the **ticker** changes |
| Shared `displayPrice` | Header uses setup `lastPrice` when present; bar close only if `bars.symbol` matches |
| Day % | Header % uses `relativeMomentum.symbolIntradayPct` (session), not chart-window math |
| Chart last candle | Patches last candle high/low/close to the same `lastPrice` so chart matches header |
| Feed badge | Scanner instrument bar shows session + feed (e.g. IEX) |

**Commit:** `75cebdd` — `fix: keep Scanner chart candles in sync with setup quotes`

**Files:**

- `apps/web/src/context/TerminalContext.tsx`
- `apps/web/src/pages/ScannerPage.tsx`
- `apps/web/src/components/scanner/CandleChart.tsx`

---

## What is NOT in this preview yet

Per Angelo’s briefing, full visual redesign of Opportunities / Watchlist / Alerts / Performance / Plans waits until **Scanner layout** is approved. Still pending on this branch:

- Desktop 3-column Scanner polish (watchlist left · large chart center · signal/levels right)
- Mobile stacking / clip fixes beyond current overflow rules
- Larger timeframe buttons, clearer level labels, fullscreen chart
- Customer-friendly watchlist-limit copy (replace raw backend JSON)
- Stronger WULU branding pass across the shell

---

## How to test (please use preview, not production)

1. Open the **preview** URL on iPhone Safari and desktop.  
2. Sign in → **Scanner**.  
3. Load **MU** — confirm header last price and chart last candle/close agree.  
4. Run **NVDA → TSLA → MU → AMD → NVDA** twice.  
5. Confirm: correct ticker, price, RVOL, session, candles, levels, no stale prior-symbol chart.  
6. Leave PR #2 **unmerged** until you approve.

---

## Decision log

| Decision | When |
|----------|------|
| Phase 7 Waves 1–2 merged to `main` | 2026-10-13 (PR #1) |
| Angelo: MU price mismatch + redesign still too “dashboard” | 2026-10-13 evening |
| Investigate price sync first; Scanner redesign on **new preview** only | Agreed |
| Chart/quote sync shipped on `phase7/scanner-v2-preview` | 2026-10-13 (`75cebdd`) |
| **Merge to production** | Waiting on WULU / Angelo approval |

---

## Safety reminders

- Automatic trading remains **disabled**.
- Confirmation rules and minimum ~2R were **not** changed.
- Do not treat setup scores as marketed win rates.
- This preview shares the live Railway API; only the **frontend** deploy differs from production.
