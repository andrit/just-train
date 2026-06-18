# User Flow — TrainerApp

**Phase 0 artifact — draft for review**
**Last updated:** 2026-06-18

---

## Document structure

This document contains two completely separate flow trees — one for Athlete, one for Trainer. They share infrastructure (auth, service worker, offline layer) but never intersect at the feature level. An Athlete never encounters client vocabulary. A Trainer never loses their Athlete experience.

Flows are numbered within each persona tree:
- `UF-A-NN` — Athlete flows
- `UF-T-NN` — Trainer flows
- `UF-S-NN` — Shared cross-cutting flows (auth, install)

---

## Policies surfaced (feed event-storm)

These rules emerge from the flows below. They are the raw material for the event-storm and bounded-context map.

| # | Rule | Source flow |
|---|------|-------------|
| P1 | A user with `trainerMode = 'athlete'` must be redirected to `/` on any attempt to access `/clients` or `/clients/:id` | UF-A-02 |
| P2 | `onboardedAt` is null until mode selection completes — every protected route checks this via `OnboardingGate` | UF-S-01 |
| P3 | The install prompt fires exactly once, after the first `SessionCompleted` event, if `beforeinstallprompt` is available and not yet deferred | UF-S-03 |
| P4 | The passive install icon is always visible in the nav header area for browsers that support `beforeinstallprompt` | UF-S-03 |
| P5 | The iOS install explainer is shown on the same trigger as P3, but uses a share-sheet instruction card instead of the native prompt | UF-S-03 |
| P6 | Offline writes use `offlineAwareApi` — POST/PATCH/DELETE are enqueued in IndexedDB `offlineQueue` when `navigator.onLine === false` | UF-A-04, UF-T-04 |
| P7 | `OfflineBanner` state machine: hidden → offline+no-pending → offline+pending (queued count) → syncing → error (tap to retry) → hidden | UF-A-04 |
| P8 | `MyTrainingPage` currently redirects to `/clients/:selfClientId` — this is a Must-be gap (URL leak). Target state: `/my-training` renders `AthleteProfilePage` directly | UF-A-06 |
| P9 | `AthleteProfilePage` is a dedicated component, not a re-use of `ClientProfilePage`. For Trainer's "My Training" tab, the same `AthleteProfilePage` is rendered (the Trainer accesses their isSelf experience through it) | UF-A-06, UF-T-07 |
| P10 | At-risk threshold is 14 days with no completed session for an external client | UF-T-09 |
| P11 | Monthly reports are HTML email; the trigger is manual (Trainer sends) or automated (`autoReportEnabled = true`) | UF-T-10 |
| P12 | Goals are append-only — a deleted goal still exists in the history table, used for monthly report narrative | UF-A-07, UF-T-08 |
| P13 | PR flash is in-session only, fires on set log when the new set beats the previous best. PR type is configurable (`prNotifyType`: `1rm` | `volume` | `both`) | UF-A-04 |
| P14 | Progress photos attach to a snapshot. A photo can be added after a snapshot is saved. | UF-A-08 |
| P15 | Trainer accesses their own Athlete experience exclusively via the "My Training" nav tab. There is no `/clients` entry for the isSelf client from the Athlete-side nav. | UF-T-07 |
| P16 | The dashboard TRAIN card has three context-aware states: (a) "Start Training" — default, no active sessions; (b) "Begin: [name] ×" — a `planned` session exists; (c) "Resume: [name] ×" — an `in_progress` session exists. "Begin" is for planned sessions (not yet started); "Resume" is for in-progress. The × opens a dismiss sheet. | UF-A-03, UF-A-04 |
| P17 | When a session is dismissed: if 0 sets logged → [ Discard ] only; if ≥ 1 set logged → [ Save as partial ] [ Discard ]. Partial sessions save with `status: 'partial'` and appear in history with a "cut short" badge. | UF-A-04 |
| P18 | The template builder is a single entry point with a type toggle: "Session" (flat exercise list spanning any workout types) or "Workout" (flat exercise list where all exercises share one workout type — advisory, not schema-enforced). Schema: `templates.type` column with values `'session' \| 'workout'`. | UF-A-09, UF-A-10 |
| P19 | Exercise rows in a live session carry a ⋮ kebab: [ Swap exercise \| Remove \| Move up \| Move down ]. Individual set rows have no kebab. | UF-A-04 |
| P20 | "Swap exercise" in the exercise row kebab pre-filters the exercise picker by the swapped exercise's workout type — replacing a resistance exercise shows resistance exercises first. Pre-filter is advisory, not locked. | UF-A-04 |
| P21 | KPI pinning is a near-term Performance feature. Pinned KPIs are configured from the Goals screen. Pinned KPI chips appear in the dashboard header strip alongside streak and last-session chips. | UF-A-03 |
| P22 | The dashboard is an action hub. The header strip is glanceable (streak, last session, PR chip, pinned KPIs). The main body has named action cards: TRAIN, PLAN, GOALS, HISTORY, BUILD. Log Snapshot sits as a secondary action at the bottom of the dashboard. | UF-A-03 |
| P23 | Athletes are always on the free tier — no payment required, no trial expiry. Athlete features (self-training, goals, snapshots, progress photos, templates) are not gated by subscription. | UF-A-01, UF-S-06 |
| P24 | Selecting `trainerMode = 'trainer'` at onboarding starts a 14-day Pro trial automatically — no payment method required at registration. Trial access is full Pro: client management, at-risk monitoring, monthly reports. | UF-T-01, UF-S-06 |
| P25 | When a trainer on `free` or trial-expired status attempts a gated action (e.g. Add Client), the billing gate intercepts and presents the upgrade flow before the action proceeds. The action is held — if the trainer subscribes, it continues automatically. | UF-S-06 |
| P26 | On trial expiry without an active subscription: `subscriptionTier` reverts to `free`. Existing client data is read-accessible (trainer can view past sessions, goals, snapshots). New client additions and other Pro mutations are blocked by the billing gate. | UF-S-06 |

