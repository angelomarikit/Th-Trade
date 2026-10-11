# Phase 3 Deploy Verification Report

**Date:** 2026-10-12 (Asia/Manila)  
**Operator approval:** yes — deploy Phase 3 without disrupting Phase 2  
**Automatic trading:** disabled (`execution.automaticOrders = false`)

---

## 1. Pre-deploy checks

| Check | Result |
|-------|--------|
| Phase 3 tip | `f7d1ec5ea2980b38300bf04f459c5ff4766a779c` |
| Feature commit | `1a6f57e5cd0613dde51cd05cada5e7e2476ef5e3` |
| Rollback tag (Phase 2) | `pre-phase3-deploy-rollback` → `79cdd7b` |
| Deploy candidate tag | `phase3-deploy-candidate` → `f7d1ec5` |
| Branch | `phase3/intelligent-signals` merged → `main` |
| Local tests | **71 / 71 passed** |

Rollback: `git checkout pre-phase3-deploy-rollback` (or redeploy Railway from `79cdd7b`).

---

## 2. Deployment

| Target | URL | Method | Deployed commit |
|--------|-----|--------|-----------------|
| Railway API | https://th-trade-production.up.railway.app | `railway redeploy --from-source` after `main` push | **`f7d1ec5`** (health `gitCommit`) |
| Vercel web | https://web-tawny-iota-56.vercel.app | GitHub → main auto-deploy (CLI logged out; bundle verified) | Phase 3 UI present (`Fake-break`, `qualityScore10`, `Entry:`, `not win %`) |

Railway deployment ID (SUCCESS): `a6dabefc-fc07-4d17-9868-07ebe940e326`

---

## 3. API smoke (post-deploy)

| Endpoint | Result |
|----------|--------|
| `GET /health` | `ok`, commit `f7d1ec5`, `automaticOrders: false`, monitor running, Alpaca IEX |
| `GET /v1/monitor` (no auth) | 200 empty session (expected — auth required for user watchlist) |
| Persisted watchlist restore | Logs: `[monitor] restored 1 persisted watchlist(s)`; hub `uniquePairsLastCycle=6` |
| `GET /v1/replay?ticker=NVDA&side=LONG` | 200 · label `HISTORICAL REPLAY — NOT LIVE` · 40 steps |
| `GET /v1/replay?ticker=TSLA&side=SHORT` | 200 · 50 steps |
| `GET /v1/signal-performance` | 200 · foundation endpoint live (in-memory; resets on restart) |
| Burst 6× parallel replay | All **200**, ~12s; no uncontrolled failure loop |
| Hub after burst | `failedScansLastCycle=0`, cycle ~46–47s for 6 symbols (paced) |

**429 logs:** No `429` / rate-limit lines in recent Railway logs during this verification pass.

---

## 4. Live Watchlist UI (production)

Signed-in session on https://web-tawny-iota-56.vercel.app/watchlist

| Check | Result |
|-------|--------|
| Title | WULU LIVE WATCHLIST |
| Six stocks | **SPY, NVDA, TSLA, QQQ, MU, AMD** (6/6 ranked) |
| Hub | RUNNING · ticks advancing · FEED OK · SIGNALS_ONLY · WEEKEND |
| Phase 3 card fields | Entry zone, Stop, T1–T3, R:R, Score x/10 (not win %), Fake-break risk, Retest |
| Actionable entries | **None** — all **DATA NOT VERIFIED — NO TRADE** (correct outside RTH) |
| Example intelligence | NVDA fake-break **MODERATE**; TSLA fake-break **CONFIRMED_FAIL**, retest **BROKE** |
| Auto-trading copy | “Auto-trading remains disabled” |

Screenshot: `docs/screenshots/phase3-live-watchlist-deploy.png`

---

## 5. Market-hours testing

**Status: PENDING — US market closed / weekend at verification time**

Required during next RTH session:

1. Confirm ENTRY ACTIVE only after completed 5m confirmation + mandatory checks + ≥2R  
2. Observe real breakout vs fake-breakout warnings on LONG and SHORT  
3. Confirm no ENTRY ACTIVE on stale / DATA NOT VERIFIED  
4. Watch `/v1/signal-performance` accumulate LIVE records across ticks  
5. Re-check Alpaca 429 rate under sustained 6-symbol monitoring

---

## 6. Signal-performance collection

| Item | Status |
|------|--------|
| Endpoint | `GET /v1/signal-performance` |
| Storage | In-memory on Railway (lost on restart) |
| Initial gap | First deploy only logged on status-change alerts → few/no weekend rows |
| Fix follow-up | Log every evaluated monitor card + replay transition/last step (see tip after `f7d1ec5` if redeployed) |
| Published accuracy % | **Not claimed** — foundation counts only |

---

## 7. Errors / limitations

| Issue | Severity | Notes |
|-------|----------|-------|
| RTH live ENTRY ACTIVE proof | Expected pending | Weekend / non-RTH → fail-closed |
| Performance store not durable | Medium | Phase 4: Supabase persistence |
| Vercel CLI logged out locally | Low | Production UI already updated via GitHub |
| Cycle ~47s for 6 symbols | Info | Intentional Alpaca pacing; monitor stays responsive |
| Some R:R &lt; 2 on cards | Expected | Blocks ENTRY ACTIVE; levels may still display for context |
| IEX volume not consolidated | Known | Labeled on UI / feed notes |

---

## 8. Safety

- [x] Automatic orders disabled in production health  
- [x] No brokerage order placement  
- [x] Phase 2 monitor + Supabase watchlist restore still work  
- [x] Rollback tag available: `pre-phase3-deploy-rollback`

---

## 9. Verdict

**Phase 3 is deployed to Railway + Vercel and verified for offline/weekend safety behavior.**  
**RTH validation of live breakouts / ENTRY ACTIVE remains the critical open item before calling Phase 3 “fully complete” in live market conditions.**

Next: RTH soak + Phase 4 (notifications + permanent performance tracking).
