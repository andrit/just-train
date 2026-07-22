# Product Story — FORGE

**Phase 0 artifact** — the narrative below is preserved as written on 2026-06-17 (working name "TrainerApp").
**Last updated:** 2026-07-22 — product renamed **TrainerApp → FORGE**; post-build section appended at the end.

---

> *TrainerApp is a progress narrative engine. Logging is just the input.*

---

## The problem worth solving

Most people who train seriously do not have a great tool for it.

The gym is loud, humid, and has poor signal. You're mid-set, trying to remember what you lifted last week. You finish, open your notes app, type "bench 80kg 3×8" and close it. Six months later you can't find it. You start over at a weight you already passed. Nothing compounds.

Or you use a fitness app — and it is technically fine. It logs the sets. But it doesn't know your training history the way your body does. It gives you a calendar of completed workouts. It does not tell you that you've been stalling on squats for six weeks, or that the week you got eight hours of sleep every night was the week you hit three PRs.

The numbers are captured. But the story is lost.

---

## Two people, one core experience

### The Athlete

The Athlete is training for themselves. No coach, no accountability partner — just a goal, a program, and the discipline to show up. They want an app that does what a good training journal does, only better: remembers everything, surfaces context at the right moment, and reflects progress back in a way that makes the next session feel earned.

They want to walk into the gym and know exactly what they lifted last time. They want to see a PR called out — not buried in a spreadsheet, but flashed in front of them the moment it happens. They want to take progress photos with some structure and look back in three months and actually see the difference. They want to set goals and watch them become an arc — not just checkboxes, but a story of what they came in wanting and what they built.

They do not want to be told to install an app, sign up for a newsletter, or turn on notifications. They want to open it, log the workout, and leave.

**Before:** a notes app, a whiteboard in the gym, a generic fitness tracker that exports to a CSV nobody reads.

**With TrainerApp:** every session logged — even when the signal drops mid-set. Context in view. PRs recognised in real time. Progress visible. No spreadsheet. No export.

### The Trainer

The professional coach is managing ten, fifteen, twenty clients. They spend their training sessions on the gym floor, phone in hand, logging sets for someone else. They spend their evenings writing check-in messages, assembling progress reports, wondering which clients they haven't heard from in a while.

The tools that exist for them are either too light (a spreadsheet and WhatsApp) or too heavy (enterprise software built for HR departments, not coaching relationships). Neither understands the rhythm of a training week.

The at-risk client is the one they lose without warning. They haven't trained in three weeks. The trainer finds out when the client cancels. With the right signal, the trainer could have reached out on day fifteen.

The monthly report is the moment the coaching relationship is made visible — goals set, goals achieved, volume trends, the narrative of what changed. Written from memory or not written at all, it's either incomplete or it costs an hour of time the trainer doesn't have.

And their own training? It falls off. They're focused on everyone else.

**Before:** client data spread across a notes app, a spreadsheet, and memory. Reports written under deadline. Their own training is a second-class activity.

**With TrainerApp:** client roster with at-risk alerts — the 14-day flag appears before the client ghosts. Monthly reports assembled from real data, one tap to send. And "My Training" — the trainer's own complete Athlete experience, right there, not an afterthought.

---

## The design thesis

```
Capture → Compare → Communicate
```

**Capture** is the set log — the weight, the reps, the offline queue when the signal drops. It has to be frictionless. One distracted second in a live set is too long to spend fighting the UI.

**Compare** is what makes capture meaningful. Last time you did this: 80 kg × 8. This is a PR. Volume this week is up 12% from last month. The baseline was here; you are here now. Without compare, capture is just a list of numbers.

**Communicate** is what makes compare matter. The PR flash. The monthly report. The at-risk alert. The progress photo comparison. The moment where the app hands the story back to the person who lived it.

Every screen in the app can be evaluated against this axis. Does it help someone capture, compare, or communicate? If the answer is none of these, it belongs in the "cut from scope" column.

---

## Athlete is the atom

The Trainer experience is built on top of the Athlete experience — not the other way around.

