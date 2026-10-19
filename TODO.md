# TODO — Trainer (Just Train) · Phase 19 Go Live

_Resume pointer. Updated 2026-10-19 (UX/user-flows session). Full handover is in the `self:session-close` memory (read via `session_start`)._

## Load first on resume
- `session_start` (Mode B — mandatory), then this file.
- Active UX plans in `.workbench/designer/current/`: `task-plan-body-sheet.md` (vetted, Phase 1+2 built),
  `task-plan-home-body-heatmap.md` (v1 built; male/female deferred).
- `docs/DEFERRED_ITEMS.md` → "Home insights / body-map" for this track's follow-ons.

## Active direction — UX / user flows (the user has been driving this)
The dashboard was reframed: **Home = launch** (greeting + body heat-map + Train, no-scroll);
**My Training = the feedback dashboard** (KPI headline row + Recent Sessions + Volume chart + tabs).
Tapping the Home figure → **Body breakdown sheet** (every muscle → 30-day counts → exercises that work it).
Next in this track is the user's call — likely body-sheet refinements (primary-first ranking, "done
before" flag, `EQUIPMENT_LABEL`), the next graph (volume by body grouping — reuses the muscle-frequency
backend), or the male/female figure once a female asset exists.

## NEXT when the UX track pauses — maintenance queue, IN ORDER (plan: `task-plan-maintenance.md`)
_Unstarted; carried from the prior session. Do in order:_
1. **G16 leftovers** *(CODE, lowest risk)* — `useSignOut` → `caches.delete('cloudinary-media')`
   (feature-detect + try/catch); `getThumbnailUrl` returns unchanged for signed/authenticated Cloudinary
   URLs (`/authenticated/` or `/s--…--/`), one-line unit test.
2. **`@sentry/react` 8→10** *(DEP, user runs)* — mirror of the shipped node bump; vet `init()`.
3. **argon2 0.31→latest** *(DEP, user runs)* — old hashes verify; RISK = native prebuilt on Railway Node 20.
4. **Admin routes + formalize Slice B** *(CODE)* — `GET /auth/admin/deactivated` + `POST /auth/admin/trainers/:id/purge`;
   `POST /exercises/:id/formalize` (reuses `MusclePicker`). PREREQ: owner `role='admin'` via one-off SQL;
   new `:id` route breaks the G3 matrix 404 convention → special-case admin; purge needs a confirm contract.
5. **drizzle 0.30→0.45 / kit 0.21→0.31** *(DEP — DEFER, own plan, LAST)* — config + snapshot + CI push risk, no urgency.

Also still unstarted: **formalize-custom Slice B** (with #4), **athlete progression-phase review**,
**muscle-map JSON↔prod reconcile**, **Project 2 movement demonstration**.

## Done this session (2026-10-19 PM — all committed, verify + CI green)
- **Dashboard debusy → Home launch surface:** removed the 2×2 ActionCard grid; rehomed "Plan" into the
  launcher ("Or plan a future session →", above templates); stripped Home to greeting + Train.
- **My Training = feedback dashboard:** Recent Sessions on the landing; headline KPI row (Streak/This
  week/Last session fixed above the carousel); **Volume-per-session chart** (new `GET /clients/:id/volume-history`).
- **Home body heat-map** (new `GET /clients/:id/muscle-frequency`; `BodyHeatMap` reuses `MuscleMap` geometry).
- **Body breakdown sheet** Phase 1 (tap figure → grouped muscle list + counts, both ends) + Phase 2
  (tap muscle → exercises via new `?muscle=` filter on `GET /exercises`; tap one → detail via `state.openExerciseId`).
- **Core exercises:** Machine Crunch + Russian Twist added (JSON + muscles); `docs/sql/add-core-ab-exercises.sql`
  **APPLIED to prod** (147 public exercises; Crunches/Sit ups also ensured). Supine Spinal Twist ≠ Russian Twist (kept both).
- **Heat-map recolor (follow-on, committed green):** body heat-map moved OFF Ember-Red → single-hue
  **Command-Blue** in **3 discrete buckets** (low/med/high, normalized to busiest; gray=untrained).
  Extracted to one shared `components/charts/heatRamp.ts` (`heatFill`) so `BodyHeatMap` and the
  `BodyBreakdownSheet` dot can't drift (the sheet had kept red). Red reads as soreness/injury; dataviz
  rule = magnitude is one hue in buckets. CHANGELOG corrected. Also: light/dark-theme note → `DEFERRED_ITEMS`.

## Standing rules (this container)
- Container can't run `pnpm verify` / vite / vitest / tsx / drizzle-kit / psql-to-prod — **user runs them**.
- I stage **specific** files (never `git add -A`); **user commits + pushes**.
- Prod SQL **before** push on column/table adds; prod-mutating **data** SQL defaults to `BEGIN…ROLLBACK` dry-run.
- A new `:id` route needs an ownership-matrix line (G3).

## Open on the user's side (ask on resume)
- **Still not set (2026-10-19):** `UPSTASH_REDIS_URL` and the Resend trio (`RESEND_API_KEY` +
  `REPORT_FROM_EMAIL=no-reply@just-train.fit` + `APP_URL=https://www.just-train.fit`) on the BACKEND
  service, staged until Deploy.
- Owner `role='admin'` via one-off SQL (unblocks admin routes + formalize Slice B).
- Launch gates (non-code): logo/favicon/PWA icons, USPTO, Sentry source-map vars, Lighthouse ≥ 90 + first install.
- Gate rows: G10 (rotate PG pw + gitleaks), G18 (backups + pg_restore), G11, G9 (`curl /documentation` → 404).
- Eyeball on device: Home no-scroll fit (`min-h-[calc(100dvh-6.5rem)]` is a first guess) + heat-map
  readability — now 3 Command-Blue tiers; confirm low/med/high are distinguishable at the region fill +
  the ~10px breakdown-sheet dot (low tier `#335C9E` is the one to brighten if they blur).
