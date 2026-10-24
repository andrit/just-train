# TODO — Trainer (Just Train) · Phase 19 Go Live

_Resume pointer. Updated 2026-10-24. Full handover is in the `self:session-close` memory (read via `session_start`)._

## Load first on resume
- `session_start` (Mode B — mandatory), then this file.
- **Business-plan docs are GITIGNORED** at `docs/product-development/business-plan/` — they will NOT show in
  `git status`. (exec summary · financial model · competitive pricing teardown · GTM/content plan · pricing memo.)
- Active UX plans in `.workbench/designer/current/`: `task-plan-body-sheet.md`, `task-plan-light-dark-theme.md`
  (sweep post-launch), `task-plan-maintenance.md`.
- `docs/preferences-audit.md` (new) — the prefs follow-ups; `docs/DEFERRED_ITEMS.md` for the rest.

## Last session (2026-10-23/24) — all committed, CI green
- **Business plan** created (gitignored, above): blended target-market questionnaire with product-synthesis.
  Pricing finding — market anchored LOW (Hevy $2.99/$23.99/$74.99, Strong $4.99/$29.99/$99.99, Trainerize per-client
  bands). Just Train's planned **$8.99 is 2–3× the anchor with no annual/lifetime**; memo recommends **$5.99/mo +
  $49/yr + $99 lifetime, A/B tested**. Financial model is scenario-based (churn is the swing variable; CAC/conversion/
  churn unknown till launch). GTM #1 risk = **PWA has no app-store discovery**.
- **5 UX features** (all committed): #1 Sessions grouped by Monday-start week + month dividers (`365fc72`);
  #5 Neglected tile → untrained-muscle list w/ per-muscle suggestions (`365fc72`); #3 preferences audit doc (`365fc72`);
  #4 native in-app **Help** screen (`/help`, `helpContent.ts` mirrors `USER_MANUAL.md`); #2 **hold-to-jump-5** on the
  `NumberField` steppers (tap ±1, hold → ×5 at a constant buffered cadence).

## Next — user's call across these tracks
1. **UX / user flows** (user has been driving): body-sheet follow-ons (primary-prevalence tiebreak, "done before"
   flag, per-region a11y) · next graph (volume-by-body-grouping *emphasis* via `exercise_muscles`, or
   weight-range-over-time per exercise) · male/female figure once a **female silhouette asset** exists ·
   **DragStepper** hold-to-jump parity (optional; `NumberField` has it now).
2. **Business plan** follow-ups: decide the athlete **price** ($8.99 vs $5.99 + annual/lifetime) — feeds v3 SaaS;
   post-launch, feed real CAC/conversion/churn into the model; optional next artifacts = 90-day content calendar +
   review-roundup outreach list.
3. **Quick prefs-audit win**: trainer-guard the **Alerts** section + **Auto-send monthly reports** for athletes
   (small, same pattern as the Training Mode guard). See `docs/preferences-audit.md`.

## When the UX track pauses — maintenance queue, IN ORDER (`task-plan-maintenance.md`)
_Unstarted; carried:_
1. **G16 leftovers** — `useSignOut` → `caches.delete('cloudinary-media')` (feature-detect + try/catch);
   `getThumbnailUrl` unchanged for signed/authenticated Cloudinary URLs; one-line test.
2. **`@sentry/react` 8→10** (user runs). 3. **argon2 0.31→latest** (Railway native prebuilt risk, user runs).
4. **Admin routes + formalize Slice B** (PREREQ owner `role='admin'` SQL; G3 matrix special-case admin).
5. **drizzle 0.30→0.45 / kit 0.21→0.31** (DEFER LAST, own plan).

Also unstarted: athlete progression-phase review · muscle-map JSON↔prod reconcile · Project 2 movement demonstration ·
three-way exercise→muscle role (`stabilizer`).

## Prod switches still unset (ASK the user) — as of 2026-10-19
`UPSTASH_REDIS_URL` (reports/at-risk/account-purge/refresh-cleanup/cron) and the Resend trio (`RESEND_API_KEY` +
`REPORT_FROM_EMAIL=no-reply@just-train.fit` + `APP_URL=https://www.just-train.fit`) — all transactional email, BACKEND
service, staged until Deploy. Plus Sentry CORS + "Sign-in locked" alert rule.

## Rules (container)
- Container runs `tsc --noEmit` + `eslint` + `node`/`postcss.parse`. It does NOT run vitest/vite/tsx/drizzle-kit/psql —
  the USER runs `pnpm verify` + prod SQL.
- Stage specific files; user commits + pushes. Prod SQL before push on col/table adds; prod-mutating data SQL defaults
  to a `BEGIN…ROLLBACK` dry-run. A new `:id` route needs an ownership-matrix line (G3). For CSS edits, `postcss.parse`
  in-container is the gate (vite can't run here).
