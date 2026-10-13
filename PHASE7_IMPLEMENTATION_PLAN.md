# Phase 7 — Launch readiness (users, trust, subscriptions)

**Goal:** Make the platform safe and usable for real users before Phase 8 launch checks.  
**Safety (unchanged):** `automaticOrders=false` · min 2R · discovery ≠ ENTRY · no fabricated win rates  
**Parallel:** Finish Phase 5 RTH validation (10–12 symbols, freshness, alert speed)

**Live frontend:** https://web-tawny-iota-56.vercel.app  
**Live API:** https://th-trade-production.up.railway.app  

---

## 0. Vercel status (checked 2026-10-13)

| Check | Result |
|-------|--------|
| Site reachable | Yes — `web-tawny-iota-56.vercel.app` HTTP 200 |
| Bundle includes Phase 6 UI | **Yes** — JS contains `separated sources`, `LIVE scanner history`, `Historical replay`, `confirmElapsedMs` |
| Auth gate | Working (protected routes show session check → login) |
| CLI deploy from this machine | **Blocked** — `vercel` logged out; GitHub→Vercel auto-deploy appears current |
| Other vanity domains | `th-trade.vercel.app` / `wulu-trading-scanner.vercel.app` → 404 (not configured) |

**Action if UI ever lags:** Vercel dashboard → Redeploy production from `main`, or `vercel login` + `vercel --prod` locally.

---

## 1. Audit — reuse vs build

### Already built (reuse — do not rebuild)

| Area | What exists |
|------|-------------|
| Auth | Supabase Auth, Login/Register, `RequireAuth`, `/v1/me` |
| Plans / credits | `PLANS` tiers, `/v1/plans`, manual `POST /v1/billing/select-plan`, Billing page |
| Monitor | Shared hub, max 12, promote from discovery, durable watchlists |
| Alerts foundation | Event store + dedupe in Supabase, browser Notification API on Alerts page, prefs API (email/SMS/push **flags only**) |
| Performance honesty | LIVE vs HISTORICAL_REPLAY, sample floors, `liveValidated` column (always false today) |
| Mobile shell | `MobileNav` (Home / Discover / Scan / Monitor / More) |
| Risk / confirm | Phase 3–4 gates, persist gate, min 2R, auto-trade off |
| Discovery | Phase 5 universe + confirm (~9–12s after Phase 6 speedup) |

### Gaps for launch (build / finish)

| Priority | Gap | Notes |
|----------|-----|--------|
| P0 | **liveValidated operator flow** | API + UI to mark RTH-verified outcomes; measured rates only from validated rows for public claims |
| P0 | **Phase 5 RTH soak** | 10–12 symbols, freshness, alert latency — next US session |
| P0 | **Launch UX pass** | Website/mobile review: empty states, disclaimers, onboarding path Login→Discover→Monitor |
| P1 | **Notification reliability** | Browser alerts work when tab open; need service worker / push **or** email for away-from-desk (paid provider) |
| P1 | **Account security hardening** | Password reset UX, session expiry messaging, rate limits on auth/paid endpoints, audit CORS |
| P1 | **Subscription readiness (pre-Stripe)** | Enforce plan watchlist caps / credit gates consistently; legal copy; cancel/downgrade |
| P2 | **Stripe Checkout** | **Needs your approval** — paid integration |
| P2 | **SMS / email / web-push providers** | **Needs your approval** — Twilio/Resend/etc. |
| P2 | **Marketing landing** | Optional public page vs app-only login |
| P3 | Phase 8 checklist handoff | Ops runbook, incident contacts, kill switches |

---

## 2. Workstreams

### A. Verified outcomes (trust) — **start first**

**Problem:** Outcomes can resolve from bars while `liveValidated` stays false; we must never show those as published edge.

