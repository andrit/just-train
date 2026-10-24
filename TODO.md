# TODO — Trainer (Just Train) · Phase 19 Go Live

_Resume pointer. Updated 2026-10-24. Full handover is in the `self:session-close` memory (read via `session_start`)._

## Load first on resume
- `session_start` (Mode B — mandatory), then this file.
- **Business-plan docs are GITIGNORED** at `docs/product-development/business-plan/` — they will NOT show in
  `git status`. (exec summary · financial model · competitive pricing teardown · GTM/content plan · pricing memo.)
- Two audit docs drive the current queue: `docs/preferences-audit.md` and `docs/paid-user-account-audit.md`.
- Active UX plans in `.workbench/designer/current/`: `task-plan-paid-user-account-audit.md`,
  `task-plan-preferences-audit-execution.md`, `task-plan-light-dark-theme.md`, `task-plan-body-sheet.md`,
  `task-plan-maintenance.md`.

## Last session (2026-10-24) — all staged/committed in batches, tsc+eslint clean
- **Preferences audit EXECUTED (task #17, done).** Lane A: trainer-guarded Alerts / Auto-send reports / Timezone;
  widget "Phase N" → "Coming soon"; photo-sharing relabelled "Not yet active". Lane C: unified toggles →
  `PrefRow`+`Toggle`, consistent "Saving…" feedback, header refresh, and **regrouped** the Dashboard catch-all →
  **Session / Reports (trainer-only) / Dashboard**. Added §7 preference→consumer inventory to the audit doc.
- **Finding: `prNotifyType` was dead → wired** — PR flash now honours the setting (`WorkoutBlock.tsx`).
- **Theme setting STUBBED** (disabled "Coming soon" Appearance section); real two-theme sweep = **task #22**.
- **Paid-user account deep audit (task #18, done)** → `docs/paid-user-account-audit.md`. Surface is strong, no
  auth bypass. Findings → **task #23** (see below).

## Queue (tasks #19–#23 — view with `task_list`)
1. **#23 Account-audit fixes** — D2 email/Resend (HIGH, mostly env), D1 `COOKIE_SECRET` guard (HIGH), D3 consent
   capture (col add), P1 XFF/`trustProxy` (confirm-then-fix), P3 in-process lockout (confirm), P2 iOS export (confirm).
2. **#19 Initial-load perf** — 3–4s first-load + Help-chunk spinner; bundle/TTI/lazy-Help/AuthProvider.
3. **#20 Body-map history tab** — persistent tab strip on a muscle, first tab = your history (needs backend).
4. **#21 Timed-exercise UI** — stationary-bike-style; **user brings inspiration before build**.
5. **#22 Light/dark themes** — the full sweep (`task-plan-light-dark-theme.md`); wire the Appearance stub.
   UX-track alternatives still open: body-sheet follow-ons, next graph (volume-by-grouping emphasis / weight-range),
   female silhouette asset, DragStepper hold-to-jump parity.

## Open — needs the user (blocks #23 D2/P3, long-carried)
`UPSTASH_REDIS_URL` + the Resend trio (`RESEND_API_KEY` · `REPORT_FROM_EMAIL=no-reply@just-train.fit` ·
`APP_URL=https://www.just-train.fit`) on Railway, with `just-train.fit` verified in Resend. **Until set, password
recovery is non-functional for beta users** (audit finding D2), and reports/at-risk/purge stay inert. Plus set
`COOKIE_SECRET` on Railway (D1). ASK whether these are done.

## Business plan follow-ups (feeds v3 SaaS)
Decide the athlete **price** ($8.99 vs recommended $5.99 + annual $49 + lifetime $99); post-launch feed real
CAC/conversion/churn into the model. Docs gitignored under `docs/product-development/business-plan/`.

## When the UX track pauses — maintenance queue, IN ORDER (`task-plan-maintenance.md`)
_Unstarted; carried:_ (1) G16 leftovers (`useSignOut` → `caches.delete('cloudinary-media')` feature-detect+try/catch;
`getThumbnailUrl` unchanged for signed URLs; one-line test). (2) `@sentry/react` 8→10 (user runs). (3) argon2
0.31→latest (Railway prebuilt risk, user runs). (4) Admin routes + formalize Slice B (owner `role='admin'` SQL
prereq; G3 matrix special-cases admin). (5) drizzle 0.30→0.45 / kit 0.21→0.31 (DEFER LAST).
Also unstarted: athlete progression-phase review · muscle-map JSON↔prod reconcile · Project 2 movement demonstration ·
three-way exercise→muscle role (`stabilizer`).

## Rules (container)
- Container runs `tsc --noEmit` + `eslint` + `node`/`postcss.parse`. It does NOT run vitest/vite/tsx/drizzle-kit/psql —
  the USER runs `pnpm verify` + prod SQL + env changes.
- Stage specific files; user commits + pushes. Prod SQL before push on col/table adds (e.g. #23 D3 consent column);
  prod-mutating data SQL defaults to a `BEGIN…ROLLBACK` dry-run. A new `:id` route needs an ownership-matrix line (G3).
  For CSS edits, `postcss.parse` in-container is the gate (vite can't run here).
