# Kano Model — TrainerApp

**Phase 0 artifact — draft for review**
**Last updated:** 2026-06-16

---

## Personas

Two distinct user types. Classifications are noted per-persona where they differ.

**Athlete** — Solo self-tracker. Uses the app for personal training only: plan routines, log sessions, track progress over time. No clients, no roster, no reports. The app is their complete personal training companion.

**Trainer** — Professional coach who manages a client roster. Has the full Athlete experience embedded via isSelf ("My Training"), plus client management, at-risk monitoring, and monthly reports.

---

## Status key

- ✅ Built and shipped
- 🔜 Planned (next phases)
- ⏸ Deferred
- ❌ Cut from scope

---

## Must-be
*Table stakes — users are dissatisfied without these. Presence is expected, not celebrated.*

### Shared (Athlete + Trainer)

- ✅ **Register and log in** — email + password, secure token handling
- ✅ **Session logging** — create a session, log sets with weight + reps, complete the session
- ✅ **Workout blocks** — group exercises into typed blocks (resistance, cardio, calisthenics, etc.)
- ✅ **Rest timer** — automatic countdown between sets; persistent across scrolling
- ✅ **Exercise library** — searchable, filterable library of movements with body part and type
- ✅ **Session history** — review past sessions; per-exercise history ("last 3 times" context)
- ✅ **Goals** — set goals, mark achieved; history is never deleted
- ✅ **Offline session logging** — sets logged without internet connection are queued and sync when back online. *A gym has poor signal. Losing a set log is unacceptable.*
- ✅ **Data does not disappear** — sessions, sets, and goals persist across app restarts, device changes, and offline periods
- ✅ **Secure auth in standalone mode** — session persists when app is launched from the home screen icon (PWA standalone); refresh token in httpOnly cookie handles this correctly
- ✅ **App is installable as a PWA** — the app must be installable to the home screen and launchable without a browser. This is a Must-be: the product should feel like an app, not a website. The install prompt itself must never be intrusive — no nudging on first load, no recurring banners. The capability must exist; the prompt surfaces contextually or not at all. Users who distrust non-app-store installs should be able to use the full app in-browser with no friction.

### Athlete-only Must-be

- ✅ **My Training profile** — goals, snapshots, and session history in one dedicated place. This is the Athlete's home base outside the dashboard.
- ✅ **Athlete-only navigation** — Dashboard, Sessions, My Training, Exercises, Templates. No client vocabulary anywhere.
- ⚠️ **Client routes blocked** — `/clients` and `/clients/:id` must redirect Athletes to the dashboard. An Athlete must never encounter client vocabulary. *Must-be gap — not yet enforced in routing.*

### Trainer-only Must-be

- ✅ **Client roster** — add, view, edit, and manage external clients
- ✅ **Client profile** — per-client goals, snapshots, and session timeline in one view
- ✅ **Self-client (isSelf)** — Trainer's own Athlete experience, accessible via "My Training" tab

---

## Performance
*Core differentiator — more quality here means more users activate, retain, and upgrade. Linear relationship: better = more satisfied.*

### Shared (Athlete + Trainer)

- ✅ **Per-exercise history in live session** — "last time you did this: 80kg × 8" shown inline during set logging. More history surfaced = better decisions = more value.
- ✅ **Template library** — reusable session plans. The more useful templates available, the less friction before a workout.
- ✅ **Session planning ("plan the day")** — build the workout before the gym. Multiple planned sessions can be open simultaneously.
- ✅ **Personal Records (PR) detection** — 1RM estimate (Epley) and volume PR tracked per exercise. PR flash on set log + persistent chip on the set row.
- ✅ **KPIs per training profile** — volume trend, 1RM estimates, streak, consistency score. Focus-aware (resistance vs cardio vs calisthenics).
- ✅ **Subjective scoring** — RPE, energy, mood sliders on session completion. Qualitative layer on top of the numbers.
- ✅ **Snapshots / measurements** — body comp and functional measurements over time. Baseline delta shown on profile.
- ✅ **Exercise media** — visualization (muscle diagram) and demonstration (video). More complete = better exercise selection.
- ✅ **Offline fallback screens** — every route must show a meaningful offline state when the network is unavailable and no cache exists. No blank screens, no unhandled errors. ⚠️ Full audit required — built but not verified across all routes.

### Trainer-only Performance

- ✅ **At-risk detection** — clients with no session in 14 days are flagged. The earlier the signal, the faster the intervention.
- ✅ **Monthly reports** — HTML email sent to clients. Quality of narrative (goal arc + key metrics + trend commentary) directly drives client retention.
- 🔜 **At-risk push notifications** — alert fires when a client crosses the 14-day threshold without a session. Not yet built.
- 🔜 **Report-ready push notification** — trainer gets confirmation when a report dispatches successfully. Not yet built.

---

