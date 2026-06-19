# Product Synthesis — TrainerApp

**Status: APPROVED — 2026-06-19 by Andrew Ritter**
**Date:** 2026-06-19
**Owner:** Andrew Ritter
**Purpose:** North star positioning document. Synthesises product story and strategy into a single agreed frame for product, design, and marketing decisions.

---

## The one sentence

**TrainerApp is the training record for athletes who take their progress seriously and the coaching tool for trainers who take their clients seriously — built for the gym floor, not the screen.**

---

## Who we are building for

### Primary buyer: The dedicated self-coached athlete

Not a casual gym-goer. Not someone tracking steps. Someone who has a programme, follows it consistently, and is frustrated that their tools don't reflect that seriousness.

**Profile:**
- Trains 3–5 days a week with a real programme (resistance, calisthenics, or structured cardio)
- Has been training long enough to care about progressive overload — not just "did I work out today"
- Is currently using a notes app, a whiteboard, or a generic tracker that exports to a CSV nobody reads
- Goes to a gym with patchy signal. Has lost set data before. It will not happen again with this app.
- Does not want to be coached by AI. They want to see their own data and make their own decisions.

**Their job-to-be-done:** *Know exactly what I lifted last time, see when I'm making progress, and have a record I can trust even when the signal drops.*

### Secondary buyer: The independent personal trainer

Not a gym chain. Not an enterprise wellness platform customer. An independent trainer managing 10–25 clients, working from a phone.

**Profile:**
- Has tried the spreadsheet + WhatsApp stack and hit its limits around client 8
- Loses clients to silence — they stop showing up and the trainer finds out too late
- Spends evenings writing progress emails from memory — it takes an hour and it's always incomplete
- Trains themselves, poorly, because they spend the session focused on everyone else
- Does not need a CRM. Needs a coaching tool that understands training data.

**Their job-to-be-done:** *Know which clients need attention before they disappear, send reports that justify my value without spending an evening on them, and still log my own training.*

### Who we are not building for

- Casual gym-goers who want a step counter and calorie goal
- Enterprise gym chains or franchise operators
- Coaches managing teams (sports, academy-level) — different data model, different compliance requirements
- People who want AI to write their programme — TrainerApp logs what you execute, it does not generate what you do

---

## Competitive position

### The market landscape

| Product | What it does well | Why it is not TrainerApp |
|---|---|---|
| **Hevy / Strong** | Clean set logging, popular | No trainer mode, no reports, no offline queue, no dual-mode |
| **Trainerize / TrueCoach** | Trainer-client management | Web-first, not PWA, no native offline, expensive per-client pricing |
| **MyFitnessPal** | Nutrition tracking | Wrong category — food logging, not training logging |
| **Spreadsheet + WhatsApp** | Free, flexible | Zero persistence, no context, breaks at scale |
| **Apple Fitness+ / Strava** | Consumer-grade motivation | No coaching layer, no data ownership, no offline-first |

### TrainerApp's position

**The only PWA-first, dual-mode training record with offline session logging and a coaching layer.**

Three claims, each defensible:

1. **PWA-first:** The service worker, the offline queue, the manifest, the install prompt timing — these are architectural decisions, not features bolted on. A native app wrapper for this use case adds maintenance cost with no meaningful UX gain. The product ships on the home screen without the App Store.

2. **Dual-mode:** The Athlete experience is not a stripped-down Trainer. It is the atom. The Trainer experience is built on top of it. A trainer who stops coaching can run as a solo Athlete without data migration. A solo Athlete who starts coaching can upgrade without starting over.

3. **Offline session logging with sync:** The queue is persistent, interface-abstracted, and syncs on reconnect. Set data does not disappear. This is the must-be that every competitor handles poorly.

### Where we are not competing

- We do not compete on AI-generated programming. The AI layer belongs after the data model is proven.
- We do not compete on social features, leaderboards, or community. These are deferred Delighters.
- We do not compete on nutrition tracking. The training record is the product; nutrition is another category.
- We do not compete on desktop-first. This product is built for a phone in a gym.

---

## Value chain

How value flows through the product for each persona:

### Athlete value chain

```
Install (home screen) →
  First session logged →
    PR detected (first real "aha") →
      Consistent logging (habit formed) →
        Progress visible in KPIs + snapshots →
          App becomes the record of record →
            Some athletes become trainers → upgrade path
```

