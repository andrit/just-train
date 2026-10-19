# TODO — Trainer (Just Train) · Phase 19 Go Live

_Resume pointer. Updated 2026-10-18. Full handover is in the `self:session-close` memory (read via `session_start`)._

## NEXT QUEUE — do in order

1. **PLAN the formalize-custom button** (plan only, don't build yet).
   Turn the 3× hand-written SQL (corkscrew curls; cable crossover go up) into a feature: a
   "formalize this custom exercise" action that inserts the public exercise (+ muscles),
   repoints every FK (`session_exercises`, `template_exercises`, `challenges`, `exercise_media`
   — all `ON DELETE RESTRICT`) onto it, then deletes the draft (snapshot per-set laterality so
   old bilateral history stays bilateral). Also plan wiring into the draft-enrichment flow.
   Pattern: `docs/sql/formalize-corkscrew-curls.sql`, `docs/sql/merge-casual-draft-exercises.sql`.
2. **Camera-sheet "why black" fix** — `InlineCameraSheet`: detect a resolved stream with no live
   video track / no frames after ~2s → show "Camera blocked — allow it in the app's permissions,
   or pick a file" + the existing file-picker fallback. (Today it only falls back on *reject*.)
3. **Deep-open the snapshot sheet** from the dashboard "Log Snapshot" action — pass an
   `openSnapshot` flag via `location.state`; `BaselineTab` auto-opens `SnapshotCaptureSheet`
   on mount when set (skip the tab-then-tap). (`DashboardPage` ~line 392.)
4. **Maintenance upgrade plan→vet cycles** (one plan→vet each): drizzle 0.30→0.45 + drizzle-kit
   0.31; argon2 0.45; `@sentry/react` 8→10; admin routes (`requireRole('admin')`); G16 leftovers
   (sign-out cache-clear of `cloudinary-media`; guard so `getThumbnailUrl()` never rewrites
   client media); trainerMode default migration.

## Backlog (queued 2026-10-19 — after the current work)
- **README is out of date — build phases incomplete.** Bring `README.md` current: the PWA SDLC /
  version phases have moved well past what it lists (we're Phase 19 Go Live; versions through v2.14.x
  + unreleased). Do after the in-flight queue is clear, or sooner if it slots in naturally.
- **Mode-variance steps 5, 6** (client-picker → `mode.hidesClientPicker`/`can`; route guard → capability).
  Steps 1+2+4 + 3 (nav) done 2026-10-19. Plan: `task-plan-mode-variance.md`.
- **Maintenance follow-ups** (plan: `task-plan-maintenance.md`): G16 leftovers; `@sentry/react` 8→10;
  argon2 bump (check Railway prebuilt); **admin routes + owner `role='admin'`** (with formalize Slice B);
  drizzle 0.30→0.45 **deferred, own plan, last**.
- **Formalize-custom Slice B** (admin-only publish-to-shared + merge) — plan: `task-plan-formalize-custom.md`.

## Last step (this session, 2026-10-18 — all committed, verify-green, confirmed in app)
- Session-review bottom-spacing fix (`SessionHistoryPanel` → `pb-nav-clear`).
- My Training **snapshot capture** — built the missing feature (`SnapshotCaptureSheet`, wired via
  shared `BaselineTab`; omit-untouched subjective sliders; `ScoreSlider` extracted from `SessionCloseout`).
- `progressionState` relabelled for athletes (Baseline/Building/Maintaining; trainer labels unchanged).
- Deferred note: athlete progression review (personalize labels + derive phase from data / plateau crossings).

## Load first on resume
- `session_start` (Mode B — mandatory), then this file.
- `docs/DEFERRED_ITEMS.md` — "User reports from live use" (queue items 1–3 are recorded there).
- For queue #1: `docs/sql/formalize-corkscrew-curls.sql` + `docs/sql/merge-casual-draft-exercises.sql`,
  and `apps/backend/src/routes/exercises.ts` (where the formalize route would live).

## Standing rules (this container)
- Container can't run `pnpm verify` / vite / vitest / tsx / drizzle-kit / psql-to-prod — **user runs them**.
- I stage **specific** files (never `git add -A`); **user commits + pushes**.
- Prod SQL **before** push on column/table adds; prod-mutating **data** SQL defaults to a `BEGIN…ROLLBACK` dry-run.
- A new `:id` route needs an ownership-matrix line.

## Open on the user's side (ask on resume)
- Did `UPSTASH_REDIS_URL` and the Resend keys (`RESEND_API_KEY`, `REPORT_FROM_EMAIL`) get set?
  (Without them: purge / token-cleanup / reports / at-risk / cron + all transactional email are off.)
- Launch gates (non-code): logo/favicon/PWA icons, USPTO, Sentry source-map vars, Lighthouse ≥90 + first install.
