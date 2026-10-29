# Changelog

All notable changes to TrainerApp are documented here.
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — Weight Ramp + Library Additions

### Timed / distance-cardio redesign (#21) — record-after model (2026-10-27)
- Reshapes distance-cardio (run / bike / row) logging for the **record-after** model: the machine captures live,
  the app plans the target off-device and records the result. Distance-cardio now shows **all four** metrics,
  ordered by importance — **Time → Distance → Intensity → Rounds** — instead of auto-hiding by target.
- **Intensity is now a number**, not the low/moderate/high enum. New nullable columns `sets.intensity_level`,
  `session_exercises.target_intensity_level`, `template_exercises.target_intensity_level` carry a device-specific
  machine level (spin-bike resistance, rower damper, treadmill level; no fixed range). The enum columns are
  **kept** (still valid for outdoor/feel efforts) but dropped from the cardio UI; subjective effort stays covered
  per-set by **RPE**.
- **Rounds = sets.** An interval effort logs one set per round (e.g. 20 min / 15 / 10) — the existing set spine;
  the active-set header reads "Round N" for distance-cardio. Per-round time stays `durationSeconds` on the set, so
  a future live timer can feed it without a model change (extensibility honored, not built).
- **Distance carries a per-exercise unit label** — new `exercises.distance_unit` ("mi"/"m"/"trips"); the hardcoded
  "(m)" is gone. Seeded defaults for the standard machines (treadmill → mi, spin bike → trips, rower → m, …).
- **"Remember your usual":** time + intensity prefill from the exercise's last session; distance is recorded fresh
  each round (last shown as a hint). Rep-only cardio (jumping jacks) and stretching/cooldown are untouched.
- Files: schema `sessions.ts`/`templates.ts`/`exercises.ts`; `packages/shared` response + input schemas;
  `lib/exerciseCopy.ts` (one copier → apply/fork/save-as-template all carry the level); routes `sessions.ts`/
  `templates.ts`/`exercises.ts`; seed `exercises.ts` + `exercises-library.json`; frontend `ExerciseBlock.tsx`,
  `AddExerciseSheet.tsx`, `SessionExerciseBreakdown.tsx`, `SessionHistoryPage.tsx`, `lib/formatters.ts`
  (`formatDistance`), `lib/queries/sessions.ts`. Migration: `docs/sql/add-cardio-intensity-level-and-distance-unit.sql`
  + data labels `docs/sql/set-cardio-distance-units.sql`. `tsc` + `eslint` clean (frontend + backend).
  **Deferred:** per-round *target* planning accordion (distinct targets per round upfront) — intervals are entered
  live today; needs per-round target storage. **Remaining:** `drizzle-kit generate` + prod SQL, `pnpm verify`
  (vitest), and on-device QA — all the user's.

