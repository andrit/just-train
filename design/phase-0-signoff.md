# Phase 0 Sign-off — TrainerApp

**Signed off:** 2026-06-18  
**Project:** trainer (pwa)  
**Signed off by:** Andrew Ritter

---

## Advance criteria — all met

| Criterion | Status | Notes |
|-----------|--------|-------|
| kano.md reviewed and all feature classifications confirmed | ✅ | |
| task-flow.md reviewed and all task steps confirmed including offline failure paths | ✅ | Updated in sign-off session to reflect flat session structure |
| user-flow.md reviewed and all screens, navigation paths, and offline fallback screens confirmed | ✅ | Updated in sign-off session to reflect flat session structure |
| event-storm.md reviewed and all domain events confirmed | ✅ | Updated through multiple review sessions (P16–P26, billing, session paths, flat structure) |
| Bounded contexts named and boundaries agreed | ✅ | 8 contexts — see below |
| glossary.md complete | ✅ | All terms defined including billing (9 new terms) |
| Offline contract explicitly decided | ✅ | design/offline-contract.md |
| Human explicitly approved Phase 0 | ✅ | "sign off on phase 0" — 2026-06-18 |

---

## Artifacts

| File | Chunks | Last updated |
|------|--------|-------------|
| design/event-storm.md | 89 | 2026-06-18 |
| design/bounded-contexts.md | 95 | 2026-06-18 |
| design/glossary.md | 78 | 2026-06-18 |
| design/user-flow.md | 108 | 2026-06-18 |
| design/task-flow.md | ~90 | 2026-06-18 |
| design/product-story.md | — | 2026-06-16 |
| design/offline-contract.md | — | prior |
| design/kano.md | — | prior |

All artifacts ingested to project RAG.

---

## Bounded contexts (8)

| Context | Persona | Responsibility |
|---------|---------|---------------|
| Identity | Both | Auth, trainerMode, account lifecycle, trainers row |
| Training | Both | Session, SessionExercise, Set, Exercise, Template, PR, RestTimer |
| Sync | Both | OfflineQueue, QueueFlush, SyncLog |
| Athlete | Both (isSelf=true) | AthleteProfile, Goal, Snapshot, ProgressPhoto |
| Roster | Trainer only | Client, AtRisk, Challenge |
| Insight | Trainer only | MonthlyReport, KPI, TrendData |
| PWA | Both | Install lifecycle, push notifications, service worker |
| Billing | Trainer | Subscription, Stripe, feature gating |

**Shared kernel:** ATHLETE ↔ ROSTER share the `clients` table (isSelf boundary). SK is data-model coupling only, not behavioral.

---

## Key design decisions locked in Phase 0

### Session structure
- **Flat**: `session → session_exercises → sets` — no intermediate workout block container
- `workoutType` is a property on `session_exercises`, inferred from the exercise record
- No `workouts` table; no `template_workouts` table

### Session creation paths (three)
1. **Planned ahead**: `SessionPlanned` (status: `planned`) → `SessionStarted`
2. **Build-first**: `SessionCreated` (status: `building`) → `SessionStarted`
3. **Jump-in**: `SessionStarted` immediately (atomic create + start, status: `in_progress`; empty exercise list)

### Exercise library
- Two filter dimensions: **body section** (anatomical region) and **workout type** (resistance, cardio, mobility, calisthenics)
- Both available in all exercise selection flows (jump-in, build-first, swap)
- "Swap exercise" pre-filters by swapped exercise's workout type — **advisory, not locked**

### Template structure
- Flat for both types: `template → template_exercises`
- `type = 'session'`: exercises may span multiple workout types
- `type = 'workout'`: all exercises share one workout type — **advisory constraint, not schema-enforced**
- `WorkoutTemplate` is a UI hint, not a structural difference

### Billing model
- **Athletes**: free forever — no gate, no trial, no payment
- **Trainers**: 14-day Pro trial at onboarding (no card); after trial, subscription required for client management
- **Billing gate**: intercepts gated actions (Add Client, Pro mutations); action held and resumes if subscription completes
- **Stripe**: Checkout (hosted), webhooks, Customer Portal
- Billing fields live on `trainers` row (`stripeCustomerId`, `subscriptionStatus`, `trialEndsAt`, `currentPeriodEnd`)

### Athlete context
- Serves both standalone Athlete users (trainerMode = 'athlete') and Trainers via "My Training" (isSelf client)
- Same code path, same aggregates, same API routes
- trainerMode distinction lives at Identity layer — Athlete context sees only a `clientId`

### Session status enum
`planned | building | in_progress | completed | partial | cancelled`

### Open gaps (to address in build phases)
| Gap | ID | Phase |
|-----|----|-------|
| `SessionStatus` enum missing `partial` and `building` in schema | G15 | Phase 2 |
| `templates.type` column not yet in schema | G16 | Phase 2 |
| Billing context not built | G17 | Phase 3/5 |
| `TrainerDeactivated` not implemented | G18 | Phase 5 |
| `AthleteRouteGuard` not yet blocking `/clients` | G1 | Phase 3 |
| `MyTrainingPage` still redirects to `/clients/:selfClientId` | P8 gap | Phase 3 |

---

## What Phase 1 picks up

Phase 1 (Scaffold) audits and completes the PWA infrastructure foundation — manifest, service worker, HTTPS, app shell — against the advance criteria in the SDLC.

TrainerApp is an existing app at v2.14.0. Phase 1 is therefore an **audit + gap-fill**, not a greenfield scaffold. See `design/phase-1-kickoff.md`.