**Build:**
1. Operator/admin endpoint: `POST /v1/signals/:id/live-validate` (auth + role/allowlist)
2. Rules: only `source=LIVE`, only after RTH, require outcome already resolved or attach evidence (entry/stop/T1 timestamps)
3. Measured performance: add `source=LIVE_VALIDATED` (or filter `liveValidated=true` only) for any user-facing “win rate”
4. UI: Journal / Backtest — badge **Validated** vs **Unvalidated LIVE** vs **REPLAY**; rates from validated bucket only when claiming edge
5. Written SOP in repo: when an operator may mark validated (checklist)

**Reuse:** `signal_performance_records.live_validated`, `aggregateMeasuredPerformance`

### B. Product / website / mobile

- Walk authenticated flows on desktop + phone widths
- Onboarding checklist component (first login): set watchlist → enable browser alerts → read risk disclaimer
- Ensure Backtest / Opportunities / Billing copy never implies auto-trading or guaranteed returns
- Mobile: confirm Monitor + Alerts reachable; fix any overflow / tap targets found in pass

### C. Notifications

- **Now (no paid):** harden browser notifications + in-app Alerts feed; optional sound; document “tab must be open”
- **Later (approval):** email (e.g. Resend) and/or Web Push; SMS last (cost/compliance)

### D. Account security

- Password reset / forgot-password page (Supabase built-in)
- Clarify email confirmation settings for production
- Confirm service-role key never on Vercel; tighten CORS to production origin only
- Optional: admin allowlist env for live-validate

### E. Subscription readiness

- **Without Stripe:** keep manual plan select; enforce `maxWatchlist` / credits on API (audit gaps)
- **With Stripe (approval):** Checkout + webhook → replace `select-plan`; map `stripePriceIdEnv` already on `PLANS`

### F. Phase 5 RTH (parallel — not blocked on Stripe)

| # | Test | How |
|---|------|-----|
| 1 | Promote 10–12 symbols | Auth → Opportunities → promote |
| 2 | Freshness | Hub metrics: `lastCycleMs`, quote age on cards |
| 3 | Alert speed | Trigger NEAR/ENTRY status change → event timestamp delta |
| 4 | Confirm latency | `confirm=3` → `confirmElapsedMs` under RTH load |

Record results in `PHASE5_RTH_STATUS.md` / a dated RTH report.

---

## 3. Needs your approval before we spend money or wire vendors

| Item | Why | Default until approved |
|------|-----|------------------------|
| **Stripe** | Card charging, webhooks, PCI surface | Manual plan select only |
| **Email provider** (Resend/SendGrid/…) | Away-from-desk alerts + transactional mail | Browser + in-app only |
| **SMS** (Twilio/…) | Cost + compliance | Off |
| **Web Push** (VAPID / FCM) | Extra infra | Off unless you want PWA push |
| **Public marketing site** | Brand/legal review | App stays login-gated |
| **Publishing any win-rate %** | Regulatory/trust | Only after `liveValidated` floors met |

Reply with which of the above to enable (and preferred vendors if you have them).

---

## 4. Suggested build order (fast path)

1. **liveValidated API + UI + SOP** (trust)  
2. **UX/onboarding + mobile pass** + disclaimer audit  
3. **Enforce plan limits** on monitor/credits  
4. **Phase 5 RTH soak** (next regular session)  
5. **Notification hardening** (browser); draft email design  
6. **Stripe design doc** — implement only after approval  
7. Hand off **Phase 8** launch checklist  

---

## 5. Explicit non-goals for Phase 7

- Automatic order placement  
- Lowering confirmation / R:R gates  
- Mixing REPLAY into LIVE rates  
- Shipping SMS/Stripe without approval  

---

## 6. Definition of done (Phase 7)

- [ ] Operators can mark outcomes `liveValidated`; public metrics respect that  
- [ ] Onboarding + mobile review signed off  
- [ ] Plan limits enforced server-side  
- [ ] Alert path documented (and browser path reliable)  
- [ ] Phase 5 RTH checklist closed or residual risks listed  
- [ ] Vercel + Railway both on same release SHA  
- [ ] Approval list above resolved (yes/no per vendor)  
- [ ] Auto-trade still **false** in `/health`  