---

## Status key

- ✅ Built and functional
- ⚠️ Built with known gap
- 🔜 Planned
- ⏸ Deferred

---

---

# Part 1 — Athlete Flows

## Navigation tree (Athlete)

```
/login  ──►  /onboard  ──►  / (Dashboard — action hub)
                             ├─ [TRAIN]    → /session/:id (start / begin / resume)
                             ├─ [PLAN]     → /session/:id (status: planned)
                             ├─ [GOALS]    → goals + KPI screen
                             ├─ [HISTORY]  → /sessions
                             ├─ [BUILD]    → /templates
                             ├─ /my-training  → AthleteProfilePage
                             ├─ /exercises
                             └─ [Log Snapshot] → measurement form
```

Client routes are never linked from athlete nav. `/clients` and `/clients/:id` redirect to `/`.

---

## UF-A-01 — Registration and onboarding (Athlete)

**Persona:** New user, self-coaching athlete  
**Starting point:** Marketing page or direct link to `/login`  
**Emotional baseline:** Curious, slightly impatient — wants to log a workout, not fill out forms

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Opens app URL in mobile browser | Login screen renders; no cookie → no auto-login attempt | Neutral |
| 2 | Taps "Create account" | Register form appears (email, password, name) | Hopeful |
| 3 | Fills form and submits | POST /auth/register → 201; JWT in memory, refresh cookie set; `onboardedAt = null` | Encouraged |
| 4 | Redirected to `/onboard` via `OnboardingGate` | Mode selection screen: "I train myself" vs "I train clients" — deliberate, full-screen moment | Present |
| 5 | Selects "I train myself" (Athlete) | POST /auth/onboard `{ trainerMode: 'athlete' }` → `onboardedAt` set | Committed |
| 6 | Redirected to `/` (Dashboard) | Dashboard renders with athlete nav. Widgets are empty (first session). CTA visible: "Start Training" | Ready |

**Billing (P23):** Athlete accounts are free forever. No trial clock, no billing gate, no payment required. The `/settings/billing` page is accessible but shows "Free plan — no subscription needed."

**Real-world detour:** User selects "Athlete" but later discovers they have clients to manage. Upgrade path (Athlete → Trainer) is deferred — for now they must contact support or re-register.

**Abandonment risk:** Between steps 5 and 6 — if the redirect is slow and nothing renders, users hit back and lose the session. `OnboardingGate` must be fast.

**Offline state:** If offline at registration, form submits fail immediately (auth requires network). Error state: "No internet connection — please connect to create your account."

---

## UF-A-02 — Route guard: Athlete attempts client route

**Persona:** Athlete (any — curious, or bookmarked a wrong URL)  
**Starting point:** Navigates to `/clients` or `/clients/:id` directly  
**Status:** ⚠️ Not yet implemented — this is a Must-be gap

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Navigates to `/clients` | ~~Currently: renders ClientsPage with no data~~ | Confused |
| — | **Target behaviour** | Immediate `<Navigate to="/" replace />` — no flash of client vocabulary | Unaffected |

**Policy:** `AthleteRouteGuard` wraps `/clients` and `/clients/:id`. Reads `trainerMode` from `usePreferences()`. If `athlete`, redirects. No error message needed — the route simply doesn't exist for them.

**Alternative path:** If an athlete somehow has a deep-linked `/clients/:id` URL (e.g. from a browser bookmark), same redirect applies. Their training data is always at `/my-training`.

---

## UF-A-03 — Dashboard (Athlete)

**Persona:** Returning athlete, opens app at the start of a training day  
**Starting point:** `/` — Dashboard

The dashboard is an **action hub** — the athlete arrives knowing what they want to do, and the dashboard surfaces those paths immediately. Glanceable stats live in a compact header strip; the main body presents five named action cards.

### Dashboard layout

```
┌──────────────────────────────────────────┐
│  HEADER STRIP (glanceable)               │
│  🔥 14-day streak  ·  Last: Mon          │
│  [PR chip if recent]  [pinned KPI chips] │
├──────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  TRAIN                      [⌄] │    │  ← context-aware (P16)
│  │  Start Training                  │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ┌─────────────────┐ ┌─────────────────┐ │
│  │  PLAN           │ │  GOALS          │ │
│  │  Plan a session │ │  Progress & KPIs│ │
│  └─────────────────┘ └─────────────────┘ │
│                                          │
│  ┌─────────────────┐ ┌─────────────────┐ │
│  │  HISTORY        │ │  BUILD          │ │
│  │  Past sessions  │ │  Templates      │ │
│  └─────────────────┘ └─────────────────┘ │
│                                          │
│  [ Log Snapshot / Measurements ]         │  ← secondary, bottom
└──────────────────────────────────────────┘
```

### TRAIN card — context-aware states (P16)

| State | Condition | Card content |
|-------|-----------|--------------|
| Default | No planned or in-progress sessions | "Start Training" — opens `SessionLauncherSheet` |
| Planned | A `planned` session exists | "Begin: [session name]  ×" — × opens dismiss sheet |
| In-progress | An `in_progress` session exists | "Resume: [session name]  ×" — × opens dismiss sheet |

In-progress takes precedence over planned. If multiple planned sessions exist, the card shows the first; ⌄ exposes others.

