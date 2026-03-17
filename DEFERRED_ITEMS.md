# Deferred Items

Items that were discussed but intentionally deferred to a later phase.
Revisited at the start of each phase conversation.

---

## Deferred in Phase 1

### Password Reset Flow
**What:** Forgot password → generate a signed short-lived token → email it → verify on a reset endpoint → allow new password to be set.
**Why deferred:** Single-trainer app doesn't need it yet. No email infrastructure in scope.
**When to revisit:** Phase 2 or whenever a second trainer is onboarded.
**Notes:** Add `password_reset_tokens` table (token_hash, expires_at, used_at). Wire to an email provider (Resend or SendGrid are lightweight choices).

### Email Verification
**What:** Send verification link on register → user must click it → `email_verified` flips to `true` → unverified accounts have restricted access.
**Why deferred:** Single known trainer — no risk of fake registrations. Column (`email_verified`) is already in the schema as a boolean (defaults `false`).
**When to revisit:** When registration is opened to multiple trainers or the public.
**Notes:** `email_verified` is already on the `trainers` table and in `TrainerResponseSchema`. Auth routes set it `false` on register but do not gate access on it yet. Gating it is a one-line check in the register/login route.

### Device Management UI
**What:** A settings page listing all active sessions ("Chrome on iPhone", "Safari on MacBook") with the ability to revoke individual ones.
**Why deferred:** Infrastructure is fully in place — `refresh_tokens` table has `device_id`, `device_name`, `last_used_at`. Only the UI page is missing.
**When to revisit:** Phase 5 or later when building the settings/profile UI.

---

## Deferred in Phase 2

### Password Reset Flow
*(carried forward from Phase 1 — still deferred)*

### Email Verification Flow
*(carried forward from Phase 1 — still deferred)*

### Invite-Only Registration
**What:** Restrict `POST /auth/register` to require an invite token. An admin generates invite links; new trainers can only register via a valid link.
**Why deferred:** Only one trainer currently. Open registration is fine for now.
**When to revisit:** When opening the platform to additional trainers.
**Notes:** Add `invite_tokens` table. The register endpoint checks for a valid, unused token before creating the account.

### Trainer Profile Edit Endpoint
**What:** `PATCH /auth/me` — allow the trainer to update their name, email, `weightUnitPreference`, and password.
**Why deferred:** Not blocking any Phase 2 functionality.
**When to revisit:** Phase 3 or 4 alongside a settings/profile UI page.
**Notes:** Password change should require `currentPassword` + `newPassword`. Email change should re-set `email_verified = false` (once email verification is implemented).

### Token Reuse Detection
**What:** If a refresh token that has already been rotated is used again (i.e. it was stolen and the attacker is trying to use it after the legitimate user already rotated it), fully terminate the trainer's session on all devices.
**Why deferred:** The rotation strategy already provides strong protection. Full reuse detection adds complexity (tracking `last_used_at` comparisons and session revocation cascade) that isn't warranted for a single-trainer app.
**When to revisit:** If the app becomes multi-trainer and higher security stakes apply.
**Notes:** The `last_used_at` column is already on `refresh_tokens` for this purpose. The detection logic would go in `findAndVerifyRefreshToken` in `auth.service.ts`.

### Refresh Token Cleanup Job
**What:** A cron job (or Railway scheduled task) that periodically deletes expired and revoked refresh token rows from the DB.
**Why deferred:** The table is small for a single trainer. Row accumulation is not a problem yet.
**When to revisit:** Phase 6 or when setting up production infrastructure.
**Notes:** Simple query: `DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked_at IS NOT NULL`.

### Admin Role Endpoints
**What:** Routes gated to `requireRole('admin')` for managing other trainer accounts, viewing usage, billing etc.
**Why deferred:** No admin-only features exist yet.
**When to revisit:** Whenever multi-trainer management is needed.
**Notes:** The `requireRole` middleware is already built and ready to use. The `admin` role is in the DB schema and JWT payload. Adding a protected admin route is a one-liner.

