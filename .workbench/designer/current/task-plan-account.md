# Account & Profile — Task Plan (Phase 19 track)
**Goal:** a signed-in user can do to their own account what any app is expected to allow — and what `/privacy` already promises: change and recover their password, change their email, see and revoke their devices, export their data, and delete their account.
**Written:** 2026-09-15 · **Status:** CONFIRMED (designer, 2026-09-15) — soft delete, no verification gating before Go Live, order A1→A5→B6→B8; lockout defaults confirmed.
**Progress (2026-09-15):** A1–A5 ✅ live in prod · B6 ✅ · B7 ✅ (both code-complete, prod migrations applied; **inert until `RESEND_API_KEY` / `REPORT_FROM_EMAIL` / `APP_URL` are set** — waits on Resend verification of `just-train.fit`) · B8 ✅ recorded (SECURITY.md G14) · C9 ✅ lockout built (in-process store — the plan's Redis assumption was wrong: no Redis client in the repo; `FailureStore` is the seam) · **Turnstile next** (own step, needs a package).
**B7 as built (differs from the sketch below):** the swap is bound to the *token* (`email_verification_tokens.new_email`), not to `trainers.pending_email` — a plain-verification token mailed to the old address can never perform the swap. `pending_email` is display/cancel only. The old address is notified on swap.
**Origin:** Security gate item 4f (`docs/SECURITY.md` → "Account surface"). Every capability below is a `DEFERRED_ITEMS` entry today.

## What exists (verified in code)
- `PATCH /auth/me` — name, unit, preferences; privileged fields cannot be set (mass-assignment guard).
- `POST /auth/onboard` — re-callable to switch mode.
- `POST /auth/logout` (this device) and `/auth/logout-all` (every device). Refresh tokens rotate per use; `refresh_tokens` has `device_id`, `device_name`, `last_used_at`.
- Email verification — built end-to-end (token table, send, verify page, banner), **advisory**, sends silently fail without `RESEND_API_KEY`.
- `PrivacyPage` §Retention and §Your rights promise **deletion, erasure and portability** (the sections are still marked `[PLACEHOLDER]` for legal wording, but the promises are on the live page).

## Email — the dependency that splits this plan
Reset-password and change-email need a working sender. Resend only sends to *your own* address from its sandbox domain; real users need a **verified domain** — the same gate as the product name. Two ways through:
- **(a) Wait** — build the code now behind the existing "send fails silently" pattern; activate when the domain exists. Reset-password stays effectively unavailable until then.
- **(b) Interim sending domain** — verify any domain you already own (or a cheap throwaway) in Resend, set `REPORT_FROM_EMAIL` + `APP_URL` (the vercel.app origin), and swap to the real domain later. One DNS change to undo. **Recommended if Go Live is before the name is settled**: a public app without password recovery is a support problem on day one.
**Resolved 2026-09-15:** the domain exists — `just-train.fit`. Neither (a) nor (b): verify `just-train.fit` in Resend, `REPORT_FROM_EMAIL=no-reply@just-train.fit` (or similar), `APP_URL=https://just-train.fit` once DNS is cut over (the vercel.app origin until then). Track B is buildable and activatable.

## Tracks and order

### A — no email dependency (build first)
1. **Change password** *(low)* — `PATCH /auth/password { currentPassword, newPassword }`: verify current (argon2), hash new, update, **revoke every other device's refresh token** (keep the caller's). Rate limit 5/15 min. Tests: 401; wrong current → 400 (same message as bad credentials, no oracle); success; other tokens revoked, own kept. UI: Preferences → Account → Change password.
2. **Devices** *(low–medium)* — `GET /auth/devices` (this trainer's `refresh_tokens`: `deviceId`, `deviceName`, `lastUsedAt`, `createdAt`, `current`) and `DELETE /auth/devices/:deviceId` (revoke that device). Tests: ownership (cannot revoke another trainer's device id → 404); current flag. UI: Preferences → Account → Devices, with "Sign out everywhere" (existing `/logout-all`).
3. **Refresh-token reuse detection** *(medium, design decision inside)* — rotation currently **deletes** the old row, so a replay is indistinguishable from an unknown token. Change: on rotate, mark the old row `revoked_at` + `replaced_by` instead of deleting (one nullable column + reuse `revoked_at` if present); on refresh, a presented token that matches a **revoked** row = reuse → revoke the whole family for that trainer, 401. Cleanup job deletes revoked rows older than the refresh TTL (the "Refresh Token Cleanup Job" deferred item — do together). Tests: replay → all sessions revoked. Needs a migration if `replaced_by` is added.
4. **Export my data** *(medium)* — `GET /auth/export` → one JSON document: trainer (minus hash), clients, goals, snapshots (+media URLs), sessions → session-exercises → sets, templates, challenges, preferences. Rate limit 3/hour. Streamed or built in memory? At current volumes in memory; `ponytail:` note with the ceiling. UI: Preferences → Account → "Download my data". Satisfies portability.
5. **Delete account** *(medium–high)* — `DELETE /auth/me { password }` (re-auth), then: (i) Cloudinary media for the trainer's clients (folder prefixes `trainer-app/clients/<clientId>/…`) queued for deletion via BullMQ — best-effort, retried, never blocks the delete; (ii) DB delete of the `trainers` row — cascades cover clients → goals/snapshots/sessions/…/sets, templates, challenges, refresh tokens, verification tokens, client_events; **one FK blocks it:** `client_snapshots.captured_by → trainers ON DELETE restrict` — change to `set null` (migration) or delete snapshots explicitly first; (iii) private exercises owned by the trainer: `session_exercises.exercise_id` is `restrict` — delete the trainer's sessions first (cascade from clients handles it) then their private exercises; public library untouched; (iv) clear the refresh cookie, 204. UI: Preferences → Danger zone → type the word + password. Tests: wrong password → 400, nothing deleted; success order; snapshots FK. **Also**: write the `[PLACEHOLDER]` retention numbers on `/privacy` for real (media within N days).

