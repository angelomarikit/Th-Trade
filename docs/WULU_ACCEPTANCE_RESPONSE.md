# Response to Wulu — live session feedback (preview only)

**From:** Angelo  
**Date:** October 16, 2026  
**Production / PR #2:** unchanged

---

## You were right

Paper trading stays **not approved**. The issues you saw were real product gaps, not “API passed / UI fine.” Prices could update while watchlist cards looked generic, new tickers could vanish after add, and Scanner “Add to watchlist” did **not** connect to the **live Watchlist monitor**.

---

## Root causes we fixed (preview branch)

| Issue | Cause | Fix |
|-------|--------|-----|
| New ticker not appearing | Symbol was in config but **no row** until a background scan finished; scan could **skip** while you used Scanner (Alpaca priority) | **SCANNING** placeholder card immediately; **force scan** on Add / Scan now / defaults |
| Repetitive generic cards | Same brief block on every card | Lead with **stock-specific `watchingSummary`** + “Still need” lines; drop duplicate brief |
| Add from Scanner didn’t work | Button only updated **browser localStorage**, not server monitor | **Add to live watchlist** calls `/v1/monitor/symbols` when signed in |
| Recent changes confusing | Events stored generic `Status A → B` | **Plain-English reasons** (invalidation, missed, confirmation, waiting line) |
| Free plan vs “default six” | Defaults could load 6 while plan cap is 3 | Defaults **respect plan cap**; preview can set `WULU_ACCEPTANCE_MIN_WATCHLIST=6` on Railway preview only |
| Not signed in | Watchlist mutations require auth when Supabase is enabled | **Sign-in banner** on Watchlist |

---

## What we need you to retest (same preview URLs)

1. **Sign in** → Watchlist → **Load default six** (or up to your plan cap).  
2. **Add** a new ticker (e.g. AAPL) → card should show **SCANNING** then full analysis within one cycle.  
3. **Scan now** → all cards refresh; failures show **error text** on the card, not silence.  
4. **Search** top bar → Scanner → confirm **action, levels, chart** match.  
5. **Add to live watchlist** on Scanner → open Watchlist → same symbol appears.  
6. Mobile: same flow; less duplicate text on cards.

---

## Still honest limits (not hidden)

- **IEX / REST**, not full SIP — spread and volume filters can yield **NO TRADE / WAIT** with **fresh** price.  
- **ENTER** only when action + verified data + chart alignment (same as before).  
- Lifecycle **TARGET/STOP** still needs a clean RTH recording with you.  
- Options, push alerts, day scanner — still **after** this E2E pass.

---

## For Angelo (deploy)

1. Merge fixes on `phase7/scanner-v2-preview`  
2. Railway preview: redeploy API; optional env `WULU_ACCEPTANCE_MIN_WATCHLIST=6`  
3. Vercel: rebuild preview web  
4. Run `node scripts/demo-watchlist-flow.mjs AAPL` with `WULU_DEMO_TOKEN`  
5. Screen recording: add → scan → chart for one new ticker + one of the starter six  

---

When you’re satisfied with a **recorded** pass of the checklist above, we can talk paper trading again — not before.