The value compounds with every session logged. A user with 6 months of data has a record no competitor can give them if they switch. **Data gravity is the retention mechanism.**

### Trainer value chain

```
Register (free trial) →
  First client added →
    At-risk alert fires (first signal the tool is working) →
      First monthly report sent (client retention moment) →
        Client base grows →
          Pro subscription required (billing gate at 14-day trial end) →
            Monthly revenue per trainer × growing client count
```

The at-risk alert and the monthly report are the two moments the trainer realises the tool is earning its subscription. Everything else — the session logging, the exercise library, the template builder — is infrastructure that makes those two moments possible.

---

## AI / voice / integration stance

These decisions are made. They should not be relitigated without a strong product reason.

### AI

**Not now. Explicitly deferred. Role defined.**

TrainerApp does not use AI to build workouts or summarise sessions. That is not the job.

The role AI earns here is **plateau analyst** — a conceptual companion for uncovering new paths to new plateaus. Not a coach, not a programme generator. Something that looks across months of accumulated performance data (RPE × weight × reps × set outcomes × time) and asks: where are you stuck, and what does the data suggest about how to get unstuck?

This is a quality decision, not a capability decision. The foundation — longitudinal training data, PR history, subjective RPE scores, snapshot timeseries — is being built now. When a user has 3–6 months of consistent logging, the signal outweighs the noise and the model has something real to work with. At month 1, it would be noise dressed as insight.

**What AI is not:** a workout builder, a session summariser, a form checker, a calorie estimator. Those are different products.

**When the conversation opens:** v4.0.0 or later, after SaaS is stable and sufficient longitudinal data exists across the user base to make the analysis meaningful.

### Voice

Not in scope. A gym is loud. Voice input for set logging is a UX dead end in the environments where the app is actually used.

### Integrations

**Current:** Cloudinary (media), Resend (email reports), Railway (backend hosting), Vercel (frontend hosting), Stripe (v3.0.0).

**Not planned:** Apple Health, Google Fit, Garmin, Strava, Whoop. Each integration adds a maintenance surface and a data normalisation problem. If user demand makes one of these compelling, evaluate it against the maintenance cost at the time.

**Wearable data:** Not in scope. RPE and subjective scores are the qualitative layer. Wearable integration is a separate product decision.

---

## Design principles derived from this position

These follow directly from the competitive position and value chain above. They should be visible in every wireframe.

1. **The gym floor first.** Every interaction must be completable in 3 seconds with one hand in a noisy environment. If it can't, it's not the right design.

2. **Data is the product.** The UI's job is to get data in cleanly and surface it meaningfully. Decoration that does not serve data capture or data display is cut.

3. **Offline is not an edge case.** The offline state is a first-class UI state on every screen. Blank screens and unhandled errors are product failures.

4. **The athlete is invisible to the trainer's UI.** The athlete experience uses first-person language throughout. The trainer experience uses client vocabulary throughout. They never bleed.

5. **The install moment is earned, not demanded.** The install prompt fires once, after the first completed session, for users on a supporting browser. It does not appear on first load. It does not recur on dismiss.

6. **Progress visibility is the retention loop.** Every screen should make progress either more visible or easier to capture. If it does neither, question why it exists.

---

## What this document authorises

Agreeing this document authorises the wireframe phase to proceed with:

- The dual-mode navigation model (Athlete nav vs Trainer nav as distinct component trees)
- The install prompt moment: after first `SessionCompleted` event, once, non-recurring
- PWA-first layout decisions (375px mobile primary, bottom tab bar, no persistent sidebar)
- The "no AI" constraint in the initial wireframe scope — no AI copy, no AI placeholder screens
- Capture → Compare → Communicate as the screen evaluation framework
- Design language: dark UI, industrial texture, triadic accent system

---

## Resolved decisions

These were open questions in Phase 0, now confirmed:

1. **Push notifications:** deferred past SaaS launch. Not in scope for the initial wireframe set. No notification permission flow in Phase D or Phase 6.

2. **Athlete upgrade path:** settings toggle with a paywall. No dedicated upgrade screen. This simplifies navigation and onboarding wireframe scope.

3. **Report delivery:** strictly email (Resend) for now. No in-app report preview in the initial wireframe scope.

---

*Draft prepared 2026-06-19. Open questions resolved 2026-06-19. Requires human approval before wireframes proceed.*
