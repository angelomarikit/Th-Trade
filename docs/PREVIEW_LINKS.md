# WULU Preview — Working links (Phase 7 scanner v2)

**Important:** `https://th-trade-preview.up.railway.app` is the **API**, not the website. Opening it in a browser shows JSON (including a link index at `/`). Use the **Vercel** URLs below for Scanner, Watchlist, and charts.

**Production is unchanged.** These URLs point at the isolated preview API (`newsProvider: alpaca`).

---

## Web app (open these in Chrome / Safari)

Base: **https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app**

| Page | Direct link |
|------|-------------|
| Sign in | https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/login |
| Overview (home) | https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/ |
| **Scanner + recommendation panel + chart** | https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/scanner |
| **Watchlist + recommendation cards** | https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/watchlist |
| Charts | https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/charts |
| Signals | https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/signals |
| Register | https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/register |

After sign-in, use **Watchlist → Load default six** to populate TSLA, MU, NVDA, AMD, SPY, QQQ.

---

## API (for tools / QA — not the UI)

| Check | URL |
|-------|-----|
| Link index (if you opened Railway by mistake) | https://th-trade-preview.up.railway.app/ |
| Health | https://th-trade-preview.up.railway.app/health |
| Sample setup JSON | https://th-trade-preview.up.railway.app/v1/setup?ticker=SPY&side=LONG&fast=1 |
| Sample catalyst | https://th-trade-preview.up.railway.app/v1/catalyst?ticker=NVDA |

---

## Quick verify

```bash
node scripts/verify-preview-links.mjs
```

Branch: `phase7/scanner-v2-preview`
