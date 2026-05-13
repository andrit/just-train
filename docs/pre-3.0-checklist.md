# Pre-3.0 Checklist

Work to complete before the v3.0.0 SaaS launch. None are hard blockers on their own,
but all reduce launch risk. Ordered here by estimated effort, not priority.

---

## Status overview

| # | Item | Status |
|---|---|---|
| 1 | UX/UI walkthrough | ⏳ Scheduling |
| 2 | Storybook coverage | 🔴 Not started |
| 3 | Accessibility audit | 🔴 Not started |
| 4 | Backend test coverage | 🟡 Partial — 5 route files untested (sessions/challenges/kpis added v2.14.0 hotfix) |
| 5 | DB indexes | 🟢 Defined — needs `db:push` |
| 6 | Error boundaries | 🟢 Built — needs wiring verification |
| 7 | Bundle size / Lighthouse | 🔴 Not started |

---

## 1. UX/UI Walkthrough

**Status:** Scheduling — not a code task.

**What:** A structured review of every screen with a designer or stakeholder before locking the 3.0 UI. Acts as the baseline for the visual regression tests described in `DEFERRED_ITEMS.md`.

**Scope:** All main flows — onboarding, client roster, client profile (all 5 tabs), live session, session history, template builder, preferences, challenges.

**Output:** A list of UX changes to address before launch, signed off as the visual baseline.

---

## 2. Storybook Coverage

**Status:** Not started. Last full pass was v1.4.3. All components added from v1.5.0 through v2.14.0 lack stories.

**Why it matters:** The UX walkthrough needs something to walk through. Stories are also the fastest way to spot color-system regressions after the v2.14.0 token sweep.

### Components needing stories

