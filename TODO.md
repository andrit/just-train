# TODO — Trainer (Just Train) · Phase 19 Go Live

_Resume pointer. Updated 2026-11-03. Full handover is in the `self:session-close` memory (read via `session_start`)._

## Load first on resume
- `session_start` (Mode B — mandatory), then this file.
- **Story rig status:** `story/backlog.md` — the oracle-storygen side-saddle (mounted at `story/`,
  companion-first) and the design-reports queue (all 4 in Done).
- **Idea inbox:** `discussions/offline-task-idea-inbox/` — designer's out-of-session drop-box; triage
  new files, respond in-file. See its `README.md`. (Two new stubs added this session.)
- **Business-plan docs are GITIGNORED** at `docs/product-development/business-plan/`.
- Audit docs driving queues: `docs/preferences-audit.md`, `docs/paid-user-account-audit.md`.

## Last session (2026-11-02/03) — design-reports workstream (orthogonal to the library thread)
- Installed the **oracle-storygen side-saddle** at `story/` and produced **4 product-design reports**
  (body map · exercise-type coding · circuits · set-targets) — **DRAFTED + STAGED (uncommitted)** in
  `docs/design-reports/`. Each piece: frozen compost dump + machinima reaction + a gardening-vet
  `## Afterward` (`story/compost-heap/`), and a seeded garden cluster (33 notes, `story/garden/` + `MAP.md`).
- **Two app changes spun out of the reviews:**
  - **Body-map heat → ABSOLUTE 5-tier** (was relative 3-tier). **SHIPPED + committed `1e2e0bf`** +
    device-verified. CHANGELOG + release note also **staged** (may still be uncommitted — see below).
  - **Calisthenics recolor:** tested gold, **KEPT fuchsia** (gold == the reserved reward-amber;
    measured ΔE under the 15 floor). No code change. `task-plan-calisthenics-recolor.md` (resolved A).
- Created tasks **#27** (complete the report review) + **#28** (content marketing).

## Next — two fresh threads + the carried library thread
1. **#27 Complete the design-reports review:** writer does the final-draft pass across the 4 staged
   reports → fold edits → **commit** (`docs(design-reports): body map, exercise-type coding, circuits,
   set-targets`). The **heat-map docs** (`docs/CHANGELOG.md` + `docs/release-notes/body-heat-map-absolute-scale.md`)
   are also staged — check `git status`; likely a separate `docs(home):` commit.
2. **#28 Content marketing for Just Train:** UNSCOPED. Feedstock = the 4 design reports; could run via
   the oracle rig. Decide scope/channels with the designer before building.
3. **#1 type-aware `ExerciseForm`** (library thread — still NEXT, untouched this session): fields by
   workout type (cardio = distance-unit + intensity; stretch/cooldown = hold-time) reusing #21
   components, **+ BW max-reps catch**. Context: `discussions/offline-task-idea-inbox/custom-exercise-improvements.md`.
4. **edit-logged-set** (`discussions/offline-task-idea-inbox/edit-logged-set.md`): no edit/delete path
   once a set is submitted — user hit it live. Captured, not scoped.
5. **#23 account-audit** (`docs/paid-user-account-audit.md`): D2 Resend (HIGH), D1 `COOKIE_SECRET`
   guard (HIGH), D3 consent, P1 XFF/`trustProxy`, P3 replicas, P2 iOS export — mostly Railway env.
6. **Maintenance queue** (`task-plan-maintenance.md`), G16 first.

## Data note (optional — not urgent; device looked right)
Some hand-added prod exercises may be `trainer_id = null` from the 2026-07-27 library collapse → they'd
show as "Library" not "Yours". Re-attribution is a data decision only (code is correct).

## Open — needs the user (ASK; long-carried)
`UPSTASH_REDIS_URL` + Resend trio (`RESEND_API_KEY` · `REPORT_FROM_EMAIL=no-reply@just-train.fit` ·
`APP_URL=https://www.just-train.fit`) + `COOKIE_SECRET` on Railway. Until set: password recovery
non-functional (D2), reports/at-risk/purge inert. (Launch gates: logo/wordmark SVG, USPTO, brand
sign-off, Lighthouse ≥90 + first real install — full list in `self:session-close`.)

## Rules (container)
- Container runs `tsc --noEmit` + `eslint` + `postcss.parse`, and `npx tsc -p packages/shared/tsconfig.build.json`
  to rebuild shared. USER runs `pnpm verify`, vitest, vite, `drizzle-kit`, prod SQL, env changes.
- **Prod is authoritative over the drifted seed JSON.** Read-only SELECTs are safe to run directly;
  data-mutating SQL defaults to a `BEGIN…ROLLBACK` dry-run (flip to COMMIT to apply).
- Stage specific SOURCE files; **never stage `packages/shared/dist`** (gitignored). User commits + pushes.
- **Story rig stays in its lane** — `story/` never touches the app build/tests/code.
