# Deferred Items

Items intentionally deferred, with notes on when to revisit.
Reviewed and updated March 2026.

---

## How to Use This File

At the start of each phase, review this list:
- Items now in scope get built into that phase
- Items still deferred are carried forward with updated notes
- New deferred items from the current phase are added at the bottom

---

## Auth & Security

### Password Reset Flow
When: Settings UI phase (post-v2.x)
What: Forgot password → signed short-lived token → email → verify → set new password
Notes: Add `password_reset_tokens` table. Wire to Resend (already integrated).

### Email Verification
When: When registration opens to multiple trainers
What: Verify email on register. `email_verified` column already exists on trainers table, defaults false. Gate is one line in auth routes.

### Invite-Only Registration
When: Multi-trainer launch
What: Restrict `POST /auth/register` to require an invite token. Add `invite_tokens` table.

### Token Reuse Detection
When: Multi-trainer + higher security stakes
What: If a rotated refresh token is replayed, terminate all sessions for that trainer. `last_used_at` column already exists for this purpose.

### Refresh Token Cleanup Job
When: Production infrastructure setup
What: Cron job deletes expired/revoked refresh token rows.
Query: `DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked_at IS NOT NULL`

### Device Management UI
When: Settings UI phase
What: List active sessions by device, with individual revoke buttons. Infrastructure complete — `refresh_tokens` has `device_id`, `device_name`, `last_used_at`. UI only.

### HTTPS in Local Dev
When: If cookie behaviour needs precise local testing
What: `mkcert` for locally-trusted TLS. The dev workaround (`secure: NODE_ENV === 'production'`) is safe and well-understood.

---

## Trainer Profile & Settings

### Trainer Profile Edit
When: Settings page (post-v2.x)
What: `PATCH /auth/me` — name, email, weightUnitPreference, password. Email change re-sets `email_verified = false`. Password change requires `currentPassword` + `newPassword`.

### Trainer Mode Switch After Onboarding
When: Settings page
What: Let trainer switch between `athlete` and `trainer` mode. `PATCH /auth/me` already supports updating `trainerMode`. UI concern only.

### Admin Role Endpoints
When: Multi-trainer management
What: Routes gated to `requireRole('admin')`. Middleware built, role in schema and JWT. Adding a protected admin route is one line.

---

## Exercise Library

### Visualization Content (Phase 9)
When: Post-SPA refactor (v2.5.0 or later)
What: Populate `exercises.visualization` with muscle-group highlight images (like gym machine diagrams). Schema column exists, currently null in seed.
Options: AI-generated SVG, licensed library (Muscle & Motion), commissioned art.

### Demonstration Content (Phase 9)
When: Post-SPA refactor
What: Populate `exercises.demonstration` with video URLs showing proper form. Schema column exists, currently null.

### Exercise "In Use" Guard on Delete
When: v1.9.x polish
What: Block deletion if exercise is referenced by active sessions or templates. Show which sessions/templates use it. Currently gracefully degrades to null.

### Exercise Duplicate / Copy
When: UX polish pass
What: "Duplicate exercise" creates a copy with "(copy)" appended. Low priority.

### Video Thumbnail Preview
When: Media polish pass
What: Cloudinary generates thumbnails automatically — just need correct URL format.

### Body Parts Admin UI
When: If trainer requests it
What: Add/edit body parts beyond the seeded list. The seeded 7 cover all standard training.

### Public Exercise Library (Multi-trainer)
When: Multi-trainer launch
What: `isPublic = true` exercises visible across all trainer accounts. Schema and query already support this. Currently scoped to `trainerId = current OR trainerId IS NULL`.

### Media Upload Retry / Progress
When: UX polish pass
What: Progress bar during Cloudinary upload, auto-retry on failure. Requires XMLHttpRequest streaming.

---

## Session & Workout

### Post-Session Wrap-Up
When: After session planning is built (v2.2.0+)
What: Lightweight end-of-session flow:
- Name/describe draft exercises created mid-session
- Add notes to exercises and the session overall
- Preview adjustments for next session
- Subjective scores UI (energyLevel, mobilityFeel, stressLevel — schema ready)

### Draft Exercise Enrichment Queue
When: v1.9.x — alongside exercise library UI
What: Indicator on Exercises page for isDraft=true exercises. Click to enrich inline. Currently invisible to the trainer after creation.

