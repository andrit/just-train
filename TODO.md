# TODO — Trainer (Just Train) · Phase 19 Go Live

_Resume pointer. Updated 2026-10-21. Full handover is in the `self:session-close` memory (read via `session_start`)._

## Load first on resume
- `session_start` (Mode B — mandatory), then this file.
- Active UX plans in `.workbench/designer/current/`: `task-plan-body-sheet.md`,
  `task-plan-light-dark-theme.md` (NEW — Step-1 token infra done, sweep post-launch).
- `docs/DEFERRED_ITEMS.md` → "Home insights / body-map" + "Light / dark theme" for this track's follow-ons.

## FIRST on resume — check the CI-fix commit landed
This session's last act was a **follow-up fix**: a stray apostrophe in an `index.css` comment broke the
CI `vite build` ("Unclosed string" at the PostCSS tokenizer). Fixed (comment de-quoted), **staged**.
If `git log` doesn't show it committed/pushed green, commit the staged `apps/frontend/src/index.css`
(`fix(theme): remove apostrophes from CSS comment that broke PostCSS parse`) and confirm CI is green.
**Lesson (now a memory):** for CSS edits, run `postcss.parse` in-container as the gate — vite can't run here.

## Active direction — UX / user flows (user has been driving this)
Home = launch surface; My Training = feedback dashboard; tap the Home figure → Body breakdown sheet
(muscle counts → exercises that work it). This session added, all committed:
- **Body-sheet refinements** (`093734e`): tap a figure **region** → sheet scoped to that region's muscles
  (all-muscles escape kept); exercises grouped **Primary movers / Also works it** (`?muscle=` carries
  `muscleRole`); equipment via `EQUIPMENT_LABEL`. Region order is frequency→name (NO static region-role —
  role is exercise-relative).
- **Volume-by-body-part graph** (`960cb59`): `GET /clients/:id/volume-by-body-part`, attributed by the
  exercise's own body part (sums to total, no double-count); `VolumeByBodyPart` on My Training.
- **Light/dark token down-payment** (`2ebbb25` + the CI fix): `surface.*` → variable-backed, new `ink.*`
  scale, `:root` dark defaults + opt-in `data-theme=light` placeholder. Default dark, no `prefers-color-scheme`.

Next in this track is the user's call — likely body-sheet follow-ons (primary-prevalence tiebreak,
"done before" flag, per-region a11y), the next graph (volume-by-body-grouping *emphasis* via
`exercise_muscles`; weight-range-over-time per exercise), or the male/female figure once a female asset exists.

## Light/dark theme — down-payment done, FULL SWEEP is post-launch
Plan: `.workbench/designer/current/task-plan-light-dark-theme.md`. Remaining: Step 0 light-palette design
(`COLOR_SYSTEM.md`; crosshatch-in-light, signal-yellow-on-light), Step 2 the ~1,000-occurrence text sweep
(raw `text-gray-*`/`text-white` → `ink.*`) across 116 files, Step 3 charts + texture + focus-ring, Step 4
toggle + no-flash script + wire `prefers-color-scheme` + QA both themes. New code should use `text-ink*` now.

## NEXT when the UX track pauses — maintenance queue, IN ORDER (plan: `task-plan-maintenance.md`)
_Unstarted; carried. Do in order:_
1. **G16 leftovers** *(CODE, lowest risk)* — `useSignOut` → `caches.delete('cloudinary-media')` (feature-detect + try/catch);
   `getThumbnailUrl` unchanged for signed/authenticated Cloudinary URLs (`/authenticated/` or `/s--…--/`); one-line test.
2. **`@sentry/react` 8→10** *(DEP, user runs)* — mirror of the node bump; vet `init()`.
3. **argon2 0.31→latest** *(DEP, user runs)* — old hashes verify; RISK = native prebuilt on Railway Node 20.
4. **Admin routes + formalize Slice B** *(CODE)* — `GET /auth/admin/deactivated` + `POST /auth/admin/trainers/:id/purge`;
   `POST /exercises/:id/formalize` (reuses `MusclePicker`). PREREQ owner `role='admin'` SQL; special-case admin in G3 matrix.
5. **drizzle 0.30→0.45 / kit 0.21→0.31** *(DEP — DEFER, own plan, LAST)*.

Also still unstarted: **athlete progression-phase review**, **muscle-map JSON↔prod reconcile**,
**Project 2 movement demonstration**, **three-way exercise→muscle role (add `stabilizer`)**.

## Prod switches still unset (ASK the user) — as of 2026-10-19
`UPSTASH_REDIS_URL` (reports/at-risk/account-purge/refresh-cleanup/cron) and the Resend trio
(`RESEND_API_KEY` + `REPORT_FROM_EMAIL=no-reply@just-train.fit` + `APP_URL=https://www.just-train.fit`) —
all transactional email. On the BACKEND service; staged until Deploy. Plus Sentry CORS + "Sign-in locked" alert rule.

## Rules (container)
- Container runs `tsc --noEmit` + `eslint` + `node`/`postcss.parse` (plain Node). It does NOT run
  vitest/vite/tsx/drizzle-kit/psql — the USER runs `pnpm verify` + prod SQL.
- Stage specific files; user commits + pushes. Prod SQL before push on col/table adds; prod-mutating data
  SQL defaults to a `BEGIN…ROLLBACK` dry-run. A new `:id` route needs an ownership-matrix line (G3).