### B — email-dependent (build now, live when the sender exists)
6. **Forgot / reset password** *(medium)* — `password_reset_tokens` (SHA-256 of a 48-byte token, 1-hour TTL, single use — same design as verification tokens, same reasons), `POST /auth/forgot-password { email }` (always 202; rate limit 5/15 min per IP; sends the link `${APP_URL}/reset-password?token=…`), `POST /auth/reset-password { token, newPassword }` (consumes token, sets hash, **revokes all devices**). Pages: `/forgot-password`, `/reset-password`. Tests: unknown email still 202; expired/used token → 400; success revokes sessions. Migration.
7. **Change email** *(medium)* — `PATCH /auth/email { newEmail, password }` → store `pending_email` + send verification to the **new** address; `GET /auth/verify-email` on that token swaps `email`, sets `emailVerified=true`, clears pending. Old address keeps working until verified — a typo cannot lock anyone out. Migration (`pending_email`). Tests: duplicate email → 409; swap on verify.
8. **Enforce verification** *(low, decision)* — what is gated for an unverified account? Recommendation: nothing before Go Live except sending emails to *others* (reports); revisit at 3.0. Record the decision.

### C — decisions
9. **Account lockout / CAPTCHA** — proposal below (§Lockout); awaiting confirmation.

## Decisions recorded 2026-09-15 (designer)
- **Delete = soft.** `DELETE /auth/me { password }` sets `deactivated_at` (new column) → login and refresh blocked, data invisible, cookie cleared. A daily BullMQ job purges accounts deactivated ≥ 30 days (Cloudinary folders, then the `trainers` row → cascades; `client_snapshots.captured_by` FK → `set null` migration). Logging in within 30 days offers **restore** (clears `deactivated_at`). Hard purge = first **admin** utility.
- **Verification gates nothing before Go Live.** Stays advisory; reset-password proves the mailbox anyway. Revisit at 3.0.
- **Email sender:** `just-train.fit` acquired — Resend domain verification + `APP_URL` at DNS cut-over (on hold until the domain is set up).
- **Order:** A1 → A5, then B6 → B8.

