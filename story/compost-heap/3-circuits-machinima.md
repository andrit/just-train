---
kind: machinima — rig-run reaction to a frozen compost source
reacts-to: 3-circuits.md
author: claude (companion reaction — observations + things to pull on, NOT report prose)
started: 2026-11-02
convention: single living doc with a Changelog. Writer's inline notes = authorNotes (*italic*, *n),
            never overwritten. Major restructure → snapshot to archive/ first.
---

# Reaction — the circuits feature

Companion read, before gardening. Three lenses, spine test, tensions.

## Aesthetics

- **The circuit is rendered as a box** — a bounded card you cycle through, which literally matches
  the mental model ("your box"). Structure becomes a container.
- **The dot-grid is the aesthetic heart:** rounds × exercises as fillable dots, the current one
  ringed — a *scorecard* that shows the whole 2D progress space in one glance. You always know which
  exercise and which round you're on.
- **Borrows the app's existing semantic palette** rather than inventing: Command-Blue for active,
  emerald check for complete, amber for PR. Circuits read as part of the system, not a bolt-on.

## Affordance

- **The killer move: round-major position is DERIVED from logged set counts, not stored.** The UI
  can't lie about where you are because it reads what's actually been logged — robust to reload and
  to logging out of order. This is the "a readout that can't lie" / functional-core instinct applied
  to live UI state. **Lead with this.**
- **Rest fires only after the last exercise of a round** — the UI encodes the *actual training
  semantics* of a circuit (no rest between interwoven moves, rest between rounds). Behavior matches
  the modality, not a generic timer.
- **Self-healing:** a circuit that drops to one member demotes to solo. The UI refuses to render a
  nonsensical "circuit of one."
- **The builder teaches the concept at creation** — "one set of each per round, in this order" — and
  the numbered chips make *selection order = round order*, shown live. No separate reorder step
  (simple, but see tensions).

## Product-story fit (Act Zero)

- **Before:** the session model was exercise-major blocks (all sets of A, then B). A circuit is a
  fundamentally different **execution order** the flat model couldn't express — so logging a circuit
  meant faking the interleave by hand or losing the structure. Circuits make an entire training
  **modality first-class.**
- **Fit in the thesis:** this is the **Capture** side answering "the app should fit how people
  actually train" — and it protects **Compare** (a circuit's sets stay comparable round-over-round).
- **Composition, not duplication:** reusing `ExerciseBlock` means the circuit is the exercise atom
  rearranged — echoing the app's "athlete is the atom" composability philosophy. Architecturally
  clean; story-wise, "the atom composes into a new structure."

## Spine test (Bridge — flagged)

Fits "legible at a glance" (encodes *how the work is structured*). But circuits aren't about
colour/CVD, so the **redundant-encoding safety net doesn't apply** — instead there's a *parallel
robustness motif*: **derived-not-stored state.** That rhymes with type-coding's unknown→neutral
fallback and the body map's data>render. **This nudges the spine wider than I first framed it:** not
just "legible at a glance + a safety net," but **"honest representation — the UI shows the true state
of training and derives/degrades safely."** Flagging that the spine is evolving.

## Tensions worth pulling on (your call which we garden)

1. **Builder order = tap order, no reorder** — limiting when you want a specific sequence?
2. **Shared weight/reps across all members** — real circuits often carry different loads per
   exercise (per-exercise weights "later"). Name the v1 limit honestly.
3. **Resistance-only v1** — but the most common circuit in the wild is **bodyweight/mixed HIIT**,
   which v1 *excludes.* That's the biggest tension; the report shouldn't gloss it.
4. **Headline** — "a supersets/circuits feature," or **"making an execution modality first-class +
   the derived-state robustness that makes it trustworthy"**? *(I lean the pair.)*

<!-- authorNotes land here or inline above, marked *1 *2 … -->

## Changelog

- **2026-11-02** — initial reaction (aesthetics / affordance / Act Zero), spine test, four tensions.
- **2026-11-02** — writer review + Claude reply: headline locked ("execution modality made trustworthy,
  through design"); per-member-targets clunk resolved via #4's "weight is athlete-owned" (don't plan
  per-member weight; reps via All-same/Per-exercise disclosure); drag-reorder (enhancement) +
  interstitial-HIIT-capture (Capture gap) parked.

REPLY:
 1. reorder by drag before the work is being done could be useful
  2. you can update weight and reps when the nested exercise comes up. but the setup in v1 is to give each the same in the circuit. how would this be
  redesigned without being clunky. seems deceptively challenging
  3. resistance only v1, as it matches my personal woprkouts style, though honestly, I do some hiit style exercises in between some sets i dont even list
  as circuits. would be good to be able to capture that.
  4. "a supersets/circuits feature," --BECOMES--> "making an execution modality first-class +
     the derived-state robustness that makes it trustworthy" through design

