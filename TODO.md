# TODO — Trainer (Just Train) · Phase 19 Go Live

_Resume pointer. Updated 2026-11-03. Full handover is in the `self:session-close` memory (read via `session_start`)._

## Load first on resume
- `session_start` (Mode B — mandatory), then this file.
- **Story rig status:** `story/backlog.md` — the oracle-storygen side-saddle (mounted at `story/`,
  companion-first; garden laid out as **Victory Gardens** — section subdirs, conceptually flat).
- **Idea inbox:** `discussions/offline-task-idea-inbox/` — designer's out-of-session drop-box; triage
  new files, respond in-file. See its `README.md`.
- **Business-plan docs are GITIGNORED** at `docs/product-development/business-plan/`.

## ▶ NEXT — three near-term priorities (the emphasis)
1. **FINISH THE PRODUCT STORIES (#27).** Writer's **final-draft pass** across the 4 committed reports
   in `docs/design-reports/` (`body-map`, `exercise-type-coding`, `circuits`, `set-targets-input`) →
   fold edits → commit. Per-piece garden: `story/garden/<section>/`; gardening vets:
   `story/compost-heap/<N>-*-machinima.md` `## Afterward`. This is the main thread to close.
2. **DISCUSS CONTENT MARKETING + STRATEGIES (#28).** Unscoped — channels / format / audience / cadence.
   The 4 design reports are natural **feedstock** (their aesthetics/affordance/product-story angles);
   can run companion-first through the rig. Decide direction with the designer.
3. **DISCUSS THE PLYOMETRICS MACHINIMA REPLY (#29).** Read `discussions/addPlyometrics/addPlyometrics-init-machinima.md`.
   The knot: **new 6th workout type vs calisthenics sub-mode** — the real cost is a 6th categorical
   hue at the palette CVD ceiling; metrics mostly composable (reps + #21 distance + RPE-like "pop");
   the non-composable gap is modality-aware PRs (plyo = best jump/distance). **Standing offer:** run
   the dataviz validator to test whether a CVD-safe 6th type-hue even exists before the type-vs-sub-mode call.

## Done this session (2026-11-02/03) — all committed
- **4 product-design reports** via the oracle rig → `docs/design-reports/` (`e9a14e8`). Each: frozen
  compost dump + machinima reaction + gardening-vet Afterward (`story/compost-heap/`) + a garden cluster.
- **Body-map heat → ABSOLUTE 5-tier** (was relative 3-tier): shipped `1e2e0bf`, docs `ecf961a`.
- **Calisthenics recolor:** tested gold, **KEPT fuchsia** (gold == reserved reward-amber). No code change.
- **Rig mounted + gardens reorganized to Victory Gardens**, backlog, CLAUDE.md mount, TODO (`85c0989`).

## Later — open but NOT the current emphasis
- **#1 type-aware `ExerciseForm`** (library thread, last of 3→2→1): fields by workout type + BW
  max-reps catch. `discussions/offline-task-idea-inbox/custom-exercise-improvements.md`.
- **edit-logged-set** (`.../edit-logged-set.md`): no edit/delete path once a set is submitted.
- **#23 account-audit** (`docs/paid-user-account-audit.md`): ✅ D1 `COOKIE_SECRET` guard, D2 Resend/Redis
  email+queue go-live, D3 consent capture — all done 2026-11-13 (uncommitted; deploy order in the
  release note). **Remaining:** P1 XFF/`trustProxy` confirm, P2 iOS export confirm, P3 Redis-backed
  lockout store (in-process today).
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
