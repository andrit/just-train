# TODO — Trainer (Just Train) · Phase 19 Go Live

_Resume pointer. Updated 2026-10-27. Full handover is in the `self:session-close` memory (read via `session_start`)._

## Load first on resume
- `session_start` (Mode B — mandatory), then this file.
- **Business-plan docs are GITIGNORED** at `docs/product-development/business-plan/` — they will NOT show in
  `git status`. (exec summary · financial model · competitive pricing teardown · GTM/content plan · pricing memo.)
- Two audit docs drive the current queue: `docs/preferences-audit.md` and `docs/paid-user-account-audit.md`.
- Active UX plans in `.workbench/designer/current/`: `task-plan-light-dark-theme.md` (#22, done),
  `task-plan-body-map-history.md` (#20, done), `task-plan-initial-load-perf.md` (#19, done),
  `task-plan-paid-user-account-audit.md` (#18 → #23), `task-plan-maintenance.md`.

## This session (2026-10-24→27) — all committed/green except #22 Step 4 (STAGED, commit at clear)
- **#17 Preferences audit EXECUTED (done).** Lane A: trainer-guarded Alerts / Auto-send reports / Timezone;
  widget "Phase N" → "Coming soon"; photo-sharing relabelled "Not yet active". Lane C: unified toggles →
  `PrefRow`+`Toggle`; Dashboard catch-all regrouped → **Session / Reports (trainer-only) / Dashboard**.
  Dead `prNotifyType` **wired** into the PR flash gate (`WorkoutBlock.tsx`).
- **#18 Paid-user account deep audit (done)** → `docs/paid-user-account-audit.md`. Surface strong, no auth
  bypass. Findings → **#23** below.
- **#19 Initial-load perf (done).** Lighthouse 88→90, FCP 2.6→1.8s. AppShell → React.lazy+Suspense; Sentry/SW/
  sync/telemetry deferred post-paint (`afterPaint`); `AppInitSkeleton` replaces the auth spinner; Home renders
  progressively. The on-phone 3-4s is the `/auth/refresh`→dashboard waterfall (TTI ~3.5s), not bundle/cold-start.
- **#20 Body-map "Your history" tab (done).** `GET /clients/:id/muscle-history/:muscle` (enum validated IN
  HANDLER, ownership-matrix line added) + tab strip (Your history | Primary movers | Also works it). Closed **#24**
  (per-session sets + trend already live in the exercise detail).
- **#22 Light/dark themes — COMPLETE, all 4 steps.** Palette + global token pass (`:root` dark = canonical;
  light in `[data-theme=light]` + `@media(prefers-color-scheme:light)`); full text sweep (~120 files); charts
  tokenized; **live System/Light/Dark toggle** in Preferences (`lib/theme.ts` + no-flash script in `index.html`).
  ⚠️ BEHAVIOR CHANGE: default = SYSTEM, so existing users on a light OS flip to light next load unless they pin dark.

## Queue — remaining (view with `task_list`)
1. **#21 Timed-exercise UI** *(NEXT — do together)* — stationary-bike-style redesign; **user brings inspiration
   before any build**. Post-clear collaborative task.
2. **#23 Account-audit fixes** — mostly USER Railway env: D2 email/Resend (HIGH), D1 `COOKIE_SECRET` + fail-fast
   guard (HIGH), D3 consent capture (col add + checkbox), P1 XFF/`trustProxy` (confirm-then-fix), P3 in-process
   lockout (confirm replica count), P2 iOS export (confirm). See `docs/paid-user-account-audit.md`.

## #22 remaining = USER QA only
Eyeball every screen in **light** (vite dev + Appearance toggle). Fix any stragglers: text left on a fixed-dark
ground, chart legibility, amber-signal (`#B45309`) contrast.

## Open follow-ups (small)
- **#19:** on-phone `/auth/refresh` measurement BLOCKED on a DATA USB cable (remote-debug stuck Offline/pending-auth,
  device `43140DLJH001PS`). Sentry Session-Replay trim (~120KB post-paint). Benign Vite warnings telemetry/syncService.
- **prNotifyType default** decision (1rm vs both — schema change if "celebrate either").
- DragStepper hold-to-jump-5 parity (offered). Help: keep `lib/helpContent.ts` in sync with `docs/USER_MANUAL.md`.

## Open — needs the user (blocks #23 D2/P3 + password recovery, long-carried)
`UPSTASH_REDIS_URL` + the Resend trio (`RESEND_API_KEY` · `REPORT_FROM_EMAIL=no-reply@just-train.fit` ·
`APP_URL=https://www.just-train.fit`) on Railway, with `just-train.fit` verified in Resend. **Until set, password
recovery is non-functional for beta users** (D2), and reports/at-risk/purge stay inert. Plus set `COOKIE_SECRET`
on Railway (D1). **ASK whether these are done.**

## Business plan follow-ups (feeds v3 SaaS)
Decide the athlete **price** ($8.99 vs recommended $5.99 + annual $49 + lifetime $99, A/B); post-launch feed real
CAC/conversion/churn into the model. Docs gitignored under `docs/product-development/business-plan/`.

## When the UX track pauses — maintenance queue, IN ORDER (`task-plan-maintenance.md`)
_Unstarted; carried:_ (1) G16 leftovers (`useSignOut` → `caches.delete('cloudinary-media')` feature-detect+try/catch;
`getThumbnailUrl` unchanged for signed URLs; one-line test). (2) `@sentry/react` 8→10 (user runs). (3) argon2
0.31→latest (Railway prebuilt risk, user runs). (4) Admin routes + formalize Slice B (owner `role='admin'` SQL
prereq; G3 matrix special-cases admin). (5) drizzle 0.30→0.45 / kit 0.21→0.31 (DEFER LAST).
Also unstarted: athlete progression-phase review · muscle-map JSON↔prod reconcile · Project 2 movement demonstration ·
three-way exercise→muscle role (`stabilizer`) · female silhouette asset · heat/breakdown metric toggle.

## Rules (container)
- Container runs `tsc --noEmit` + `eslint` + `node`/`postcss.parse`. It does NOT run vitest/vite/tsx/drizzle-kit/psql —
  the USER runs `pnpm verify` + prod SQL + env changes.
- Stage specific files; user commits + pushes. Prod SQL before push on col/table adds (e.g. #23 D3 consent column);
  prod-mutating data SQL defaults to a `BEGIN…ROLLBACK` dry-run. A new `:id` route needs an ownership-matrix line (G3)
  + in-handler enum param validation (schema enum → 400 beats 401). For CSS edits, `postcss.parse` is the gate.
