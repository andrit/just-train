# TODO — Trainer (Just Train) · Phase 19 Go Live

_Resume pointer. Updated 2026-10-30. Full handover is in the `self:session-close` memory (read via `session_start`)._

## Load first on resume
- `session_start` (Mode B — mandatory), then this file.
- **Idea inbox:** check `discussions/offline-task-idea-inbox/` for new idea files (designer's
  out-of-session drop-box). Triage new ones, respond in-file. See that folder's `README.md`.
- **Business-plan docs are GITIGNORED** at `docs/product-development/business-plan/`.
- Audit docs driving queues: `docs/preferences-audit.md`, `docs/paid-user-account-audit.md`.

## Last session (2026-10-29/30) — three shipped, all committed + device-verified
- **#22 light stragglers:** inactive filter pills `bg-[#1C1C1C]`→`bg-surface` (Exercises/Sessions/Help),
  Home body-map border+shadow, low-opacity white accents→`ink`/`surface-border` (commits `56a13e6`,`84b1b13`).
- **#25 exercise-type visual system:** one tokenized `EXERCISE_TYPE_THEME` (`lib/exerciseTypeTheme.ts`)
  + 5 `--type-*` light/dark tokens + hand-rolled glyphs (barbell/bike/jumping-jacks/split/snowflake) +
  card thumbnail = type art + label-only corner pill. dataviz-validated palette (`ead4e77`,`321c5ed`,`d50a721`).
- **#2 provenance:** Yours vs Library via `trainer_id`; `trainerId` added to the summary schema
  (`.nullable().optional()`); All·Yours·Library filter + grouped grid + "Yours" badge (`9effb7a`).
- Established the offline idea-inbox (`c790604`). Tasks **#25 and #26 done**. Latest commit **`9effb7a`**.

## Queue — next is the designer's call
1. **#1 type-aware `ExerciseForm`** (last of the 3→2→1 sequence): fields change by workout type
   (cardio = distance-unit + intensity from #21; stretch/cooldown = hold-time); reuse #21 field
   components; **+ the BW max-reps catch** (0-weight resistance set → PR by max reps). Context:
   `discussions/offline-task-idea-inbox/custom-exercise-improvements.md`.
2. **edit-logged-set** (`discussions/offline-task-idea-inbox/edit-logged-set.md`): no edit/delete path
   once a set is submitted — user hit it live (135 vs 155). Captured, not scoped.
3. **#23 account-audit** (`docs/paid-user-account-audit.md`): D2 Resend (HIGH), D1 `COOKIE_SECRET`
   guard (HIGH), D3 consent, P1 XFF/`trustProxy`, P3 replicas, P2 iOS export — mostly Railway env.
4. **Maintenance queue** (`task-plan-maintenance.md`), G16 first.

## Data note (optional — not urgent; device looked right)
Some hand-added prod exercises may be `trainer_id = null` from the 2026-07-27 library collapse → they'd
show as "Library" not "Yours". Re-attribution is a data decision only (code is correct). Investigate
with the read-only SELECTs in the chat log if pursued.

## Open — needs the user (ASK; long-carried)
`UPSTASH_REDIS_URL` + Resend trio (`RESEND_API_KEY` · `REPORT_FROM_EMAIL=no-reply@just-train.fit` ·
`APP_URL=https://www.just-train.fit`) + `COOKIE_SECRET` on Railway. Until set: password recovery
non-functional (D2), reports/at-risk/purge inert.

## Rules (container)
- Container runs `tsc --noEmit` + `eslint` + `postcss.parse`, and `npx tsc -p packages/shared/tsconfig.build.json`
  to rebuild shared. USER runs `pnpm verify`, vitest, vite, `drizzle-kit`, prod SQL, env changes.
- **Prod is authoritative over the drifted seed JSON.** Read-only SELECTs are safe to run directly;
  data-mutating SQL defaults to a `BEGIN…ROLLBACK` dry-run (flip to COMMIT to apply).
- Stage specific SOURCE files; **never stage `packages/shared/dist`** (gitignored). User commits + pushes.