### Flow

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Opens app | Auth init fires (`GET /auth/me`); access token restored | Autopilot |
| 2 | Dashboard renders | Action hub shown; header strip: streak, last session date, PR chip if recent | Oriented |
| 3 | Taps TRAIN card | Launches session via Start Training, Begin: [name], or Resume: [name] per state | Focused |
| 4 | Taps PLAN card | `SessionLauncherSheet` in planning mode → session created with `status: 'planned'` | Planning |
| 5 | Taps GOALS card | Goals screen with progress overview and KPI pinning configuration (P21) | Reflective |
| 6 | Taps HISTORY card | `/sessions` — athlete's full session timeline | Reviewing |
| 7 | Taps BUILD card | `/templates` — template library with prominent "New Template" CTA | Designing |
| 8 | Taps Log Snapshot | Body measurement form (34 optional fields; delta vs prior shown) | Tracking |

**Offline state:** Dashboard renders from TanStack Query cache. Header strip shows stale timestamp ("Last updated [time]"). TRAIN and HISTORY work from cache; PLAN/GOALS/BUILD require network for mutations.

**Empty state (first session):** Header strip shows zero streak. TRAIN card prominent with "Log your first session" subtext.

**KPI pinning (P21 — near-term Performance feature):** From the Goals screen, the athlete pins specific KPIs to the header strip. Pinned chips appear alongside streak and last-session chips. Configuration lives in Goals, keeping the dashboard itself configuration-free.

---

## UF-A-04 — Live session (Athlete)

**Persona:** Athlete in the gym, phone in hand  
**Starting point:** Taps TRAIN card on Dashboard (any state — Start Training / Begin: [name] / Resume: [name]), or navigates to `/sessions` → "New Session"  
**Status:** ✅ Core built, ⚠️ offline PR recompute pending

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1a | Taps TRAIN → "Start Training" | `SessionLauncherSheet` opens; `trainerMode = 'athlete'` → `selfClient` auto-selected; no client picker visible | Focused |
| 1b | Taps TRAIN → "Begin: [name]" | Named planned session opens directly (skip launcher); `planned → in_progress`; overlay launches | In the zone |
| 1c | Taps TRAIN → "Resume: [name]" | In-progress session overlay restores; exercises and logged sets repopulate | Returning |
| 2 | Selects from template or starts blank (step 1a only) | POST /sessions → session created; `LiveSessionPage` launches in full-screen overlay | Building |
| 3 | Adds exercise to session | Exercise picker opens; filter by body section or workout type; exercise added with empty set rows | Ready |
| 3a | *(managing an exercise)* | ⋮ kebab on exercise row → [ Swap exercise \| Remove \| Move up \| Move down ] | Adjusting |
| 3b | *(swapping an exercise)* | "Swap exercise" pre-filters the picker by the swapped exercise's workout type (P20) | Efficient |
| 4 | Logs a set (weight + reps) | POST /session-exercises/:id/sets (or queued to IndexedDB if offline) | Executing |
| 4a | *(if PR)* | PR flash animation — amber pulse, fades 2s; PR chip appears on set row | Surprised, pleased |
| 4b | *(if offline)* | Set is queued; OfflineBanner: "1 change queued" | Slightly anxious, continues |
| 5 | Rest timer fires | Timer countdown appears in session footer; persists across scrolls | Resting |
| 6 | Continues logging sets and exercises | History context shown: "Last time: 80 kg × 8" inline per exercise | Calibrating |
| 7 | Taps "Complete Session" | Session summary sheet: RPE, energy, mood sliders; subjective notes | Reflecting |
| 8 | Submits summary | PATCH /sessions/:id `{ status: 'completed' }` → session saved | Satisfied |
| 8a | *(if offline queue has items)* | `syncService.flushQueue()` fires on next online event; OfflineBanner: "Syncing…" → "Done" | Relieved |
| 9 | *(first session ever)* | Install prompt fires (if `beforeinstallprompt` captured and not yet deferred) — see UF-S-03 | Curious |

### Dismissal — partial session (P17)

Tapping × on the TRAIN card or the close button on the session overlay opens a context-aware dismiss sheet.

| Condition | Sheet content |
|-----------|---------------|
| 0 sets logged | [ Discard ] only |
| ≥ 1 set logged | [ Save as partial ] [ Discard ] |

**Save as partial:** session saved with `status: 'partial'`. Appears in history with a "cut short" badge. The sets and exercises logged are preserved and visible in the session timeline and per-exercise history.

**Discard:** session deleted. No history entry. The right choice when the athlete changes plans before logging anything — for example, all the back machines are broken and they want to start a chest session instead.

**Planned session dismissed (0 sets):** Discard removes the planned session from the store. It does not create a history entry.

### Real-world detours

- Phone rings mid-session: session overlay persists; user tabs away and returns
- Gym WiFi drops: sets continue logging to queue; OfflineBanner shows count; no data loss
- App force-closed mid-session: session remains `in_progress`; on reopen, TRAIN card shows "Resume: [name]"; overlay restores from TanStack Query + store state
- All back machines are broken — switching to chest day: dismiss (0 sets logged → Discard); start fresh session from launcher

**Offline state for this flow:**
- Reads (exercise history): served from cache; "Cached data" indicator if stale
- Writes (set log, add exercise, session complete): queued in IndexedDB; replayed on reconnect
- PR detection offline: evaluated client-side against cached history; server-side recheck on sync (⚠️ pending — `POST /session-exercises/:id/recompute-prs` in backlog)

**Abandonment risk:** The dismiss sheet intercepts accidental close taps. With 0 sets logged the athlete can cleanly discard. With sets logged, "Save as partial" prevents data loss. The explicit two-option sheet removes anxiety about accidentally destroying an in-progress session.

