# TODO — Trainer (Just Train) · Phase 19 Go Live

_Resume pointer. Updated 2026-11-19. Full handover is in the `self:session-close` memory (read via `session_start`)._

## Load first on resume
- `session_start` (Mode B — mandatory), then this file.
- **Story rig status:** `story/backlog.md` — the oracle-storygen side-saddle (mounted at `story/`,
  companion-first; garden laid out as **Victory Gardens** — section subdirs, conceptually flat).
- **Idea inbox:** `discussions/offline-task-idea-inbox/` — designer's out-of-session drop-box; triage
  new files, respond in-file. See its `README.md`.
- **Business-plan docs are GITIGNORED** at `docs/product-development/business-plan/`.

## ⚠ First on resume — two on-device visual verifies owed (code shipped + CI green)
From 2026-11-17 (both committed, CI green — glance only, no code pending):
1. **Edit a logged set:** in a live session, log a set → tap the pencil on its row → correct the weight →
   confirm it saves and the PR (Load/Vol) chip re-settles; then **end** the session and confirm the
   pencil is gone (edit frozen). Server already 409s a completed session's set.
2. **Add Exercise "All types":** open Add Exercise → "All types" → confirm late-alphabet resistance
   staples (Squat, Deadlift, RDL, Overhead Press) now appear (the 30-item cap is gone).

## ▶ NEXT — three near-term priorities (the emphasis)
1. **FINISH THE PRODUCT STORIES (#27) — AWAITING WRITER CONFIRM.** Final-draft pass across the 4
   committed reports in `docs/design-reports/` (`body-map`, `exercise-type-coding`, `circuits`,
   `set-targets-input`). **Done 2026-11-19:** factual pass — reports verified clean vs source (all
   identifiers + heat buckets); two set-level editorial calls surfaced (NOT applied, companion):
   **(A)** the 4 closers disagree on the through-line's stance (settle vs "offered as a thread, not a
   law") — rec = settle/drop the hedge; **(B)** unify the 4 `Status:` lines. **Review note + confirm
   checklist:** `.workbench/designer/current/design-reports-final-pass-note.md`.
   **On resume:** check the note for the writer's confirm → if yes, apply exactly those edits to the 4
   files, stage, commit `docs(design-reports): final-pass — unify through-line + status lines`. Then
   the thread is closed. Per-piece garden: `story/garden/<section>/`; vets:
   `story/compost-heap/<N>-*-machinima.md` `## Afterward`.
   **Parked idea (cross-project):** add the 4 reports to the arisme Just Train study at `/work/just-train`
   — happens in the arisme repo, logged in the arisme memory + the review note.
2. **DISCUSS CONTENT MARKETING + STRATEGIES (#28).** Unscoped — channels / format / audience / cadence.
   The 4 design reports are natural **feedstock** (their aesthetics/affordance/product-story angles);
   can run companion-first through the rig. Decide direction with the designer.
3. **DISCUSS THE PLYOMETRICS MACHINIMA REPLY (#29).** Read `discussions/addPlyometrics/addPlyometrics-init-machinima.md`.
   The knot: **new 6th workout type vs calisthenics sub-mode** — the real cost is a 6th categorical
   hue at the palette CVD ceiling; metrics mostly composable (reps + #21 distance + RPE-like "pop");
   the non-composable gap is modality-aware PRs (plyo = best jump/distance). **Standing offer:** run
   the dataviz validator to test whether a CVD-safe 6th type-hue even exists before the type-vs-sub-mode call.

## Done this session (2026-11-17) — all committed, CI green
- **Edit a logged set during a live session** (`bd77ec7`). Pencil on each logged spine row → inline
  `SetEditRow` over the metrics the set records (resistance weight+reps; other types time/distance/
  level/reps). `useEditSet` wired in for the first time + widened + offline-aware. **Freeze enforced
  server-side:** `PATCH`/`DELETE /sets/:id` 409 unless session `in_progress` (`ownedSet` now carries
  status; 404-before-409 so nothing leaks). PR chips re-derive on read. Out of scope: circuit sets,
  L/R split sets, delete-UI. Tests + release note `docs/release-notes/edit-logged-set.md`.
- **Add Exercise "All types" now shows the whole library** (`196e86c`). The no-search view capped at
  the alphabetically-first 30 (`exercises.name` order) → hid late-alphabet resistance staples. Dropped
  `slice(0,30)` on the empty-search branch (ponytail: virtualise past a few hundred rows).

## Prior session (2026-11-02/03) — committed (context, not pending)
- 4 product-design reports via the oracle rig → `docs/design-reports/` (`e9a14e8`); body-map heat →
  absolute 5-tier (`1e2e0bf`); calisthenics kept fuchsia; rig mounted + Victory Gardens (`85c0989`).

## Later — open but NOT the current emphasis
- **#1 type-aware `ExerciseForm`** (library thread, last of 3→2→1): fields by workout type + BW
  max-reps catch. `discussions/offline-task-idea-inbox/custom-exercise-improvements.md`.
- **edit-logged-set** — ✅ BUILT 2026-11-17 (see Done above). Remaining for a later pass: delete-set
  UI (endpoint already gated), circuit-set + L/R-split editing, and an optional **optimistic offline
  update** so an edited value shows immediately while offline (today it shows the old value until sync).
- **#23 account-audit** (`docs/paid-user-account-audit.md`): ✅ D1 `COOKIE_SECRET` guard, D2 Resend/Redis
  email+queue go-live, D3 consent capture — all done 2026-11-13, **committed + pushed, CI + verify green**.
  Prod consent columns applied + backfill COMMITted (1 post-terms account stamped) + drizzle snapshot in
  sync. **Remaining:** P1 XFF/`trustProxy` confirm, P2 iOS export confirm, P3 Redis-backed lockout store
  (in-process today).
- **Maintenance queue** (`task-plan-maintenance.md`), G16 first.
- Parked inbox ideas: `circuit-builder-reorder.md`, `capture-interstitial-work.md`.

## Open — needs the user (ASK; long-carried)
✅ **Env now set (2026-11-13):** `UPSTASH_REDIS_URL` + Resend trio (`RESEND_API_KEY` ·
`REPORT_FROM_EMAIL=no-reply@just-train.fit` · `APP_URL=https://www.just-train.fit`) + `COOKIE_SECRET`
on Railway. Password recovery verified delivering; queue workers + scheduler live. (Confirm the
`COOKIE_SECRET` value is real random hex, not the placeholder text.)
Still owed by the user — **launch gates:** logo/wordmark SVG, USPTO, brand sign-off, Lighthouse ≥90 +
first real install — full list in `self:session-close`.

## Rules (container)
- Container runs `tsc --noEmit` + `eslint` + `postcss.parse`, and `npx tsc -p packages/shared/tsconfig.build.json`
  to rebuild shared. USER runs `pnpm verify`, vitest, vite, `drizzle-kit`, prod SQL, env changes.
- **Prod is authoritative over the drifted seed JSON.** Read-only SELECTs safe to run directly;
  data-mutating SQL defaults to a `BEGIN…ROLLBACK` dry-run (flip to COMMIT to apply).
- Stage specific SOURCE files; **never stage `packages/shared/dist`** (gitignored). User commits + pushes.
- `.workbench/designer/` task plans are kept **untracked** by convention.
- **Story rig stays in its lane** — `story/` never touches the app build/tests/code.
