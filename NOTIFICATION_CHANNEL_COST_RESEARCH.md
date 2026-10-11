# Notification channel cost research (no purchases made)

**Date:** 2026-10-12  
**Purpose:** Inform Phase 4 channel choices before enabling paid SMS/email/push.  
**Status:** Research only — email/SMS/push senders remain **not wired**.

Current Wulu delivery (implemented):

| Channel | Status | Cost |
|---------|--------|------|
| In-app alert feed | Wired (local + server events) | $0 |
| Browser Notification API | Wired (opt-in permission) | $0 |
| Email | Not wired | see below |
| SMS | Not wired | see below |
| Mobile push (FCM/APNs) | Not wired | see below |

---

## Email (transactional)

Typical options for status-change alerts (ENTRY ACTIVE, INVALIDATED, etc.):

| Provider | Free / entry tier (approx.) | Paid (approx.) | Notes |
|----------|----------------------------|----------------|-------|
| [Resend](https://resend.com/pricing) | Often ~3k emails/mo free | ~$20/mo+ for higher volume | Developer-friendly API |
| [SendGrid](https://sendgrid.com/en-us/pricing) | Free tier ~100/day historically | Essentials ~$19.95/mo+ | Mature; verify current free limits |
| [Postmark](https://postmarkapp.com/pricing) | Trial credits | ~$15/mo for 10k emails | Strong deliverability focus |
| [Amazon SES](https://aws.amazon.com/ses/pricing/) | Pay-as-you-go | ~$0.10 / 1k emails | Lowest unit cost; more setup |

**Recommendation:** Start with **Resend or SES** only after RTH proves alert volume is useful. Estimate: 6 symbols × ~10 status changes/day × 30 users ≈ 1.8k emails/mo — often fits a free/cheap tier.

---

## SMS

| Provider | Approx. US SMS cost | Notes |
|----------|---------------------|-------|
| [Twilio](https://www.twilio.com/en-us/pricing) | ~$0.0079–$0.01+/SMS outbound US | Plus monthly number ~$1.15 |
| [MessageBird / Bird](https://bird.com/) | Similar per-segment pricing | Region-dependent |
| [AWS SNS](https://aws.amazon.com/sns/sms-pricing/) | Per-message, country-based | Good if already on AWS |

**Rough monthly:** 30 users × 20 SMS/mo × $0.01 ≈ **$6** traffic + number fees. Costs jump if users enable noisy WAIT alerts — **gate SMS to ENTRY ACTIVE / INVALIDATED / MISSED only**.

**Recommendation:** Defer SMS until paying users request it; keep browser/in-app first.

---

## Mobile push

| Stack | Cost | Notes |
|-------|------|-------|
| Firebase Cloud Messaging (Android) | Free | Need Android/iOS apps or PWA + service worker |
| Apple Push Notification service | Free (Apple developer account $99/yr) | Required for native iOS |
| OneSignal | Free tier then paid | Easier multi-platform |
| Expo push (if React Native later) | Free tier | Only if mobile app exists |

**Recommendation:** Browser notifications cover desktop/mobile Chrome/Safari for now (**$0**). Native push waits until a dedicated mobile app.

---

## Suggested rollout order (no spend yet)

1. ✅ In-app + browser (done)  
2. Optional: email via Resend/SES after volume estimate from RTH week  
3. SMS only for critical statuses + paid plan  
4. Native push with mobile app phase  

**Do not purchase** until leadership approves a provider and monthly budget.