### Theme — Step 4: the toggle (System / Light / Dark) — light/dark complete (2026-10-27)
- The light/dark theme is now **live and user-selectable**, completing the sweep. `lib/theme.ts` (`useTheme`)
  persists the choice to localStorage and stamps `data-theme` on `<html>`; an inline **no-flash script** in
  `index.html` applies an explicit choice before first paint; `index.css` resolves three modes — `:root` dark
  baseline, a `@media(prefers-color-scheme: light)` block for the **system default** (follow the OS), and
  `[data-theme="light"]`/`"dark"` for explicit choices that win on any OS. The Preferences **Appearance** control
  is now a live System/Light/Dark segmented toggle (closes preferences-audit rec #6). **Default is system** — a
  first-time user follows their OS; dark can be pinned. Dark byte-identical. Files: `lib/theme.ts` (new),
  `index.html`, `index.css`, `PreferencesPage.tsx`. **Remaining:** QA every screen in light (human pass).

### Theme — light-QA stragglers (#22) (2026-10-29)
- **Inactive filter pills unreadable in light.** The inactive filter/tab pills under the search bar on the
  Exercises and Sessions pages (and the Help-page section chips) hardcoded `bg-[#1C1C1C]` for their background.
  In light that near-black fill didn't flip, so `text-ink` (near-black in light) sat on a near-black pill —
  invisible. Swapped all 7 to the `bg-surface` token (dark `#1E1E1E` ≈ the old `#1C1C1C`, so dark is unchanged;
  flips to white in light). Active pills were already correct (fixed `chalk-white`/`#1C1C1C` pair). Files:
  `ExercisesPage.tsx`, `SessionsPage.tsx`, `HelpPage.tsx`.
- **Home body-map lacked definition.** The body heat-map button on Home was a transparent figure on the page
  ground. Added a card treatment — `border border-surface-border bg-surface/50 shadow-sm` with `p-3` insets — so
  it reads as a contained panel in both themes. Files: `DashboardPage.tsx`.

### Theme — Step 3: charts tokenized for light/dark (2026-10-27)
- The body heat-map, muscle map, and the shared `heatRamp` no longer hardcode dark hex. The untrained fill, the
  region stroke, and the three-tier Command-Blue frequency ramp are now CSS variables (`--chart-base`,
  `--chart-stroke`, `--heat-1/2/3`), consumed via `style` on the SVG polygons (var() doesn't resolve in SVG
  presentation attributes). In light the figure is faint on white and the ramp **darkens** with frequency
  (busiest = command-blue) so the hot region still pops. Added a `.text-on-signal` utility (black in dark, white
  in light) for the live-session button, since `signal-yellow` becomes a dark amber in light. Dark renders
  identically. Files: `heatRamp.ts`, `BodyHeatMap.tsx`, `MuscleMap.tsx`, `index.css`, `DashboardPage.tsx`.

### Theme — Step 2 text sweep complete (bright tier) + brand grounds tokenized (2026-10-27)
- Finishes the light/dark text sweep. The **bright tier** (`text-white`, `text-gray-100/200/300`) is migrated to
  `ink.*` app-wide via a bulk pass with a **scoped revert**, so `text-white` is preserved wherever it labels a
  **solid** accent (`bg-command-blue` / `bg-ember-red`) — those must stay white since the accent doesn't change in
  light; text on translucent accents and surfaces flips to `ink`. Also tokenized the fixed-dark **card/panel
  grounds** (`bg-brand-secondary` → white, `bg-brand-accent` → light panel in light) so text adapts with them.
  With the earlier muted-grey pass, **no raw `text-gray-*` remains, and `text-white` survives only on solid
  accents.** Dark byte-identical at the exact token levels; `tsc` + `eslint` clean. Left for later: chart hex
  (Step 3), the toggle (Step 4), and 4 `text-black`-on-`signal-yellow` labels (handle when signal flips to amber).

### Theme — Step 2 sweep: Preferences + muted-grey bulk pass (2026-10-27)
- The light/dark text sweep is underway. **Preferences** is fully migrated (both tiers). The **muted-grey tier**
  (`text-gray-400/500/600/700`, `placeholder-gray-*`) is now migrated to the `ink.*` scale **across all ~115
  remaining files in one vetted bulk pass** — those greys are never solid-accent labels, so the mapping is
  deterministic (400/500/600 are byte-identical in dark). **Still pending** — the context-sensitive bright tier
  (`text-white` / `text-gray-100/200/300`), handled per-screen because some are white labels on solid accents
  that must stay white. Dark unchanged throughout; `tsc` + `eslint` clean.

### Theme — light palette + global tokenization (Step 0 of light/dark) (2026-10-27)
- The light theme's palette is designed and locked, and the global `index.css` foundation is tokenized
  (**dark unchanged** — every light-variable's dark value equals the former hex). `signal-yellow` is now
  variable-backed and flips to an on-light amber (`#B45309`, since `#FFE200` is invisible on white); the
  page crosshatch, focus-ring offset, `body` text, `.field` / `.field-label` / `.section-label`, and the
  `.card` / `.header-crosshatch` textures read theme variables. Light = warm off-white ground (`#FAF9F7`),
  white cards, a warm-stone ink scale. Reachable only via `data-theme="light"` in devtools — no shipped UI
  sets it until the per-screen `text-gray-*` → `ink.*` sweep (Step 2). See `COLOR_SYSTEM.md` § Light theme
  and the proposal mockup. Files: `tailwind.config.js`, `src/index.css`, `docs/COLOR_SYSTEM.md`.

### Body map — "Your history" tab on a drilled muscle (2026-10-26)
- Drilling a muscle in the Home body-breakdown drawer now shows a **tab strip**: **Your history** (default) ·
  **Primary movers** · **Also works it**. "Your history" lists the exercises you've actually logged that train
  that muscle (lifetime, newest-first, with a session count + last date); tapping one opens the exercise detail,
  where the per-session sets and the trend sparkline already live. Primary / Also-works-it are the existing
  library suggestions. New endpoint `GET /clients/:id/muscle-history/:muscle` (query-only — no migration) with a
  TDD test; `useMuscleHistory` hook; `BodyBreakdownSheet` now takes the self-client id. Files: `routes/kpis.ts`,
  `response-schemas.ts`, `components/charts/BodyBreakdownSheet.tsx`, `lib/queries/clients.ts`, `DashboardPage.tsx`.

### Performance — Home renders progressively, no second spinner (2026-10-26)
- `DashboardPage` no longer blocks on a full-page spinner while `useSelfClient` loads. The home was already
  built to render with empty data (greeting from the auth store, the body figure all-cold, the Train card's
  default state), so it now paints its shell immediately and fills the heat-map + Train states as the queries
  land. Removes the *second* spinner that used to follow the cold-load skeleton — the last progressive-render
  (PRPL) lever. `DashboardPage.tsx`.

### Performance — perceived-load pass: shell skeleton + Dashboard preload (2026-10-26)
- After the bundle pass cleared Lighthouse ≥ 90 (FCP 1.8 s), the *perceived* cold-load was still ~3–4 s: the
  "Initialising app" spinner is held while `AuthProvider` waits on `/auth/refresh` → the Dashboard chunk → its
  data (TTI ≈ 3.5 s). The refresh is unavoidable (the access token is in-memory and lost on reload), so this
  pass masks and shortens the wait rather than erasing it: `AuthProvider` now renders a static **shell skeleton**
  (greeting · body-map · Train CTA · bottom nav) instead of a bare spinner, and `App` **prefetches the Dashboard
  chunk** during the refresh so it isn't a serial fetch afterwards. `AppInitSkeleton.tsx` (new), `AuthProvider.tsx`,
  `App.tsx`.

### Performance — lazy-load the interactive tree + defer startup off the critical path (2026-10-26)
- The always-loaded entry chunk carried the **whole interactive component tree**: `AppShell` eagerly imported
  the session overlay/live-session tree, client-profile panels + tabs, plan/history panels, the launcher sheet,
  and report preview (→ `dompurify`) — all shipped on every cold launch though none shows at first paint.
  Measured: entry **484 KB / 132 KB gzip**; Lighthouse-Mobile (incognito) FCP **2.6 s** with TBT **10 ms** →
  a **time-to-first-paint** problem (not execution or total weight), and **not** the backend (`/auth/refresh`
  ~400 ms, no cold-start; Railway serverless off).
- Fixes: `AppShell` panels/overlay/sheet are now **`React.lazy` + `Suspense`** (overlay gated on an active
  session; launcher mounts on first open then stays for its animation); **Sentry**, service-worker registration,
  offline-sync init, telemetry and the SW error relay moved to a **deferred post-paint bootstrap** via dynamic
  import; `SpeedInsights` lazy-loaded (`installPrompt` kept static for its early `beforeinstallprompt` listener).
  These move the session/client tree + Sentry out of the entry into on-demand, SW-precached chunks. `AppShell.tsx`,
  `main.tsx`. Findings + measurements: the #19 plan and `discussions/lighthouse-reports/`.

### Performance — devtools excluded from the production bundle (2026-10-26)
- `ReactQueryDevtools` is now a **dev-only lazy import** (`import.meta.env.DEV`), so Rollup tree-shakes the
  dependency out of the production bundle entirely instead of shipping it and rendering null. Trims main-entry
  JS and mobile parse time. `main.tsx` only. First item of the #19 initial-load pass; the larger finding —
  the first-load spinner is the `/auth/refresh` round-trip (service worker precaches all JS, so the spinner is
  network, not bundle) — is pending a timing measurement.

### Docs — paid-user account deep audit (2026-10-24)
- `docs/paid-user-account-audit.md`: read-only audit of the account/auth surface (security, agency,
  settings+auth controls, product-story↔UX fidelity) + email/billing forward-readiness. No reachable auth
  bypass found; surface verified strong (argon2id, refresh rotation + reuse detection, per-email+per-IP
  lockout, mass-assignment whitelist, complete data export). Definite findings: `COOKIE_SECRET` default
  (prod-beta footgun), email recovery inert without Resend (password reset unavailable in beta), consent
  not recorded at register. Confirm-first findings: `X-Forwarded-For`/`trustProxy`, in-process lockout
  per-replica, iOS standalone export download. Fixes tracked as follow-up task #23; no code changed by the audit.

### Sessions — list grouped by week (2026-10-24)
- The Sessions view now groups by **Monday-start week** (newest first) with flat week headers
  ("This week" / "Last week" / "Week of Mar 10") and a **month divider** wherever the month changes;
  a week is attributed to the month of its Monday. Replaces the former per-day grouping. `SessionsPage.tsx` only.

### Body map — drill into neglected muscles (2026-10-24)
- The **Neglected** tile in the body-breakdown sheet is now tappable: it opens the list of muscles
  untrained in the last 30 days, each expandable to the library exercises that work it (the existing
  per-muscle suggestions), with an "All muscles" escape. Disabled when nothing is neglected. Reuses the
  existing suggestion engine; `BodyBreakdownSheet.tsx` only.

### Steppers — hold a + / − to jump by 5 (2026-10-24)
- On the target steppers (sets, reps, weight when adding an exercise), **press-and-hold** a + / − arrow
  to jump by 5 at a steady, non-accelerating cadence with a brief buffer between jumps; a quick tap still
  steps by one. Shared `NumberField` (add-exercise / circuit / target surfaces; not live set logging).
  `GESTURE_GUIDE.md` updated.

### Help — native in-app user manual (2026-10-24)
- New **Help** screen (`/help`): a single scrolling page with a sticky "jump to" chip row, rendering the
  user manual as native sections (the "For Trainers" section shows only in trainer mode). Static, so it
  works offline. Linked from the mobile account roll-up and the desktop sidebar footer. Content lives in
  `lib/helpContent.ts`, mirroring `docs/USER_MANUAL.md` (the doc-of-record).

### Preferences — athlete-relevance pass (Lane A of the audit) (2026-10-24)
- Acted on the high-value findings of `docs/preferences-audit.md`. Mode-guarded three trainer-only
  settings to `trainerMode === 'trainer'` (same pattern as the Training Mode section): the **Alerts**
  section (at-risk clients), **Auto-send monthly reports**, and **Timezone** — all three are read only by
  the report/at-risk schedulers (`queues/scheduler.ts`, `queues/workers.ts`), so they're inert for an
  athlete. Swapped the dashboard widget **"Phase N"** availability badge for **"Coming soon"** (internal
  roadmap vocabulary was leaking into the UI). Relabelled **progress-photo sharing** as **"Not yet active"**
  — the trace found its only reader (`SnapshotPhotoCapture.tsx`) is unmounted, so the control is dormant
  end-to-end; the saved preference survives for when sharing ships. `PreferencesPage.tsx` only.
- Added §7 **preference → consumer inventory** to `docs/preferences-audit.md` (what reads each preference,
  live?, who it serves). Two new findings surfaced: **`prNotifyType` is dead** (the PR flash fires on both
  record types regardless of the setting) and **`photoSharingPreference` is fully dormant** — both logged
  for the backlog, not changed in this pass.

### Preferences — toggle/feedback consistency pass (Lane C of the audit) (2026-10-24)
- Converted the two hand-rolled switches (1RM estimates, auto-send reports) to the shared `PrefRow` +
  `Toggle` so all on/off settings look and behave identically. Added the "Saving…" indicator to the four
  multi-option cards that lacked it (weight unit, session layout, weekly target, timezone). Feedback
  convention is now explicit: toggles show an inline spinner via `PrefRow`; multi-option controls show a
  bottom "Saving…" line. Refreshed the stale file header (was "v1.4.5 / 4 sections"). `PreferencesPage.tsx`
  only.

### Preferences — Appearance theme stub (2026-10-24)
- Added a disabled **Appearance → Theme** control (System / Light / Dark, Dark preselected) marked
  "Coming soon". It is an intentional placeholder so the setting has a home — it does nothing until the
  light/dark sweep lands and is labelled so it never reads as a live control. The real two-theme work is
  tracked as its own task. `PreferencesPage.tsx` only.

### Preferences — section regroup (Lane C, cont.) (2026-10-24)
- Split the oversized "Dashboard" catch-all into three focused sections: **Session** (layout, weekly
  target, 1RM, PR notifications, rest timer), **Reports** — *trainer-only* (auto-send monthly reports,
  timezone), and **Dashboard** (training-button label, widget order). The Reports section's mode guard
  replaces the former inline guards on auto-report/timezone (the guarding folds into the section, as the
  audit predicted). Athletes see Profile → Session → Dashboard → Privacy → Account; trainers also get
  Training Mode, Reports, and Alerts. `PreferencesPage.tsx` only.

### Live session — PR flash now honours the notification preference (2026-10-24)
- The in-session **PR flash** now respects the Preferences "PR notifications" setting (`prNotifyType`):
  `1rm` flashes on a load/1RM record, `volume` on a volume record, `both` on either. Previously the setting
  was ignored and the flash fired on either type. The **persistent PR chip** on the set row is unchanged —
  it still reflects the actual record regardless of this preference (it's a record, not a notification), and
  the setting's copy was corrected from "flash and badge" to "celebratory flash" to match. `WorkoutBlock.tsx`.
  Note: `prNotifyType` defaults to `1rm`, so by default volume-only PRs no longer flash — see the open
  decision on whether the default should become `both`.
- `docs/preferences-audit.md`: relevance & completeness review of the Preferences screen. Headline finding:
  the Alerts section and auto-send monthly reports are trainer-only concepts still shown to athletes and
  should be mode-guarded (as the Training Mode section already is).

### Docs — Developer Manual + User/Athlete Manual (2026-10-21)
- **`docs/DEVELOPER_MANUAL.md`** — the onboarding/operations map for developers: what the app is, repo
  layout, local setup, the `pnpm verify` gate, the short-list conventions (with pointers to the detailed
  docs), git/deploy workflow, and a **deploy troubleshooting runbook**. The runbook captures the Railway
  "empty build logs = builder flake" case and the fix: when the failed deployment can't be redeployed
  (it crashed before producing an image), **`railway up`** uploads local source and starts a fresh build
  **without a commit** — the no-empty-commit trick — and why you must *not* redeploy the last successful
  deployment (it re-ships older code). Plus the Zod-serializer, staged-env-var, SW-stale-bundle, and
  CSS/PostCSS gotchas.
- **`docs/USER_MANUAL.md`** — athlete-first guide to using Just Train: the two home surfaces (Home =
  launch, My Training = dashboard), the body map, logging a session (all metric types, circuits,
  per-side, PRs, rest timer, offline), exercises, templates, progress tracking, account/settings, and a
  Trainer section. Both linked from the README docs index.

### Theme — token infrastructure down-payment for light/dark (2026-10-21)
- **Groundwork for a future light theme, with zero visible change today.** The app is dark-only by
  construction (~1,000 raw `text-gray-*`/`text-white` across 116 files); a real light theme is a
  tokenization sweep, planned post-launch (`.workbench/designer/current/task-plan-light-dark-theme.md`).
  This lays the seam so the sweep is smaller and new code stops adding dark-assuming debt.
- **Variable-backed semantic tokens.** `surface.{DEFAULT,raised,border}` now resolve to
  `rgb(var(--…) / <alpha-value>)` (dark values equal the former fixed hex — the dark app is
  byte-identical), and a new `ink.{DEFAULT,muted,subtle,faint}` text scale is the migration target for
  raw text colors. Variables live in `index.css`: `:root` = dark defaults, `:root[data-theme="light"]`
  = an opt-in **placeholder** light set.
- **Safe by construction:** default stays dark, light applies only when `data-theme="light"` is
  explicitly set (no shipped UI sets it yet), and **`prefers-color-scheme` is deliberately NOT wired** —
  auto-flipping a system-light user before the text sweep would render unreadable light. The 400+
  existing `surface`/`surface-border` usages become theme-ready for free; new code should use `ink.*`.
- `tailwind.config.js` + `src/index.css` only. Verified: config parses, `tsc` clean.

### My Training — volume by body part (where your work is going, 2026-10-21)
- **The second trend graph: total lifting volume over the last 30 days, split by body part** — on the My Training landing, under the volume-per-session chart. Answers "am I balanced?" at a glance: horizontal bars (Legs / Back / Chest / …), single Command-Blue hue (magnitude — no legend, the title names it), sorted busiest-first, a direct value label per bar. Dependency-free HTML in the spirit of `VolumeBySession` (`components/charts/VolumeByBodyPart.tsx`); empty state for a new athlete. Built against the dataviz skill (one hue for magnitude, text in ink tokens, rounded bars, direct labels on a short list).
- **Attribution = the exercise's own body part** (its library `bodyPartId` / `body_parts.name`), so the bars **sum to total lifting volume — no double-counting**. A bench set credits Chest in full; a muscle-group "emphasis" cut (via `exercise_muscles`, which would double-count across groups) is a deliberately separate later view (deferred).
- **Backend:** new `GET /clients/:id/volume-by-body-part` (in `kpis.ts`, self-client scoped like the other client-KPI routes) — last-30-day completed sessions, `setVolume` per-side aware, summed per the exercise's body part; exercises with no body part contribute nothing; entries sorted desc, zero-volume parts omitted. Shared `VolumeByBodyPartResponseSchema` (+ `VolumeByBodyPartEntry`); `period:'month'` literal. `useVolumeByBodyPart` hook (`enabled: !!accessToken && !!clientId`). TDD (401 / 404-unowned / empty / sums-and-sorts-and-skips-null-bodypart) and the required ownership-matrix line (G3).
- Deferred: the muscle-group emphasis view; a window/range toggle (fixed at 30 days for v1).

### Body sheet — tap a region, rank prime movers, read equipment properly (2026-10-20)
- **Tap a region on the Home figure → the breakdown sheet scoped to that region's muscles**, instead of the whole 34-muscle list. Tapping the quads shows just Quads + Hip Flexors (each still expandable to its exercises); a single-muscle region (hamstrings, obliques) auto-expands straight to exercises. A "‹ All muscles" escape returns to the full map, and the whole-figure tap still opens the full map directly — **both entry points kept**. The region polygons are now individually tappable (`onClick` + `cursor-pointer`; `head`/`knees` carry no muscle and stay inert); keyboard/SR users reach everything via the whole-figure button → full sheet (region tap is a touch/mouse shortcut, not the only path — per-region focusability is a logged a11y follow-on).
  - **Region → muscles is derived, not authored.** `REGION_MUSCLES` is built at module load as the inverse of `MUSCLE_TO_REGION` (`MuscleMap.tsx`) so the two can't drift; `REGION_LABEL` gives the sheet header a readable region name. No static region-role table — see below.
  - **No static "stabilizer" claim.** An earlier design proposed labeling each region's muscles primary/stabilizer; dropped, because **secondary/stabilizer is a property of the exercise, not the region** (hip flexors are *primary* in the Hip Flexor Rotary Machine). Scoped rows order by **30-day frequency → name**; the untrained-region alphabetical tiebreak + a data-derived primary-prevalence tiebreak are a logged refinement.
- **Exercises under a muscle are grouped "Primary movers" / "Also works it."** The `?muscle=` filter on `GET /exercises` now carries the per-exercise role: the two-step `inArray` selects `{ id, role }` from `exercise_muscles`, attaches `muscleRole` to each returned row, and sorts primary-movers first (name order preserved within each group). New additive `muscleRole: MuscleRoleEnum.nullable().optional()` on `ExerciseSummaryResponseSchema` — populated only under a `?muscle=` filter, null on every other list. Role stays **binary** (primary/secondary); a three-way `stabilizer` role is logged as its own initiative (needs a per-exercise re-authoring pass). TDD: role surfaced, primary-before-secondary sort, null-on-unfiltered.
- **Equipment reads properly in the suggestion rows.** They showed the raw enum (`NONE`, `RESISTANCE_BAND`) — `none` in particular read as missing data. Now run through `EQUIPMENT_LABEL` (`none → Bodyweight`, `resistance_band → Band`, …).
- Frontend: `BodyHeatMap` (region taps), `BodyBreakdownSheet` (scope + grouped exercise list + equipment labels), `DashboardPage` (region vs whole-figure wiring). Backend: `exercises.ts` muscle branch + the shared schema line.

### Body breakdown — tap a muscle → exercises that work it (Phase 2, 2026-10-19)
- **The map becomes actionable.** In the body breakdown sheet, tapping a muscle row now expands it to
  the **library exercises that target that muscle** (primary or secondary); tapping one opens its
  detail on the Exercises page — where the existing context-aware "Add to Workout" CTA lives, so
  add-to-session comes free. Turns a cold region straight into "here's how to work it."
- **Backend seam — one `?muscle=<slug>` filter on `GET /exercises`** (`muscle: MuscleEnum.optional()`
  added to the querystring). Implemented as a **two-step `inArray`** — resolve the exercise ids that
  target the muscle from `exercise_muscles`, then filter the list by id — rather than a correlated
  EXISTS subquery inside the relational `findMany` (whose root-table aliasing isn't guaranteed for raw
  SQL). Simpler, no alias risk, trivial at library scale; no role ordering in v1 (name-ordered, either
  role). No schema/shared change — `MuscleEnum` already existed. TDD: filters→matches, no-match→`[]`,
  unknown muscle→`400`.
- **Frontend:** `useExercises` gains a `muscle` filter; `BodyBreakdownSheet` rows are now expandable
  (`MuscleExercises` loads on expand via the hook); a tapped suggestion routes to `/exercises` with
  `state.openExerciseId`, and `ExercisesPage` consumes that once (then clears the router state) to open
  the detail sheet. Deterministic, library-facts only — the LLM/KB tier stays a later initiative.

### Home — body breakdown sheet (tap the figure, Phase 1, 2026-10-19)
- **The Home body figure is now tappable** → a "Body · last 30 days" bottom sheet that maps **every
  muscle**, grouped by body part, to how many sessions trained it. Phase 1 of the body-sheet plan: the
  map itself, reliable on its own; exercise suggestions per muscle come in Phase 2.
- **More granular than the figure, deliberately.** The sheet lists all 34 muscles from
  `MUSCLE_BODY_PART` (6 groups) with `MUSCLE_LABEL` names — including ones the SVG can't shade
  (Tibialis Ant., Soleus), so "the shin muscle" / "that forearm muscle" are reachable even though they
  never light up on the body. **Both ends shown:** a highlights strip (most-trained muscle + how many
  are untrained) and, within each group, muscles sorted busiest-first with untrained ones shown cold
  (not hidden). Intensity dot reuses the heat-map's shared ramp (`heatRamp.ts`).
- **Frontend-only — no backend.** It's fed the `muscle-frequency` counts Home already fetches; grouping
  and labels are existing shared data. Whole-figure tap (no per-polygon hot-spots); reuses `BottomSheet`
  (swipe/backdrop/Esc). Rows are display-only in v1. New `components/charts/BodyBreakdownSheet.tsx`;
  Home figure wrapped in a button. Plan + vet: `.workbench/designer/current/task-plan-body-sheet.md`.

### Exercise library — core/ab additions (2026-10-19)
- **Two new public exercises:** **Machine Crunch** (resistance / isolation / machine — seated weighted
  crunch against a stack; rectus abdominis primary, obliques secondary) and **Russian Twist**
  (resistance / isolation / dumbbell, bodyweight-optional — the rotational oblique move; obliques
  primary, rectus + transverse abdominis secondary). Added to `exercises-library.json` (meta total
  119 → 121). Calisthenics "Crunches" (feet-up, accordion) and "Sit ups" (feet-anchored full situp)
  already existed in the seed — calisthenics already supports reps **or** timed via the existing
  reps/time toggle, so no new logging behavior was needed.
- **Prod:** `docs/sql/add-core-ab-exercises.sql` — idempotent, name-guarded insert of all four into the
  public library plus their `exercise_muscles` rows (so the Home heat-map lights the core), dry-run by
  default (`BEGIN…ROLLBACK`). The JSON only feeds local `db:seed`; prod's public library is separate,
  so this SQL is what makes them appear in the live app. ⚠️ Name-guarded: if prod already holds a
  crunch/sit-up under a different spelling, verify before committing to avoid a duplicate.

### Home — body heat-map above Train (v1, 2026-10-19)
- **Home now leads with a body figure that shows what you've actually been training.** Anterior +
  posterior silhouettes with each muscle region shaded by how often it was trained in the last 30 days
  — a glanceable "am I hitting everything?" picture, sitting between the greeting and the Train card.
  Home stays a single no-scroll screen: greeting (top) · figure (fills the middle) · Train (just above
  the nav).
- **Backend:** `GET /clients/:id/muscle-frequency` (in `kpis.ts`, self-client scoped) — counts, per
  muscle, the number of completed sessions in the last 30 days that trained it (primary **or**
  secondary, once per session), via the `exercise_muscles` join. Shared `MuscleFrequencyResponseSchema`
  carries a `metric: 'sessions'` literal as a deliberate **seam for a future toggle** (sets / reps /
  volume) — the literal widens to an enum then. TDD tests (401 / 404 / empty / distinct-session count)
  + the G3 ownership-matrix line.
- **Frontend:** `BodyHeatMap.tsx` reuses `MuscleMap`'s vendored region geometry and its
  `MUSCLE_TO_REGION` map (now exported) — only the coloring differs: a single-hue **Command-Blue
  sequential** ramp in **three discrete buckets** (low/med/high, brightening with frequency),
  **normalized** to the athlete's busiest region so the top tier always lights up; untrained regions
  stay base-gray. Per the dataviz guidance (single-hue magnitude, discrete buckets, color last, text in
  ink tokens). **Blue, not red** — red on a body reads as soreness/injury, not "well-trained." Fed by
  the new `useMuscleFrequency` hook.
  - The ramp lives in one shared module, `components/charts/heatRamp.ts` (`heatFill(value, max)`), so
    the figure and the Body breakdown sheet's per-muscle intensity dot (`BodyBreakdownSheet.tsx`) draw
    from the same tiers and can't drift — the sheet had kept the old Ember-Red ramp until this.
- **Decisions (asked):** fine muscle-region granularity (not the 7 body parts); sessions as the count
  unit with the noted toggle seam; normalized scale. **Deferred:** the male/female figure preference
  and a female silhouette asset (we only have one, neutral/male, silhouette — `muscleMapData.ts`), and
  the metric toggle. Plan + full decision record: `.workbench/designer/current/task-plan-home-body-heatmap.md`.
- **On-device fit:** the no-scroll Home uses `min-h-[calc(100dvh-6.5rem)]`; the offset is a first guess
  to verify/tune on small and notched phones.

### My Training — volume-per-session chart (first trend graph, 2026-10-19)
- **The first of the planned training graphs: total volume per completed session**, on the My
  Training landing below Recent Sessions. A compact bar chart — one bar per session (most recent 12,
  oldest → newest), single Command-Blue hue (magnitude, so no legend; the title names it), bars
  anchored to a baseline with rounded data-ends and a 2px gap. Hovering/focusing a bar updates a
  readout (volume + date; latest by default); tapping a bar opens that session's history. Empty state
  for a new athlete. Dependency-free inline HTML/SVG in the spirit of `Sparkline` / `MuscleMap`
  (`components/charts/VolumeBySession.tsx`); built against the dataviz guidance (color last, text in
  ink tokens, baseline + rounded ends, a hover layer).
- **Backend:** new `GET /clients/:id/volume-history` (in `kpis.ts`, self-client scoped like the other
  client-KPI routes) — the most recent 12 completed sessions with total volume each (sum of
  weight×reps via the shared `setVolume`, per-side aware), returned chronological. All completed
  sessions count, including zero-volume (cardio-only) ones. Shared `VolumeHistoryResponseSchema` +
  `VolumeHistoryPoint`; frontend `useVolumeHistory` hook (`enabled: !!accessToken`). TDD tests (401 /
  404-unowned / empty / computed-and-chronological) and the required ownership-matrix line (G3).
- **Queued, not built:** a dynamic Home body figure (male/female, picked in Settings) heat-mapping
  per-body-part training frequency over the past month, above the Train CTA, no-scroll —
  `.workbench/designer/current/task-plan-home-body-heatmap.md`.

### My Training — headline KPI row (2026-10-19)
- **The "are you moving forward?" answer no longer needs a swipe.** The KPI hero was a single
  carousel of all nine stats, so the three signals that actually answer the question — **Streak**,
  **This week** (x/target), **Last session** — competed equally with Avg stress and had to be swiped
  to. They're now a **fixed 3-up row** at the top of the hero, always visible; the remaining six
  (Consistency, Focus, Volume·month, All-time, Avg energy, Avg stress) stay in the carousel below.
  Delivers the Phase-7 "answer it in 10 seconds" goal on the My Training landing.
- Pure reorganization of `KpiHero` — same cards, same values, same highlight/empty logic, split into
  `headlineCards` (rendered as `KpiCard`s in a grid) + `carouselCards` (unchanged `KpiCarousel`, now 6
  cards / 2 pages). Loading shows a 3-up skeleton matching the carousel's. Applies on the trainer's
  client profile too (shared component) — an improvement there as well. Frontend-only.

### Launcher — "Or plan a future session" moved above "From Template" (2026-10-19)
- Reordered the start-training drawer so the plan link sits directly under the primary Start button,
  above the template list (was below it). One-block move in `SessionLauncherSheet`.

### My Training — recent sessions on the landing (2026-10-19)
- **Developing My Training into the feedback dashboard** (the counterpart to the now-bare Home).
  First step: the "Recent Sessions" widget (last 3 completed, tappable → session history) now sits on
  the My Training landing, between the KPI hero and the tabs. It was the one old-dashboard signal with
  no landing home — previously reachable only by tabbing into Timeline. The widget is self-contained
  (fetches its own sessions), so this is a one-line mount plus an import. Frontend-only
  (`MyTrainingPage.tsx`).

### Home is a launch surface — stripped to greeting + Train (2026-10-19)
- **Reframe: the "dashboard" is Home, a starting point — not an analytics surface.** It was trying
  to be both: the Train card *and* a stack of feedback (the "Your stats" KPI widgets, Active
  Challenges, Log Snapshot, "+ Set a challenge") — all of which **My Training already carries** more
  fully (KPI hero + Overview / Timeline / Baseline / PRs / Challenges tabs). The two surfaces
  overlapped, with Home a lite, redundant copy.
- **Home now renders only the greeting + the Train card** (with its live / planned / idle states
  intact). Everything else was removed from `DashboardPage` — the widget stack (`WidgetRenderer`),
  the Active Challenges list, the Log Snapshot button, the "+ Set a challenge" form. This keeps Home
  out of the way of the "just train" path: you land, you train. The email-verification banner stays
  (a conditional system notice, not feedback).
- **Nothing is lost — feedback is one tap away on the nav bar.** Stats/PRs/goals/snapshots/challenges
  all live in **My Training** (the next surface to develop into the real feedback dashboard).
  Post-login landing stays Home by design.
- Frontend-only, one file (`DashboardPage.tsx`); pruned every now-unused hook/import
  (`usePreferences`, `useClients`, `useClientGoals`, `useChallenges`, `WidgetRenderer`,
  `ChallengeProgressCard`, `ChallengeForm`). The `WidgetRenderer` / widget components and the
  `widgetProgression` preference are untouched and still used by their own machinery; Home simply no
  longer renders them.

### Dashboard debusy — one primary action, planning rehomed into the launcher (2026-10-19)
- **The dashboard action hub was 75% duplicate nav.** Below the Train card sat a 2×2 grid of
  `ActionCard`s — **Goals** (→ `/my-training`), **History** (→ `/sessions`), **Build** (→ `/templates`)
  and **Plan** — but the first three are the exact destinations the nav bar already offers (My
  Training / Sessions / Templates), so the grid mostly restated the nav. Removed the whole grid (and
  the now-unused `ActionCard` component): the dashboard's action hub is now just the **Train** card —
  one unambiguous way to start.
- **Plan was the only grid card with no nav home, so it moved into the start-training drawer.**
  `SessionLauncherSheet` gains a quiet secondary link — **"Or plan a future session →"** — shown once
  a client is selected and no session is active; it closes the sheet and opens the plan panel
  (`openSessionPlan`). Discovery of planning drops one level (open launcher → see it), which is right
  for a less-frequent action; an *existing* planned session still surfaces directly on the Train card.
- **Neither mode is stranded.** Athletes reach Goals/History/Build from the nav bar (My Training /
  Sessions / Templates). Trainers — whose nav shows *Clients*, not *My Training* — still reach their
  own training via the trainer-only Self-Training widget. Frontend-only, two files
  (`DashboardPage.tsx`, `SessionLauncherSheet.tsx`).

### Docs — README brought current (2026-10-19)
- The root `README.md` had drifted badly: the Build Phases table marked v1.9.0 "🔨 Current" while
  everything after it was ✅, and v2.12–v2.14 were mislabeled and wrong-status. Rebuilt the table from
  `PROJECT_STATE.md` (all of v1.0.0–v2.14.0 ✅, v2.15.0 deferred, v3.0.0/v3.1.0 next), added an
  **Unreleased (in flight)** section summarizing the untagged work, and a note that the PWA SDLC is at
  **Phase 19, Go Live**. Also: renamed the title to **Just Train**; fixed the CI/CD section (lint is no
  longer a no-op; added the G3 real-DB ownership-matrix lane) and the pre-commit `pnpm verify` gate;
  refreshed the monorepo structure, terminology (Circuit/Snapshot/Challenge), and the docs index
  (GESTURE_GUIDE, COLOR_SYSTEM, RAILWAY_ERRORS); dropped the drifting "109 exercises" count.

### Mode "theme" — athlete/trainer variance in one registry (v1: steps 1+2+4, 2026-10-19)
- **The start of a single source for everything that differs by `trainerMode`.** An audit found mode
  variance was handled five different ways (nav arrays, a route guard, an inline dashboard list,
  hand-threaded `isAthlete` label props, and the widget registry) — only one declarative — so a new
  feature could silently leak trainer vocabulary (the ASSESSMENT-label relic was one instance). Audit +
  full plan: `.workbench/designer/current/task-plan-mode-variance.md`.
- **New `lib/mode.ts` + `useMode()`** — `MODE_CONFIG: Record<TrainerMode, ModeConfig>` holding, per mode:
  `labels` (the mode-varying vocabulary in one place), a `can` capability set (`viewRoster`,
  `manageClients`, `sendReports`, `viewBilling` — names reused by the v3 billing gates + the admin
  bypass), `isAthlete`/`isTrainer`, and `hidesClientPicker`. `useMode()` returns the active config from
  `trainerMode`. A unit test (`__tests__/unit/mode.test.ts`) asserts every label + capability exists for
  **both** modes — a half-added variant fails CI instead of leaking at runtime (a check that can fail).
- **Fixed a latent drift bug (step 2).** `WIDGET_META.selfTraining.modes` said `['athlete','trainer']`,
  but `DashboardPage` separately hardcoded `['atRisk','activeClients','selfTraining']` as the
  athlete-excluded widgets — two sources of truth. Set `selfTraining.modes → ['trainer']` (it duplicates
  the athlete action hub) and **deleted the inline list**; `parseWidgetProgression` is now the single
  mode filter. Also closes a latent vocab leak in `SelfTrainingWidget` (which always used the trainer
  label). Behaviour unchanged for both modes (`DEFAULT_ATHLETE_WIDGET_ORDER` never contained it).
- **Killed the vocabulary leak class (step 4).** The mode-varying strings now live in `mode.labels`:
  dashboard title, the sessions self-client label, and the progression-state phrasing. The three
  mode-aware surfaces (`OverviewTab`, `BaselineTab`, `MyTrainingPage`) read `useMode().labels` instead of
  a hand-threaded `isAthlete` prop — the prop is **gone** from both tab components. The ambiguous
  `progressionStateLabel(state, isAthlete)` helper was removed; the five trainer-only surfaces keep
  importing `PROGRESSION_STATE_LABEL` directly (athletes never reach them). Behaviour-preserving
  (`isAthlete` was always `trainerMode === 'athlete'` at every call site).
- **Step 3 (nav) — done same day.** The sidebar + mobile tab bar now read `useMode().nav`; `Layout`'s
  `TRAINER_NAV`/`athleteNav()` arrays and its local `NavItem` type are gone (moved into `mode.ts`). The
  gate test now also asserts a complete nav for both modes. Behaviour-preserving (same items/icons).
- **Steps 5 + 6 — done same day; mode-variance migration complete.** The client-picker (session launcher,
  launcher sheet, plan panel) reads `mode.hidesClientPicker` (athlete → auto-selects the self-client, no
  picker); the sessions roster filter reads `mode.can.viewRoster`; and `AthleteRouteGuard` redirects on
  `!mode.can.viewRoster` instead of `trainerMode === 'athlete'`. Every ad-hoc `trainerMode === …` check in
  these surfaces is gone — the six files now read the registry. (`usePreferences` dropped where it only
  fed a mode check; kept where it still serves `ctaLabel`.) The page trees (MyTraining vs ClientProfile)
  stay separate by design; the backend stays mode-agnostic (branches on `role`, never `trainerMode`).

### Dashboard "Log Snapshot" opens the capture sheet directly (2026-10-19)
- **One tap instead of two.** The dashboard's "Log Snapshot" action navigated to My Training's Baseline tab and stopped at the "Take a Snapshot" button — the athlete still had to tap it. It now deep-links straight into the `SnapshotCaptureSheet`.
- **How:** the action passes `state: { tab: 'baseline', openSnapshot: true }`; `MyTrainingPage` reads `openSnapshot` as a **one-shot** and passes `autoOpenSnapshot` + `onSnapshotAutoOpened` to `BaselineTab`, which opens the sheet on mount and calls back so the parent clears the flag — switching away and back to Baseline doesn't re-open it. The two trainer call sites of the shared `BaselineTab` pass neither prop (both optional, default off), so viewing a client is unchanged.

### Camera sheet now says why the viewfinder is black (2026-10-19)
- **A camera that opens to a black rectangle now explains itself.** `InlineCameraSheet` previously fell back to the file picker only when `getUserMedia` *rejected*. When it *resolved* with a stream that delivers no frames — an installed PWA whose camera permission differs from the browser's (seen on the `www.just-train.fit` origin switch), or a camera held by another app — the user got a silent black box with no way forward.
- **New `'blocked'` state.** Reached when the resolved stream has no video track, or when a **2 s watchdog** finds `videoRef.videoWidth` still 0 (a healthy camera reports frames well within 2 s). The watchdog stops the dead stream and shows: *"Camera is blocked or in use. Allow camera access for this app in your device settings — an installed app asks separately from the browser — or pick a file instead."* with **Try again** (re-runs `getUserMedia` — fixes the transient camera-in-use case) and **Choose a file** (the existing file-picker fallback).
- The watchdog is cleared on a real capture, on camera flip, and on close, so it can never flip a working viewfinder. `'fallback'` (getUserMedia unavailable/denied) is unchanged. Frontend-only, one component.

### Custom exercises can now carry a muscle map (Slice A of formalize-custom, 2026-10-18)
- **A trainer's own custom exercise now gets a muscle diagram.** Adding a private custom exercise already worked end-to-end (`POST /exercises` stamps `trainerId = you, isDraft = false`; `ExerciseForm` was already wired into `ExercisesPage`) — but the create/edit form captured **no muscles** (nor compound/isolation category or laterality), so every custom exercise showed a blank muscle section on its detail view. The form now captures all three.
- **New `components/exercises/MusclePicker.tsx`** — the 34-muscle `MuscleEnum` vocabulary grouped by the 7 body-part buckets (`MUSCLE_BODY_PART`), labelled with gym names (`MUSCLE_LABEL`). Tap a muscle chip to cycle **none → primary → secondary → none**; colour matches the muscle map (Ember Red primary, red tint secondary). Controlled, no internal state. Added to `ExerciseForm` alongside **Category** (compound/isolation) and **Laterality** (bilateral/unilateral) selects.
- **Backend writes `exercise_muscles` on create + enrich.** `POST /exercises` and `PATCH /exercises/:id` accept an optional `muscles: { primary[], secondary[] }` and persist it in **one transaction** with the row. On PATCH the muscle set is **replaced only when sent** (omitted = untouched, standard PATCH semantics), scoped to the owned row. New pure `lib/exerciseMuscles.ts` → `buildMuscleRows()` (primary-wins de-dupe — a muscle can't be both, matching the DB's `unique(exercise_id, muscle)`), unit-tested.
- **No schema change / no prod SQL** — the `exercise_muscles` table already exists (migration `0010`). This is purely additive behaviour on existing tables. Shared: `MuscleTargetsSchema` + `muscles` on `CreateExerciseSchema` (inherited by `UpdateExerciseSchema.partial()`).
- **This is Slice A** of the formalize-custom plan (`.workbench/designer/current/task-plan-formalize-custom.md`). The shared `MusclePicker` is the piece the admin-only formalize/publish-to-shared action (Slice B) will reuse.

### My Training — snapshot capture now works + athlete-facing phase labels (2026-10-18)
- **"Take a Snapshot" now actually captures one.** The button on the Baseline tab had **no `onClick`** and there was no capture form anywhere in the app — the backend route and `useCreateSnapshot` existed, but the UI was never built, so the dashboard's "Log Snapshot" action dead-ended on a no-op button. New `components/client-profile/SnapshotCaptureSheet.tsx` — a `BottomSheet` covering the subset the Baseline card surfaces (weight, body fat, resting HR, max push-ups, mile time, the five 1–10 subjective scores, notes), wired to `useCreateSnapshot`. Because the tab is shared, this fixes both My Training (athlete) and the trainer's Client Profile. The full ~30-field schema is deliberately not exposed for v1.
  - **Every field is optional and starts unset; only set fields are sent.** Numbers omit when blank; mile time (`MinSecField`, reused from the cardio work) omits at `0:00`; the five subjective sliders start `null` and are **omitted unless moved** — a slider reading "5" that saved nothing would invent data the athlete never gave, the exact trap the end-session flow already fixed. Save is disabled until at least one field is set. Notes map to `clientNotes` for v1.
- **`progressionState` is relabelled for athletes.** The "ASSESSMENT / PROGRAMMING / MAINTENANCE" badge is trainer vocabulary (where a client sits in their arc) and surfaced on the athlete's own "Your Training" header, Overview tab, and Baseline history — against the rule that athletes never see client vocabulary. New `progressionStateLabel(state, isAthlete)` + `PROGRESSION_STATE_LABEL_ATHLETE` (`assessment→Baseline`, `programming→Building`, `maintenance→Maintaining`); `isAthlete` threaded through `OverviewTab` and `BaselineTab` from `MyTrainingPage` (`trainerMode === 'athlete'`). Trainer views (Client Profile, roster self-tile, dashboard self-widget) default to `isAthlete=false` and keep the original labels unchanged. Colours unchanged.
- **DRY:** the 1–10 score slider was extracted from `SessionCloseout`'s local `SliderRow` into a shared `components/ui/ScoreSlider.tsx` (byte-identical markup; `hint`/`lowLabel`/`highLabel` made optional, new optional `dimmed` for the muted-until-touched look). `SessionCloseout` now imports it — end-session behaviour unchanged.

### Session review — bottom rows no longer hide behind the tab bar (2026-10-18)
- **The slide-in session-review panel (`SessionHistoryPanel`) now clears the mobile tab bar.** It is a `z-[10]` scroll container (`flex flex-col h-full overflow-y-auto`) and the tab bar is `z-50` — on top of it — but its last content block had only `py-4` of bottom padding, so the final exercise's last set (and its Load/Vol chips) sat *behind* the bar and couldn't be scrolled into view (the scroll ends where the content ends). The breakdown block now carries `pb-nav-clear` (`calc(6rem + env(safe-area-inset-bottom))` — the same token `<main>` uses, home-indicator inset included), `md:pb-8` on desktop where the nav is a sidebar. `py-4` → `pt-4` so `pb-nav-clear` owns the bottom unambiguously (both set `padding-bottom`; Tailwind resolves by generation order, not source order). Frontend-only, one block. The standalone `SessionHistoryPage` was already correct (it renders inside `<main>`, which already has `pb-nav-clear`).

### Exercise muscle map — coverage top-up (name drift) + Cable Crossover split (2026-10-18)
- **Muscle-map coverage goes from 67 → 125 of prod's 141 public exercises.** `seed-exercise-muscles.sql` only matched 67 because prod's public names were built from the old hardcoded library and the seed is keyed on `exercises-library.json` names. A coverage diagnostic (`docs/sql/check-exercise-muscle-coverage.sql`, read-only) surfaced the 74 without muscles; of those, 2 are correctly empty (Box Breathing, Slow Treadmill Walk — like cardio), Cable Crossover is handled by the split below, and **58** get muscle data via `docs/sql/topup-exercise-muscles-name-drift.sql` — keyed on prod's exact names, idempotent (`ON CONFLICT DO NOTHING`), dry-run by default. Covers both spelling drift (`Chin-up`↔`Chin-Up`, `Diamond Push-up`, `Cross-body Shoulder Stretch`, `Front Squat`…) and genuinely new prod exercises never authored (Cable Curl, Sumo Deadlift, Close-Grip Bench Press, T-Bar Row, foam-roll variants, …). Remaining uncovered after this = cardio + the two no-highlight entries (intentional).
- **Cable Crossover split into High / Middle / Low** (`docs/sql/split-cable-crossover.sql`): three public exercises by pulley height — High (high→low, lower pec), Middle (parallel, mid pec), Low (low→high, upper pec), each with `pectoralis_major` primary + `deltoid_anterior` secondary. Existing history on the single "Cable Crossover" is repointed to **Low**, then the generic is deleted (per the user) — same repoint-then-delete, dry-run-default pattern as the corkscrew formalize. All three share the `pectoralis_major` map region (the 34-muscle vocab has no upper/lower-pec split); the angle lives in the name/description.
- **Custom "cable crossover go up" merged into Low Cable Crossover** (`docs/sql/merge-cable-crossover-go-up.sql`): a private custom entry shadowing the new public Low variant — its history repointed onto the public row, then deleted (same repoint-then-delete, dry-run-default pattern).
- Both are prod-targeted SQL; `exercises-library.json` is not touched (the net-new prod exercises aren't in it, and full JSON↔prod reconciliation stays its own deferred item). Closes the muscle-map name-drift deferred note (67/103) and the Cable Crossover variants TODO.

### Cardio — capture distance, time and intensity together (2026-10-18)
- **A cardio exercise can now track any combination of distance / time / intensity**, not just one. The "Measure by" picker in the add-exercise sheet is now a **multi-select** (toggle each on; defaults to Time, as before); each enabled metric shows its own input in setup and its own box when logging live. Log a bike interval as `20:00` *and* `moderate` *and* `8000m` on the same set.
- **Frontend-only** — the schema already had `targetDistance` / `targetDurationSeconds` / `targetIntensity` (and `distance` / `durationSeconds` / `intensity` on sets) as independent nullable columns; only the UI forced a single choice. `ExerciseBlock` now derives the *set* of active metrics (`detectCardioModes`) from whichever targets are present and renders/logs/validates across all of them (loggable once any enabled metric has a value).
- **Readback made whole:** distance and intensity now also show in the post-session summary and session history (`SessionExerciseBreakdown`, `SessionHistoryPage`) — previously only weight/reps/duration rendered there, so a logged distance or intensity was captured but invisible after the session. The live past-set rows already showed all metrics.

### Exercise library — Corkscrew Dumbbell Curls formalized + custom draft absorbed (2026-10-18)
- **Added "Corkscrew Dumbbell Curls" as a formal public library exercise** (arms / isolation / dumbbell / **unilateral**): a supinating dumbbell curl. Muscles: biceps_brachii primary; brachialis + brachioradialis secondary. In `exercises-library.json` (local seed) and `seed-exercise-muscles.sql` (canonical prod muscle seed, coverage list + VALUES).
- **One-file prod migration `docs/sql/formalize-corkscrew-curls.sql`** does the whole formalize-custom workflow in a single transaction: insert the public exercise (idempotent), seed its muscles (idempotent), then find the trainer's private `%cork%` draft(s), repoint every reference (`session_exercises`, `template_exercises`, `challenges`, `exercise_media` — all `ON DELETE RESTRICT`) onto the public row, and delete the draft. So the session history logged against the old custom entry carries over to the formal exercise and only the formal version remains. Resolved by name, never UUID; **dry-run by default** (`BEGIN…ROLLBACK`) with a match preview + before/after counts — flip `ROLLBACK`→`COMMIT` to apply. Same pattern as `merge-casual-draft-exercises.sql`.
- Historical sets keep what they logged: the old draft was bilateral, so its past sets stay bilateral (`per_side` is snapshotted per set — volume unchanged); only *new* sessions adding the formal exercise default to per-side tracking from its `unilateral` laterality. No recompute.
- **Still deferred:** turning formalize-custom into a repeatable process / wiring it into the draft-enrichment flow (this SQL is the reusable pattern, run by hand per case for now).

### Cardio time entered as minutes : seconds (2026-10-18)
- **Cardio "Time" is now entered as two boxes — `min : sec` — instead of raw seconds.** Logging a 20-minute stationary-bike interval was previously `1200` in a seconds field (reported on Stationary Bike); it is now `20 : 00`. Storage is unchanged — still total seconds — so no schema, migration, or data change; only the input and the readback change.
- **New shared `components/ui/MinSecField.tsx`** — a two-box minutes/seconds control whose value in and out is total seconds (seconds clamp 0–59, minutes 0–300). Used in both places cardio time is entered so they can't drift: the target-setup sheet (`AddExerciseSheet` → `CardioTargets`, replacing the "Seconds per round" drag-stepper) and live logging (`ExerciseBlock`, replacing the "Duration (seconds)" number input). The drag-stepper stays everywhere else (sets, reps, rounds, stretch hold, cooldown).
- **Every logged set duration now reads back as `m:ss`** via the existing `formatSeconds()` (e.g. `20:00`, `0:30`) — cardio, calisthenics-by-time, stretch holds and cooldown alike, so entered time and displayed time match. Touched: `ExerciseBlock` (live past rows + "Last:" line), `SessionExerciseBreakdown`, `SetRow`, `SessionHistoryPage`, `WorkoutBlock` peek, and `formatSetSummary` in `lib/formatters.ts`. The form-check *clip length* in `MediaPlaybackModal` is a recording length, not a set metric, and is left as `12s`.
- **Guard:** setup no longer sends `targetDurationSeconds` when the time is `0:00` (`cardioDuration >= 1`), matching the distance branch — the input schema requires `min(1)`, and the old stepper's floor of 5 is gone. Live logging won't log a `0:00` set (loggability now checks `> 0`, not non-empty-string). Cardio default targets (4 rounds × 1:00) are unchanged.

### Exercise muscle map — "muscles worked" diagram on exercise detail (2026-10-11)
- **Every resistance, calisthenics, stretching, and foam-rolling exercise now shows a gym-placard-style muscle diagram** on its detail view: anterior + posterior body silhouettes with worked muscles highlighted (**Ember Red** primary, red tint secondary), plus precise muscle labels. Cardio and breathing/savasana/walking show nothing (no meaningful highlight) — `ExerciseHero`'s hide-when-empty behaviour extends to this section.
- **Data > render, deliberately.** A new **34-muscle anatomical vocabulary** (`MuscleEnum` — three deltoid heads, rhomboids, three traps, forearm flexors/extensors/brachioradialis, obliques, TVA, glute max/med, hip flexors/adductors/abductors, gastroc/soleus/tibialis, …) is stored per exercise and shown as labels + is queryable; the SVG map paints at its coarser region resolution via a muscle→region map. Muscles with no region (e.g. tibialis anterior) still show as labels.
- **Schema:** `exercise_muscles` join table (`exercise_id`, `muscle` **text** + Zod-validated so the vocabulary refines without a type migration, `role` enum, unique per exercise+muscle). `GET /exercises/:id` returns `muscles: { primary, secondary }`. Drizzle `0010`; prod SQL `docs/sql/add-exercise-muscles.sql` (apply before deploy).
- **Rendering:** `MuscleMap.tsx` — dependency-free inline SVG (same spirit as `Sparkline`). Polygon geometry vendored from **react-body-highlighter (MIT)** into `muscleMapData.ts`; attribution + free-exercise-db (Unlicense) provenance in the new root `NOTICE`.
- **Data:** primary/secondary muscles authored for 103 exercises (anatomically, with free-exercise-db as cross-check) into `exercises-library.json`; `seedExercises` inserts them; `docs/sql/seed-exercise-muscles.sql` seeds prod's public library (name-keyed, idempotent, dry-run default, drift-coverage report).
- **Shared:** `MUSCLE_BODY_PART` (34→7), `MUSCLE_LABEL` / `muscleLabel()`.
- Project 2 (movement demonstration — the start→finish images) is the planned follow-on; it reuses the same public-domain dataset.

### Brand — the app is called Just Train (2026-09-17)
- Every user-facing surface that still said "TrainerApp" now says **Just Train**: the wordmark on the sign-in, onboarding, offline-hold and verify-email screens and in the sidebar (single-colour, per the brand guardrail — the two-tone `Trainer`/`App` split is gone), the install banner label, `<title>`, the meta description, and the PWA manifest (`name`/`short_name: 'Just Train'` — the label under the home-screen icon; Android updates an installed WebAPK's label on its own schedule, so an existing install may show "Trainer" for a while or need a reinstall).
- The story and brand docs record the name and what it changes: `design/product-story.md` → *The name, resolved* (the Phase-0 narrative stays as written), `docs/product-development/brand-identity.md` (values: "Forge yourself" → "Keep going"; voice: no metaphor — the instruction is the brand; domain section current). Colour token names are unchanged. Logo, USPTO clearance and sign-off remain launch gates.

### Platform — Sentry SDK 8 → 10, backend (audit tier 2, 2026-09-17)
- `@sentry/node` ^10.75. Why: the 8.x line pins OpenTelemetry 1.30, whose `@opentelemetry/core` parses an incoming `baggage` header with unbounded allocation (moderate advisory, reachable on every request); the fix ships only with OTel 2, which Sentry 9+/10 carries. The 8.x line is also out of support.
- Nothing in our code changes: the whole Sentry surface is six calls in `lib/sentry.ts` (init, Fastify error handler, captureException/Message, setUser, withMonitor), all unchanged across the majors; `instrument.ts` already initialises before any other module loads. The privacy pinning (`sendDefaultPii: false`, `beforeSend` scrubbing) is guarded by `__tests__/lib/sentry.test.ts`. Plan + vet: `.workbench/designer/current/task-plan-sentry-10.md`.
- Known, accepted: v9+ instruments Fastify differently (`@fastify/otel` semantics); error capture is unaffected, request *tracing* may be absent until `@fastify/otel` is added — tracing was never a Phase 18 criterion. Cron heartbeat still unverifiable until `UPSTASH_REDIS_URL` is set in production.
- Frontend `@sentry/react` stays on 8 for now (no advisory); a separate commit when convenient.

### Security — refresh cookie is SameSite=Strict (gate G19, 2026-09-16)
- With the app served from `just-train.fit` and `/api/*` proxied to Railway, the refresh cookie is first-party on the app's own origin, so the last reason for `'lax'` (a vercel.app origin) is gone. `'strict'` now: the cookie is never sent on a cross-site request. It is path-scoped to `/api/v1/auth` and only the app's own fetches call those routes — email links land on public pages, so nothing that used to work stops working. Unit test pins the options.
- **Domain cut-over, same day (yours):** `CORS_ORIGIN` on Railway now lists `https://just-train.fit,https://www.just-train.fit` — the Vercel proxy forwards the browser's `Origin`, so the backend's allow-list is effectively an origin guard on the API; with the old value every call 500'd (seen in Sentry: `Origin https://www.just-train.fit not allowed by CORS`). `APP_URL` set to the domain.

### Platform — Fastify 4 → 5 (audit tier 2, 2026-09-16)
- **Why:** Fastify 4 is end-of-life with a reachable body-validation bypass (CVE-2026-25223: a `Content-Type` carrying a tab character skipped validation) and no 4.x patch. Zod body validation is this app's input guard on every route. Plan + vet: `.workbench/designer/current/task-plan-fastify-5.md`.
- **Versions:** `fastify` ^5.12, `@fastify/cookie` 11, `cors` 11, `helmet` 13, `multipart` 10, `rate-limit` 11, `swagger` 9, `swagger-ui` 6, **`fastify-type-provider-zod` 4.0** (the line for Fastify 5 with the Zod 3 API — 5.x already expects `zod/v4` schemas; 6.x/7.x need Zod 4 — a separate migration), Zod **^3.25** everywhere (root override, shared peer, backend, frontend). Node 20 was already the floor. No schema, no prod SQL.
- **One error shape for the Zod pipeline** (`lib/errorHandler.ts`): request validation → `400 { error: 'Validation failed', code: 'VALIDATION', details: [{ path, message, code }] }`; response serialisation → `500 { error: 'Response failed validation', code: 'RESPONSE_SCHEMA', details }` with `details` withheld in production (it names our own fields — what the real-DB lane needs, what a stranger doesn't). Everything else keeps Fastify's status. Before this, a validation failure was Fastify's default 400 with the raw issue list in `message` and `error: 'Bad Request'` — which is what the frontend displayed. Registered in production and in the test app builder, so the unit lane sees the same shapes.
- **Swagger renders real schemas now** — `transform: jsonSchemaTransform` on `@fastify/swagger`; it was registered without it, so `/documentation` showed empty request/response bodies (dev only).
- Retires with it: `find-my-way` 8 (HTTP/2 DDoS), `@fastify/static` 7 (path traversal), the `fast-uri` chain at source.
- Verification bar: `pnpm verify` + CI real-DB matrix green **with no security-guard expectation relaxed**; Sentry receives a test event after the first deploy (`@sentry/node` 8.55 on Fastify 5 was the one unverified assumption).

### Security — ownership proven against a real database, on every push (gate G3, 2026-09-16)
- **A second test lane, against Postgres.** `pnpm --filter backend test:db` (config `vitest.db.config.ts`, setup refuses any `TEST_DATABASE_URL` whose database name lacks `test`/`ci` — the harness truncates every table). CI gains a `postgres:16` service, a *Prepare test database* step (`drizzle-kit push` via `drizzle.ci.config.ts` — `strict: false`, reads only `TEST_DATABASE_URL`; the main config's `strict: true` would prompt and hang, and the migration chain has no real baseline to build from) and an *Ownership matrix* step. `pnpm test` / `pnpm verify` are unchanged and still need no database.
- **The matrix** (`__tests__/db/ownership-matrix.test.ts`): two seeded trainers; A owns a row in every table a route can address; B calls **all 56 parameterised routes** with A's ids and must get exactly `404` — never `403` (confirms existence), never `400` (bodies are the minimal valid shape so validation cannot mask the check). Nine more cases smuggle A's ids in request bodies (`clientId`, `templateId`, `exerciseId(s)`, `sessionId`, reorder lists). A sanity block confirms the owner gets `200` for the same rows, so the 404s mean something.
- **The net stays complete by itself:** a coverage test compares the matrix to the routes the app actually registers — a new `:id` route without a matrix entry, or a stale entry, fails CI. Adding a route now costs one line in this file.
- **Two convention breaks found on the way, fixed:** `PATCH /sessions/:id/exercises/reorder` and `PATCH /templates/:id/exercises/reorder` answered `403 Not authorised` for another trainer's resource. Now `404`, like everything else.
- **Purge proven against real foreign keys** (`__tests__/db/purge-order.test.ts`): deactivate A, purge, assert every A row gone table by table, every B row intact, and a private exercise B still references re-homed to public rather than deleted — the RESTRICT-edge claims the ordered delete was designed around, previously asserted only as "the mock saw the deletes in this order".
  - **Which found a defect:** the purge deleted the Cloudinary media of *every* private exercise **before** the transaction decided which ones survive as public — a re-homed exercise kept an `exercise_media` row pointing at a deleted file. Re-homing is now decided first (`exercisesReferencedElsewhere`) and only the exercises that will actually be deleted lose their media folder.
  - **And a second one:** the "still referenced" check counted the trainer's **own** sessions/templates/challenges — which the same purge deletes a step earlier — so a private exercise the trainer had used themselves was re-homed to the public library instead of deleted. Only references from *other* trainers count now.
- **What the first CI run of the matrix found (the lane itself came up clean — service container, `drizzle-kit push`, seeds):**
  - **`GET /templates/:id` and `GET /exercises/:id` returned 500 for any exercise that has media** — both converted only the top-level row's timestamps; nested `media[].createdAt` stayed a `Date` and failed the response schema. Never hit in production only because no exercise has media yet; never hit in tests because factories already hold strings. One deep `lib/serializeDates.ts` now (the third ad-hoc copy of this conversion), used at both reply boundaries.
  - **Both reorder routes answered `204` for a session-exercise / template-exercise id that belongs to someone else.** The update was scoped (`AND session_id = ?`), so nothing foreign was written — but a no-op reported success, and a foreign id got a 204 instead of a 404. Each id is now checked against the parent first; a foreign one is `404`.
  - **Circuit creation (session and template) answered `400` for a foreign private exercise in `exerciseIds`** — the convention is `404`, like every other visibility miss.
  - One matrix mistake on my side: `POST /templates/:id/fork` has an optional body schema, so a bodiless request was a `400` before ownership ran. The case sends `{}`.
- Local recipe: `createdb trainer_test`, then `TEST_DATABASE_URL=postgresql://localhost/trainer_test pnpm --filter backend test:db:prepare` and `… test:db`. Never point it at the dev database.

### Security — client media delivered only with a signature (gate G16, 2026-09-16)
- **Progress photos and form-check clips are now uploaded under Cloudinary's `authenticated` delivery type**, and every URL the API returns for them is **signed at read time** by `mediaDeliveryUrl(publicId, resourceType, access)` — the one chokepoint in `cloudinary.service.ts`. Cloudinary refuses to serve an authenticated asset without the `s--…--` signature, which only the backend (holding the API secret) can produce. The stored `cloudinary_url` column is no longer used for delivery (kept; dropping it is a later migration). Exercise-library media stays public — it is the shared library.
- **What this buys and what it doesn't.** No credential-less delivery: a path found in a console, a log line, a support ticket or a future bug that echoes a `public_id` no longer fetches the photo, and rotating `CLOUDINARY_API_SECRET` invalidates every URL ever issued — one revocation lever that did not exist. It does **not** expire a URL that legitimately loaded and then leaked (a shared "copy image address", a synced history entry, an ex-trainer's browser cache): a signed URL is a permanent capability until the asset is deleted or the secret rotates. Expiring delivery is Cloudinary's paid token auth or a backend proxy — both recorded with triggers in `DEFERRED_ITEMS.md`; the design note with the four options weighed is `.workbench/designer/current/task-plan-g16-media-delivery.md`.
- **Nothing changes on the device.** A signed URL is deterministic for (asset, transformation), so the service worker's CacheFirst on `res.cloudinary.com` keeps working offline; the frontend still receives ready-to-use URLs; CSP already allows `https:` images.
- **Deletes are scoped by type — and that was a trap.** Cloudinary's destroy and delete-by-prefix APIs only touch the delivery type they are told; a purge that forgot the type would report success and delete nothing. `deleteByPublicId` / `deleteByPrefix` take the access, the account purge passes `authenticated` for client folders and `public` for exercise folders, and the tests pin exactly that.
- Export (`GET /auth/export`) carries the signed URLs.
- **Existing assets** (none in production today — Cloudinary is not yet configured there): the day there are, `type: upload` assets must be renamed to `authenticated` (`uploader.rename(id, id, { type: 'upload', to_type: 'authenticated' })`) — old URLs stop working the moment the new code deploys. Script + dry-run are task 4 of the plan, deferred until there is something to migrate.
- Tests: `services/cloudinary.test.ts` (signed vs public, webp format for images, determinism, type passed on upload / destroy / prefix delete); purge asserts the per-folder access; snapshot delete asserts the type; export asserts a signed URL.

### Security — uploads typed by their bytes, lock events in Sentry (gate G17 + G20, 2026-09-15)
- **G17 — the client's `Content-Type` no longer decides what an upload is.** `lib/magicBytes.ts` sniffs the first bytes for exactly the seven accepted formats (JPEG, PNG, WebP, GIF, MP4/MOV via the `ftyp` box, WebM via the EBML header); `validateMediaFile(buffer)` now returns `{ ok, mimeType } | { ok, error }` and the sniffed type drives both the size class and Cloudinary's `resource_type`. An HTML file labelled `image/png` is refused before Cloudinary sees it; a MOV labelled `video/mp4` is corrected. All three upload routes (exercise, session-exercise clip, snapshot photo) use it; the allow-list is unchanged (HEIC still refused — surgical). No dependency: `file-type` is ESM-only from v17 and the backend is CJS; seven signatures don't need a library. Closes the "MIME type: client-supplied header" trade-off in `DEFERRED_ITEMS`.
- **G20 — sign-in failures are now observable.** Every failed sign-in logs at `warn` with an email hash, the client IP and both counters (shipped with the lockout); the *locking* failure (email scope, with `known: true|false`) and the IP-cap crossing additionally raise a Sentry security event (`kind: security`, `scope: email|ip`, tags only — no address, no hash) so an alert rule can watch for a spike. The rule itself is a Sentry setting — runbook line added.

### Security — login lockout (account plan C9, 2026-09-15)
- **Five failed sign-ins for an email pause password sign-in for the rest of a 15-minute window** (`423 Locked`, `code: ACCOUNT_LOCKED`, `retryAfterSeconds`, `Retry-After` header). Counted for **unknown** emails too, so the lock cannot be used to discover whether an account exists; the check runs *before* the account lookup for the same reason. A correct sign-in clears the counter. Devices already signed in are untouched — the lock is on password login only, which is also what bounds the "lock the victim out" nuisance (their refresh cookie keeps working).
- **Twenty failures from one address pause that address** (`429`, `code: TOO_MANY_FAILURES`) — the credential-stuffing shape: many accounts, a guess or two each. Success does not clear the IP counter.
- **Fixed window, not exponential back-off**: explainable in the UI, and 5 × 15 min is already ≈480 guesses/day. Sign-in page shows the reason and a live countdown, and holds the button until it lapses.
- **Notice to the owner** on the locking failure, when the address is a real account and mail is configured (best-effort, never awaited): "5 failed attempts; devices stay signed in; if this wasn't you, change your password when the lock lifts".
- **Store is in-process, deliberately.** `lib/loginLockout.ts` is pure logic over a `FailureStore` interface (`createMemoryStore()` today, keys are `sha256(email)` / `ip:` — no PII). The plan said Redis; the repo has no Redis *client* — `ioredis` was removed as a direct dependency on purpose (`queues/connection.ts`), BullMQ takes a URL. Adding it back is a lockfile round-trip and re-opens the duplicate-version conflict, for a counter that today has the same durability as the global rate limiter it sits next to (also in-memory, one Railway replica). `ponytail:` in the file — ceiling is a second replica; the interface is the seam for Redis or a Postgres table.
- `lib/clientIp.ts` — one client-IP derivation shared by the global rate limiter and the lockout (first `X-Forwarded-For` entry; trustworthy only if the first proxy overwrites the header — a live check, SECURITY.md G9).
- Frontend: `ApiError.body` carries the parsed error body so pages can read fields beyond `error`/`code`/`details`.
- Tests: `lib/loginLockout.test.ts` — locks on the 5th not the 4th; `justLockedEmail` once; unknown email identical; success clears; window end lifts + restarts; fixed-not-sliding; hashed keys; IP cap across emails and precedence; success leaves the IP count; reset. Route: 423 before lookup with header; 429; failures recorded for unknown email and wrong password keyed on the forwarded IP; notice only for a real account; success calls `recordSuccess`.
- **Not built yet:** Cloudflare Turnstile (register always, login after the 3rd failure) — its own step; needs a package.

### Account — change sign-in email (account plan B7, 2026-09-15)
- **Preferences → Account → Sign-in email.** New address + current password → a confirmation link goes to the **new** inbox; the sign-in email changes only when that link is redeemed. Until then the old address keeps working (a typo cannot lock anyone out), the card shows the pending address with **Cancel**, and requesting again supersedes the earlier link.
- **The token carries the target address, not the trainer row.** `email_verification_tokens.new_email` (nullable) — a token with it is a *change* token; redeeming it swaps `trainers.email`, clears `pending_email`, marks verified. A plain verification token (sent to the *current* address) can never perform the swap, which is the hole a `pending_email`-only design would have had. `trainers.pending_email` exists for display/cancel only. Both columns additive; `docs/sql/add-pending-email.sql`, drizzle `0009` — **apply to prod before deploying** (login reads `trainers`).
- **The old address is told.** On a successful swap a notice goes to the previous email naming the new one and pointing at `/forgot-password` — the owner's only signal if someone with a live session re-pointed the account. Best-effort; a failed notice never undoes the swap.
- Routes: `PATCH /auth/email { newEmail, password }` (5/15 min; 400 wrong password / same address / 60 s cooldown, 409 in use, 503 recorded-but-mail-failed) and `DELETE /auth/email/pending`, both returning the trainer (`pendingEmail` added to `TrainerResponse`). `GET /auth/verify-email` now answers 409 when the address was registered by someone else between request and click; on a swap its message names the new address and `VerifyEmailPage` shows it.
- Verification redemption moved out of `auth.service` into `services/emailVerification.service.ts` (`requestEmailChange` / `cancelEmailChange` / `redeemVerificationToken`) once a token had two meanings. `sha256`, the TTL and the cooldown are exported from `auth.service` for it.
- Tests: service — wrong password touches nothing, same-address, taken, cooldown, token bound to the new address + pending set + mail to the new inbox, send-failure keeps the pending change; cancel; redeem — plain path never changes the address, change path swaps + notifies the old address, failed notice keeps the swap, `taken` consumes the token without swapping. Routes — 401, malformed, success shape, outcome→status map, cancel, verify-email 200/400/409.

### Account — forgot / reset password (account plan B6, 2026-09-15)
- **A forgotten password is no longer a lost account.** "Forgot your password?" on the sign-in page → `/forgot-password` (email) → link in the mail → `/reset-password?token=…` (new password + confirm) → sign in. Setting a new password this way **signs out every device** — if the reset is the recovery from a compromise, the intruder's session goes with it.
- **Backend.** New `password_reset_tokens` table (SHA-256 of a 48-byte token, 1-hour TTL, single use — the same design and reasons as verification tokens; migration `0008` + idempotent `docs/sql/add-password-reset-tokens.sql`, **apply to prod before deploying**). `POST /auth/forgot-password` answers `202` identically whether the address exists, is on a 60 s cooldown, or the mail failed to send — the inbox is the only signal, so the endpoint cannot be used to enumerate accounts; outcomes are logged with a short hash of the email, and a send failure raises a Sentry security event. Requesting again invalidates earlier unused links. `POST /auth/reset-password` returns `400` with `RESET_EXPIRED` / `RESET_USED` / `RESET_NOT_FOUND`. Both public, rate-limited (5 and 10 per 15 min), and on the `no-anonymous-route` guard's public list.
- **One sender for all transactional mail.** New `services/email.service.ts` — `emailConfig(env)` requires `RESEND_API_KEY`, `REPORT_FROM_EMAIL` and `APP_URL` and throws otherwise; `sendTransactionalEmail` and `escapeHtml` are shared by the verification and reset mails. The verification email's `https://trainerapp.io` fallback for `APP_URL` is gone — an unset `APP_URL` now fails the send instead of mailing a live token to a domain we don't own.
- **Frontend.** `ForgotPasswordPage` (confirmation copy never confirms an account exists), `ResetPasswordPage` (min 8, confirm must match, missing token → "request a new link", 400 reasons shown inline with a link to request again), `useForgotPassword` / `useResetPassword` hooks, lazy public routes.
- **Not live until email is configured** — see `DEPLOYMENT.md` §1c. Resend domain verification for `just-train.fit` is on hold with the DNS cut-over.

### Account — export my data (account plan A4, 2026-09-15)
- **`GET /auth/export`** — one JSON attachment (`just-train-export-YYYY-MM-DD.json`) of every row the account owns, grouped by table: account (minus the password hash), clients, goals, snapshots + progress photos, sessions → session-exercises → sets, form-check clips, templates → exercises, challenges, private exercises, telemetry. Raw rows on purpose (portability = the data as stored, not the UI's view); media as their existing URLs. Rate-limited 3/hour; download logged. `ponytail:` assembled in memory — fine to ~100k rows.
- **Preferences → Account → Download my data.** Closes the portability promise in `/privacy` §Your rights (checklist G21 now fully mapped).
- Tests: service strips the hash, assembles the envelope, and skips per-client/media queries when nothing exists; route 401 / 200 with the attachment header.

### Account — deactivate, restore, purge (account plan A5, 2026-09-15)
- **`DELETE /auth/me { password }` — soft delete.** Re-proves the password, stamps `trainers.deactivated_at` (new column, migration `docs/sql/add-trainers-deactivated-at.sql` / drizzle `0007`), revokes every device, clears the cookie. Not exposed on `TrainerResponse` — a deactivated account can't be signed in to see it.
- **Restore by signing in.** Login on a deactivated account within **30 days** (`PURGE_AFTER_DAYS`) clears the stamp and returns `restored: true` (shared `AuthResponseSchema`); the app toasts "Welcome back". Past the window the login answers the generic "Invalid email or password" — a distinct message would confirm the email once existed. The check runs *after* the password check for the same reason.
- **Daily purge job** (`account-purge`, 01:00 UTC): for each account deactivated ≥ 30 days ago, `purgeTrainer()` deletes Cloudinary media by prefix (clients' and private exercises' folders, best-effort, failures reported to Sentry), then the database in **explicit dependency order in one transaction** — sessions → templates → challenges → clients → private exercises → tokens/events → trainer. The order is the design, not a detail: `session_exercises`/`template_exercises` → `exercises` and `client_snapshots.captured_by` → `trainers` are RESTRICT, and a bare cascade from `trainers` can hit either depending on the order Postgres happens to process it. No FK changes were needed. A private exercise still referenced by *another* trainer's rows (possible for data older than the visibility fix) is **re-homed to the public library** rather than deleted, so their history is never broken; counted in the purge report. `purgeTrainer()` is also the admin "hard purge now" utility.
- **Preferences → Danger zone → Deactivate account**: type `DEACTIVATE` + password, then the shared sign-out (`localOnly`). `/privacy` §Data retention is now real text that matches this behaviour (was `[PLACEHOLDER]`).
- Residual, documented: an already-issued access token stays valid for up to 15 minutes after deactivation (stateless JWT). Refresh is dead immediately because every token is revoked.
- Tests: service — deactivate stamps + revokes; `isRestorable` boundaries; purge order asserted table-by-table; re-home path; media failure doesn't block the DB delete. Routes — 401 / wrong password (nothing happens) / success clears cookie; login restores within the window and flags it, denies past it, and never reveals state on a wrong password.

### Account — refresh-token reuse detection (account plan A3, 2026-09-15)
- **Rotation now marks the old token instead of deleting it** (`revokedAt` + `lastUsedAt` = "rotated at" — the column existed for exactly this and had never been written). A token presented after rotation is classified by pure `classifyPresentedToken()`: **`grace`** (rotated ≤ 10 s ago — the two-tabs race, since the refresh cookie is shared across tabs) proceeds normally; **`reuse`** (older) means the token was copied → **every session for that trainer is revoked**, `warn` log, Sentry security event (`captureSecurityEvent`, level warning, `kind: security`), `401 TOKEN_REUSE`; **`stale`** (revoked by logout, never rotated) is a plain 401 — a signed-out device, not proof of theft. The client shows "You were signed out everywhere for security" on `TOKEN_REUSE` instead of a silent bounce.
- **Daily cleanup job** (`refresh-token-cleanup`, 00:30 UTC): deletes expired rows and revoked rows older than the refresh TTL — a copy of one of those has expired too. Closes the deferred "Refresh Token Cleanup Job" and "Token Reuse Detection" items. No migration.
- Tests: classifier boundaries (valid / grace incl. the 10 s boundary / reuse / stale), rotate marks-not-deletes in one transaction, cleanup; route: reuse → family revoked + cookie cleared + `TOKEN_REUSE`, grace → normal refresh, stale → plain 401.

### Account — devices (account plan A2, 2026-09-15)
- **`GET /auth/devices`** — every device with a live session (unexpired, unrevoked refresh token), grouped by the client's `X-Device-ID`, newest activity first, the caller's flagged `current`. Rotation replaces the token row, so the newest row's `createdAt` *is* last activity (the never-maintained `lastUsedAt` column is not used). **`DELETE /auth/devices/:deviceId`** — revokes that device's tokens, scoped to the caller (404 for an unknown or another trainer's device id); revoking your own device clears the cookie, i.e. logout.
- **Preferences → Account → Devices** (`components/account/DevicesCard.tsx`): "Chrome on Android · Active 3 h ago", per-device *Sign out*, and a two-step *Sign out everywhere* (existing `/auth/logout-all`). `lib/userAgent.ts` `describeUserAgent()` reduces the stored UA to browser + platform (unit-tested: Edge/Opera before Chrome, Chrome before Safari).
- **`hooks/useSignOut.ts`** — the one sign-out sequence (server revoke → query cache → auth store → session state → overlay → `/login`), extracted from `Layout`'s logout button so *Sign out everywhere* and account deactivation cannot drift from it. `Layout` now calls it.
- Tests: service grouping/sorting/name fallback + revoke true/false (`services/devices.test.ts`); routes 401 / list with current flag / 204 scoped / 404 / own-device clears cookie.

### Account — change password (account plan A1, 2026-09-15)
- **`PATCH /auth/password { currentPassword, newPassword }`** — re-proves the current password (argon2), stores the new hash, and **signs out every other device** (new `revokeRefreshTokensExceptDevice(trainerId, keepDeviceId)`; the caller's `X-Device-ID` refresh token survives). Reusing the current password is refused. Rate-limited 5/15 min. Logged at `warn` (the start of auth-event logging, checklist G20). Shared `ChangePasswordSchema` (8–100 chars, same rule as register).
- **Preferences → Account → Change password** (`components/account/ChangePasswordCard.tsx`, `lib/queries/account.ts`). Copy states up front that other devices will be signed out.
- Tests: 401 / short password / wrong current (nothing written, nothing revoked) / reused password / success (hash stored, other devices revoked, this one kept) / trainer gone.

### Security — seven IDORs closed in the session/template exercise tree (Phase 19 gate, 2026-09-14)
- **Any authenticated trainer could mutate any other trainer's session-exercises and sets, and delete any template exercise.** `POST /sessions/:id/exercises`, `PATCH`/`DELETE /session-exercises/:id`, `POST /session-exercises/:id/sets`, `PATCH`/`DELETE /sets/:id`, `DELETE /template-exercises/:id` all acted by bare id. Set logging additionally inserted when the parent session-exercise didn't exist. Each now resolves ownership through the aggregate root (`ownedSession` / `ownedSessionExercise` / `ownedSet` in `routes/sessions.ts`; relational load in `templates.ts`) and returns 404 — never 403, so nothing leaks existence. `POST …/sets` now documents its 404.
- **Circuit auto-ungroup.** Deleting a member of a 2-member circuit (session or template) demotes the survivor to a standalone exercise, in the same transaction as the delete. Closes the deferred "auto-ungroup on member delete" item.
- **Permanent guard:** `__tests__/security/ownership-guard.test.ts` scans every parameterised route and fails if the handler never uses `request.trainer.trainerId` in a scoping shape (SQL `eq`, comparison, or as an argument to a resolver — an object-literal property does not count, which is exactly how `logSyncWrite({ trainerId })` disguised the set-logging gap). It failed on all seven before the fix and passes now. It is a source check, not a proof — the mocked test db cannot evaluate `WHERE` clauses; the real-database matrix is the next gate item.
- **Second sweep — ids in request bodies (2026-09-15).** `POST /sessions` wrote `body.clientId` unchecked (sessions against another trainer's client; their KPIs / at-risk / report would count them). `exerciseId` / `exerciseIds` on add-exercise, circuits (session + template), template-exercise and challenge create accepted another trainer's *private* exercise and 500'd on unknown ids. New `lib/ownership.ts` centralises the resolvers — `ownedClient`, `ownedSession`, `ownedSessionExercise`, `ownedSet`, `visibleExercise(s)` (public OR own, the `GET /exercises` rule).
- **Four more permanent guards** in `__tests__/security/`: no-anonymous-route (source + runtime), mass-assignment, response-leak (`passwordHash`), rate-limit-presence. `serializeTrainer` exported for the leak test. `buildFullTestApp()` registers every route file and records routes for cross-cutting checks.
- **Account surface vetted** (`SECURITY.md` → "Account surface"): self-profile is safe by schema, but change/reset password, change email, device revoke, token-reuse detection, **account deletion** and **data export** are all missing — and `/privacy` promises deletion, erasure and portability today. Planned as the Phase 19 account track.
- `docs/SECURITY.md` gains the Pre-Go-Live Security Gate table (4a–4f) with dates as evidence.

### Process — PWA SDLC Phase 18 complete → Phase 19 Go Live (2026-09-14)
- Advanced with `criteria_verified: true`: a production error event and the install message were both observed in Sentry. Phase 19 is blocked on the launch gates (name, logo, domain + SSL, sign-off); nothing in it is code.

### Monitoring (PWA SDLC Phase 18) — errors, availability, field performance, first-party usage
Survey of options (Sentry / GlitchTip / PostHog / Better Stack / UptimeRobot / Vercel / Railway, free tiers checked 2026-09-14) and the level decision are in `.workbench/designer/current/task-plan-phase-18.md`. Chosen: **L2 + L3 + L4 option A** — everything on free tiers, no third-party analytics, extensible to a paid sink later.
- **Backend Sentry** (`@sentry/node`, DSN-gated, inert without `SENTRY_DSN`). `src/instrument.ts` is the first import so Fastify/pg/ioredis are instrumented. Three paths reach Sentry with **zero route changes**: `routeLog(app).error(err)` now forwards `Error` instances (every route's caught 500), Sentry's Fastify handler takes uncaught 5xx, and BullMQ `failed` events are captured from both workers and the scheduler. `authenticate` tags the request scope with the trainer id. Release = `RAILWAY_GIT_COMMIT_SHA`. `lib/sentry.ts` is the only file that imports the SDK; unit-tested inert/active behaviour.
- **Cron heartbeat.** The hourly at-risk fanout runs inside `Sentry.withMonitor('scheduler-hourly')` (crontab `0 * * * *`, 10-min margin, 15-min max runtime) — the free plan's one cron monitor. A dead scheduler worker is now an alert instead of being indistinguishable from "no clients at risk". Uptime uses the free plan's one uptime monitor on `/health` (runbook), so no second vendor account.
- **Service-worker errors reach Sentry.** `sw.ts` posts `error` / `unhandledrejection` to open windows as `SW_ERROR`; `lib/swErrorRelay.ts` rebuilds the worker's stack and captures it tagged `source: service-worker`. Before this, a throwing route handler or bad precache entry failed silently in the one place we couldn't see.
- **Vercel Speed Insights** at `sampleRate 0.2` (free tier: 10k events / 30 days, Real Experience Score). No cookie, no PII.
- **First-party product counters — `POST /telemetry` → `client_events`.** The app counts a few things about itself and sends **aggregates** (one row per name+props with a `count`, flushed every 30 s / on hide / on reconnect; never queued, never retried, never in the user's way). Events: `offline.cache_hit` (the SW signals when NetworkFirst genuinely fell back to cache — i.e. the athlete was served offline), `offline.queue_flush` (ops, failed), `session.completed`, `record.detected` (load|volume), `pwa.installed`. Names are validated (`^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$`), props are flat scalars only (no structured PII by construction), batches ≤ 50, rate-limited 60/min, trainer-scoped by the JWT.
  - **Extensibility (designer requirement):** the route writes through a `TelemetrySink` interface (`lib/telemetry/sink.ts`) — `postgres` now, `none` to discard, and a vendor sink (PostHog or any `capture`-shaped API) is a new file + a case in `createTelemetrySink()`, selected by `TELEMETRY_SINK`. The row shape (distinct id, name, props, client timestamp) is already the vendor shape, so moving to paid analytics is a field mapping, never a re-instrumentation. The analytics deferral (`DEFERRED_ITEMS.md`) stands; this is the path *to* it.
  - Migration: `client_events` table (`docs/sql/add-client-events-table.sql`, idempotent; Drizzle `0006` via `drizzle-kit generate`).
- Runbook rewritten as `docs/user-tasks/phase-18-monitoring-setup.md` (two Sentry projects, DSNs, heartbeat + uptime on Sentry, Railway alert, Speed Insights, verification incl. the PWA-reopened-twice rule and the `/_vercel/speed-insights/script.js` rewrite check). Env: `SENTRY_DSN`, `TELEMETRY_SINK`, `VITE_SENTRY_DSN` documented in both `.env.example`s and `DEPLOYMENT.md`.
- **Install signal rebuilt (found by the first real Android install producing nothing).** "Installed" is now the **first launch from the home screen** on a device — `recordFirstStandaloneLaunch()` in `lib/installPrompt.ts` detects standalone display mode, records once per device in localStorage, and fires `pwa:first-launch`, which drives both the Sentry info message and the `pwa.installed` telemetry row. The browser's `appinstalled` event (the previous signal) fires only in the tab that triggered the install, only on Chromium, never on iOS, and usually while logged out — so it under-counted by design. Telemetry now also flushes the moment a token appears, so an install recorded before login is not lost. The duplicate, dead `lib/pwaInstall.ts` / `hooks/usePWAInstall.ts` (a second `beforeinstallprompt` capture that never dispatched anything) is deleted.
- **Service-worker registration is ours now.** vite-plugin-pwa's injected `/registerSW.js` is a bare `navigator.serviceWorker.register()` with no handler; on a Galaxy S20 / Chrome 143 it rejected and surfaced as an anonymous `Error: Rejected` unhandled rejection — the first real event Sentry caught. `injectRegister: null`; `main.tsx` registers via `virtual:pwa-register` with `onRegisterError` → Sentry, tagged `source: sw-registration`. Root cause of that rejection is **not yet known** (see DEFERRED_ITEMS → SW Update Strategy).
- **Source maps.** `@sentry/vite-plugin` uploads hidden maps when `SENTRY_AUTH_TOKEN` is set (Vercel Production), release = `VERCEL_GIT_COMMIT_SHA`, maps deleted after upload; `build.sourcemap: 'hidden'`. Without the token the build is unchanged. The first event showed `js_no_source` — symbolication was promised in the survey and was not actually configured until this.
- **IP addresses.** Sentry stored `user.ip_address` + city-level geo on the first browser event **despite** `sendDefaultPii: false` — for browser events Sentry infers the IP server-side from the ingest connection. Fixed by the project setting *Security & Privacy → Prevent Storing of IP Addresses* on both projects (human step, done 2026-09-14). The SDK flag alone does not make the privacy page's "no IP address" sentence true; the runbook now says so.
- **Privacy.** Sentry and Vercel Speed Insights added to the processors list on `/privacy` (the page's "no third parties beyond the processors listed" sentence has to stay true). What the paragraph promises is pinned in code, not left to SDK defaults: `sendDefaultPii: false` in both inits, `beforeSend` strips query strings (frontend) and drops request body / cookies / query (backend) — unit-tested. Session replay is off. Decision recorded: Sentry is an *infrastructure* processor like Railway/Vercel/Cloudinary/Resend (it sees failures, not behaviour), so it does not contradict the analytics deferral; the SDK is protocol-compatible with self-hosted GlitchTip, so the exit is a DSN change. Sentry's Developer plan is free with no time limit (the 14-day trial is of the paid Business tier) — 1 member, 5k errors/mo.
- **Deliberately not done:** session replay (would record training screens), PostHog, a status page, log shipping — all recorded with triggers under `DEFERRED_ITEMS.md` → "Monitoring L5".

### Process — PWA SDLC Phase 17 closed incomplete → Phase 18 (2026-09-14)
- Brand & Identity was advanced with `criteria_verified: false` by explicit decision: the three code-side criteria are met, the four remaining (name, logo SVG, domain + SSL, sign-off) are external and now gate **launch** (Phase 19), not monitoring work. ~~The product name is undetermined~~ — **resolved 2026-09-15: Just Train, domain `just-train.fit` acquired.** Chosen because it says what the app is ("we are here to train, and that's it"), and it was already the repo/Vercel/Railway name. Logo, USPTO clearance and sign-off remain launch gates; DNS/SSL cut-over and the Resend sender domain are now unblocked.

### Save as template — now actually saves the plan
- **"Save as template" copied nothing.** `handleSaveAsTemplateConfirm` created a template with the typed name and zero exercises, then toasted "Template saved!" — silent data loss for anyone who assumed it worked. It now deep-copies the session's plan.
- **New `POST /templates/from-session`** `{ sessionId, name, description? }` — fork with a different source table. Copies every planning field of the session's exercises (targets, ramp step, per-side mode, notes, circuit grouping — never the sets), remaps circuit ids to fresh per-template ids (members that shared a group still share one), and writes the header and rows in **one transaction**. Refuses a session with no exercises (400) — an empty template is exactly the failure this replaces. Session-scoped to the trainer (404 otherwise). Returns the full template detail.
- **Reachable from a completed session.** New shared `SaveAsTemplateButton` (owns the name prompt + mutation) sits beside the delete affordance in both single-session views — `SessionHistoryPanel` and the standalone `SessionHistoryPage` — and replaces the plan panel's inline copy. Not on list rows (a row is for choosing). Renders nothing until the session has exercises.
- **Templates now carry the two session-only planning fields**, so session → template → session is lossless. Migration (additive, nullable): `template_exercises.target_weight_step real` and `template_exercises.track_per_side boolean` — **tri-state**: `null` = inherit from the exercise's laterality on apply (today's behaviour, and what the template builder produces), `true/false` = explicit, captured from a session. Nullable on purpose: a `NOT NULL DEFAULT false` would have flipped every existing template's unilateral exercises to "together". Prod SQL: `docs/sql/add-template-exercise-step-and-per-side.sql`; Drizzle migration via `npx drizzle-kit generate`.
  - `POST /templates/:id/exercises` and `POST /templates/:id/circuits` accept `targetWeightStep` (+ `trackPerSide` on exercises). `CreateTemplateCircuitSchema` no longer omits the step, and the template circuit builder shows the `+ / set` ramp control.
  - Apply: `trackPerSide = te.trackPerSide ?? laterality === 'unilateral'`; `targetWeightStep` flows through.
- **One field list for all three copiers.** New pure `lib/exerciseCopy.ts` — `createCircuitRemapper()` (the Map + `randomUUID` closure that was duplicated verbatim in fork and apply) plus `toTemplateExerciseRow` / `toSessionExerciseRow`. Save-as-template, `POST /templates/:id/fork` and template application in `POST /sessions` all go through it: `rows = src.map(mapper)` → one multi-row insert → inside `db.transaction`. Unit-tested (`__tests__/lib/exerciseCopy.test.ts`) — the "copies every planning field" cases are the check that a new column reached all three copiers, which nothing caught before.
  - **Fork and apply are now atomic too.** Both previously inserted rows in a `for…await` loop with no transaction — a mid-loop failure left a half-copied template / a planned-looking-but-empty session.
  - **Security fix (found here):** `POST /sessions` applied `templateId` **without** checking the template belonged to the trainer — any trainer could instantiate another trainer's template by id. Now scoped to the owner (404), matching the earlier fork fix. No session row is written for a template you cannot see.
- Closes the deferred "carry a session's circuits into a template" (it rides on the copy) and "`targetWeightStep` on templates" items.

### End session — one step, one window
- **Ending a session used to take two trips.** Confirming the "how did you feel" sliders completed the session server-side, but the flow then bounced to the dashboard; you had to resume the session and end it a *second* time before the wrap-up (and the session-name field) appeared — being asked for feedback both times, with the second set of scores overwriting the first. Now it is one window and one confirm.
  - **Root cause (two stacked bugs).** `LiveSessionContent.handleEndSession` cleared the session store inside the mutation's success callback and *then* tried to show the wrap-up — but `activeSessions` going empty makes `ActiveSessionOverlay` bail (`sessionCount === 0` → `return null`), unmounting the very tree the wrap-up renders into. Separately, that callback was passed per-call to `mutate(_, { onSuccess })`, and React Query drops those when the calling component unmounts before the mutation settles. Fixed by deferring the store clear to the point of navigation (`finishSession()`) and awaiting `mutateAsync` so the continuation lives in the component's own closure.
- **New `SessionCloseout` component** replaces `EndSessionModal` + `PostSessionWrapUp`: session name → what you did (exercises, sets, volume, PRs, challenge progress) → how you felt, with one **Finish session** button. Nothing is written until Finish, so abandoning the window leaves the session `in_progress` and resumable rather than closed-but-unnamed.
- **One request instead of two.** Completion, scores and name now travel in a single `PATCH /sessions/:id` (the route already accepted `name`). The name can no longer land without the completion or vice versa, and offline it queues as one operation rather than two that could replay out of order.
- **Default session name is now date-stamped** — leave the field blank and the session saves as `Session - Aug-28-26`, identical in form to typing `Session - {date}` by hand. Stored rather than computed at render, because the monthly report builds its session table on the backend and prints the name only when present, so a display-only fallback would show in the app and vanish from the email. The "Saves as …" preview now shows even for an empty field, so the default is a visible choice rather than a surprise found later in history. New `defaultSessionName()` in `lib/sessionName.ts`, unit-tested.
- **"How you felt" is genuinely optional now.** The three sliders previously defaulted to 7 / 7 / 5 and were written on *every* session whether or not anyone touched them — so sessions where nothing was reported were recorded as if 7/7/5 had been, and the Avg energy / Avg stress KPI cards averaged those invented values in with real ones. The section now carries a dismiss (×), renders muted until a slider is actually moved, and **omits** `energyLevel` / `mobilityFeel` / `stressLevel` entirely unless one was. The empty-session "End Anyway" path omits them too — it never showed the sliders in the first place.
  - Keys are **omitted, never sent as `null`**: `UpdateSessionSchema` declares all three `.optional()` but not `.nullable()`, so a literal `null` is a 400. The PATCH handler spreads the parsed body and Drizzle drops undefined keys from the SET clause, so an omitted score leaves the column untouched.
  - The session note is a separate field and is unaffected by dismissing the sliders — collapsing one must not discard the other.
  - ⚠️ **KPI discontinuity, deliberate and not backfilled.** Sessions logged before this change keep their synthetic 7/7/5, while newer un-touched sessions store nothing. Avg energy / Avg stress therefore straddle two meanings across that boundary. Historical rows were left alone on purpose: inventing or deleting values the athlete never gave is worse than a documented discontinuity. Both `avg()` helpers already return `null` (not 0) for an empty set, and the report omits the section entirely, so a skipped session reads as *no data* rather than *zero energy*.

### Delete a saved session
- **A saved session can now be deleted from anywhere it can be opened.** A trash affordance flips to a two-step `Keep` / `Delete` confirm in place — the same inline pattern the in-progress card already uses for Cancel, rather than a new modal. The backend route (`DELETE /sessions/:id`, trainer-scoped, cascades to workouts/exercises/sets) and the `useDiscardSession` hook already existed; this makes them reachable.
- **It lives in the session view, not in list rows.** A list row is for choosing a session, not destroying one, and a trash icon on every row invites a mis-tap on the way to opening something. Both views that show a single session carry it: the `SessionHistoryPanel` (opened from the sessions list and the dashboard's Recent Sessions) and the standalone `SessionHistoryPage` (still linked from the client-profile timeline and from the per-exercise history rows). Deleting from either closes / navigates back, since the view is showing a session that no longer exists.
- Shared `DeleteSessionButton` + `useDeleteSession` rather than a copy per view. The hook also drops the session from the client-side store and hides the overlay if it was focused, so a deleted session cannot leave a phantom pill or a stale "Resume" card on the dashboard — cleanup that is easy to get subtly different if duplicated.
- On a failed delete the confirm resets in place rather than navigating, so the session stays visible instead of the view closing on something that still exists.
- **Records and KPIs self-correct; challenge progress does not.** Load/Volume records and every KPI are derived from the surviving sets at read time, so they recompute as soon as the session is gone. Challenge `currentValue` is *stored* — `sessions_completed` counters and `max()`-based exercise challenges are not reversed by a delete. Logged in `DEFERRED_ITEMS.md`.

### Circuits (interwoven exercises)
- **Log a group of exercises round-major.** A circuit is a named group performed in rounds — one set of each exercise, then loop — instead of finishing one exercise before the next. You log each set the instant you finish it (1-for-1) rather than doing the whole box then catching up. Motivating case: a 5-exercise shoulder box, same weight, 3 rounds.
- **Model:** one nullable `circuit_id` on `session_exercises` (+ `template_exercises`). Members sharing it are one circuit; **rounds = the shared `target_sets`**; order = `order_index`. Sets stay per-exercise, so volume, PRs, per-side, and per-exercise history/progress all keep working untouched — the circuit is a grouping + execution-order overlay, not a fork. Migration `0004` (idempotent, additive). No `circuit_label` column — the label is derived from the members' shared body part ("Shoulder Circuit").
- **Create:** `POST /sessions/:id/circuits` — generates one shared `circuit_id`, stamps rounds→`target_sets` + shared reps/weight across members, contiguous `order_index`, per-side inherited from laterality; guards single workout type (v1). Shared `CreateCircuitSchema`.
- **Live execution (`CircuitBlock`):** the live session groups by `circuit_id` and renders round-major — header "Shoulder Circuit · Round 2 of 3", a progress grid (exercise × round), and the current exercise's full input (reusing `ExerciseBlock`, so per-side/prefill work inside it). Logging advances to the next exercise in the box; **rest fires only when a round completes** (not per set); PR flash still per set. Position is derived from logged set counts, so it's reload-proof. Ending early leaves unlogged work simply absent (sets only exist once logged).
- **Creation UX (`CircuitBuilderSheet`):** "Add Circuit" sits beside "Add Exercise" in the live Start-Training flow **and** the plan builder. Batch multi-select (exercises numbered in round order) + rounds/reps/weight → create. v1 resistance-only (mixed-type deferred).
- **Read-view bracketing:** session history + post-session summary now group a circuit's exercises inside one bracketed block, headed by the derived "{BodyPart} Circuit" label and its round count (e.g. "Shoulders Circuit · 3 rounds · interwoven"). Members still render per-exercise (sets/PRs/volume unchanged); the grand-total volume is unaffected. New pure `lib/circuits.ts` (`groupExercisesByCircuit` + `circuitLabel`, unit-tested) drives both this and the live header — the label helper was extracted out of `CircuitBlock` (DRY). A circuit left with a single member (e.g. after a member was deleted without ungrouping) is demoted to a normal exercise card, never a bracket of one.
- **New-circuit sheet reworked to match "Set targets."** The Rounds/Reps/Weight controls previously sat in one horizontal row that overflowed narrow phones (the weight field was pushed off-screen — you had to slide sideways to reach it, if at all). They now **stack vertically** — Rounds → Reps / set → Starting weight · **+ / set** — mirroring the exercise Set-targets step, and the whole sheet scrolls (`BottomSheet`). Weight accepts decimals (kg).
  - **Added `+ / set` (weight ramp) to circuits.** `CreateCircuitSchema` + backend gain `targetWeightStep` (the `session_exercises.target_weight_step` column already existed — no migration); a live "100 · 150 · 200" ramp preview renders under the weight fields. Shared start+step apply to every member for now (per-exercise weights deferred).
  - **Body-part filter in the exercise search.** A compact "All / {body part}" button opens a popup select (from `useBodyParts`) that narrows the resistance list to one body part — small footprint when inactive.
  - `weightRampSequence` extracted from `AddExerciseSheet` into `lib/weightRamp.ts` (DRY — shared by both sheets).
- **Templates carry circuits (Task 4, backend).** A circuit saved in a template now survives being applied or forked, as an independent group.
  - **Application remap:** `POST /sessions` with a `templateId` maps each distinct template `circuitId` → a fresh per-session `circuitId` on the copied `session_exercises`, so applied sessions get their own independent circuits (members that shared a group in the template still share one). Standalone exercises stay `null`.
  - **Fork remap:** `POST /templates/:id/fork` remaps circuit ids the same way (it previously dropped `circuitId` entirely).
  - **Create-in-template:** new `POST /templates/:id/circuits` — the template mirror of the session circuit endpoint (one shared `circuitId`, rounds→`targetSets`, shared reps/weight, contiguous `orderIndex`, single-type + ownership guards). Appends at `max(orderIndex)+1` (not row count) so gaps from deletions can't duplicate an index. New shared `CreateTemplateCircuitSchema` = `CreateCircuitSchema.omit({ targetWeightStep })` — templates have no weight-step column, and omitting (not silently dropping) keeps the API honest. `TemplateExerciseResponseSchema` is now exported.
  - **Security fix (found here):** `POST /templates/:id/fork` looked up the source template by id **without** a trainer-ownership scope, so any trainer could deep-copy another trainer's template. Now scoped to the owner (matches `GET /templates/:id`).
  - Migration-free — `template_exercises.circuit_id` already existed. Tests: application remap, fork remap, create-in-template (shared id, rounds→targetSets, single-type guard, max-index append).
  - **Frontend — create a circuit in the template builder.** `TemplateBuilderSheet` gains an **"Add circuit"** button beside "Add exercise"; it opens the same `CircuitBuilderSheet`, now generalized to target either a session or a template (`sessionId?` / `templateId?` — existing session call sites unchanged). In template mode the `+ / set` ramp control is hidden (templates have no weight-step column). New `useCreateTemplateCircuit` hook → `POST /templates/:id/circuits`, invalidating the template detail. Full chain now works end-to-end: build a template circuit → apply the template → the session gets the circuit (via the remap above).
- **Deferred:** ~~carry a *session's* circuits into a saved template~~ and ~~`targetWeightStep` on templates~~ — both shipped with "Save as template" above. Still open: bracketing circuit members visually inside the template builder's exercise list (they render flat but apply correctly) — and, relatedly, the builder's drag-reorder can drop a standalone exercise between circuit members, splitting contiguity so a read view would show two brackets (same accepted reorder-contiguity hazard sessions already have, now reachable in templates); mixed-type circuits; per-exercise round counts; circuit-membership editing; ~~**auto-ungroup on member delete**~~ and ~~the missing trainer-ownership guard on `DELETE /session-exercises/:id`~~ — both shipped 2026-09-14 (Security section above).

### Per-exercise history + progress analytics (athlete-first)
- **The exercise detail now shows your own history + progression for that one exercise** — answers "is my bench actually growing?" without digging through session history. Resistance only for v1 (non-resistance hides the section); athlete/self-client scoped (trainer-per-client deferred as the product focus shifts athlete-first).
- **Headline:** estimated 1RM (Epley) with an est-1RM **sparkline** over time, plus current top-set weight and best volume, and the overall highest-weight rate-of-change (`▲ +20 lb · 6 wks`).
- **Per-set rate-of-change:** the **top-3-heaviest** sets per session tracked independently over time (Heaviest / 2nd / 3rd), each with its own weight trend. Ranking by weight (not set order) means a warm-up drops out on its own once there are ≥3 work sets.
- **History list:** every session with the exercise — date, top set (wt×reps), est 1RM, volume — tap a row to open that session.
- Backend: `GET /clients/:id/exercise-progress/:exerciseId` (self-client scoped, resistance-aware). Pure, unit-tested cores: `lib/progression.ts` `weightTrend()` (least-squares slope for direction, first→last delta for display) and `lib/exerciseProgress.ts` `buildExerciseProgress()` (grouping, top-3 ranking, est-1RM/volume). Volume/1RM route through the shared `setMath` so per-side work counts correctly. Shared `ExerciseProgressResponseSchema` + `WeightTrend`.
- Frontend: `components/charts/Sparkline.tsx` (dependency-free inline SVG, `currentColor`), `useExerciseProgress` hook, `ExerciseProgressSection` rendered on `ExerciseDetailPanel` below the description.

### Fixed — exercise detail bottom sheet (scroll + layering)
- **Background no longer scroll-through.** The `BottomSheet` sits inside Layout's scrollable `<main>`, so touch-drags on the sheet scrolled the page behind it (`body { overflow: hidden }` couldn't stop it — the scroller is `<main>`, not `<body>`). The open effect now locks both `<body>` and the nearest scrollable ancestor, restoring each on close; `overscroll-contain` on the sheet's own scroll area as a backstop.
- **Sheet no longer hidden behind / dimmed by chrome.** Backdrop → `z-[54]`, sheet → `z-[55]` (above the mobile tab bar's `z-50`), so the footer CTA and lower content are visible and tappable, and the sheet isn't dimmed by its own backdrop.

### Fixed — content/buttons hidden behind the mobile tab bar
- **All in-`main` content now clears the bar with margin.** `<main>` used a flat `pb-20` (80px) that (a) never added the device safe-area inset, so on a notched phone the ~89px-tall nav overlapped page content, and (b) left only ~13px on a normal phone. New `pb-nav-clear` = `calc(6rem + env(safe-area-inset-bottom))` (tab-bar height + safe area + ≥15px margin), defined as a spacing token in `tailwind.config.js` (`nav-clear`, plus `sheet-bottom`) so the `env()` calc lives in config, not a fragile arbitrary-value class. `md:pb-0` unchanged.
- **Post-session wrap-up "View summary" button no longer sits under the bar.** `PostSessionWrapUp` was `z-50` — equal to the nav, so the bar painted over its bottom. Raised to `z-[55]`; panel gets `pb-sheet-bottom` so the button also clears the home indicator. (It only collided on the `/session/:id` inline path, where the nav is visible; in the full-screen overlay the nav is already hidden.)
- **`TemplateExercisePickerSheet`** (renders in `<main>`) raised `z-50` → `z-[55]`; its scroll list gets `pb-sheet-bottom`.
- **`NamePromptModal`** mounts inside `SessionPlanPanel` (a `z-[10]` stacking context), so a z-index bump would be capped and can't out-stack the nav — instead its card is lifted clear of the bar with `pb-nav-clear` (`items-end`), keeping its bottom-docked design while clearing the bar.
- Docs: `PROJECT_STATE.md` Z-Index Layer Stack corrected (sheets/modals over the nav are 54–55, not the original 30/40) with the stacking-context caveat.

### Unilateral (per-side) set tracking
- **Single-limb exercises are now counted correctly.** A Bulgarian split squat logged as "10" means 10 *per side* — the athlete still enters one number, but volume, PRs, and totals count both sides (20). An L/R drill-down captures asymmetry ("left leg got 9, right got 10") without complicating the default flow.
- **Schema (additive):**
  - `exercises.laterality` — `pgEnum('laterality', ['bilateral','unilateral'])`, `NOT NULL DEFAULT 'bilateral'`. `unilateral` surfaces the per-side toggle + drill-down. (New shared `LateralityEnum`.)
  - `session_exercises.track_per_side` — `boolean NOT NULL DEFAULT false`. The persisted toggle state; defaults `true` when a unilateral exercise is added (derived from laterality, incl. template application). Input mode only.
  - `sets.per_side` (`boolean NOT NULL DEFAULT false`) + `sets.reps_left` / `sets.reps_right` (`integer`, nullable). The set **snapshots** `per_side` at log time (like `weight_unit`) so volume never recomputes if the toggle later changes; L/R written only when the drill-down splits them.
  - Migration: `npx drizzle-kit generate` (CREATE TYPE + 3 ADD COLUMNs — all backward-compatible; existing rows read as bilateral, zero recompute). Classification data: `docs/sql/set-exercise-laterality.sql` (idempotent, `BEGIN…ROLLBACK` dry-run) flips the 12 unilateral movements to `unilateral`.
- **The single volume source:** `packages/shared/src/utils/setMath.ts` — `sideReps(set)` (`perSide ? (repsLeft ?? reps) + (repsRight ?? reps) : reps`) + `setVolume(set)`. **All** volume now routes through it: backend PR/record derivation (`prRecords.ts` — Volume PR counts both sides, Load PR unchanged), KPI monthly/trend volume, monthly report volume; frontend `SessionExerciseBreakdown`, `SessionHistoryPanel`/`Page`, `SessionSummaryPage`, `PostSessionWrapUp`. Unit-tested (`__tests__/lib/setMath.test.ts`, plus a per-side volume-record case in `prRecords.test.ts`).
- **Classification (12 unilateral):** Bulgarian Split Squat, Lunges, Barbell Lunges, Dumbbell Row, Dumbbell Curl, Hammer Curl, Glute Kickback, Pallof Press, Hip Flexors (Rotary Machine), Side Plank, Dumbbell Front Raise, Dumbbell Shoulder Press. Tagged in `exercises-library.json` (+ seeder maps `laterality`); everything else stays bilateral.
- **Routes:** `POST /sessions/:id/exercises` derives `trackPerSide` from laterality (honouring an explicit body value); `POST …/sets` snapshots `per_side` from the session-exercise and counts both sides in the live record flash; new `PATCH /session-exercises/:id` flips the toggle (also adjusts targets). `GET …/exercise-history/:exerciseId` now returns `perSide`/`repsLeft`/`repsRight` so prefill can restore an asymmetric split. Shared: `SetResponseSchema` +`perSide`/`repsLeft`/`repsRight`, `SessionExerciseResponseSchema` +`trackPerSide`, `ExerciseSummaryResponseSchema` +`laterality`; new `UpdateSessionExerciseSchema`; `CreateSetSchema`/`AddSessionExerciseSchema`/`CreateExerciseSchema` gain the input fields.
- **Live session UI (`ExerciseBlock`):** on the resistance path, unilateral exercises show a **"Reps / side"** input with an **"×2 · both sides counted"** hint and an **"Uneven? Log L / R"** drill-down (two rep fields, prefilled equal, collapse when even). An **"Each side ⟷ Together"** toggle on the exercise header flips `trackPerSide`. Logged rows read `10 ea` (symmetric) · `9 / 10` (asymmetric) · `12` (bilateral) via the shared `formatSetReps` (DRY across live/summary/history).
- **Test factories:** shared `makeSet` / `makeSessionExercise` added to `factories.ts` (+ `laterality` on the exercises test factory), consumed by the new per-side tests.
- **Decisions / v1 scope:** weight asymmetry out (shared weight per set); the per-side toggle appears only on flagged exercises; templates inherit the exercise default (superseded: `template_exercises.track_per_side` was added, tri-state, with "Save as template" — `null` still inherits). Known limits (deliberate): the per-side *input* is wired on the resistance rep path only (time-based unilateral like Side Plank shows the toggle but no hold-time split); Personal Bests single-set volume magnitude stays raw (`ponytail` — folds into the records section rework); the `AddExerciseSheet` target form isn't yet labelled per-side (targets already resolve per-side at execution).

### Session weight ramp (per-set increment)
- `session_exercises.target_weight_step` (`real`, nullable) — the per-set weight increment for a live ramp (e.g. `50` = raise each set by 50). **Only the starting weight (`targetWeight`) and this step are stored** — the expanded per-set values are computed live, never persisted (no per-set weight array, consistent with the "athlete owns the weight" decision).
  - Additive migration: `docs/sql/add-target-weight-step-column.sql` (prod) / `pnpm db:push` (local).
  - Shared: `AddSessionExerciseSchema` (input) + `SessionExerciseResponseSchema` (response) gain `targetWeightStep`.
- `AddExerciseSheet` — resistance targets add a **"+ / set"** control beside "Starting weight" with a live preview (`100 · 150 · 200 · 250`). Sent only when a starting weight is present and "Use last time" is off.
- `ExerciseBlock` — live prefill: set 1 uses the starting weight; each later set pre-fills from the **previous in-session set's actual weight + step** (compounds from what was actually lifted; always editable). Non-ramp and "Use last time" prefill paths are unchanged.

### Exercise library
- Added **Good Mornings** (resistance/compound) and **Hip Flexors (Rotary Machine)** (resistance/isolation) to `exercises-library.json`. (Hip Abductors / Hip Adductors were already present.)
- `docs/sql/add-hip-leg-exercises.sql` — idempotent prod insert for all four leg/hip exercises (guards on name; safe to re-run).
- Added **7 back & shoulder exercises** to `exercises-library.json` (seed total 112 → 119):
  - Back: **Pendlay Row** (compound/barbell), **Yates Row** (compound/barbell), **Overhead Face Pulls** (isolation/cable), **Machine Shrugs** (isolation/machine), **Diamond Bar Shrugs** (isolation/barbell).
  - Shoulders: **Dumbbell Upright Row** (compound/dumbbell), **Monkey Rows** (compound/dumbbell — wide upright-row variant, lateral-delt/trap bias).
- Reclassified **Face Pull** in the seed from `shoulders` → `back` (it's a trap/upper-back movement). In prod the existing Face Pull rows are trainer-owned copies and were already `back`, so no data change was needed there.
- `docs/sql/add-back-shoulder-exercises.sql` — idempotent prod insert for the 7 new exercises (guards on name; safe to re-run) plus an idempotent `UPDATE` that moves a *public* Face Pull to `back` if one exists (no-op against current prod, where Face Pull rows are trainer-owned and already `back`).

### Exercise library → single public shared library
- **Registration no longer copies the exercise library per trainer.** `auth.ts` previously called `seedExerciseLibrary(trainer.id)`, inserting a private copy (`trainerId` set, `isPublic: false`) of the whole library for every new trainer — the source of duplicate rows (5× `Face Pull`, etc.). It now calls `seedDefaultTemplates(trainer.id)` directly (templates resolve exercise names against the shared public rows). Visibility is `trainerId = current OR trainerId IS NULL`, so the shared public library (`trainerId IS NULL`) is visible to all trainers.
  - `seedExerciseLibrary` in `db/seed-exercises.ts` is now unused (dead code — safe to remove in a later cleanup; left in place to keep this change surgical).
- `docs/sql/migrate-exercises-to-public-library.sql` — one-off prod dedup: for each standard exercise name (already public, or owned by ≥2 trainers) it promotes one canonical row to public, repoints every `session_exercises` / `template_exercises` / `challenges` / `exercise_media` reference to it (both exercise FKs are `ON DELETE RESTRICT`), then deletes the duplicate per-trainer copies. Genuinely custom exercises (owned by one trainer, no public counterpart) are left private. Runs in a single transaction with before/after reports; dry-run by switching the final `COMMIT` to `ROLLBACK`.
- `docs/sql/cleanup-overhead-face-pulls-draft.sql` — one-off: repointed the single referencing session then deleted the redundant trainer-owned `overhead face pulls` draft (superseded by the public `Overhead Face Pulls`). Applied to prod 2026-07-27.
- `docs/sql/merge-casual-draft-exercises.sql` — one-off: merged 7 casual-named private drafts (`good morning`, `hip abductors/adductors`, `hip flexors`, `shrugs`→Machine Shrugs, `yates rows`, `pullups`) into their public equivalents (repoint refs, then delete). Applied to prod 2026-07-27; 0 private rows remain.
- **Deleted dead `db/seed-exercises.ts`** — the hardcoded 129-exercise per-trainer library and `seedExerciseLibrary`, orphaned once registration switched to `seedDefaultTemplates`. Its `seedBodyParts` was a duplicate of the canonical `seeds/bodyParts.ts` (used by `db:seed`). Backend typecheck passes.
  - **Known divergence (deferred):** `exercises-library.json` (the remaining seed source) does not match prod — prod's public library was built from the deleted hardcoded list and uses its naming (`Pull-up`, `Push-up`, …). Documented in `docs/LOCAL_DEV_CATCHUP.md` with a reconciliation plan (dump prod → regenerate JSON). Local-dev fidelity only; prod is correct and not re-seeded.

### Tooling / process
- **Prod-mutating SQL now defaults to `ROLLBACK`.** One-off data migrations are authored as a single `BEGIN … ROLLBACK` transaction with before/after report SELECTs, so running as-is is a dry run; applying is a deliberate `ROLLBACK`→`COMMIT` edit. Rationale + fail-safe conventions (resolve by name not UUID; unmatched rows skip) added to `docs/DEPLOYMENT.md`.

### Personal records — Load / Volume PRs (replaces the auto-1RM chip)
- **Chips are now derived "current record holder," not a frozen per-set flag.** Previously every qualifying set stored `isPR` (Epley 1RM) + `isPRVolume` at log time and kept the badge forever — so every set (and the first-ever baseline) showed a badge that never cleared when beaten. Now the badge lives only on the set that *currently* holds the record and moves off the old holder automatically.
- **Two markers: Load PR** (heaviest `weight`, any reps) and **Volume PR** (`weight × reps`). The auto **1RM** chip is gone — 1RM belongs to planned/analysis contexts (est. Epley + true singles), deferred to the records section. This also fixes "10-rep sets showing a 1-rep-max badge."
- **Baseline excluded:** the first-ever set of a client+exercise earns nothing (there was nothing to beat); the next set can. **Ties:** the earliest set keeps the record (strict `>`).
- Backend: `apps/backend/src/lib/prRecords.ts` — pure `deriveRecordSetIds` (unit-tested, `__tests__/lib/prRecords.test.ts`). `GET /sessions/:id` derives records across the client's full history for the session's exercises and annotates each set with `isLoadRecord` / `isVolumeRecord`; `POST …/sets` computes them at log time (baseline-suppressed) for the live flash. Epley `isPR` detection removed; the `is_pr` / `is_pr_volume` columns are deprecated (unread; a later migration can drop them).
- Shared: `SetResponseSchema` gains `isLoadRecord` / `isVolumeRecord`; `isPR` / `isPRVolume` marked deprecated.
- Frontend: live chips (`ExerciseBlock`), history chips (`SessionHistoryPanel`, `Load` / `Vol`), the "New PR" flash (`WorkoutBlock`), and the post-session PR count/callouts (`PostSessionWrapUp`) all read the derived fields. `useLogSet` already invalidates the session query, so logging a new record refreshes and moves the chip.
- **Next:** per-exercise records section in history (Load PR, Volume PR, true 1RM, est. 1RM), where the 1RM analytics land.

### Post-workout summary — exercise breakdown
- The `SESSION DONE` screen (`SessionSummaryPage`) now shows a per-exercise breakdown below the stat tiles: each exercise → its sets (reps × weight, colour-coded green/amber vs target), Load/Vol record chips, a per-exercise **volume subtotal** and **est. 1RM** (Epley of the best set), and a **grand-total volume** footer row. Frontend-only — the data was already on the page via `useSession`.
- New shared component `components/session/SessionExerciseBreakdown.tsx` (props: `sessionExercises`, `showVolumeTotals`, `showEst1rm`, `prFilter`, `renderMediaThumbs`). `SessionHistoryPanel` was refactored to render through it (behaviour-preserving — keeps its PR filter + media thumbs, no totals/est-1RM), removing the duplicated set-row markup that had already drifted once during the Load/Volume rename.

### Post-completion workout name — {date} token
- The post-session name field (`PostSessionWrapUp`) accepts a `{date}` token that resolves to the workout's date in a short friendly form — "Leg Day - {date}" saves as "Leg Day - Jul-28-26". Resolved at save time (`LiveSessionContent.handleWrapUpDone`) and stored as the literal string (what's stored is what's shown). A live "Saves as …" preview appears under the input while typing.
- `lib/sessionName.ts` — pure `resolveNameTokens` (extensible token map, case-insensitive, unknown `{tokens}` pass through) + `formatShortDate`. Unit-tested (7 cases).
- New `components/ui/HintPopover.tsx` — reusable circular info button + popover with **swipe-to-dismiss** (fling horizontally past ~50px, animates out; backdrop-tap + Escape fallbacks). Takes a `glyph` prop ("?" for help, "i" for info). Used for the `{date}` token hint and the Personal Bests metric tooltips — the inline `InfoTip` in `PersonalBestsTab` was removed in favour of it (DRY; adds swipe-to-dismiss there too).

### Docs
- `docs/GESTURE_GUIDE.md` — new plain-language map of every shipping touch gesture and interaction animation (what it does, where, and the component behind it), written to be read by an end user. Includes a **developer palette** of the `ux-events` motion vocabulary (8 wired today; the rest defined and ready). Governing rule: update it in the same commit as any interaction change.
- `CONTRIBUTING.md` — new "UI interactions & gestures" section pointing to that same-commit rule, plus a release-checklist item.

### Changed
- **`BottomSheet` now closes on a swipe-down of its drag handle** (handle-scoped, mirroring `ActiveSessionOverlay`; tap-backdrop + Esc unchanged) — its header already advertised "swipe down" but it was never wired. `GESTURE_GUIDE.md` updated to match (gap closed).
- Extracted the drag-handle swipe-to-dismiss into `hooks/useSwipeDismiss` — `ActiveSessionOverlay` (minimise) and `BottomSheet` (close) now share it (`<div {...useSwipeDismiss(onClose)} />`) instead of duplicating the touch math. Behaviour unchanged.

### Database
- **Reconciled Drizzle migration drift.** `idempotency_keys` (v2.14.1) and `session_exercises.target_weight_step` were applied to prod via `db:push` / manual SQL but never captured in a generated migration. `drizzle/0002_reconcile_idempotency_and_weight_step.sql` now adds both — fully **idempotent** (`CREATE TABLE IF NOT EXISTS`, FK guarded by a `duplicate_object` exception, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) — plus the updated `meta/` snapshot + journal, so `drizzle-kit generate` is clean going forward and a fresh DB builds the complete schema.
  - **Prod:** already has both changes and has never used the migration runner, so treat `0002` as **already-applied (baseline the migration table)** rather than running it. Because every statement is guarded, an accidental run against prod is a harmless no-op.

### Task 6 (exercise-UI rework) — verification
- Confirmed per-set **reps** prefill (`targetRepsPerSet` → `getSetTargetReps`) and per-set **weight-from-history** prefill (`GET /clients/:id/exercise-history/:exerciseId` returns every set of the last completed session, indexed by set position). The authored weight ramp was intentionally not built as a persisted per-set array — replaced by the start-+-step model above.

### Fixed
- **Athlete dashboard: removed the duplicate "MY TRAINING" card.** The `selfTraining` widget (Start Training / Profile) duplicated the top action hub (TRAIN + profile), so it's now excluded for athletes and dropped from the default athlete widget order. Also stopped the Phase-7 widgets (`volume` / `streak` / `newClients`) from reserving empty slots, since they render nothing yet. (`DashboardPage.tsx`, `lib/widgets.ts`)
- **Dashboard "Recent Sessions" now shows real sessions** instead of the stale "Session logging arrives in the next update" placeholder. It fetches the last 3 completed sessions (`useSessions`), each tappable to its history, with a real empty state. (`RecentSessionsWidget.tsx`)
- **Ending a session could bounce you to the page behind it ("back to profile") instead of opening the end dialog.** The swipe-down-to-minimise gesture was bound to the *entire* `ActiveSessionOverlay`, so any touch that ended ~60px lower than it started — scrolling down to reach the "End" button, or a slightly-draggy tap on it — fired `minimise()`, hiding the live session (and its End modal) behind the pill and revealing the route underneath. Reopening and tapping End without a drag then worked, which is why it felt intermittent. The gesture is now scoped to the **drag handle** only, so content scrolling and control taps (End included) can't trigger an accidental minimise; the explicit "Minimise" button is unchanged. (`ActiveSessionOverlay.tsx`)
- **Cardio exercises showed resistance target inputs (reps/weight) instead of cardio metrics.** The `AddExerciseSheet` "Set targets" form branched on the *block's* workout type, so a cardio exercise (e.g. Stationary Bike, Assault Bike) added to a resistance block got Sets × Reps × Weight instead of Rounds + Time/Distance/Intensity. It now follows the **selected exercise's own `workoutType`** (falling back to the block type for quick-add drafts) — across the target form, `buildInput`, the swipe-to-add defaults, and the targets-step header. The backend already stored the exercise's library `workoutType` on the session-exercise, so live logging was already correct; this aligns the target UI with it. Verified via git history that the reported cardio items are correctly typed `cardio` in the data — purely a UI-branching bug, no migration. (`AddExerciseSheet.tsx`)
- **Live-session weight/reps inputs stayed empty when the value came only from exercise history** (async race, pre-existing since v2.8.0 auto-populate). `exercise-history` loads after mount, so on set 1 the input initialised before it arrived and the re-fill effect only depended on `[setNumber]` — the "Last: …" line updated but the input didn't. The effect now also depends on the last-set primitives (`lastSet?.weight/reps/durationSeconds`), so inputs fill the moment history lands. Stable primitives mean it won't re-run and clobber a manual edit. (`ExerciseBlock.tsx`)

---

## [v2.14.1] — Offline Write Idempotency

### Fixed
- **Double-insert on offline write replay** (data-integrity). The offline queue replays POST/PATCH mutations on reconnect; a write the server had processed but whose HTTP response was lost was treated as failed and replayed, inserting a duplicate (e.g. a set logged twice). Writes now carry an `Idempotency-Key` (a per-operation UUID generated before the first attempt and reused on every replay), and the server deduplicates on it — returning the stored response instead of re-running the mutation.

### Added
- `apps/backend/src/db/schema/idempotency.ts` — `idempotency_keys` table (key PK, trainer, method, path, captured response status/body). Apply with `db:push`.
- `apps/backend/src/lib/idempotency.ts` — preHandler (atomic claim-or-replay) + onSend (response capture) hooks, registered on the session routes after `authenticate`.

### Changed
- `lib/offlineAwareApi.ts` — generates the key once per logical op; sends it on the online attempt and stores it on the queued op.
- `services/offlineQueue.ts` — `QueuedOperation.idempotencyKey`; `services/syncService.ts` — sends the key header on flush (tolerates legacy keyless ops).
- `design/offline-contract.md` — documents the idempotent-replay semantics (binding contract).

---

## [v2.14.0] — Color System

### Defined
- `docs/COLOR_SYSTEM.md` — formal palette with names, hex values, color theory, and usage rules
- Six named tokens: Forge Black `#000000`, Chalk White `#FFFFFF`, Iron Grey `#8A9099`, Ember Red `#D91B1B`, Command Blue `#1B50D9`, Signal Yellow `#FFE200`
- Triadic primary structure (Red/Blue/Yellow) with equal HSL saturation and lightness on Ember Red and Command Blue — intentional visual parity

### Changed
- `tailwind.config.js` — `brand-highlight` (`#e94560`) removed entirely; six named tokens added; background palette shifted from dark navy (`#1a1a2e`) to Iron Grey (`#8A9099`) base; FAB pulse animation updated to Command Blue
- `index.css` — field focus ring and offset updated from `brand-highlight` to `command-blue`

### Component sweep — 79 files
- All `brand-highlight` references replaced with intent-appropriate tokens:
  - `ember-red` — resistance workout type badge, rest timer last-3s urgency flash, danger dialog icon, required field asterisks, destructive hover states
  - `command-blue` — all primary actions (Log Set, primary buttons, nav active states, focus rings, selected filter chips, spinners, sync banner, progress indicators)
- `lib/exerciseLabels.ts` — resistance type color updated to `ember-red` (intensity); all other types unchanged (sky=cardio, emerald=calisthenics, violet=stretching, gray=cooldown)
- `lib/interactions.ts` — FAB hover shadow updated to `command-blue`

---

## Older releases

Entries for **v2.13.0 and earlier** have moved to [`CHANGELOG-ARCHIVE.md`](./CHANGELOG-ARCHIVE.md) to keep this file lean. Nothing was deleted — it is history, split out on 2026-10-21.