## Admin interface (new, from the delete decision)
First utility: list deactivated accounts + hard purge now. Recommended shape: `apps/admin` — a separate, tiny Vite app in the monorepo on **its own origin** (`metzger.just-train.fit` — designer's choice 2026-09-15: an unguessable name is a useful extra layer on top of `requireRole('admin')` + Vercel deployment protection, never the lock itself; its own Vercel project with the same `/api` rewrite), talking to `/api/v1/admin/*` routes guarded by the existing `requireRole('admin')`. `role = 'admin'` is set only via SQL (the mass-assignment guard means there is no self-promotion path). Why a separate origin rather than `/admin` in the app: admin code never ships in the user bundle; its own CSP and cookie scope; Vercel's deployment protection / IP allow-list can sit in front of it; the blast radius of an admin XSS is the admin origin, not the app. Cost: one more Vercel project and a second shell — kept small by reusing `packages/shared` and one `AdminLayout`. Second utilities, later: account search, public-library curation, telemetry counters.

## Lockout — proposal (§C9)
**Threat model:** (1) online guessing against one known account; (2) credential stuffing — many accounts, one or two passwords each, from many IPs; (3) bot registration. Three different controls.
- **Per-email soft lock:** 5 consecutive failures → 15 minutes. Counted for **unknown emails too** (same counter, same message) so the lock does not reveal whether an account exists. Fixed window rather than exponential: simpler to explain in the UI ("try again in 12 minutes") and 5×15 min already makes online guessing hopeless (≈480 guesses/day). Reset on success.
- **Victim-lockout problem:** per-email locks let an attacker lock *you* out of your own account by failing 5 times. Mitigation: the lock applies to password login only — a valid refresh cookie keeps an existing device signed in — and the notice email (once mail is live) tells the owner what happened. If this becomes a real nuisance, the escalation is CAPTCHA-instead-of-lock (see below), not a longer lock.
- **Per-IP:** keep the existing `POST /auth/login` 10/15 min rate limit; add a *failure* counter per IP (20/15 min) so a stuffing run gets 429 before it gets far. `X-Forwarded-For` is trustworthy behind Vercel's proxy → Railway; verify `trustProxy` is set.
- **Storage:** Redis (Upstash, already present for BullMQ) — `login:fail:email:<sha256(email)>` and `login:fail:ip:<ip>` with TTL; no migration, no PII in keys. In-memory fallback when `UPSTASH_REDIS_URL` is unset (dev), documented as such.
- **Notification:** on lock, email the account ("5 failed sign-in attempts; if this wasn't you, change your password") — once the sender exists. No email → log at `warn` only.
- **CAPTCHA (Cloudflare Turnstile, free):** on **register** always (bot signups are the cheapest attack); on **login** adaptively after the 3rd failure for that email or IP. Works in the installed PWA (it is a normal widget); needs a site key + `TURNSTILE_SECRET` server-side. Builds as its own step after the lock.
- **Response shape:** locked → `423 Locked` with `retryAfterSeconds`; the UI shows a countdown rather than a generic error.
- **Tests:** 5th failure locks; success resets; unknown email locks identically; lock expires; per-IP 429; log line emitted.
**Confirmed 2026-09-15 (defaults):** threshold 5 · window 15 min · per-IP failure cap 20/15 min · Turnstile register-always / login-adaptive.

## Execution order
1 → 2 → 3 → 4 → 5 (all shippable without the domain) → 6 → 7 → 8 → 9. Each with tests first, CHANGELOG, and the 4-file rule for any column. Migrations: 3 (`replaced_by`), 5 (`captured_by` → set null), 6 (`password_reset_tokens`), 7 (`pending_email`) — generated on the Mac, prod via psql, **lockfile if any package changes**.

## Vet — the doubtful parts
- **Delete-order correctness** (5): cascades are the claim; the *test* is the proof. Write the delete as an explicit ordered transaction rather than trusting cascade discovery, and test the `captured_by` restrict is gone.
- **Reuse detection false positives** (3): two tabs refreshing at once with the same token is a legitimate race, not an attack. Mitigation: a short grace window (≈10 s) where a just-rotated token is accepted once more; document it.
- **Export size** (4): a trainer with a year of sets is tens of thousands of rows — fine in memory today; the `ponytail` marks the ceiling.
- **Email (b)** puts a throwaway domain in users' inboxes; acceptable for a pre-launch cohort, not for launch.

## Not in this plan
2FA / passkeys (post-3.0); social login (never planned — private by default); admin impersonation.