### Offline Sync (v2.4.0)
When: After SPA refactor
What: IndexedDB + Workbox service worker. Sets logged offline queue to sync when connectivity returns. BullMQ workers already handle server-side processing. Frontend queue (pendingSets) is stubbed in sessionStore.
Complexity: High. Do after SPA architecture is stable.

### Session Metrics — Duration, Cardio Fields
When: Session planning build (v2.1.0)
What: Distance, time, pace tracking for cardio. Time-based holds for stretching and cooldown. Schema has fields; UI not built.

---

## SPA Architecture (v2.0.0 sequence)

### Observable Navigation Service (v2.3.0)
When: After SPA refactor ships (v2.0.0)
What: Replace React Router location-state navigation with RxJS observable stream. Every panel open/close is a stream emission. Solves rapid open/close race conditions, gives single auditable navigation log.
Why deferred from v2.0.0: SPA refactor + observable layer simultaneously = too many moving parts, no working increments.
How to migrate: Nav is abstracted as a service from day one in v2.0.0. Swap the underlying implementation in v2.3.0 without touching call sites.

### Android Back Button Edge Cases
When: Post-observable migration
What: React Router location state handles ~90% correctly. The remaining edge cases (rapid panel interactions, deep nested overlays) are solved by the observable system.

---

## Reporting & Comms

### SMS Report Delivery
When: When app has paying clients needing SMS
What: Twilio integration for sending monthly reports as text when client has no email. Phone number already captured on client records.
Needs: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `sms.service.ts`, plain-text report variant.

### Client Portal / Magic Link
When: Post-SaaS
What: Report email contains a time-limited token → client gets read-only view of their own data. No client login needed. Token table + public read-only API route.

---

## SaaS & Billing (v3.0.0)

### Subscription Billing Gate
When: Stripe integration
What: Block `POST /clients` for free-tier trainers (self-only). Schema ready: `trainers.subscriptionTier`, `trainers.subscriptionStatus`.
Gate location documented in `routes/clients.ts`.

### Usage Monthly Population
When: Billing phase
What: Nightly job recalculates `trainer_usage_monthly` rows. Table schema and unique constraint on `(trainerId, periodYear, periodMonth)` ready for upsert.

### Billing Gate Matrix (reference)

| trainerMode | subscriptionTier | Client limit | Reports | KPI history |
|---|---|---|---|---|
| athlete | free | 1 (self) | No | 30 days |
| athlete | pro | 1 (self) | Yes (self) | Unlimited |
| trainer | free | 3 external | No | 30 days |
| trainer | pro | 20 external | Yes | Unlimited |
| trainer | studio | Unlimited | Yes | Unlimited + team |

---

## Dashboard & Preferences

### Preferences Phase 4.5
When: After dashboard is stable
What: Full preferences screen — CTA label picker, alert customization, widget drag-to-reorder, mood/accent color override.

### Widget Drag-to-Reorder
When: Preferences screen phase
What: `@dnd-kit/core` for draggable dashboard tiles. Syncs with preferences list editor via `widgetProgression`.

### At-Risk Alert Customization
When: Preferences screen phase
What: Color scheme (amber/red/blue/green) and message tone (clinical/motivating/firm) for at-risk alerts.

---

## Code Quality

### ESLint Setup
When: Dedicated code quality version
What: Proper ESLint config across all packages with TypeScript-aware rules. Currently lint scripts are no-ops.
Needs:
- `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin` in backend + frontend
- `eslint-plugin-react`, `eslint-plugin-react-hooks` in frontend
- `eslint.config.js` per app
- Root-level shared config in `packages/eslint-config/`
- Restore lint scripts from `echo` no-ops

### vi.mock Hoisting Audit
When: Before adding new test files
What: Audit all test files for module-level variable references inside `vi.mock()` factories. Install `eslint-plugin-vitest` to enforce automatically.

### Storybook Updates
When: Each major component phase
What: Add stories for session components, exercise library components, panel/overlay components as they're built.

---

## Nutrition (Intentionally Long-Deferred)

### Nutrition Tracking
When: Only if users consistently request it
What: Calorie and macro tracking per session/day. Risk of becoming a half-baked MyFitnessPal clone. The lightweight hooks (`caloricGoal`, session notes) already cover what the monthly report needs.