This matters for every product decision. When we're designing a session flow, we design it for the Athlete first: fast, focused, offline-capable, frictionless. The Trainer gets that same flow for every client they coach, including themselves. Their "My Training" tab is not a lite version of the client profile view — it is the full Athlete experience, accessed from inside a Trainer account.

An Athlete never sees a client roster. They never encounter the word "client." Their world is: Dashboard → My Training → Sessions → Exercises → Templates. That is the complete product for them. It is not a feature subset — it is the whole thing.

This separation has a technical consequence: `AthleteProfilePage` and `ClientProfilePage` are separate components. The `/clients` routes are blocked for Athletes. The vocabulary in the Athlete UI is first-person throughout — "your goals," "your training," "your progress." The underlying data model is the same; the experience is distinct.

---

## The isSelf bridge

When a Trainer registers, their isSelf record is created automatically. This record is the Trainer's Athlete experience — their goals, their snapshots, their sessions. The backend treats it identically to any external client record. The trainer accesses it through "My Training."

The isSelf record is never shown in the client roster. It is never managed like a client. It is the bridge between the two experiences — the mechanism by which a single product serves both a self-coaching athlete and a professional coach who trains alongside the people they coach.

---

## The PWA promise

TrainerApp must feel like an app. Not a website that happens to work on a phone — an app you install, an app you trust with your training data, an app you open from your home screen without thinking about URLs.

This matters most in the gym. Spotty signal, one hand occupied, three seconds to log the set. The app must not require a browser. It must not lose sets when the connection drops. It must not require a login every session.

The PWA installability is a must-be capability, not a delighter. The install prompt, by contrast, must never be intrusive — no banner on first load, no recurring nudges. The passive install icon in the nav is always there for anyone who wants it. The contextual prompt fires once, after the first completed session, for users on a browser that supports it. That's the full install surface. Users who prefer the browser experience get the full product without friction.

---

## The progress record

Training progress is non-linear and it is easy to miss. The weight goes up until it doesn't. The streak breaks and the calendar goes blank. A photo taken three months apart shows a change no mirror reveals on a Tuesday morning.

TrainerApp is designed to make this record visible:

- Goals are append-only. A goal achieved is part of a narrative arc, not a checkbox to clear. The arc from "I want to deadlift twice my bodyweight" to "I deadlifted 180 kg on 14 March" is the content of a monthly report, the reason someone keeps coming back.

- Snapshots are time-series. Body composition, circumference, cardiovascular markers, subjective notes — all optional, all stored, all compared against the baseline. The delta shows up next to the number. The progress photo comparison shows up next to the mirror.

- Session history is live context. The moment you add an exercise in a live session, the last three times you did it are there — date, weight, reps, PR marker. You do not need to remember. The app has it.

---

## The Trainer's practice

For a professional coach, the product is also a business tool.

The at-risk alert is not a nice-to-have — it is the mechanism by which the trainer retains clients. A client who disappears for three weeks is usually gone. A trainer who reaches out on day fifteen can still turn that around. The 14-day flag is the signal that makes that intervention possible.

The monthly report is the artefact that justifies the coaching relationship to the client. It answers: what did we set out to do, what did we actually do, how did the numbers move, what's next? Written consistently, it is the record of the coaching practice itself. The app assembles the data; the trainer adds the narrative layer — the commentary, the adjustment, the intention for next month. One tap to send.

Push notifications for at-risk alerts and report delivery are planned. They are not built yet. When they are, the loop closes: the trainer knows immediately when a client crosses the threshold, and knows immediately when the report lands.

---

## The path forward

TrainerApp is at v2.14.0. The core training experience is complete. The app is close to production but not there yet.

The immediate path:

- **Phase 0 design alignment** (now): establish the Athlete/Trainer model clearly in code, components, and routing. Close the Must-be gaps: route guard, URL leak, dedicated `AthleteProfilePage`. The design artifacts in this folder are that work.

- **Push notifications**: at-risk alerts and report delivery confirmations. The service worker foundation is in place; VAPID and the push endpoint are next.