### HTTPS / TLS in Local Development
**What:** Run the dev server over HTTPS so that `secure: true` cookies work locally (the httpOnly refresh token cookie has `secure: false` in development as a workaround).
**Why deferred:** The dev workaround (`secure: process.env.NODE_ENV === 'production'`) is safe for local development and well-understood.
**When to revisit:** If testing cookie behavior precisely in a staging environment.
**Notes:** `mkcert` is the simplest way to get a locally trusted TLS certificate for Vite + Fastify.

---

## How to Use This File

At the start of each phase conversation, review this list:
- Items that are now in scope get built into that phase.
- Items that remain deferred are carried forward with updated notes.
- New items discovered during the phase are added under that phase's heading.

---

## Deferred in Phase 3

### Media Upload Retry / Progress
**What:** Show upload progress bar during Cloudinary upload. Retry failed uploads automatically.
**Why deferred:** The current UX (spinner during upload, error message on failure) is functional. Progress tracking requires streaming upload with XMLHttpRequest, adding complexity.
**When to revisit:** Phase 5 UX polish pass.

### Exercise "In Use" Guard on Delete
**What:** Block deletion of an exercise that is referenced by active sessions or templates, and show the trainer which sessions/templates use it.
**Why deferred:** The backend currently allows deletion. Sessions store a nullable exerciseId — deleted exercises show as `null` (graceful degradation).
**When to revisit:** Phase 4-5 when session and template UIs are built. A warning modal is the right UX ("This exercise is in 3 sessions — delete anyway?").
**Notes:** Query `session_exercises` and `template_exercises` for any row matching the exerciseId before deleting.

### Exercise Duplicate / Copy
**What:** "Duplicate exercise" button creates a copy with "(copy)" appended to the name.
**Why deferred:** Low priority — trainers can create manually.
**When to revisit:** Phase 5 UX pass.

### Public Exercise Library
**What:** `isPublic = true` exercises are visible to all trainers (future multi-trainer).
**Why deferred:** Single-trainer for now. The column and flag exist in the schema.
**When to revisit:** When multi-trainer support is added.

### Video Thumbnail Preview
**What:** Show a video poster/thumbnail in the media gallery instead of just a play button.
**Why deferred:** Cloudinary generates video thumbnails automatically — just need to request the correct URL format.
**When to revisit:** Phase 5 media polish.

### Body Parts Admin
**What:** UI for the trainer to add/edit body parts beyond the seeded list.
**Why deferred:** The seeded list (arms, back, chest, legs, shoulders, core, full_body) covers all standard training. Custom body parts are an edge case.
**When to revisit:** If the trainer requests it.

---

## Deferred in Phase 3C

### Subscription Billing Gate (Free vs Pro)
**What:** Block `POST /clients` for trainers on the `free` subscription tier. Free tier = self-training only (isSelf client only). Pro/Studio = unlimited external clients.
**Why deferred:** No payment infrastructure yet. Stripe integration is planned for the SaaS phase.
**When to revisit:** SaaS phase — when Stripe is integrated and subscription management UI exists.
**Notes:** The check location is documented in `routes/clients.ts` as a comment. Schema is ready: `trainers.subscriptionTier` and `trainers.subscriptionStatus` are already present. The gate is a single check:
```typescript
if (trainer.subscriptionTier === 'free') {
  return reply.status(402).send({ error: 'Upgrade to Pro to add external clients', code: 'SUBSCRIPTION_REQUIRED' })
}
```

### Nutrition Tracking
**What:** Full calorie and macro tracking per session or per day, with trends in the monthly report.
**Why deferred:** Too tangential for a training-focused app. Risk of becoming a half-baked MyFitnessPal clone.
**When to revisit:** Only if users consistently request it, and only as a separate, well-scoped feature.
**Notes:** Two lightweight hooks are already present as placeholders: `clients.caloricGoal` (int, kcal/day intent) and `clientSnapshots.clientNotes` / `trainerNotes` (free-text nutrition observations). These are sufficient for Phase 7.5 reports.