---

## UF-A-05 — Session history (Athlete)

**Persona:** Athlete reviewing past performance  
**Starting point:** `/sessions`

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Taps Sessions tab | `SessionsPage` loads; `trainerMode = 'athlete'` → no client filter picker shown; shows only their own sessions | Reviewing |
| 2 | Scrolls history | Sessions listed chronologically. Each card: date, duration, exercise count, total volume. | Analytical |
| 3 | Taps a session | `SessionHistoryPage` opens; full set-by-set breakdown; PR chips shown on rows where PRs were logged | Detailed |
| 4 | Taps "Compare with previous" | Side-by-side volume comparison for same exercise (if prior session exists) | Comparing |

**Offline state:** History renders from cache. If no cache and offline: "Couldn't load session history — you're offline. Data will appear when you reconnect."

---

## UF-A-06 — My Training profile (Athlete)

**Persona:** Athlete checking their own progress and goals  
**Starting point:** `/my-training`  
**Status:** ⚠️ Currently redirects to `/clients/:selfClientId` — Must-be gap

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Taps "My Training" tab | ~~Currently: fetches `GET /clients/self`, navigates to `/clients/:id`~~ | (URL leak) |
| — | **Target:** | `AthleteProfilePage` renders directly at `/my-training`. No redirect. URL stays `/my-training`. | Seamless |
| 2 | Profile loads | `AthleteProfilePage`: KPI hero, goal list, snapshot history, session timeline. No client-vocabulary in sight. | Oriented |
| 3 | Taps a goal | Goal detail modal: title, target date, achieved indicator, history | Reflective |
| 4 | Taps "Add Goal" | Goal creation sheet: title, notes, target date | Purposeful |
| 5 | Taps "Snapshot" | Body measurement form — 34 optional fields; delta vs prior shown | Tracking |
| 6 | Taps "Progress Photo" | Photo capture sheet — see UF-A-08 | Documenting |
| 7 | Taps a historical snapshot | Snapshot detail: all measurements, delta vs baseline, attached photos | Longitudinal view |

**Key distinction:** `AthleteProfilePage` ≠ `ClientProfilePage`. They serve different audiences and vocabularies. `AthleteProfilePage` says "Your goals," "Your measurements." `ClientProfilePage` says "Client goals," "Client measurements" — visible only to Trainers.

**Offline state:** Profile data serves from cache. Goal creation queued offline. Snapshot creation queued offline.

---

## UF-A-07 — Goals (Athlete)

**Persona:** Athlete setting and tracking personal goals  
**Starting point:** `AthleteProfilePage` → goals section

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Taps "Add Goal" | Goal creation sheet opens | Motivated |
| 2 | Enters goal title + target date | POST /goals → goal created; appears in goal list | Committed |
| 3 | Goal is achieved (manual) | "Mark achieved" button; PATCH /goals/:id `{ achieved: true }` → date stamp set | Accomplished |
| 4 | Views goal history | All goals ever set shown, including achieved ones — never deleted | Reflective |

**Policy (P12):** Goals are append-only. Deletion removes from view but record persists.

**Offline state:** Goal creation queued; achievement queued. Both replay on reconnect.

---

## UF-A-08 — Progress photo capture (Athlete)

**Persona:** Athlete documenting physique changes  
**Starting point:** `AthleteProfilePage` → "Progress Photo" → `SnapshotPhotoCapture`

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Taps "Progress Photo" | `SnapshotPhotoCapture` opens; 4-pose grid (Front, Side L, Side R, Back) | Slightly self-conscious |
| 2 | Taps a pose slot | `<input type="file" capture="user">` fires (front camera default for isSelf=true) | Practical |
| 3 | Takes or selects photo | File selected; preview shown in pose slot; max 10 MB enforced client-side | Evaluating |
| 4 | Fills all desired poses (optional — not all required) | Remaining empty slots show placeholder | Selective |
| 5 | Taps "Save" | Photos upload to Cloudinary; URLs saved to snapshot record | Done |
| 6 | Views `ProgressPhotoTimeline` | Grid of snapshots ordered chronologically; each shows front-pose thumbnail | Motivated |
| 7 | Taps two snapshots | `PhotoComparisonSlider` opens — side-by-side drag comparison | Impressed (ideally) |

**Offline state:** Photo capture works offline (camera API is local). Upload to Cloudinary requires network — queued on reconnect. If offline when saving: "Photos will upload when you're back online."

---

## UF-A-09 — Template library (Athlete)

**Persona:** Athlete building reusable workout plans  
**Starting point:** `/templates` or BUILD card on Dashboard

Templates come in two types (P18):
- **Session template:** a flat ordered list of exercises spanning any workout types. Used to plan a full training day.
- **Workout template:** a flat ordered list of exercises all sharing one workout type (e.g., a Push Day or Leg Day). The workout type scope is advisory — enforced by the UI's exercise picker pre-filter, not by the schema. Used standalone or applied to a live session.

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Taps Templates tab or BUILD card | Template list; tabbed: Sessions / Workouts; athlete sees only their own | Organized |
| 2 | Taps "New Template" | Unified template builder opens — see UF-A-10 | Planning |
| 3 | Taps a session template in session launcher | Template loads with all exercises pre-populated | Ready to train |
| 4 | Taps a workout template in session builder | Template's exercises added to the current session | Efficient |
| 5 | Saves session as template | "Save as template" on session complete → template created from the session's exercise list | Systematic |

**Schema note:** `templates.type` column — `'session' | 'workout'`. Both types share the same flat `template → template_exercises` structure. The Workout type is a UI hint about scope, not a structural difference.

