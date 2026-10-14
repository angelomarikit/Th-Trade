# Milestone 1 — Lifecycle demo (preview branch)

**Goal:** Prove WAIT → ENTRY ACTIVE → TARGET HIT or STOP HIT with recorded outcome logic (no broker orders).

**Branch:** `phase7/scanner-v2-preview`  
**Production / PR #2:** unchanged

---

## Automated proof (run locally or CI)

```bash
node scripts/demo-lifecycle-simulation.mjs
```

Or:

```bash
npx vitest run packages/confirmation/tests/lifecycleDemo.test.ts
```

**Latest result:** 2/2 tests pass — TSLA simulation:

| Step | Status / action |
|------|-----------------|
| 1 | **WAIT** (action: WAIT) |
| 2 | **ENTRY ACTIVE** (action: ENTER, open track) |
| 3 | **TARGET HIT (T1)** or **STOP HIT** (action: SKIP or INVALIDATED) |

Stop path: ENTRY ACTIVE → **STOP HIT** → action **INVALIDATED**.

---

## What shipped in code

- **TARGET HIT (T1/T2/T3)** and **STOP HIT** user-facing statuses after completed-bar resolution
- Monitor **alerts** on target/stop transitions (in-app event log)
- **tradingAction:** `WAIT` | `ENTER` | `SKIP` | `INVALIDATED` on setup + watchlist
- **watchingSummary** — what we’re watching and what confirmation is missing
- Scanner panel shows **data feed + timestamp** when API provides `marketDataAt`
- Chart/setup sync guards unchanged (stale → hide executable levels)

---

## Preview links (web UI — sign in required)

| Page | URL |
|------|-----|
| Scanner | https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/scanner |
| Watchlist | https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/watchlist |
| Signals (open tracks) | https://web-git-phase7-scanner-v2-preview-supporttoptiersoluts-projects.vercel.app/signals |

Verify links: `node scripts/verify-preview-links.mjs`

---

## Still needed for your “one full recording” acceptance

Live **MU or TSLA** during RTH where the **real** matrix reaches ENTRY ACTIVE, then a **real** 5m bar hits target or stop — captured on video/screenshots. That depends on market conditions; the simulation proves the **engine**; the recording proves **live data + UI** together.

**Screenshots:** capture after Vercel deploy + sign-in:

1. Scanner — TSLA or MU with **Your action** + **watchingSummary**
2. Watchlist — same symbol after monitor tick
3. Watchlist **Recent changes** after a transition (or Signals open track)

---

## Next priority (after you sign off Milestone 1)

1. Options on preview (`FEATURE_OPTIONS_ENGINE`) — confirm Alpaca options entitlement/cost first  
2. Day vs overnight scanners  
3. Alert delivery (push/email) with retry logs  