- **v3.0.0 — SaaS**: Stripe integration, subscription gates, billing UI. The billing model for Trainers is active clients per month. The billing model for Athletes is TBD — the product must serve them without assuming they all become Trainers.

- **Athlete → Trainer upgrade**: an Athlete who starts coaching others should be able to carry their training data forward. Their Athlete record becomes their isSelf client. They gain the Trainer layer without starting over.

The longer horizon: challenges and leaderboards (v2.15.0), the client portal magic link so a client can read their own report without an account, eventually a social layer for milestone sharing. These are Delighters — present in the Kano model, absent from the current scope.

---

## What this product is not

TrainerApp does not generate workout plans. It logs the plans you execute. The intelligence is in the coach or the athlete — the app surfaces the data that makes that intelligence useful.

TrainerApp does not have a marketplace or a social feed. It is a private training record, shared only when the trainer or athlete chooses to share it.

TrainerApp does not use AI to summarise sessions or recommend exercises. The AI layer belongs after the data model is proven, not before. When there is enough longitudinal data to make meaningful recommendations, that conversation opens. Not yet.

TrainerApp does not have a React Native app. The PWA is sufficient. Native adds maintenance cost with no meaningful UX gain for this use case — the offline session logging, the progress photos, the rest timer — all work in the browser. The home screen install path is the only native-equivalent feature that matters, and the PWA delivers it.

---

## The one-line version

**TrainerApp is a progress narrative engine for athletes and the coaches who guide them — built for the gym floor, not the boardroom.**

---

## Post-build — what shipped, and the name  *(added 2026-07-22)*

The narrative above is the Phase-0 story, written before the product was built and preserved as written. This section folds in what was actually learned and shipped by v2.14, and records the brand that emerged.

### The name: TrainerApp → FORGE
"TrainerApp" was always a working label. The product is **FORGE**, tagline **"Just Train."** — one hard, activity-agnostic word for *making your body your machine*. See `docs/product-development/brand-identity.md` and `design/brand/`. (Domain target `trainforge.io`, not yet acquired; USPTO Class 9/41 clearance pending — the only thing that reopens the name.)

### What held from the Phase-0 thesis
- **Athlete is the atom — confirmed in code.** `AthleteProfilePage` is a separate tree, `/clients` is route-guarded for Athletes, and the Athlete UI is first-person throughout. The Trainer layer sits on top via the isSelf bridge, exactly as the story argued.
- **Capture → Compare → Communicate held** as the evaluation axis. Capture is offline-durable (write queue v2.4.0, idempotent replay v2.14.1 — no double-logged sets). Compare shipped as per-set history prefill, PR detection (Epley 1RM), KPIs and consistency. Communicate shipped as the PR flash, monthly reports (Resend), and at-risk alerts.
- **The PWA promise was delivered** — installable, offline auth hold, home-screen launch, service-worker caching. Native was correctly never built.

### What the build added beyond the original story
PRs + personal-bests, gamification foundations (streaks, consistency, **coach challenges**), the **template library**, **camera / form-check clips** and **progress photos**, the named **color system** (v2.14.0 — Forge Black / Chalk White / Iron Grey / Ember Red / Command Blue / Signal Yellow), and security hardening (v2.13.0). The v2.5.0 execution rework (horizontal exercise navigation, rest timer in the footer) and the per-set weight ramp sharpened Capture.

### The refusal positioning, made explicit
The Phase-0 "What this product is not" section was the seed of the whole brand. Post-build it is the **positioning**, stated positively as five values: **Log the work · Progress, not engagement · Private by default · You're the coach · Forge yourself.** No feed, no AI coach, no meal plans — that refusal *is* the product.

### What's still ahead (unchanged from the story, still true)
Push notifications remain deferred (post-SaaS). SaaS / Stripe billing is v3.0. The Athlete → Trainer upgrade is still the one-way growth path. Leaderboards and the social/share layer stay Delighters.

### The one-line version, post-build
**FORGE is a bare-metal training record — where you make your body your machine. Log the work, get stronger, nothing else. Just train.**