**Offline state:** Template list serves from Workbox NetworkFirst cache (24h TTL). Template creation requires network.

---

## UF-A-10 — Unified template builder

**Persona:** Athlete designing a reusable session or workout template  
**Starting point:** `/templates` → "New Template" button → unified builder

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Opens builder | Type toggle at top: [ Session ] [ Workout ]. "Session" selected by default. | Deciding |
| 2a | Building a Session template | Name field; "Add Exercise" button; flat ordered exercise list — exercises of any workout type | Designing |
| 2b | Building a Workout template | Name field; workout type selector (advisory — pre-filters exercise picker to one type; user can override); flat exercise list | Focused |
| 3 | Adds exercises | Exercise picker: pre-filtered by workout type for Workout templates (override allowed); unrestricted for Session templates. Filter dimensions: body section, workout type, name search. | Choosing |
| 4 | Reorders exercises | @dnd-kit drag handles; PATCH order saved | Refining |
| 5 | Saves | POST /templates `{ type: 'session' \| 'workout', ... }` → saved; appears in library under correct tab | Done |

**Workout template scope:** The workout type selector sets an advisory scope on creation — the exercise picker opens pre-filtered to that type, keeping the template focused. The user can clear the filter and add any exercise. This mirrors the "Swap exercise" pre-filter in the live session kebab (P20): same mental model, same advisory behaviour.

**Offline state:** Builder requires network. Template list available offline from cache.

---

---

# Part 2 — Trainer Flows

## Navigation tree (Trainer)

```
/login  ──►  /onboard  ──►  / (Dashboard)
                             ├─ /sessions
                             ├─ /clients         (roster)
                             │   └─ /clients/:id  (profile panel)
                             ├─ /exercises
                             └─ /templates
```

"My Training" is accessible from the Dashboard or a secondary nav entry — but through `AthleteProfilePage` at `/my-training`, not through `/clients`.

---

## UF-T-01 — Registration and onboarding (Trainer)

**Persona:** Professional coach, registering for client management  
**Starting point:** `/login`

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Opens app | Login screen | Businesslike |
| 2 | Creates account | POST /auth/register → registered; `onboardedAt = null` | Proceeding |
| 3 | Redirected to `/onboard` | Mode selection: "I train myself" vs "I train clients" | Deciding |
| 4 | Selects "I train clients" (Trainer) | POST /auth/onboard `{ trainerMode: 'trainer' }` → `onboardedAt` set; `isSelf` client created server-side | Committed |
| 4a | (POL) 14-day Pro trial starts | Stripe Customer created server-side (transparent); `subscriptionStatus = 'trialing'`; `trialEndsAt = now + 14 days`; full Pro access unlocked — no card required (P24) | Empowered |
| 5 | Redirected to `/` (Dashboard) | Trainer dashboard: client roster widget, at-risk widget, recent activity, weekly session target. Trial badge visible in nav: "Pro trial — N days left" | Ready to work |

**isSelf client creation:** Step 4 triggers `POST /auth/onboard` which creates the isSelf Client record automatically. The Trainer's own Athlete experience is available from this point forward.

**Billing (P24):** Trial is 14 days, Pro-level, no payment method required. At trial end without a subscription, `subscriptionTier` reverts to `free` and the billing gate activates on gated actions.

---

## UF-T-02 — Client roster management

**Persona:** Trainer adding a new client  
**Starting point:** `/clients`

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Taps Clients tab | ClientsPage renders; roster list with search; at-risk clients highlighted in amber | Scanning |
| 2 | Taps "Add Client" | Client creation sheet: name, email, notes | Onboarding |
| 3 | Fills and submits | POST /clients → client created; roster refreshes | Efficient |
| 4 | Taps a client row | ClientProfilePanel slides in from right | Transitioning |

**Empty state:** "No clients yet. Tap + to add your first client." with an illustration.

**Offline state:** Client list from cache. Add client queued offline. At-risk highlights use cached data — may be stale if offline.

---

## UF-T-03 — Client profile (Trainer)

**Persona:** Trainer reviewing a client before a session  
**Starting point:** `/clients` → tap client row → `ClientProfilePanel`

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Panel slides in | `ClientProfilePage` renders: KPI hero, goal list, snapshot history, session timeline | Preparing |
| 2 | Reviews KPIs | Volume trend, 1RM estimates, streak, consistency score. At-risk badge visible if > 14 days | Assessing |
| 3 | Reviews goals | Goal arc: what they set, what they achieved. Context for the upcoming session | Contextualizing |
| 4 | Taps "Start Session for Client" | Session launcher opens pre-scoped to this client | Transitioning |
| 5 | Taps "Add Snapshot" | Body measurement form for client | Documenting |
| 6 | Taps "Progress Photos" | Photo capture for client — uses rear camera default (trainer captures, not athlete) | Documenting |

**Offline state:** Profile loads from cache. New entries queued.

---

## UF-T-04 — Live session (Trainer — logging for a client)

**Persona:** Trainer on the gym floor, logging sets for a client  
**Starting point:** `/clients/:id` → "Start Session" or SessionLauncherSheet with client selected

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Opens session launcher | Client picker visible (`trainerMode = 'trainer'`); selected client pre-populated from profile | Organized |
| 2 | Selects template or starts blank | POST /sessions → session created scoped to client | In control |
| 3 | Logs sets for client | Set logging identical to Athlete flow; exercise history shown from client's past sessions | Focused |
| 3a | *(if PR for client)* | PR flash fires — trainer sees the client's new PR; moment to celebrate together | Delighted |
| 3b | *(if offline)* | Sets queued; OfflineBanner shows count | Calm, continues |
| 4 | Completes session | Summary: RPE, energy, mood for the client; subjective notes | Documenting |
| 5 | Returns to client profile | Session appears in timeline; KPIs update | Closing loop |