### Per-Session Subjective Score UI
**What:** A 3-tap modal at the end of every session to capture `energyLevel`, `mobilityFeel`, `stressLevel` (1–10 each).
**Why deferred:** Schema and API are ready (columns on `sessions` table, included in `UpdateSessionSchema`). The UI component is a Phase 5 concern.
**When to revisit:** Phase 5 — end-of-session flow.

### Monthly Report Email (Resend)
**What:** Trainer clicks "Send Monthly Report" → backend computes KPIs → renders HTML email → sends via Resend API.
**Why deferred:** Requires KPI computation (Phase 7) and a working session history (Phase 6) to have meaningful data to report.
**When to revisit:** Phase 7.5 — after KPI dashboard is built.

### Client Portal / Magic Link
**What:** Report email contains a time-limited token that drops the client into a read-only view of their own data. No client login — just a magic link.
**Why deferred:** No client login exists and won't until post-SaaS if ever. The report-as-email design is sufficient for now.
**When to revisit:** Post-SaaS phase, if clients request it or it becomes a differentiator.
**Notes:** The hook is already designed: the monthly report endpoint (Phase 7.5) can include a signed token in the email URL. The token would resolve to a read-only API endpoint scoped to a single client. No new DB changes needed — just a token table and a public route.

---

## Deferred in Phase 3D

### Usage Monthly Population Strategy
**What:** Populating `trainer_usage_monthly` rows with accurate counts.
**Why deferred:** Billing infrastructure doesn't exist yet — no point running a job that writes to a table nothing reads.
**When to revisit:** SaaS billing phase, when Stripe integration begins.
**Options:**
- **Option A (recommended first):** Nightly background job recalculates the current month's row from raw data. Simple, always accurate, tolerant of backfills.
- **Option B (lower latency):** Increment counters in-place on each relevant API event (session completed → sessionsCompleted++). Faster to query but requires careful transaction handling.
**Notes:** The `trainer_usage_monthly` table schema is complete. The unique constraint on `(trainerId, periodYear, periodMonth)` supports upsert. When ready, add a `POST /internal/usage/recalculate` admin endpoint that runs Option A.

### Billing Gate Matrix
The following combinations determine feature access. Not yet enforced — document here for SaaS phase reference.

| trainerMode | subscriptionTier | Active client limit | Reports | KPI history |
|---|---|---|---|---|
| athlete | free | 1 (self) | No | 30 days |
| athlete | pro | 1 (self) | Yes (self) | Unlimited |
| trainer | free | 3 external | No | 30 days |
| trainer | pro | 20 external | Yes | Unlimited |
| trainer | studio | Unlimited | Yes | Unlimited + team |

**Gate location:** `POST /clients` for client limit. Report dispatch for report gate. History queries for date range gate.

### Email/Password Change Flow
**What:** Let trainers update their email or password from the profile settings page.
**Why deferred:** Single known user, low risk. Requires email verification loop for email changes.
**When to revisit:** Phase settings UI — after Phase 7 when a profile/settings page is built.

### trainer_mode Switch After Onboarding
**What:** Allow a trainer to switch from `athlete` to `trainer` mode (or back) after they've been using the app.
**Why deferred:** Edge case — most users won't switch. Switching from `athlete` to `trainer` needs to surface the client roster UI; switching back needs to hide it cleanly.
**When to revisit:** Settings page phase. The `PATCH /auth/me` endpoint can already update `trainerMode` — it's purely a UI concern.

---

## Deferred in Phase 4 (Preferences)

### Preferences Screen — Phase 4.5
**What:** A dedicated Preferences screen accessible from the nav or profile menu.
**Contains:**
  - CTA label picker (select from CTA_LABEL_OPTIONS or type custom)
  - Alert toggle (alertsEnabled on/off)
  - At-risk alert customization: color scheme, message tone
  - Widget progression editor: draggable list with hamburger handle, enable/disable toggles
  - Dashboard density (compact / comfortable / spacious) — future
  - Mood/accent color override — future
