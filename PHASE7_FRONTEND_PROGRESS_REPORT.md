# Phase 7 Frontend Redesign — Status Report for WULU

**Date:** 2026-10-13 (UTC+8)  
**Prepared for:** WULU / Angelo  
**Branch:** `phase7/frontend-redesign` → **MERGED** to `main` (`0d62323`)  
**PR:** https://github.com/angelomarikit/Th-Trade/pull/1 (**MERGED** 2026-10-13)  
**Safety:** `automaticOrders=false` · min ~2R unchanged · no fabricated win rates  

---

## Executive summary

Phase 7 Waves 1–2 (Scanner redesign + design-system polish) are **merged to production `main`** (merge commit `0d62323`).

An earlier Vercel Preview build looked broken on iPhone (SESSION UNKNOWN, FEED DOWN, “string did not match the expected pattern,” dead chart). That was a **shared Preview API-connection bug**, not separate page failures. It is fixed and included in this merge.

---

## Live URLs

| Surface | URL |
|---------|-----|
| **Production (after merge deploy)** | https://web-tawny-iota-56.vercel.app |
| Preview branch (historical) | https://web-git-phase7-frontend-redesign-supporttoptiersoluts-projects.vercel.app |
| API (Railway) | https://th-trade-production.up.railway.app |
| Pull request | https://github.com/angelomarikit/Th-Trade/pull/1 |

Allow a few minutes after merge for Vercel Production to finish deploying `main`.

---

## Root cause of the Preview outage (fixed)

1. **Empty `VITE_API_BASE` on Vercel Preview** — Vite bakes env at build time. Without it, `/v1/*` and `/health` hit the SPA HTML. Safari threw “The string did not match the expected pattern,” and every page lost market data.
2. **Railway CORS** only allowed the production frontend origin, so Preview fetches were blocked until Preview team hosts were allowlisted.

### Fixes included

| Fix | Detail |
|-----|--------|
| Bake API base | `apps/web/.env.production` + fallback in `apiBase.ts` → `https://th-trade-production.up.railway.app` |
| Harden API client | Reject HTML-as-JSON; `friendlyApiError()` (no raw browser/pattern errors to customers) |
| CORS | Allow `*-supporttoptiersoluts-projects.vercel.app` on Railway API |
| Mobile layout | Page width clipped; chart keeps touch pan/zoom (`touch-action: none` on chart host) |
| TopBar | Show **UPDATING…** while setup loads instead of false **SESSION UNKNOWN** |

---

## What shipped (Waves 1–2)

### Wave 1 — Scanner / chart-first UX

- Global symbol search (ticker + company name) via `GET /v1/symbols/search`
- Chart-first Scanner layout (desktop + mobile)
- Stable ticker switching (abort/seq; clear stale levels)
- Opportunities deep-link to correct Scanner symbol
- Shared UI primitives + nav IA (Scanner, Opportunities, Watchlist, Alerts, Performance, Plans)

### Wave 2 — design-system consistency

- Watchlist, Alerts, Plans (Billing), Performance / Signals chrome aligned

### Commits merged (vs previous `main`)

| Commit | Summary |
|--------|---------|
| `8f5fed6` | Wave 1 Scanner redesign |
| `abfca3d` | Design system, nav IA, Opportunities → Scanner |
| `3803b37` | Preview instructions |
| `3b433bc` | Wave 2 page polish |
| `18ecb11` | Bake `VITE_API_BASE` + harden API client |
| `b6b2a08` | Vercel Preview CORS on Railway |
| `6148dea` | Avoid SESSION UNKNOWN flash while loading |

---

## Verification performed (engineering)

| Check | Result |
|-------|--------|
| Preview bundle points at Railway API | Pass |
| `/health` — feed OK, `alpacaCredentialsPresent: true` | Pass |
| Settings market-data readout | Pass |
| Mobile @ 390px — no horizontal page overflow | Pass |
| Ticker sequence **NVDA → TSLA → MU → AMD → NVDA** (repeated) | Pass — price, RVOL, session, candles/VWAP/levels, FEED OK |
| Raw Safari pattern error shown to UI | Fixed (friendly copy only) |

**Note:** “DATA NOT VERIFIED / STALE” in premarket or on IEX is existing fail-closed signal logic, not a dead feed.

---

## Still open (not blocking this merge)

| Item | Status |
|------|--------|
| Wave 3 visual polish (mobile density, billing visuals, alert clarity) | Paused / next |
| Dual watchlist (localStorage vs server monitor) cleanup | Open |
| Push / SMS / email alert delivery | Not wired |
| Stripe Checkout / full billing | Not wired |
| Phase 5 RTH soak / liveValidated sample volume | Parallel trust path |

---

## Safety reminders for WULU

- Automatic trading remains **disabled**.
- Confirmation / ENTRY ACTIVE rules (including min ~2R) were **not** changed for this redesign.
- Do not treat setup scores or measured performance as marketed win rates.
- Production frontend and Preview share the live Railway API; only the UI deploy changes with this merge.

---

## Recommended smoke test after production deploy

1. Open production URL on iPhone Safari + desktop.  
2. Sign in → Scanner.  
3. Run **NVDA → TSLA → MU → AMD → NVDA**.  
4. Confirm: correct ticker, price, RVOL, chart (drag/zoom), FEED OK, no raw browser errors.  
5. Settings → Backend capability → Alpaca credentials present **true**.  
6. Watchlist → **Load default six** if empty, then refresh.

---

## Decision log

| Decision | When |
|----------|------|
| Hold merge until Preview connection fixed | 2026-10-13 morning (Angelo feedback) |
| Connection fixed + engineering retest | 2026-10-13 evening |
| **Merge to `main` authorized** | 2026-10-13 (explicit go-ahead) |