**Concurrent sessions:** The Trainer can have multiple planned sessions open simultaneously (one per client + isSelf). `activeSessions` is keyed by clientId — one active per client at a time.

**Offline state:** Identical to UF-A-04. Sets queue to IndexedDB. Flush on reconnect.

---

## UF-T-05 — Session planning (Trainer)

**Persona:** Trainer planning multiple clients' workouts before they arrive  
**Starting point:** Dashboard CTA or `/sessions` → "Plan Session"

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Opens session launcher | `plannedSessions` can hold many open sessions; any client selectable | Methodical |
| 2 | Selects client + template | POST /sessions `{ status: 'planned' }` → session created | Organizing |
| 3 | Repeats for other clients | Multiple planned sessions accumulate in `plannedSessions` store keyed by sessionId | Systematic |
| 4 | Client arrives — taps planned session pill | Session transitions `planned → in_progress`; overlay opens | Executing |

**Offline state:** Session planning requires network for POST. Planned sessions already in store function offline.

---

## UF-T-06 — Session history (Trainer)

**Persona:** Trainer reviewing sessions across all clients  
**Starting point:** `/sessions`

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Taps Sessions tab | `SessionsPage`; `trainerMode = 'trainer'` → client filter picker visible | Reviewing |
| 2 | Filters by client | Sessions filtered by selected client (or "All") | Focused |
| 3 | isSelf sessions included | Trainer's own sessions appear with client label "Me" (selfClient match) | Self-aware |
| 4 | Taps a session | SessionHistoryPage — full set breakdown; PR chips | Detailed |

---

## UF-T-07 — My Training (Trainer accessing their own Athlete experience)

**Persona:** Trainer switching from client mode to personal training  
**Starting point:** Dashboard → "My Training" tab or widget

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Taps "My Training" | `AthleteProfilePage` renders at `/my-training`; data is the Trainer's isSelf client | Shifting gears |
| 2 | Sees own KPIs | Same `AthleteProfilePage` as a pure Athlete sees — no client vocabulary | Present |
| 3 | Starts personal session | SessionLauncherSheet opens; selfClient auto-selected (`trainerMode = 'trainer'`, `isSelf = true`) | Training |
| 4 | Session completes | Returns to `AthleteProfilePage`; KPIs update | Complete |

**Policy (P9, P15):** The Trainer sees `AthleteProfilePage` at `/my-training`. The isSelf client record is never visible in the `/clients` roster (filtered out). The Trainer's own training feels like a clean Athlete experience, not "editing one of my clients."

---

## UF-T-08 — Goals (Trainer managing client goals)

**Persona:** Trainer setting goals for or with a client  
**Starting point:** `ClientProfilePage` → goals section

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Opens client profile | Goals section shows full goal arc | Contextual |
| 2 | Adds a goal | POST /goals `{ clientId }` | Coaching |
| 3 | Marks goal achieved | PATCH /goals/:id → date stamp | Celebrating |
| 4 | Goal arc visible in report | Monthly report uses the goal arc for narrative | Prepared |

---

## UF-T-09 — At-risk monitoring

**Persona:** Trainer doing a weekly check-in scan  
**Starting point:** Dashboard at-risk widget or `/clients` with amber highlights

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Notices amber badge on dashboard | At-risk widget: "2 clients haven't trained in 14+ days" | Alert |
| 2 | Taps at-risk widget | Expands to list of at-risk clients | Concerned |
| 3 | Taps a client | ClientProfilePanel → sees last session date, no recent sessions | Assessing |
| 4 | Taps "Message" (future) | *(push notification to client — 🔜 not yet built)* | Proactive |
| 5 | Books a session | Starts a planned session for the at-risk client | Taking action |

**Push notification (🔜):** `POST /push/at-risk` — fires when a client crosses 14 days. Trainer receives a push to their device. Requires service worker push subscription.

**Offline state:** At-risk data from cache; may be stale if offline. Amber highlights persist until refresh.

---

## UF-T-10 — Monthly report

**Persona:** Trainer sending end-of-month reports  
**Starting point:** Dashboard report widget or manual trigger

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Views report-ready indicator | Dashboard widget: "3 clients ready for monthly report" | Accountable |
| 2 | Taps to preview | Report preview: goal arc, key metrics, trend commentary | Reviewing |
| 3 | Edits narrative (optional) | Text fields for custom commentary | Personalizing |
| 4 | Taps "Send Report" | POST /reports/send `{ clientId }` → HTML email dispatched | Delivering |
| 4a | *(if `autoReportEnabled`)* | Report sends automatically at month end | Hands-free |
| 5 | Confirmation | *(🔜 Push notification: "Report sent to [client name]")* | Done |

---

---

# Part 3 — Shared Flows

## UF-S-01 — Auth init and session restore

**Persona:** Any user returning to the app  
**Starting point:** App launch (browser tab reload or PWA cold start)

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | App opens | `initAuth()` fires: `GET /auth/me` with access token in memory | Loading |
| 2a | Token still valid (< 15 min) | Auth confirmed; user lands on last viewed route | Seamless |
| 2b | Token expired | Auto-refresh: `POST /auth/refresh` using httpOnly cookie | Transparent |
| 2c | Cookie expired (> 7 days) | Refresh fails; redirect to `/login` | Must log in |
| 3 | Onboarding check | `OnboardingGate` reads `trainer.onboardedAt`; if null → `/onboard` | Guarded |