**Session (priority — core trainer workflow)**
- `WorkoutBlock` — horizontal exercise navigation, two-row dots, carved footer bar
- `ExerciseBlock` — set accordion (past/active/future states exist in Session.stories but ExerciseBlock itself doesn't)
- `AddBlockSheet` — workout type picker
- `AddExerciseSheet` — search, quick-add, swipe-to-add gesture
- `PostSessionWrapUp` — PR count, volume summary, session naming
- `InlineCameraSheet` — viewfinder, photo/video capture, preview/confirm states
- `FormCheckBadge` — media count indicator on exercise header

**KPI / gamification**
- `KpiCard` — all variants: streak, volume, last session, focus KPI (resistance/cardio/calisthenics/mixed/insufficient_data), at-risk highlight
- `KpiCarousel` — dot navigation, snap scroll
- `KpiHero` — full 8-card stack, 1RM nudge visible/dismissed states
- `TipIcon` — standalone

**Challenges**
- `ChallengeProgressCard` — active, completed, expired, cancelled states; urgency indicator; days-remaining display
- `ChallengeForm` — metric-type-aware fields, exercise selector, deadline picker

**Progress photos**
- `SnapshotPhotoCapture` — 4 pose buttons, thumbnail grid, retake state, shareable toggle
- `ProgressPhotoTimeline` — latest + older snapshots grid
- `PhotoComparisonSlider` — full-screen before/after with draggable divider

**Shell / overlay**
- `ActiveSessionOverlay` — expanded (full screen), minimised (pill), multi-session switcher
- `SessionPlanPanel` — empty state, blocks added, template loaded
- `SessionHistoryPanel` — stats row, exercise breakdown, set pills (hit/missed)
- `OfflineBanner` — offline with queue count, syncing, error, hidden
- `BottomSheet` — open, with content, with drag handle

**UI primitives**
- `DragStepper` — default, at min/max, mouse drag in progress
- `NamePromptModal` — default, with pre-filled value
- `ToastContainer` — success, error, info toasts

**Templates**
- `TemplateBuilderSheet` — empty, with blocks, with exercises
- `TemplatePickerSheet` — list, search results, selected state

### Story file plan

| File | Components covered |
|---|---|
| `Session2.stories.tsx` | WorkoutBlock, ExerciseBlock, AddBlockSheet, AddExerciseSheet |
| `PostSession.stories.tsx` | PostSessionWrapUp |
| `Camera.stories.tsx` | InlineCameraSheet, FormCheckBadge, MediaPlaybackModal |
| `KPI.stories.tsx` | KpiCard (all variants), KpiCarousel, KpiHero, TipIcon |
| `Challenges.stories.tsx` | ChallengeProgressCard (all states), ChallengeForm |
| `ProgressPhotos.stories.tsx` | SnapshotPhotoCapture, ProgressPhotoTimeline, PhotoComparisonSlider |
| `Shell.stories.tsx` | ActiveSessionOverlay (expanded/pill), OfflineBanner, BottomSheet |
| `Templates.stories.tsx` | TemplateBuilderSheet, TemplatePickerSheet |
| `UIPrimitives2.stories.tsx` | DragStepper, NamePromptModal, ToastContainer |

**Approach for complex shell components:** Use static render with hardcoded props — no Zustand/TanStack Query wiring. Import the presentational layer only, pass mock data via args.

---

## 3. Accessibility Audit

**Status:** Not started. No a11y pass has been done on any version of this codebase.

**Why it matters:** SaaS users include trainers in gym environments (low light, noisy, using their phone one-handed) and athletes with varying needs. Color issues and keyboard gaps are the highest-probability problems.

### Audit areas

**1. Color contrast — Iron Grey tokens (highest risk)**
- `Iron Grey #8A9099` on `Forge Black #000000`: ratio ~4.5:1 — passes AA for normal text, fails for large text if used at small sizes. Verify all uses of `text-iron-grey` are 16px+ or 18px+ bold.
- Inactive nav items, placeholder text, secondary labels: check each render in Storybook against WCAG AA (4.5:1 for normal text, 3:1 for large text).
- Tools: browser DevTools accessibility panel, or the `axe` browser extension run against each story.

**2. Drag-to-reorder keyboard nav**
- `SortableWorkoutList` (session plan builder, using @dnd-kit/sortable) — needs keyboard support: Space to pick up, arrow keys to move, Space/Enter to drop, Escape to cancel.
- `SortableBlockList` (template builder) — same.
- `useReorderList` (preferences widget order) — this is a custom hook without @dnd-kit; verify keyboard support or add it.
- @dnd-kit includes `KeyboardSensor` — confirm it's wired in both sortable contexts.

**3. Set accordion keyboard nav**
- `SetRow` / `ExerciseBlock` — the active set inputs must be reachable by Tab. Check that focus doesn't get trapped or skipped when an accordion opens.
- Rest timer "Skip" button must be reachable without a mouse when the banner is visible.

**4. ARIA labels — session overlay and bottom sheets**
- `ActiveSessionOverlay` pill: needs `aria-label="Active session: [client name]"` so screen readers announce it.
- `BottomSheet`: needs `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the sheet title. Focus should move into the sheet on open and return to the trigger on close.
- All icon-only buttons (`×` close, `⋮` overflow menu, camera flip button in `InlineCameraSheet`) need `aria-label`.

**5. Focus management — panels and overlays**
- When `ClientProfilePanel`, `SessionPlanPanel`, or `SessionHistoryPanel` opens, focus should move to the panel's first focusable element.
- When those panels close, focus should return to the element that triggered the open.
- `ActiveSessionOverlay` swipe-down to minimise: the resulting pill should receive focus.

**6. Form inputs**
- All `<input>` and `<textarea>` elements must have associated `<label>` elements (or `aria-label` if labelless by design).
- Error messages must use `aria-describedby` pointing from the input to the error text.
- Weight/reps inputs in the active set row: check they have labels, not just placeholder text.

### Deliverable
A tracked list of issues found, each with: component, issue type (contrast / keyboard / ARIA), severity (critical / major / minor), and proposed fix. Critical and major issues are 3.0 blockers. Minor issues go into `DEFERRED_ITEMS.md`.

---

## 4. Backend Test Coverage

**Status:** Partial. 8 of 13 route files have tests. Missing 5.

### Already tested
`auth`, `clients`, `client-goals`, `client-snapshots`, `exercises`, `sessions`, `kpis`, `challenges`

> `sessions`, `kpis`, `challenges` were added in the v2.14.0 hotfix (this session).

### Needs tests

**`templates.ts`** — largest surface area

| Endpoint | Test cases |
|---|---|
| `GET /templates` | 401, 200 empty list, 200 with results, search param filters |
| `GET /templates/:id` | 401, 404 wrong trainer, 200 with workout/exercise tree |
| `POST /templates` | 401, 400 missing name, 201 created |
| `PATCH /templates/:id` | 401, 404 wrong trainer, 200 updated |
| `DELETE /templates/:id` | 401, 404 wrong trainer, 204 deleted |
| `POST /templates/:id/fork` | 401, 404 wrong trainer, 201 forked copy |
| `POST /templates/:id/workouts` | 401, 404 wrong trainer, 201 workout added |
| `DELETE /template-workouts/:id` | 401, 404, 204 |
| `POST /template-workouts/:id/exercises` | 401, 404, 201 |
| `DELETE /template-exercises/:id` | 401, 404, 204 |
| `PATCH /templates/:id/workouts/reorder` | 401, 404, 200 reordered |
| `POST /auth/seed-templates` | 401, 200 seeded, 200 idempotent |

**`reports.ts`**

| Endpoint | Test cases |
|---|---|
| `GET /clients/:id/report-preview` | 401, 404 wrong trainer, 200 returns HTML + metadata |
| `POST /clients/:id/report` | 401, 404 wrong trainer, 400 no email, 200 sent (mock Resend) |

Note: mock `../../services/report.service` to avoid Resend calls. Test that the route calls `sendReport` with the right args, not the email internals.

**`media.ts`** (exercise media)

| Endpoint | Test cases |
|---|---|
| `POST /exercises/:id/media` | 401, 404 wrong trainer, 400 no file, 201 uploaded |
| `PATCH /exercise-media/:id` | 401, 404, 200 updated |
| `DELETE /exercise-media/:id` | 401, 404, 204 deleted |

Note: mock `../../services/cloudinary.service` to avoid real uploads. Inject a buffer as `multipart/form-data`.

**`snapshot-media.ts`**

| Endpoint | Test cases |
|---|---|
| `POST /snapshots/:id/media` | 401, 403 client opted out, 404 snapshot not found, 201 uploaded |
| `PATCH /snapshot-media/:id` | 401, 404, 200 |
| `DELETE /snapshot-media/:id` | 401, 404, 204 |
| `GET /clients/:clientId/progress-photos` | 401, 404, 200 grouped array |

**`session-exercise-media.ts`**

| Endpoint | Test cases |
|---|---|
| `POST /session-exercises/:id/media` | 401, 404, 400 video too long, 201 |
| `DELETE /session-exercise-media/:id` | 401, 404, 204 |
| `GET /session-exercises/:id/media` | 401, 404, 200 list |

### Mock additions needed
- `buildTemplateTestApp()` in `helpers/buildApp.ts`
- `buildReportTestApp()` in `helpers/buildApp.ts`
- `buildMediaTestApp()` in `helpers/buildApp.ts` (shared for all 3 media route files)
- `makeTemplate()`, `makeTemplateWorkout()`, `makeTemplateExercise()` in `helpers/factories.ts`
- `makeSnapshotMedia()`, `makeSessionExerciseMedia()` in `helpers/factories.ts`

---

## 5. DB Indexes

**Status:** All indexes are defined in the schema. Needs `pnpm db:push` to apply to the database.

### Indexes already defined in schema

`sessions.ts` defines these indexes:

```
sessions_trainer_id_idx              — sessions.trainerId
sessions_client_id_idx               — sessions.clientId
sessions_status_idx                  — sessions.status
sessions_trainer_client_date_idx     — sessions.trainerId + clientId + date (composite)
workouts_session_id_idx              — workouts.sessionId
session_exercises_workout_id_idx     — sessionExercises.workoutId
session_exercises_exercise_id_idx    — sessionExercises.exerciseId
sets_session_exercise_id_idx         — sets.sessionExerciseId
sets_created_at_idx                  — sets.createdAt
```

### Why these cover the key query patterns

- **KPI route** (`WHERE sessions.clientId = ? AND status = 'completed'`) → `sessions_client_id_idx` + `sessions_status_idx`, or the composite if the planner prefers it.
- **Personal bests** (`JOIN sets → sessionExercises → workouts → sessions WHERE clientId = ?`) → `sets_session_exercise_id_idx` + `session_exercises_workout_id_idx` + `sessions_client_id_idx` cover every join hop.
- **Exercise history** (`WHERE clientId = ? AND exerciseId = ? AND status = 'completed' ORDER BY date DESC LIMIT 20`) → `sessions_client_id_idx` + `session_exercises_exercise_id_idx`.
- **Session list** (`WHERE trainerId = ? ORDER BY date DESC`) → `sessions_trainer_id_idx`.

### Action
```bash
cd apps/backend && pnpm db:push
```

Verify in psql or Railway console afterward:
```sql
\d sessions  -- should list all index definitions
```

---

## 6. Error Boundaries

**Status:** Built and wired. Needs a quick verification pass, not new code.

### What's already in place

- `ErrorBoundary` (generic) — in `components/shell/ErrorBoundary.tsx`. Full-page fallback with "Try again" and "Go home" buttons. Shows error message in dev.
- `SessionErrorBoundary` — same file. On error, calls `onMinimise()` to keep the session pill alive. Shows "Re-open session" button.
- **Wired in `main.tsx`:** `<ErrorBoundary>` wraps `<AppShell>` — catches any render error outside the session overlay.
- **Wired in `ActiveSessionOverlay.tsx`:** `<SessionErrorBoundary onMinimise={minimise}>` wraps `<LiveSessionContent>` — catches mid-session crashes while preserving the pill.

### Verification checklist

- [ ] Confirm `main.tsx` wraps `<AppShell>` (not just `<App>` or a subtree) — global catch.
- [ ] Confirm `SessionErrorBoundary.onMinimise` wires to the overlay store's `minimise()` action.
- [ ] Confirm the "Go home" button navigates to `/` without relying on React Router (a crashed tree may not have router context — `window.location.href` is correct here, not `useNavigate`).
- [ ] In dev, throw an error in a route component manually and confirm the full-page boundary catches it.
- [ ] In dev, throw inside `LiveSessionContent` and confirm the session boundary shows, the overlay minimises to the pill, and the rest of the app is still usable.

No code changes expected — this is a read-and-verify task.

---

## 7. Bundle Size / Lighthouse

**Status:** Not started. One-time audit pass before launch.

### Bundle size

**Run:**
```bash
cd apps/frontend && npx vite build && npx vite-bundle-visualizer
# or
npx source-map-explorer dist/assets/*.js
```

**Targets:**
- Total JS (compressed): < 500 KB is good, < 800 KB is acceptable for a PWA with this feature set.
- Any single chunk > 200 KB should be investigated for code-splitting.

**Known risk areas:**
- `@dnd-kit/*` — sortable drag-and-drop, used in two places. Check if it's being tree-shaken.
- Cloudinary SDK — confirm only the upload widget (not the full SDK) is included.
- Storybook dependencies — must not leak into the production bundle (they live under `devDependencies`; confirm).
- `react-pdf` or any report rendering lib — confirm reports are rendered server-side (HTML email), not client-side.

**Quick wins if over budget:**
- Lazy-load `InlineCameraSheet` (MediaRecorder API, camera setup — only needed mid-session).
- Lazy-load `PhotoComparisonSlider` (only on client profile Baseline tab).
- Lazy-load the template builder sheets (only on Templates page).

### Lighthouse

**Run against production or a preview deploy (not localhost — service worker and compression must be active):**

```
Lighthouse → Performance, Accessibility, Best Practices, PWA
```

**Targets:**
- Performance: ≥ 80 (mobile throttled)
- Accessibility: ≥ 90 (will catch whatever the manual audit misses)
- Best Practices: ≥ 95
- PWA: all checks green (installable, offline fallback, icons)

**Known risk areas:**
- LCP: the dashboard widget stack renders a lot of content on first paint — confirm skeleton loaders are shown during data fetch.
- CLS: any dynamic content that shifts layout after render (images loading, widget height changes).
- PWA offline: the Workbox config narrows caching to reference data only (`exercises`, `body-parts`, `templates`). Auth routes, clients, and sessions are intentionally not cached — Lighthouse may flag a 200 offline requirement. The `index.html` shell should return 200 offline.

---

## Recommendation — where to start

**Start with item 4: backend test coverage.**

Reasoning:
- Items 5 (DB indexes) and 6 (error boundaries) are effectively done — DB indexes just need one command, and the error boundary code is already written and wired.
- Items 1, 7 are external or one-time audits that don't block other work.
- Items 2 (Storybook) and 3 (a11y) are better done after item 1 (UX walkthrough) establishes what the UI is supposed to look like.
- Item 4 is the only item where untested code is live and taking real user traffic. The `reports`, `templates`, and media routes are all exercised in normal trainer workflows — silent failures in those routes are the highest probability launch incident.

**Suggested order:**
1. `pnpm db:push` + verify indexes — 10 minutes
2. Error boundary verification checklist — 20 minutes
3. Backend test coverage — 2–3 sessions (templates first, then reports, then media)
4. Bundle / Lighthouse — 1 session (run before UX walkthrough so bundle regressions are visible)
5. UX/UI walkthrough — schedule after bundle pass
6. Storybook — build alongside or after walkthrough
7. Accessibility audit — last, informed by walkthrough findings
