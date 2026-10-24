# Paid-User Account — Deep Audit

**Date:** 2026-10-24 · **Task:** #18 · **Scope:** the account surface a (future) paid user depends on — security, agency, settings+auth controls, and product-story↔UX fidelity.
**Method:** read-only trace of the authoritative code. Findings are classified **DEFINITE** (a problem now — including latent/future problems, which this audit treats as present) or **CONFIRM** (likely a problem; the exact check to settle it is given). Fixes are follow-up work (queued as task #23), not applied here.
**Headline:** the account/auth surface is unusually well-built. No reachable auth bypass was found. The real exposures are two operational gaps that bite *in a production beta* (email sending, cookie secret), a missing consent record, and three things that need a one-command confirmation.

---

## Verified strengths (so the findings are read in proportion)
- **Password hashing:** argon2id, 64 MB / t=3 / p=1 (OWASP-aligned). Verify is constant-time, throws→false.
- **JWT:** signed with a fail-fast `JWT_SECRET`; a `type:'access'` claim blocks refresh-as-access. 15-min TTL.
- **Refresh tokens:** 48-byte random, argon2-hashed at rest, **rotated every use**, with a 10 s two-tab grace window and **reuse detection that revokes the whole family** (`classifyPresentedToken` → `revokeAllRefreshTokens`). Cleanup job prunes expired/old-revoked rows.
- **Cookies:** httpOnly, `secure` in prod, `sameSite:'strict'`, path-scoped to `/api/v1/auth`.
- **Lockout:** per-email (5) *and* per-IP (20), fixed 15-min window, unknown emails counted identically (no enumeration), correct sign-in clears the counter, owner emailed on lockout.
- **Rate limiting:** global 100/min + tight per-route (login 10/15m, register 5/15m, export 3/h, reset 10/15m, …).
- **Mass-assignment:** `PATCH /auth/me` whitelists via `UpdateTrainerSchema` — **no `role`, `subscriptionTier`, `trainerMode`, `email`, or `passwordHash`**; Zod strips unknown keys.
- **Account lifecycle:** password change re-proves + signs out other devices; soft-delete re-proves password; **sign-in restores within 30 days**, past-window treated as unknown (no enumeration); daily hard-purge is an explicit dependency-ordered delete with media cleanup and private-exercise re-homing.
- **Export is complete** (resolves the audit's main WS2 doubt): account (minus `passwordHash`), clients, goals, snapshots, full session trees (sets), templates, challenges, private exercises, telemetry, and signed media URLs. Never includes the hash or tokens.
- **CSP/headers:** helmet CSP (prod: no `unsafe-inline`), `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`; `Cache-Control: no-store` on `/api`. CORS is an allowlist with credentials.

---

## DEFINITE findings (address now)

### D1 — `COOKIE_SECRET` falls back to a hardcoded default (you are in production beta)
`index.ts:200`: `secret: process.env.COOKIE_SECRET ?? 'change-this-cookie-secret-in-production'`. Unlike `JWT_SECRET` (fail-fast), this silently accepts a **public default**.
- **Live severity today: LOW** — I verified nothing is signed: the refresh cookie is set **without `signed:true`** and nothing calls `unsignCookie`. So no cookie's integrity currently depends on this secret (the real gate is the argon2 DB check of the raw token).
- **Why it's still a DEFINITE now-problem:** it's a latent footgun that becomes a real forgery vector the moment anyone adds `signed:true` trusting it; and in a prod beta an unset secret is a silent config gap. A future problem is a problem now.
- **Fix:** require it in production, allow a dev fallback:
  ```ts
  const cookieSecret = process.env.COOKIE_SECRET
  if (!cookieSecret && process.env.NODE_ENV === 'production')
    throw new Error('Missing required environment variable: COOKIE_SECRET')
  app.register(cookie, { secret: cookieSecret ?? 'dev-only-insecure-cookie-secret' })
  ```
  **and set `COOKIE_SECRET` on Railway now** (a long random value). Failing fast is safe because the app already fails fast on `JWT_SECRET`.

### D2 — Password recovery / change-email / verification are non-functional until Resend is configured
`forgot-password` always answers 202; `sendTransactionalEmail`/`emailConfig()` throw when `RESEND_API_KEY` / `REPORT_FROM_EMAIL` / `APP_URL` are unset, and the throw is swallowed (logged as `send_failed`). The code is **correct and graceful**; the capability is simply **absent while unconfigured**.
- **Why DEFINITE:** in a production beta, a real user who forgets their password has **no recovery path** — the UI says "a reset link is on its way" and nothing arrives. Same for change-email confirmation and verification.
- **Confirm:** are `RESEND_API_KEY`, `REPORT_FROM_EMAIL=no-reply@just-train.fit`, `APP_URL=https://www.just-train.fit` set on Railway, and is `just-train.fit` verified in Resend? (Open question carried since 2026-10-19.)
- **Fix (pick one, now):** (a) configure Resend and verify the domain — the real fix; or (b) until then, make the forgot-password UI honestly state that email recovery isn't live yet, so the 202 copy doesn't promise a link that can't arrive. (a) is strongly preferred for a beta with real accounts.

### D3 — Consent is shown but not recorded
Register (`CreateTrainerSchema` = name/email/password) captures **no consent**: there is no `termsAcceptedAt`/`consentVersion` on `trainers`, and no required acceptance in the schema. `/terms` and `/privacy` exist and are linked, but acceptance leaves no server-side record.
- **Why DEFINITE:** a product taking real (even beta) users, heading to paid, should be able to prove *what* a user agreed to and *when*. Retrofitting consent onto existing accounts later is painful; recording it from the first beta user is cheap.
- **Fix:** add a required consent checkbox at register, store `termsAcceptedAt` + a `termsVersion` string on the trainer row (4-file column checklist + migration), and stamp it in the register handler. Backfill existing beta accounts with the version live at their `createdAt` (or prompt on next login).

---

## CONFIRM findings (likely a problem; here is the exact check)

### P1 — IP rate-limit & lockout key derives from the first `X-Forwarded-For` entry; `trustProxy` is unset
`lib/clientIp.ts` returns the **first** XFF entry; Fastify is created **without `trustProxy`** (`index.ts:62`). Taking the leftmost entry is only safe if the nearest trusted proxy *overwrites* a client-sent XFF.
- **Impact if spoofable:** an attacker reaching the Railway backend directly with a forged `X-Forwarded-For` can rotate the key and evade the per-IP cap (20) and the global 100/min. **The per-email lockout (5) is unaffected**, so single-account brute force stays capped — this is credential-stuffing / volumetric evasion, not account takeover.
- **Confirm:** `curl -H 'X-Forwarded-For: 1.2.3.4' https://<railway-backend-host>/api/v1/health` (and a login attempt) sent **directly to the Railway host**, and check what `clientIp` logs. If the forged value wins, it's spoofable.
- **Fix if confirmed:** set `Fastify({ trustProxy: <n> })` to the real trusted-hop count (Vercel+Railway — verify) and key limits on `request.ip`; **not** `trustProxy:true` (that trusts the leftmost again). Strongest option: have the Vercel rewrite inject a shared secret header and reject direct (un-proxied) requests.

### P2 — Data export download on installed iOS (standalone PWA)
`useExportData` builds a Blob and clicks an `<a download>`. Reliable in normal browsers; **iOS Safari in standalone/installed mode has historically poor `<a download>` support** and may open the JSON in place instead of saving.
- **Confirm:** install the PWA on an iPhone, Preferences → Account → Download my data; verify a file is actually saved (not just opened).
- **Fix if broken:** fall back to opening the JSON in a new tab / share-sheet on iOS standalone, or offer a "copy to clipboard" path. Low-severity but it's the portability promise on `/privacy`.

### P3 — Lockout + rate-limit state is in-process (resets on deploy, per-replica)
`loginLockout` and `@fastify/rate-limit` both use an in-memory store (`ponytail`-noted). Counters reset on every deploy and are **not shared across replicas**.
- **Impact if >1 replica:** the effective lockout/limit multiplies by the replica count (attacker's attempts spread across instances).
- **Confirm:** Railway service replica count. If 1, this is latent; if/when it scales out, it's live.
- **Fix when it matters:** move the `FailureStore` + rate-limit store to Redis/Postgres (the interface is already the seam). Tie this to the same Upstash enablement that reports/purge need.

---

## Informational / accepted (no action, recorded so it isn't "discovered" later)
- **I1 — Access token survives logout/password-change/device-revoke for ≤15 min.** Standard JWT trade-off; only refresh tokens are revoked server-side. Mitigation = the 15-min TTL; documented in the logout handler. Acceptable; note it exists.
- **I2 — Register is read-then-insert on email.** The `trainers.email` UNIQUE constraint makes the TOCTOU race safe (second insert throws → 500). Only nit: a concurrent collision returns 500 instead of the clean 409. Cosmetic.

---

## Agency (WS2) — summary
The user has genuine control: see/revoke every device, change password (ending other sessions), change email (reversible, old address keeps working), **export everything**, and deactivate with a 30-day restore before irreversible purge. Export completeness and the restore window are real, verified strengths. The one gap is **consent capture (D3)** — the user agrees to terms with no durable record of having done so.

## Product-story ↔ UX fidelity (WS4) — deviations as insight
Fidelity to `product-synthesis.md` is high: athlete-as-atom, offline-first, install-after-first-session, no-AI, email-only reports — all shipped as described. The deviations are all **the monetization layer, which is simply not built yet (v3)** and are insight, not defects:
- **"Athlete upgrade path = settings toggle with paywall"** (resolved decision #2): not shipped — trainer-mode switching is deferred and the Preferences "Training Mode" section is display-only.
- **"Pro subscription required (billing gate at 14-day trial end)"** (trainer value chain): billing gates are documented, **not enforced**. Every beta account is free.
- **Net:** today there is no "paid user" — the audited surface is the *account infrastructure that will carry paid users*. It is ready for a billing layer to attach (see below). This is the correct state for pre-v3, not a gap to fix.

---

## Forward-readiness (grounded in existing code; not auditing absent code)

### Email activation checklist (turns D2 from a risk into a punch-list)
Wired end-to-end today, inert only for lack of config:
- Verification (register fire-and-forget + `/auth/send-verification` resend, 60 s cooldown), **advisory** (login does not require it).
- Password reset (`/auth/forgot-password` → `/auth/reset-password`), always-202, SHA-256 single-use token, signs out all devices on reset.
- Change-email (`PATCH /auth/email`) — confirmation mailed to the **new** address; swap is **bound to the token's `new_email`**, so a token mailed to the old address can never perform the swap; old address notified.
- Lockout notice email on just-locked.

**To activate:** set `RESEND_API_KEY`, `REPORT_FROM_EMAIL=no-reply@just-train.fit`, `APP_URL=https://www.just-train.fit` on Railway; verify `just-train.fit` in Resend. **Then re-test:** forgot→reset round-trip, change-email confirm + old-address notice, registration verification link, a forced lockout notice. Until then, prefer D2(b) honest copy over the current silent 202.

### v3 billing attach points (where a gate hooks; what must not break)
- **Fields already present:** `trainers.subscriptionTier` / `subscriptionStatus`, and the `trainer_usage_monthly` meter — the data model is ready.
- **The seam:** gate in the `authenticate`/`requireRole` layer (or a small `requireTier` preHandler), *not* in the routes ad hoc.
- **Hard invariant the future plan MUST honour:** **admin bypasses every gate** — `isGated = tierCheck && role !== 'admin'` (owner `role='admin'` via one-off SQL; see memory `trainer-owner-admin-full-access`). The owner must stay full-access after paid tiers land.
- **What must not break:** tier/status must remain **un-settable via `PATCH /auth/me`** (the whitelist is the guard today). A tier change must flow only through a payment-verified path (Stripe webhook → server-side mutation). Keep `UpdateTrainerSchema` free of `subscriptionTier`/`subscriptionStatus`/`role` forever.

---

## Prioritized actions
| # | Finding | Class | Priority | Action |
|---|---|---|---|---|
| D2 | Email recovery inert in prod | DEFINITE | **High** | Configure Resend + verify domain (or honest interim copy) |
| D1 | `COOKIE_SECRET` default | DEFINITE | **High** | Set env + fail-fast guard in prod |
| D3 | Consent not recorded | DEFINITE | Medium | Consent checkbox + `termsAcceptedAt`/version column |
| P1 | XFF/`trustProxy` key | CONFIRM | Medium | Curl-confirm direct spoof; set `trustProxy:<n>` if so |
| P3 | In-process lockout/limit | CONFIRM | Medium | Confirm replica count; Redis store before scale-out |
| P2 | iOS export download | CONFIRM | Low | On-device check; share-sheet fallback if broken |
| I1/I2 | Access-token window / register 500 | INFO | — | None (recorded) |
