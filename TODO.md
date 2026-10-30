# TODO — Trainer (Just Train) · Phase 19 Go Live

_Resume pointer. Updated 2026-10-28. Full handover is in the `self:session-close` memory (read via `session_start`)._

## Load first on resume
- `session_start` (Mode B — mandatory), then this file.
- **Idea inbox:** check `discussions/offline-task-idea-inbox/` for new idea files (designer's
  out-of-session drop-box). Triage any new ones, respond in-file. See that folder's `README.md`.
- **Business-plan docs are GITIGNORED** at `docs/product-development/business-plan/` (won't show in `git status`).
- Audit docs driving queues: `docs/preferences-audit.md`, `docs/paid-user-account-audit.md`.
- Active UX plans in `.workbench/designer/current/`: `task-plan-timed-exercise.md` (#21, done),
  `task-plan-paid-user-account-audit.md` (#18 → #23), `task-plan-maintenance.md`.

## Last session (2026-10-27/28) — #21 timed/distance-cardio redesign SHIPPED
- Record-after model for run/bike/row. Four nullable cols live in prod (`sets.intensity_level`,
  `session/template_exercises.target_intensity_level`, `exercises.distance_unit`). Intensity is now a
  NUMBER in the cardio UI (enum kept in data for outdoor/feel; RPE = subjective). Rounds = sets
  (intervals logged one round per set). Distance has a per-exercise unit label, seeded + prod-labelled.
  "Remember your usual" prefills time + intensity. Rep-cardio / stretch / cooldown untouched.
- Committed **`92fb08a`**; prod migrated via `docs/sql/*`; `pnpm verify` + CI green.
- Release note: `docs/release-notes/timed-exercise-redesign.md`.

## ⚠️ FIRST on resume — one follow-up commit owed
The Drizzle migration generated for #21 is **staged but NOT in `92fb08a`** (feature commit shipped
without it). Per CLAUDE.md **critical rule 5**, the migration must be committed with the schema.
Prod is already applied (via `docs/sql` DDL), so this only keeps the Drizzle snapshot in sync:
```
git commit -m "chore(db): add 0011 migration for cardio intensity_level + distance_unit (#21)"
```
Staged files: `apps/backend/drizzle/0011_neat_the_watchers.sql`,
`apps/backend/drizzle/meta/0011_snapshot.json`, `apps/backend/drizzle/meta/_journal.json`.

## Queue — next is the user's call
1. **#21 remaining:** on-device QA only (bike 10 min @ 15 → trips; rounds=3 interval; prefill works;
   treadmill → mi; rep-cardio/stretch unchanged).
2. **#21 DEFERRED feature:** per-round *target* planning accordion (distinct targets per round upfront,
   e.g. 20 high / 15 mid / 10 high) — needs per-round target comma-list cols + copier + an
   `AddExerciseSheet` accordion. Intervals entered live today. See `DEFERRED_ITEMS.md` (2026-10-27).
3. **#23 account-audit fixes** — mostly USER Railway env: D2 Resend trio (HIGH), D1 `COOKIE_SECRET` +
   fail-fast guard (HIGH), D3 consent capture, P1 XFF/`trustProxy`, P3 replica count, P2 iOS export.
   See `docs/paid-user-account-audit.md`.
4. **#22 light QA** (user eyeballs every screen in light).
5. **Maintenance queue** (`task-plan-maintenance.md`), G16 first.

## Open — needs the user (ASK; long-carried)
`UPSTASH_REDIS_URL` + Resend trio (`RESEND_API_KEY` · `REPORT_FROM_EMAIL=no-reply@just-train.fit` ·
`APP_URL=https://www.just-train.fit`, domain verified in Resend) + `COOKIE_SECRET` on Railway.
Until set: password recovery non-functional (D2), reports/at-risk/purge inert.

## Rules (container)
- Container runs `tsc --noEmit` + `eslint` + `node`/`postcss.parse` only. USER runs `pnpm verify`,
  vitest, vite, `drizzle-kit`, prod SQL, env changes.
- **Prod is authoritative over the drifted seed JSON** (`exercises-library.json` ≠ prod). Dry-run data
  SQL against prod before committing names. Additive DDL (`ADD COLUMN IF NOT EXISTS`) needs no txn
  wrapper; data-mutating SQL defaults to a `BEGIN…ROLLBACK` dry-run (flip to COMMIT to apply).
- Stage specific files; user commits + pushes. A new `:id` route needs an ownership-matrix line (G3)
  + in-handler enum param validation. CSS edits gated by `postcss.parse`.
