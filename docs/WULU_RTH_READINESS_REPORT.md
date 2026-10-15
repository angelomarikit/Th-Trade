# WULU Preview — RTH Readiness Report

**From:** Angelo (developer)  
**For:** Wulu (paper trading & acceptance testing)  
**Date:** October 15, 2026  
**Environment:** Preview only — **production is unchanged**

---

## What this is

This is a **preview** of the trading scanner: clear **WAIT / ENTER / SKIP / INVALIDATED**, levels, lifecycle status, indicators, and watchlist cards. It **does not place trades**. You paper trade in Thinkorswim (or similar) and use WULU only for **signals and levels**.

This report says **what you can rely on during regular trading hours (RTH)** and **what not to trust yet**.

---

## Links (use these in the browser)

Open the **Vercel** app, not the Railway API URL (Railway is JSON for the backend).

| What | Link |
|------|------|
| **Watchlist** (start here) | https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/watchlist |
| **Scanner** (one symbol + chart) | https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/scanner |
| Sign in | https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/login |

After sign-in: **Watchlist → Load default six** (TSLA, MU, NVDA, AMD, SPY, QQQ). Cards refresh about every **20 seconds**, or use **Scan now**.

If the UI looks old: **hard refresh** (Ctrl+Shift+R / Cmd+Shift+R).

---

## Bottom line for today

| | |
|---|---|
| **Yes — supervised paper testing during RTH** | Watchlist + Scanner, when **ENTER**, **data verified**, and **no stale “updating setup” banner** |
| **No — not yet** | Blind trust on every ticker, options, full-market scanner, push alerts, or “proven” live ENTRY → TARGET/STOP without us validating together |

**NO TRADE** from the matrix (spread, regime, R:R, etc.) should show as **WAIT** on the latest preview — meaning “no entry right now,” not “broken product.” **MISSED** setups show **SKIP** (do not chase).

---

## How to use the three areas

1. **Watchlist** — Your live monitor. Default six symbols; trust **action + verified data** on these cards when you’re watching them refresh.
2. **Scanner** — Deep dive on one symbol: same recommendation panel + chart. Use before you size a paper trade.
3. **Recent** (bottom of watchlist) — **Do not trust** for symbols you haven’t just opened or scanned. It’s cached in your browser; only the **current** symbol stays fresh on auto-refresh. **Tap a symbol to refresh** if you need it live.

---

## When you **may** paper trade off a signal

All of these should be true:

- **Action = ENTER**
- **Data verified** (not “DATA NOT VERIFIED”)
- No **“Updating setup…”** / stale banner on Scanner
- You’re comfortable with **trigger, entry, stop, T1–T3** matching the chart
- Roughly **≥ ~2R to T1** (the system should block bad R:R, but double-check)

---

## When you **must not** paper trade

- **WAIT** or **SKIP** or **INVALIDATED**
- **DATA NOT VERIFIED** or obvious stale data
- **ENTER** while the chart/setup still says updating / not in sync
- You’re basing the decision only on **Recent** for a symbol you didn’t just scan

---

## What each card should show (acceptance checklist)

Use this during a live RTH session. If something fails, screenshot + **time (ET)** + symbol.

| # | What to check | Pass when… |
|---|----------------|--------------|
| 1 | WAIT → ENTER | ENTER only when setup is actually executable and data is fresh |
| 2 | Chart ↔ numbers | Header/levels match chart; no trade while “Updating setup…” |
| 3 | Broken setup | Bad structure/stop → **INVALIDATED** |
| 4 | Missed move | **MISSED** + **SKIP**, no chase |
| 5 | Lifecycle | After **ENTRY ACTIVE**, you eventually see **TARGET HIT** or **STOP HIT** (we’re still validating this live with you) |
| 6 | Recent changes | Table updates when setups change (sanity check) |
| 7 | Six symbols | All six refresh without scan errors |
| 8 | Phone | Same Vercel URL; layout stacks on narrow screen |

---

## Fields on each watchlist card

- Symbol + **LONG / SHORT**
- **WAIT / ENTER / SKIP / INVALIDATED**
- Lifecycle chip (e.g. WAIT, ENTRY ACTIVE, MISSED)
- Price + **verified / not verified**
- Trigger, entry, stop, T1–T3, R:R, setup score
- **Waiting for** line
- Six indicators (compact grid)
- Data timestamp / feed line

Scanner shows the same recommendation logic with a full chart.

---

## Known behavior (not bugs)

- **SPY / NVDA “NO TRADE”** during RTH with **data fresh** — often correct (spread, regime, VWAP, 5m, R:R). That’s **WAIT**, not bad data.
- **MU in Recent looking stale** while Watchlist is fresh — refresh that symbol or use Watchlist/Scanner for the decision.
- **Alpaca news** on preview; production app is still separate and unchanged.

---

## After your session — send Angelo

For any mismatch:

1. Screenshot  
2. **Symbol + time (ET)**  
3. What you expected vs what you saw (action, status, price, levels)

That drives the next fixes on preview only — still **no production deploy** until you and Angelo agree.

---

## Priority after this test (for your awareness)

1. Your live RTH pass on the checklist above  
2. Optional: align preview API with latest **WAIT** labeling (if you still see SKIP on pure NO TRADE)  
3. Record real **ENTRY ACTIVE → TARGET/STOP** examples (e.g. MU/TSLA) in RTH  
4. Options on preview — only after cost/entitlement sign-off  
5. Day/overnight scanners, alerts, etc. — later

---

**Summary:** Preview is **ready for you to run a supervised RTH acceptance test and manual paper trades** when **ENTER + verified + in sync**. It is **not** ready for unattended or full-product trust. Start on **Watchlist**, use **Scanner** to confirm, ignore stale **Recent** rows.

— Angelo