ENDREPLY;

---
## Claude reply — 2026-11-02

**4 — locked, with your nuance:** the transformation is *through design* — the derived-state
robustness plus the box/dot-grid are what turn "a supersets feature" into "an execution modality made
trustworthy." Headline and thesis in one line.

**1 — drag-reorder before execution: agreed, useful, small.** The box order is still soft before the
work starts, so drag-to-reorder the selected chips (pre-Create) is clean and low-risk — reorder the
plan, never mid-execution (where the derived position would fight a reorder). Parking it as a potential
enhancement; not a blocker for the report.

**2 — the per-member-targets clunk dissolves once you stop treating weight and reps the same.**
You're right it's deceptively hard *as posed* — 4 exercises × (reps + weight + step) is an input wall.
But the app already decided the hard half: from the set-targets work (#4), **weight is athlete-owned —
it lives in history / prefill-with-last, not in the plan.** So:
- **Per-member weight doesn't belong in the builder at all.** Keep one shared (optional) starting
  weight; each member's real load comes from live logging + prefill-from-last when its turn comes up —
  exactly the "update when the nested exercise comes up" you described. Half the wall gone.
- **Per-member reps** *is* plan-worthy (rep schemes are stored). Non-clunky path: reuse a vocabulary the
  app already has — a circuit-level **All same** (current default, fast) vs **Per exercise** toggle;
  "Per exercise" reveals one compact reps field per chip. Progressive disclosure: collapsed by default,
  so the simple case stays one-tap and only the writer who wants variety pays for it.

So it isn't a new pattern — it's (a) *don't* build per-member weight (the #4 decision already says so),
and (b) borrow the All-same/Per-set idiom for reps. That cross-piece link is itself a report beat: #4's
"weight is athlete-owned" is what keeps #3's builder from bloating.

**3 — resistance-only v1 confirmed; but you named a real gap.** The HIIT-style work you do *between*
sets and don't even log is invisible to the narrative engine — a blind spot in Capture. That's distinct
from "circuits for other types": it's *"capture the in-between work without ceremony"* (a lightweight
interstitial log, or mixed-type circuits). Parking it as its own idea, not folding it into this report.

**Net:** headline locked; the per-member-targets design has a clean answer via #4; two things to park —
drag-reorder (enhancement) and interstitial-HIIT-capture (a real Capture gap). Want those two in the
idea-inbox as task stubs, or just noted here for now?

_— end Claude reply —_
---

## Afterward — gardening vet (2026-11-03)

Planted the circuits cluster (9 notes); before Rendering, the doubts about **how I portrayed it** —
the places most likely to be my angle rather than the feature's truth.

1. **"Derived-not-stored" over-elevated.** I keep calling it "the killer move," but it's a
   *robustness* virtue — mostly engineer-visible. The user never feels "position is derived"; they'd
   only feel its *absence* (a circuit that lost its place after a reload). So it's the *why it's
   trustworthy*, not the lead affordance. I led the report on the **felt flow** (interweaving + the
   dot-grid that always shows where you are) and demoted derived-state to the trust layer. Noting it
   because the machinima's first draft had it as the lead.

2. **"Modality made first-class" is half-true.** v1 is **resistance-only**; the most common real
   circuit (bodyweight/HIIT) is excluded, and you even flagged the unlogged in-between HIIT work. So
   "first-class" holds for *one modality's* circuits. The report names the scope honestly rather than
   selling a completeness that isn't there.

3. **The per-member-targets resolution is a proposal, not a shipped feature.** The clean
   weight-vs-reps answer (via #4's "weight is athlete-owned") is *design-for-later*; v1 ships **shared**
   targets. Real risk of portraying an unbuilt design as the feature — the report keeps it clearly as
   "how this resolves when we get to it," and states v1's actual behaviour.

4. **"Builder teaches the concept" softened to "names it."** It's one caption plus the live numbered
   chips — a well-placed label, not a tutorial. I downgraded the claim in the note and the report.

5. **The "athlete is the atom / composition" echo may be decorative.** Reusing `ExerciseBlock` is
   clean engineering; tying it to the app's founding philosophy is a connection I like — it earns a
   sentence, not a section. Kept light in the report.

**Lowest-confidence claim:** #1 — whether derived-state deserves any prominence in a *product* report
at all, versus being a footnote. I gave it a short "why it's reliable" paragraph rather than a lead;
flag if even that's too much engineering for this audience.

**Headline note for your review:** you locked "execution modality made trustworthy, through design."
I rendered it felt-first (open on the flow, that line as the thesis), matching the type-coding
decision. Redirect if you want the thesis back at the very top.
