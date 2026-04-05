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

### Offline Sync — IndexedDB upgrade path (v3.x)
When: If localStorage proves insufficient (unlikely given data volumes)
What: Swap `services/offlineQueue.ts` implementation from localStorage to IndexedDB. The `OfflineQueue` interface is already defined — it's a one-file change. The Background Sync API (writes replay while app is closed) would also become available with IndexedDB + service worker.
Why not now: localStorage is sufficient for the data volumes involved. The interface is already abstracted for trivial upgrade.
Shipped in v2.4.0: Write queue (localStorage), connectivity detection, prefetch on load, offline banner, sync-on-reconnect. All critical writes (set logging, exercise additions, session end) are offline-aware.

### Session Metrics — Duration, Cardio Fields
Shipped in v2.2.0 (workout-type-aware inputs) and v2.5.0 (horizontal exercise navigation, rest timer in footer). All metric types covered: resistance (weight×reps), cardio (distance/time/intensity), calisthenics (reps/time), stretching (hold), cooldown (duration).

### Post-Session Wrap-Up (v2.7.0)
When: v2.7.0 — after gamification foundations ship in v2.5.0
What: Lightweight end-of-session flow:
- Name/describe draft exercises created mid-session
- Add notes to exercises and the session overall
- Surface PRs achieved in this session
- Preview adjustments for next session
- Streak + consistency update shown
Schema: ready. Natural home for PR celebration on session complete.

### Milestone / Badge System (v2.7.0)
When: v2.7.0 alongside post-session wrap-up
What: `trainer_milestones` table. Auto-detection job on session complete. Milestone types: first session, 10/50/100 sessions, first PR, volume milestones, streak milestones. Display on client profile and in post-session wrap-up.

### Coach Challenges (v2.8.0)
When: v2.8.0 alongside video capture
What: Trainer sets a challenge for a client ("10 pull-ups unassisted by end of month"). Progress tracked automatically from session data. `challenges` table (trainer creates, client assigned, metric + deadline + completion detection).

### Leaderboards + Weekly Quests (v2.9.0)
When: v2.9.0 — needs meaningful user base, privacy design, opt-in consent
What: King/Queen of the Gym leaderboards (trainer-scoped first, not global). Weekly/monthly quests tied to performance metrics. Anti-gaming considerations. Global leaderboards deferred to v3.x behind subscription gate.

### Social Share — Athlete Tier (v2.9.0)
When: v2.9.0 alongside leaderboards
What: Share session summary / PR achievement card as image. Native share sheet on mobile (Web Share API). Augments athlete subscription value. Depends partly on video capture scope from v2.8.0.

---

## SPA Architecture (v2.0.0 sequence)

### Observable Navigation Service — full RxJS (v3.1.0)
When: After v3.0.0 SaaS ships
What: Replace the `NavEventBusImpl` class in `services/navEventBus.ts` with an RxJS `Subject`. The public interface (`.next()`, `.subscribe()`, `.getValue()`) is identical — it's a one-file swap. All call sites in `navService.ts` and `useNavLog.ts` are unchanged.
Shipped in v2.3.0: Debouncing per action (300ms panel opens, 150ms close), in-memory audit log (200 entries), dev console logging, `useNavLog` hook for subscribers.

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
Shipped in v2.6.0. ESLint 9 flat config across all packages:
- `packages/eslint-config/` — shared base (TypeScript rules, no-any warn, unused-vars error with _ escape, no-console warn)
- `apps/frontend/eslint.config.js` — extends base + react + react-hooks
- `apps/backend/eslint.config.js` — extends base, relaxed console rule (pino wraps it)
- `pnpm lint` in root runs all three
- `--max-warnings 0` — lint must be clean to pass CI

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

### Post-Session Wrap-Up + Auto-Populate + Drag Reorder (v2.8.0)
Moved from v2.7.0 to v2.8.0 to make room for the template library.
- Auto-populate exercise targets from last session history
- Drag to reorder workouts and exercises in plan builder (@dnd-kit/core)
- Post-session wrap-up flow (name draft exercises, add notes, preview PRs)

### Hosting Setup (v2.11.0)
Railway (backend + PostgreSQL) + Vercel (frontend) production deploy.
Full environment variable config, custom domain, GitHub auto-deploy.
Slotted before v3.0.0 SaaS work so billing features deploy to a real environment.

---

## v2.9.0 UX — Exercise Detail Page

### Hide media placeholder when no image/video exists
Currently shows a large empty placeholder with "Visual coming in Phase 9" text even when there's no media. Should be hidden entirely — only show the media section when `demonstration` or `visualization` is present.

### Single scroll on exercise detail
Currently two separate scroll containers create double-scroll UX. The entire exercise detail (media, tags, description, instructions, etc.) should be one unified scrollable module — no nested scrolls.