**Where stored:** trainer record fields: `ctaLabel`, `alertsEnabled`, `widgetProgression`
**How saved:** `PATCH /auth/me` — each preference saves immediately on change (no "Save" button needed, each toggle/select is instant)
**When to revisit:** After dashboard is built so the preview is meaningful while editing

### Widget Drag-to-Reorder on Dashboard
**What:** Trainer can drag dashboard tiles to reorder them directly on the dashboard. 
**Syncs with:** The preferences list editor — both write the same `widgetProgression` string.
**Implementation:** Use `@dnd-kit/core` — lightweight, accessible, works on touch/mobile.
**When to revisit:** Phase 4.5, after preferences screen is built.

### Mood / Reactive UI System
**What:** A theme layer the trainer can tune. Controls alert color, UI density, accent override.
**Design principle:** Every preference that affects visual style passes through a `moodConfig` object derived from preferences, consumed by components via a `useMood()` hook.
**When to revisit:** Phase 4.5 or later — needs the preferences screen first.

### At-Risk Alert Customization
**What:** Trainer can change the alert's color scheme and message tone.
**Color schemes:** default (amber), urgent (red), calm (blue), motivating (green)
**Message tone:** clinical ("2 clients inactive"), motivating ("Time to check in"), firm ("Action required")
**Stored as:** Two additional preference fields — `alertColorScheme` and `alertTone` — to add in Phase 4.5.
**When to revisit:** Phase 4.5 preferences screen.

---

## Deferred in Phase 5 (v1.5.x)

### ESLint Setup
**What:** Proper ESLint configuration across all three packages (shared, backend, frontend) with TypeScript-aware rules.
**Why deferred:** ESLint was never properly installed as a devDependency — it was working by accident through hoisting. Lint scripts have been replaced with no-ops in all three package.json files to unblock CI.
**When to revisit:** Dedicated "code quality" version — not a hotfix.
**What's needed:**
- Add `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin` as devDependencies in `apps/backend` and `apps/frontend`
- Add `eslint-plugin-react`, `eslint-plugin-react-hooks` to frontend
- Create `.eslintrc.js` or `eslint.config.js` in each app
- Restore lint scripts from `echo '...'` back to `eslint src --ext .ts`
- Consider a root-level shared ESLint config in `packages/eslint-config/`
- Shared package can remain as `echo` since tsc covers it fully

### vi.mock Hoisting Audit
**What:** Full audit of all test files to ensure no module-level variables are referenced inside `vi.mock()` factory functions.
**Why deferred:** Fixed in exercises.test.ts (inline `chain`) and auth.test.ts (inline refresh token object). Other test files may have the same latent issue that CI catches but local testing misses.
**When to revisit:** Before adding new test files — establish a linting rule (eslint-plugin-vitest) that flags this pattern automatically.

---

## Deferred in Phase 7 (v1.7.0)

### SMS Report Delivery
**What:** Send the monthly report as a text message (SMS) when the client has no email on record, or as an alternative delivery option.
**Why deferred:** Requires a third-party SMS provider (Twilio, Vonage, etc.), phone number verification, and consent management. Adds meaningful cost per message.
**When to revisit:** When the app has paying clients who need SMS. The phone number field is already captured on client records.
**What's needed:**
- Choose SMS provider (Twilio recommended)
- Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` to `.env`
- Build `sms.service.ts` with a plain-text report variant
- Add SMS option to the report send flow when email is missing

### Report Scheduling
**What:** Trainer can schedule reports to auto-send on the 1st of each month for all active clients.
**Why deferred:** Requires a job queue (Redis + BullMQ, Phase 7.5) and per-client opt-in settings.
**When to revisit:** Phase 7.5 when BullMQ is added.
