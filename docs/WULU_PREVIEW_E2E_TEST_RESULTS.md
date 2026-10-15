# Preview E2E test results (Angelo — pre-Wulu RTH retest)

**Date (UTC):** 2026-10-15T22:58Z  
**Production / PR #2:** unchanged  
**Paper trading:** not approved  

---

## 1. Deploy verification

| Layer | URL | Status |
|-------|-----|--------|
| **API (preview)** | https://th-trade-preview.up.railway.app | Deployed; `/health` `ok: true` |
| **Web (preview)** | https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app | Auto-build from branch `phase7/scanner-v2-preview` (latest commit **48f8b59**) |

**Backend flags (preview Railway env):**

- `WULU_PREVIEW_DEV_WATCHLIST=1` → **`previewDevWatchlist: true`**
- `WULU_PREVIEW_WATCHLIST_MAX=12` → **`effectiveWatchlistMax: 12`**
- `WULU_ACCEPTANCE_MIN_WATCHLIST=6` → default six not blocked by Free-tier cap on preview
- Production billing caps **unchanged** (these vars are preview-only)

**Git:** Railway health may show `gitCommit: null`; code verified via deploy upload + GitHub **48f8b59**.

---

## 2. API workflow probes (after hours)

Script: `node scripts/run-preview-e2e-probes.mjs`

**Stock-specific (not identical copy):**

| Symbol | Price | Trigger | Stop | T1 | Primary “still need” (different per name) |
|--------|-------|---------|------|-----|-------------------------------------------|
| TSLA | 360.77 | 363.67 | 361.87 | 365.39 | Spread 10.10% |
| MU | 926.02 | 913.23 | 902.53 | 939.12 | Spread 9.38% |
| NVDA | 217.33 | 218.43 | 216.59 | 219.84 | Regime LOW_VOL caution |
| SPY | 772.12 | 772.65 | 770.75 | 775.58 | Regime + R:R (in matrix) |
| AAPL | 341.91 | 342.99 | 341.28 | 344.62 | Regime caution |

Each response includes **`watchingSummary`** with symbol + strategy + trigger (e.g. “Watching MU VWAP Reclaim at trigger 913.23…”).

**Session note:** Probes ran **AFTERHOURS** → `dataFresh: false`, indicators show **NOT VERIFIED** (fail-closed). **During RTH** you should see verified data and directional indicator bias when quotes are fresh.

**Invalid input:**

- `!!!` → **400** JSON error (no API crash)
- Unknown symbol `ZZZZ` → **502** JSON with clear message (not silent failure)

---

## 3. UI / authenticated workflow

Preview web **requires sign-in** for Watchlist and Scanner (redirects to `/login`). Automated browser could not complete **your** account flow without your credentials.

**You should retest during RTH:**

1. Sign in → **Watchlist** → **Load default six** (up to 6 on preview dev mode; up to 12 total slots).  
2. **Add** AAPL (or any liquid name) → card shows **SCANNING** then full row.  
3. **Scan now** → all cards refresh.  
4. **Scanner** → search same symbol → **Add to live watchlist** → confirm on Watchlist.  
5. Open **chart** → levels match recommendation when **verified** (no stale banner).  
6. Repeat on **phone** (same URL; layout stacks).

---

## 4. Desktop vs mobile

- Desktop: login gate verified; post-login flow requires your session.  
- Mobile: 390×844 layout checked (login screen renders; top search full width when signed in).

---

## 5. Recording status

| Step | API (automated) | UI (needs Wulu login) |
|------|-----------------|------------------------|
| Add ticker | ✅ via `/v1/monitor/symbols` with token | ⏳ Wulu RTH |
| SCANNING → analysis | ✅ monitor tick + pending rows in build | ⏳ Wulu RTH |
| Scan now | ✅ forced tick endpoint | ⏳ Wulu RTH |
| Chart ↔ recommendation | ✅ SPY levels consistent in JSON | ⏳ Wulu RTH |
| Scanner → live watchlist | ✅ code path shipped | ⏳ Wulu RTH |
| Failed scan messaging | ✅ 400/502 JSON | ⏳ card `error` on monitor failures |

**Angelo:** Record a **screen capture during RTH** immediately after Wulu’s pass, or Wulu records using this checklist.

---

## 6. Links for Wulu

- Watchlist: https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/watchlist  
- Scanner: https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/scanner  
- API health: https://th-trade-preview.up.railway.app/health  

---

## 7. Commits on preview branch

- `b407a87` — Watchlist E2E (pending scan, forced tick, Scanner live add)  
- `2ba8d13` — Preview dev watchlist cap (12) + verify script  
- `48f8b59` — Ticker validation + clear setup errors  