**PWA standalone:** On cold start from home screen icon, refresh token in httpOnly cookie persists; this is intentional — standalone PWA mode preserves the cookie across launches.

**Offline state:** If offline on launch, `GET /auth/me` fails. If access token is in Zustand memory (tab never closed), user stays authenticated. If memory was cleared (force-quit), a `/refresh` is attempted — if that fails offline, the user sees a "You're offline — please connect to log in" screen rather than a login redirect.

---

## UF-S-02 — Login (returning user)

**Persona:** Any user  
**Starting point:** `/login`

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Enters email + password | POST /auth/login → JWT issued; refresh cookie set | Familiar |
| 2 | Redirected to `/` | Dashboard (mode-appropriate) | Home |

**Offline state:** Login requires network. Error: "Can't log in while offline." If already logged in and offline, login page is not shown (auth guard routes away).

---

## UF-S-03 — PWA install prompt

**Persona:** Any user, on first session completion  
**Starting point:** `SessionCompleted` event → install prompt logic

**Policy:** The install capability is a Must-be. The prompt UX must be non-intrusive. The passive icon is always available; the active prompt fires exactly once.

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Browser fires `beforeinstallprompt` | Event is captured and stored; native prompt deferred (not shown immediately) | Unaware |
| 2 | Passive install icon renders in nav header | Icon is always visible in-browser for browsers supporting install. Tap = show prompt. | Available on demand |
| 3 | User completes their first session | `SessionCompleted` event fires | Satisfied |
| 4a | *(Chrome/Edge/Android)* | Native install banner shown once: "Add TrainerApp to your home screen?" | Curious |
| 4b | *(iOS Safari)* | Custom in-app card: "Install for the best experience — tap Share then 'Add to Home Screen'" + illustration | Guided |
| 4c | *(Already installed or not supported)* | Nothing shown | Unaffected |
| 5 | User dismisses | Flag persisted (`installPromptSeen = true`); never shown again | Respected |
| 6 | User accepts | `prompt()` called; PWA installed; icon on home screen | Committed |

**Ongoing availability:** After step 5 or 6, the passive install icon in the nav header remains. A motivated user can always install manually — they just won't be prompted again.

**Alternative path — user seeks install manually:** Taps passive icon in nav → prompt shown (or iOS share-sheet card shown). Same single-use rule applies.

---

## UF-S-04 — Offline queue flush

**Persona:** Any user returning to connectivity after an offline period  
**Starting point:** Device reconnects; `window.online` event fires

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Network restores | `window.online` event fires; `syncService.flushQueue()` called | Background |
| 2 | Queue has items | `OfflineBanner` transitions: "Syncing…" with item count | Aware |
| 3 | Each item replays in order | Items sent sequentially (session → sessionExercises → sets); each gets a `sync_log` entry server-side | Transparent |
| 4 | All items succeed | `OfflineBanner` fades; TanStack Query cache invalidated; UI reflects synced state | Resolved |
| 5a | *(partial failure)* | Failed items remain in queue; banner: "X changes couldn't sync — tap to retry" | Alerted |
| 5b | *(conflict)* | Server returns 409; conflict entry written to `sync_log`; banner surfaces conflict count | Needs attention |

**Post-sync PR recompute (backlog):** After queue flushes, sets that were logged offline should re-check PR status server-side. Proposed: `POST /session-exercises/:id/recompute-prs` called for each synced sessionExercise.

---

## UF-S-05 — Push notification subscription

**Persona:** Any user — primarily Trainer for at-risk alerts  
**Starting point:** First login, or Preferences page

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | App requests push permission | Browser permission dialog: "TrainerApp wants to send notifications" | Considering |
| 2 | User allows | Push subscription created; `POST /push/subscribe` with endpoint + keys | Enabled |
| 3 | Notification fires | Browser/OS push notification delivered | Receiving |
| 4 | User taps notification | Deep-link to relevant context (client profile, session history) | Acting |

**Status:** 🔜 Not yet built. Service worker foundation exists (vite-plugin-pwa + Workbox). VAPID keys and push endpoint needed.

---

## UF-S-06 — Subscription and upgrade flow

**Persona:** Trainer on free tier or after trial expiry attempting a gated action, or proactively managing billing from settings  
**Status:** 🔜 Not yet built

**Two entry points:**
1. **Billing gate** — user attempts a gated action while `subscriptionTier = 'free'` or `subscriptionStatus = 'pastDue'`
2. **Settings** — user navigates to `/settings/billing` to view or change their subscription

### Main upgrade path

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| 1 | Taps "Add Client" (or other gated action) | Billing gate intercepts: upgrade modal shows current plan, feature being blocked, and "See Plans" CTA. Action is held — will resume automatically if subscription completes. | Paused |
| 2 | Taps "See Plans" | Plan selection screen: Free (current), Pro (N clients, reports, at-risk), Studio (unlimited + team). Pricing visible. | Evaluating |
| 3 | Taps "Subscribe to Pro" or "Subscribe to Studio" | Stripe Checkout opens (hosted page); plan pre-selected; no card stored until this step | Committing |
| 4 | Enters payment details | Stripe handles card entry, validation, 3DS if required; PCI compliance fully on Stripe | Completing |
| 5 | Payment succeeds | Stripe webhook → `SubscriptionCreated`; `subscriptionTier` and `subscriptionStatus` updated on `trainers` row; app redirected back | Unlocked |
| 6 | Billing gate clears | Held action proceeds automatically; success toast: "You're now on Pro" | Seamless |

