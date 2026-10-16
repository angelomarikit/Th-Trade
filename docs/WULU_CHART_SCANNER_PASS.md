# Wulu chart + scanner pass (preview branch)

## Chart (clean price action)

- No entry/stop/target price lines or BUY labels on the candlestick chart.
- Reduced right padding; `fixLeftEdge` / `fixRightEdge`; visible range clamped so panning cannot scroll into large empty areas.
- VWAP + volume only; trade levels live in the **Scanner recommendation panel**.

## Scanner recommendation panel

Structured trade plan per scan: Direction, Action, Current price, Trigger, Entry zone, Stop, T1–T3, R:R, Waiting for — with **scan timestamp** and stale/unverified styling when appropriate.

## Market data clarity

- Top bar: **API OK** = health/connectivity only (not verified NBBO).
- Scanner strip: API · Quote · Bars · Setup verified · Entry permitted/blocked + plain-language summary when blocked.

## RTH stale-quote investigation

- Root cause: Alpaca `quote.t` can lag while bars update; we still fail closed on wide spread / missing quote / bars stale / quote age &gt; ~120s.
- Modest timestamp lag (&lt;= 90s + 30s) on a **just-fetched** usable NBBO with current bars is treated as fresh for setup evaluation only when spread passes entry gates.

## Demo

```bash
npm run build && npm test
node scripts/demo-lifecycle-simulation.mjs
```

Preview only — production and PR #2 unchanged.
