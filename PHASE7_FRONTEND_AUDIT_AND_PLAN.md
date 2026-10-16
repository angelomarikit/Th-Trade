# Phase 7 — Frontend audit, redesign plan & Wave 1

**Branch:** `phase7/frontend-redesign` (preview — do not merge to production until approved)  
**Safety:** Auto-trading disabled · min 2R · liveValidated evidence rules unchanged  
**Backend:** Reuse Phases 1–6; only thin `/v1/symbols/search` added for typeahead  

---

## Audit

### Reuse
- Terminal hub, setup/bars APIs, monitor, opportunities, alerts prefs, billing plans
- lightweight-charts candle engine
- Dark shell tokens, Sidebar, Auth

### Bugs fixed in Wave 1
- Double bars fetch + no abort → race/flicker / stale candles across symbols
- Prior symbol levels could overlay new chart mid-switch (`setData` kept old card)
- Tiny TopBar ticker-only input (no name search)

### Redesign gaps (Wave 2–3)
- Opportunities table polish + click-through filters
- Unify local star vs server monitor watchlist
- Alerts center: recorded vs delivered
- Mobile nav (Alerts), Billing visual polish
- Full device QA + screenshot pack

---

## Timeline

| Wave | Scope | Estimate |
|------|--------|----------|
| **1 (this PR)** | Search, chart stability, Scanner chart-first layout | 3–5 days |
| **2** | Nav, Opportunities, Watchlist, Alerts | 3–4 days |
| **3** | Mobile, Billing UI, polish, QA | 2–3 days |
| **Gate** | Your review → production deploy | 1 day |

---

## Wave 1 delivered for review

1. **`GET /v1/symbols/search?q=`** — curated liquid universe + company names  
2. **`SymbolSearch`** — typeahead + Search CTA (TopBar + Scanner hero)  
3. **Chart** — clear on symbol change, abort/seq guard, volume + VWAP, fewer overlapping level labels, symbol-gated overlays  
4. **Scanner** — recent rail · instrument header · hero chart · signal panel (LONG/SHORT, WAIT why, levels, R:R, score, collapsed details)  

**Not changed:** confirmation gates, plan prices (still API `PLANS`), Stripe off  

---

## How to preview

```text
git checkout phase7/frontend-redesign
npm run build -w @wulu/regime -w @wulu/api -w @wulu/web
npm run dev:web   # + API if needed
```

Push branch for Vercel preview; merge only after approval.