## Delighter
*Unexpected features that create "wow, it does that?" moments. Absence is neutral — users didn't expect them.*

### Shared (Athlete + Trainer)

- ✅ **PR flash animation** — amber flash fills the log area on a new PR, then fades. Rest timer slides into the footer simultaneously. Unexpected moment of recognition.
- ✅ **Challenges** — coach-assigned challenges with progress tracking. Athletes can see their own challenges on the dashboard.
- ✅ **Camera capture** — progress photos taken in-app, stored with the snapshot. Front camera default for athletes.
- ✅ **UX event system** — 33-type taxonomy with animation engine. Interactions feel alive (pulse on add, confetti on achievement, etc.).
- ✅ **Offline banner** — subtle sync status indicator; banner appears when offline, resolves when sync completes.
- ⏸ **Leaderboards + weekly quests** — competitive layer for Athletes using the app. Deferred (v2.15.0).
- ⏸ **Social share** — share a PR or streak milestone as an image. Deferred (v2.15.0).
- 🔜 **Push notifications for milestones** — notify on new PR, streak milestone, or completed challenge. Not yet built; use case clear.
- 🔜 **Exercise visualization and demonstration content** — muscle-group diagrams and form videos. Schema exists; content population deferred (Phase 9).

### Trainer-only Delighters

- 🔜 **Client portal magic link** — client receives a read-only link to their own report. They don't need an account.
- 🔜 **Athlete → Trainer upgrade flow** — Athlete's data becomes their isSelf client when they upgrade. Seamless continuity. Deferred (definition in progress).

---

## Indifferent
*Users don't care either way. Don't spend time here.*

### Athlete-indifferent (Trainer features that mean nothing to a solo user)

- Client roster management
- At-risk alerts for clients
- Monthly reports to clients
- Studio tier / multi-trainer accounts
- Per-client billing metrics

### Trainer-indifferent

- Storybook component library (dev tooling, not user-facing)
- RxJS observable navigation refactor (internal implementation detail — v3.1.0)

### Both-indifferent

- SSO / SAML (enterprise concern; the target user is an independent trainer or solo athlete)
- Zapier / third-party integrations (v1 scope; may graduate to Performance if trainers request it)
- Custom roles beyond Athlete/Trainer (overengineering for the current scale)

---

## Cut from scope
*Actively excluded — either wrong market, wrong phase, or harmful to the core experience.*

- ❌ **React Native apps** — PWA is sufficient. Native adds maintenance cost with no meaningful UX gain for this use case.
- ❌ **Public REST API with API keys** — not a platform play in v1. Revisit if studios want integrations.
- ❌ **Email verification on register** — deferred to multi-trainer launch. Gate is one line of code when needed.
- ❌ **HIPAA / GDPR compliance modules** — out of scope for independent trainers.
- ❌ **Template marketplace** — interesting but a separate product surface. Trainers share templates by forking, not a marketplace.
- ❌ **LLM-generated workout summaries** — AI layer belongs after the data model is proven, not before.

---

## PWA-specific summary

| Capability | Athlete | Trainer | Status |
|---|---|---|---|
| Offline session logging | Must-be | Must-be | ✅ Built (IndexedDB + sync log) |
| App is PWA-installable (capability) | Must-be | Must-be | ✅ Built (vite-plugin-pwa + Workbox) |
| Install prompt UX (non-intrusive) | Must-be | Must-be | ⚠️ Needs review — must not nag; contextual or absent |
| Lighthouse PWA audit | Must-be (validates installability) | Must-be | 🔜 Not yet formally run |
| Push — milestone / PR | Delighter | Delighter | 🔜 Not built |
| Push — at-risk alert | Indifferent (no clients) | Performance | 🔜 Not built |
| Push — report dispatched | Indifferent (no reports) | Delighter | 🔜 Not built |
| Offline fallback screens | Must-be | Must-be | ⚠️ Built but full audit required |
| Background sync indicator | Must-be | Must-be | ✅ Built (OfflineBanner) |
| Athlete route guard (/clients blocked) | Must-be | — | ⚠️ Not yet enforced — gap to close |

---

## Scope summary

| Tier | Contents |
|---|---|
| **Athlete MVP (complete)** | Auth, session logging, rest timer, exercise library, templates, session history, goals, snapshots, KPIs, PR detection, offline sync, installable PWA |
| **Trainer MVP (complete)** | Everything Athlete has + client roster, client profiles, at-risk detection, monthly reports |
| **Next — both** | Push notifications (milestones, at-risk), Lighthouse audit, offline fallback screen audit, Athlete route guard |
| **Next — Athlete** | Leaderboards, quests, social share (v2.15.0), Athlete → Trainer upgrade flow |
| **Next — Trainer** | Client portal magic link, Stripe billing gates (v3.0.0) |
| **Not building** | React Native, public API, HIPAA modules, template marketplace, LLM summaries |