### Trial expiry path

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| T1 | `trialEndsAt` passes with no subscription | Cron: `subscriptionStatus → 'free'`; email: "Your trial has ended — upgrade to keep your clients" | Not yet aware |
| T2 | Trainer opens app | Dashboard renders; existing clients visible (read-only); trial badge replaced with "Free plan" chip; no features immediately broken | Noticing |
| T3 | Taps any Pro-gated action | Billing gate intercepts — same as main path step 1 | Prompted |

### Billing management (settings path)

| Step | Action | System response | Emotional state |
|------|--------|-----------------|-----------------|
| B1 | Navigates to `/settings/billing` | Current plan shown: tier, `subscriptionStatus`, next billing date, `currentPeriodEnd` | Informed |
| B2 | Taps "Change Plan" | Plan selection screen (same as step 2 above) | Considering |
| B3 | Taps "Cancel Subscription" | Confirmation: "Access continues until [currentPeriodEnd]. After that, reverts to free." | Decided |
| B4 | Confirms cancellation | Stripe subscription set to `cancel_at_period_end`; `subscriptionStatus = 'cancelled'` | Finished |
| B5 | Taps "Update Payment Method" | Stripe Customer Portal opens (hosted; handles card update, invoice history) | Managing |

**Data on downgrade (P26):** All existing client data remains read-accessible. Past sessions, goals, and snapshots are viewable. New client additions blocked. Existing client sessions can still be logged — the trainer's own training is never gated.

**Offline state:** Billing gate and upgrade flow require network. `/settings/billing` shows cached subscription data if offline.

---

---

# Navigation Diagrams

## Athlete navigation tree

```mermaid
flowchart TD
    START([App open]) --> AUTH{Auth init}
    AUTH -->|Token valid| DASH[Dashboard / — action hub]
    AUTH -->|No token| LOGIN[/login]
    AUTH -->|Not onboarded| ONBOARD[/onboard]
    LOGIN --> ONBOARD
    ONBOARD -->|Select Athlete| DASH

    DASH --> TRAIN[TRAIN card — Start / Begin / Resume]
    DASH --> PLANCARD[PLAN card → planned session]
    DASH --> GOALSCARD[GOALS card → goals + KPI screen]
    DASH --> HISTCARD[HISTORY card → /sessions]
    DASH --> BUILDCARD[BUILD card → /templates]
    DASH --> MYTRAINING[/my-training → AthleteProfilePage]
    DASH --> EXERCISES[/exercises]
    DASH --> DASHSNAP[Log Snapshot → measurement form]

    TRAIN --> LIVE[/session/:id — LiveSession overlay]
    PLANCARD --> LIVE
    HISTCARD --> SESSIONLIST[/sessions]
    SESSIONLIST --> HISTORY[/session/:id/history]
    BUILDCARD --> TEMPLATES[/templates]
    LIVE --> SUMMARY[/session/:id/summary]
    SUMMARY -->|First session?| INSTALL([Install prompt — UF-S-03])
    SUMMARY --> DASH

    MYTRAINING --> SNAPSHOT[Body measurement form]
    MYTRAINING --> PHOTO[SnapshotPhotoCapture]
    MYTRAINING --> GOALS[Goal sheet]

    BADROUTE([/clients or /clients/:id]) -->|AthleteRouteGuard| DASH
```

## Trainer navigation tree

```mermaid
flowchart TD
    START([App open]) --> AUTH{Auth init}
    AUTH -->|Token valid| DASH[Dashboard /]
    AUTH -->|No token| LOGIN[/login]
    AUTH -->|Not onboarded| ONBOARD[/onboard]
    LOGIN --> ONBOARD
    ONBOARD -->|Select Trainer| DASH

    DASH --> SESSIONS[/sessions — all clients]
    DASH --> CLIENTS[/clients — roster]
    DASH --> EXERCISES[/exercises]
    DASH --> TEMPLATES[/templates]
    DASH --> MYTRAINING[My Training → AthleteProfilePage /my-training]
    DASH --> NEWSES[Session Launcher]

    CLIENTS --> PROFILE[/clients/:id — ClientProfilePage]
    PROFILE --> STARTSESS[Start session for client]
    STARTSESS --> LIVE[/session/:id — LiveSession overlay]
    LIVE --> SUMMARY[/session/:id/summary]
    SUMMARY --> PROFILE

    NEWSES --> LIVE

    MYTRAINING --> SELFPROFILE[AthleteProfilePage — isSelf data]
    SELFPROFILE --> SELFSESS[Session Launcher — selfClient auto-selected]
    SELFSESS --> LIVE

    SESSIONS --> HISTORY[/session/:id/history]

    ATRISK([At-risk alert]) --> CLIENTS
```

---

## Open questions (for event-storm)

1. ~~**Athlete billing model**~~ **Resolved (P23–P26):** Athletes are free forever. Trainers get a 14-day Pro trial at onboarding (no card). After trial, client management requires a Pro subscription. Billing gate intercepts gated actions for free/expired trainers.
2. **isSelf in session history filter** — Currently labeled "Me" when `selfClient.id === clientId`. Should it be hidden from the Trainer's all-sessions view or clearly separated?
3. **Notification permission timing** — Should push permission be requested at onboarding or deferred to first at-risk event?
4. **Offline login UX** — If access token is cleared and user is offline, should there be a cached "read-only" mode or a hard block?
5. **Template ownership** — Trainer creates a template, then logs a session for a client using it. Does the client's session history reference the template? Does the template show usage stats?
6. **Photo sharing preference** — `photoSharingPreference` (`private` / `share_selected` / `share_all`) is stored. What is the sharing surface — social share as image? Magic link for client portal? This affects UF-A-08 and UF-T-03.
7. **AthleteRouteGuard placement** — Wrap at the route level in `App.tsx` or as a HOC? Route-level is cleaner and more explicit.
