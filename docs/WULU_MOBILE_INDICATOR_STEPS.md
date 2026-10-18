# Mobile chart-line toggles — Wulu troubleshooting log

**Preview web:** https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app  
**Branch:** `phase7/scanner-v2-preview` only (no production / PR #2)

---

## Step 1 — Same version?

| Check | Result |
|-------|--------|
| Service worker | **None** in `apps/web` — no SW cache layer |
| Live Vercel HTML (18 Oct) | `/assets/index-DHVDNIG2.js` embeds **`web 9806c37`** |
| Git branch tip | **`81fdbeb`** (API-only commit after `9806c37` web) |
| iPhone BUILD row | If missing or not `9806c37`, Safari is on **cached HTML/JS** |

**Root cause (likely for Wulu’s 12:21 video):** Phone on **older bundle** or **scroll overlap**, not localhost vs preview logic. His clip shows Vercel URL but **no BUILD stamp** → treat as stale cache until BUILD matches desktop.

**Wulu action:** Settings → Safari → Advanced → Website Data → remove site, or Private tab → confirm TopBar **`BUILD 9806c37 · …`**.

---

## Step 2 — Controls hidden?

| Check | Result |
|-------|--------|
| Responsive CSS | Dedicated **“Chart lines”** row under TF buttons (`9806c37+`); wraps on iPhone |
| Confusion | Yellow **API / Quote / Bars** chips are **status** (`MarketDataStatusStrip` in recommendation panel), **not** VWAP/EMA/BB/RSI toggles |
| Follow-up fix | Label renamed **Indicators → Chart lines**; mobile panel **sticky** + higher z-index |

---

## Step 3 — Toggle state vs chart?

| Overlay | Series hidden when off |
|---------|-------------------------|
| VWAP | `vwap` line |
| EMA 9 | `ema` line |
| BB 20 | upper / mid / lower |
| RSI 14 | `rsi` line |

Prefs key: **`localStorage` `wulu.v2.chartOverlays`**.  
Visibility re-applied after each bar/study update (no calc changes).

---

## Step 4 — Settings reset?

| Action | Expected |
|--------|----------|
| TF change | Prefs **unchanged** (not reset on symbol/TF) |
| Symbol change | Same |
| Navigate away / back | Re-read from `localStorage` |
| Hard refresh | Prefs **persist** |

Unit test: `apps/web/tests/chartOverlays.storage.test.ts`.

---

## Step 5 — Deploy for iPhone re-test

After push: Vercel preview should show **`BUILD <new-web-sha> · <api-sha>`** and **Chart lines** box with four chips.

---

## Reply snippet for Wulu

> We walked your five steps. Preview web is serving bundle **9806c37** (confirmed in the live JS); there is no service worker. Your 12:21 recording likely used a cached build (no BUILD stamp) and the yellow quote/bars chips are data status, not the chart-line toggles. Chart-line controls sit under the timeframe row in the **Chart lines** panel. After the next deploy, please private-tab and confirm BUILD matches **9806c37** or newer, then toggle RSI off and switch 1m→5m and symbol — RSI should stay off.
