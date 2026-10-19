# TODO — Trainer (Just Train) · Phase 19 Go Live

_Resume pointer. Updated 2026-10-19. Full handover is in the `self:session-close` memory (read via `session_start`)._

## Load first on resume
- `session_start` (Mode B — mandatory), then this file.
- Plans in `.workbench/designer/current/`: `task-plan-maintenance.md`, `task-plan-formalize-custom.md`, `task-plan-mode-variance.md`.
- `docs/DEFERRED_ITEMS.md` for the longer-tail items.

## NEXT — maintenance queue, IN ORDER (plan: `task-plan-maintenance.md`)
1. **G16 leftovers** *(CODE — build first, lowest risk)*
   - `useSignOut.ts` → `caches.delete('cloudinary-media')` (feature-detect `'caches' in window` + try/catch).
   - `getThumbnailUrl` (`components/exercises/utils.ts`) → return URL unchanged when it's a signed/authenticated
     Cloudinary URL (`/authenticated/` or a `/s--…--/` segment). Defensive — today only public exercise media is
     thumbnailed. One-line unit test (public rewritten / signed untouched).
2. **`@sentry/react` 8→10** *(DEP — user runs)* — tiny surface (main.tsx + swErrorRelay + 1 test mock); mirror of the shipped node bump; vet `init()`.
3. **argon2 0.31→latest** *(DEP — user runs)* — API stable, old hashes verify; RISK = native prebuilt on Railway Node 20; own commit.
4. **Admin routes + formalize Slice B** *(CODE)* — `GET /auth/admin/deactivated` + `POST /auth/admin/trainers/:id/purge`;
   formalize `POST /exercises/:id/formalize` (reuses `MusclePicker`). PREREQ: owner `role='admin'` via one-off SQL.
   New `:id` route breaks the G3 matrix 404-convention → special-case admin; purge needs a confirm contract.
5. **drizzle 0.30→0.45 / kit 0.21→0.31** *(DEP — DEFER, own plan, LAST)* — config + snapshot + CI push risk, no urgency.

## Done this session (2026-10-19 — all committed, verify + CI green)
- Queue #1 formalize-custom: **PLAN** (admin-only publish, exact merge match, promote-in-place vs merge; FK correction — only 2 of 4 are RESTRICT) + **Slice A built** (custom exercises get a muscle map: `MusclePicker`, muscles on POST/PATCH `/exercises`, `lib/exerciseMuscles.ts`).
- Queue #2 camera "why black": `InlineCameraSheet` `blocked` state (no-frames 2s watchdog) + Try again + file fallback.
- Queue #3 snapshot deep-open: dashboard "Log Snapshot" → `openSnapshot` one-shot → `BaselineTab` auto-opens the sheet.
- Queue #4 maintenance: **PLAN** (`task-plan-maintenance.md`).
- **Mode-variance COMPLETE** (all 6 steps): `lib/mode.ts` + `useMode()`; widget-drift fix; vocabulary + nav + client-picker + route guard migrated; `mode.test.ts` gate.
- README brought current (title → Just Train; Build Phases rebuilt; CI + verify gate; structure/docs refreshed).

## Standing rules (this container)
- Container can't run `pnpm verify` / vite / vitest / tsx / drizzle-kit / psql-to-prod — **user runs them**.
- I stage **specific** files (never `git add -A`); **user commits + pushes**.
- Prod SQL **before** push on column/table adds; prod-mutating **data** SQL defaults to a `BEGIN…ROLLBACK` dry-run.
- A new `:id` route needs an ownership-matrix line (G3).

## Open on the user's side (ask on resume)
- **Still not set (2026-10-19):** `UPSTASH_REDIS_URL` (queue: reports/at-risk/purge/cleanup/cron) and the Resend trio
  `RESEND_API_KEY` + `REPORT_FROM_EMAIL=no-reply@just-train.fit` + `APP_URL=https://www.just-train.fit` (all transactional
  email; needs `just-train.fit` verified in Resend = DNS at Cloudflare). Vars on the BACKEND service, staged until Deploy.
- Owner `role='admin'` via one-off SQL (unblocks admin routes + formalize Slice B; stays full-access post-SaaS).
- Launch gates (non-code): logo/favicon/PWA icons, USPTO, Sentry source-map vars, Lighthouse ≥ 90 + first install.
- Gate rows: G10 (rotate PG pw + gitleaks), G18 (backups + pg_restore), G11, G9 (`curl /documentation` → 404).
