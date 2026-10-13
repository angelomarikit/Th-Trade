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

### A. Verified outcomes (trust) — **in progress / largely done**

**Problem:** Outcomes can resolve from bars while `liveValidated` stays false; we must never show those as published edge.  
**Labeling:** Always **verified signal outcomes** — never customer trading profits (no order execution).

**Build / status:**
1. [x] `POST /v1/signals/:id/live-validate` (auth + `LIVE_VALIDATE_EMAILS` allowlist)
2. [x] Evidence required: entry zone, stop, targets, timestamps, outcome — note alone **rejected**
3. [x] Backend re-fetches market bars and re-resolves path; mismatch → **unvalidated**
4. [x] Audit: `signal_validation_audit` + `validated_by` / `validated_at` / `validation_evidence`
5. [x] `GET /v1/signals/:id/validation-audit`
6. [x] Measured `source=LIVE_VALIDATED` + Backtest VALIDATED panel
7. [x] SOP: `docs/LIVE_VALIDATE_SOP.md`
8. [ ] Apply Supabase migration `20261013_phase7_validation_audit.sql` on production
9. [ ] Operator UI button to validate from Journal (API ready)

**Reuse:** `signal_performance_records`, `resolveOutcomeOnBar`, `aggregateMeasuredPerformance`

### B. Product / website / mobile

- [x] Onboarding checklist on Overview (Discover → Monitor → Alerts → Backtest; signals-only disclaimer)
- [ ] Full desktop + mobile UX pass (overflow / tap targets)
- [x] Backtest / measured copy: verified signal outcomes ≠ trading profits
- [ ] Mobile: Alerts link from More/Settings if not in bottom nav

### C. Notifications

- **Now (no paid):** harden browser notifications + in-app Alerts feed; optional sound; document “tab must be open”
- **Later (approval):** email (e.g. Resend) and/or Web Push; SMS last (cost/compliance)

### D. Account security

- Password reset / forgot-password page (Supabase built-in)
- Clarify email confirmation settings for production
- Confirm service-role key never on Vercel; tighten CORS to production origin only
- Optional: admin allowlist env for live-validate

### E. Subscription readiness

- [x] Promote enforces plan `maxWatchlist` (capped by hub max 12)
- [x] PUT watchlist enforces same plan cap
- **Without Stripe:** manual plan select remains
- **With Stripe (approval):** Checkout + webhook → replace `select-plan`

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

- [x] Evidence + audit required for `liveValidated` (not note-only)  
- [x] Public copy = verified signal outcomes, not customer profits  
- [x] `LIVE_VALIDATED` measured bucket + VALIDATED UI panel  
- [x] Onboarding checklist shipped  
- [x] Promote plan watchlist cap enforced  
- [ ] Supabase validation migration applied in production  
- [ ] Mobile review signed off  
- [ ] Alert path documented (browser reliable; email/SMS pending approval)  
- [ ] Phase 5 RTH checklist closed or residual risks listed  
- [ ] Vercel + Railway on same release SHA  
- [ ] Approval list above resolved (yes/no per vendor)  
- [x] Auto-trade still **false** in `/health`  
