---
kind: machinima — rig-run reaction to a frozen compost source
reacts-to: 4-set-targets-input-ui.md
author: claude (companion reaction — observations + things to pull on, NOT report prose)
started: 2026-11-02
convention: single living doc with a Changelog. Writer's inline notes = authorNotes (*italic*, *n),
            never overwritten. Major restructure → snapshot to archive/ first.
---

# Reaction — set-targets input UI

Companion read, before gardening. This piece fits the set **differently** — flagged under the spine.

## Aesthetics

- **The least "visual" of the four** — it's an input control, not a glanceable encoding. But there's
  real craft: a big **mono-bold 2xl number as the hero**, small −/+ flanking it, label above —
  consistent across `NumberField` and `DragStepper`. The value you're setting is always the loud
  element.
- **A deliberate anti-acceleration stance.** Both controls share one feel philosophy: DragStepper's
  "slow is smooth, smooth is fast" (8px = 1 step, linear) and NumberField's hold-to-jump at a
  **constant cadence that never accelerates.** The app explicitly refuses the iOS-style accelerating
  spinner that overshoots. **Control over speed** is a stated feel-value worth naming.

## Affordance

- **This is affordance *repair*, not invention.** The Act Zero is a broken basic: the editor only let
  you *roll* one number at a time and dropped focus. The headline affordance is "let people just type
  the number" — the most basic affordance had been lost in a refactor. The spine here is **removing
  friction**, not adding a new encoding.
- **Affordance pluralism:** type, tap, hold-to-jump ×5, drag — many paths to one value, meeting the
  user where they are (precise → type; nudge → tap; big jump → hold). "Steppers are an adjunct" is
  stated as a principle in the code.
- **The Ramp is the power-user affordance:** express a scheme (10/8/6) as a **rule** (start 10, step
  −2) instead of hand-typing each set — compact intent — then still hand-editable (rule as a
  starting point, not a cage).
- **"Use last time" is restraint:** opt-in, default off, physically separated — because the app knows
  some athletes move weights a lot and *won't* want prefill. Prefill treated as a preference, not a
  universal good.
- **The editor morphs to the modality** (cardio → Distance/Time/Intensity; stretching → Hold). The
  input surface speaks each type's native metric — the data-level companion to type-coding's
  *visual* differentiation of types.

## Product-story fit (Act Zero)

- **A restoration, not a greenfield feature:** a paradigm change broke something basic; this fixes it
  (typeable, focus bug root-caused) and goes further (ramp, use-last, per-type config). Honest story.
- **Fit in the thesis — pure Capture ergonomics.** The least glamorous but most **load-bearing**: if
  setting a target is annoying, the whole Capture→Compare→Communicate chain starves at the input. Low
  friction to log *is* the product.
- **Solve-without-storing:** "no schema change, no migration," leaning on the existing
  prefill-from-last seam (v2.8.0), and the implicit "ON = write no weight" resolution. Ties to the
  app's recurring **derive-don't-store** instinct (circuits derive position; the body map renders from
  data; here prefill derives from history).

## Spine test (Bridge — flagged) — this one is the counterexample

The first three pieces are about **reading** (Compare / Communicate — glanceable encodings). This one
is about **writing** (Capture — input ergonomics). So it **does not share the "legible at a glance"
spine** — and since the reports are standalone, it doesn't need to. What it *does* share is the
**design-values** layer: derive-don't-store, control-over-speed, root-cause-not-band-aid. Useful
framing for the report: situate this on the **Capture** side of the thesis, opposite the other three.

## Tensions worth pulling on (your call which we garden)

1. **`DragStepper` still present + imported alongside `NumberField`** — two controls for similar jobs.
   Vestigial now, or still used (sets)? **Verify before the report claims anything.** *(open fact)*
2. **Non-accelerating ×5 hold-jump** — is ×5 right for both weight (where a 45-plate jump matters) and
   reps (where +5 is huge)? One constant `HOLD_STEP` across contexts.
3. **"Use last time" ON = "write no weight" is implicit** — the task plan itself worried it's "too
   implicit." Does the athlete understand toggling it changes whether a starting weight is even
   collected? Latent confusion.
4. **Headline** — "typeable inputs," or **"repairing the Capture ergonomics a refactor broke +
   compact intent encoding (the ramp) + derive-don't-store prefill"**? *(I lean the richer framing.)*

<!-- authorNotes land here or inline above, marked *1 *2 … -->

## Changelog

- **2026-11-02** — initial reaction (aesthetics / affordance / Act Zero), spine test, four tensions.
- **2026-11-02** — writer review + Claude reply: `DragStepper` NOT vestigial — **division of labour by
  value-range** (typeable for big numbers, roll for small); rework was resistance-scoped (consistency
  seam noted). #3 downgraded to non-issue (no fabrication; prefill is `?? ''`). Headline reframed to
  "ergonomics learned through using the app" + ramp (compact intent) + derive-don't-store. **All four
  reviews closed.**


REPLY:
1.im pretty sure could still use both. suggestion is that both make it messy? I think it offers options to different types of people. I typically just type, but thats just me
2. Yeah both are fine. Having it non accelerating makes it more determinate. Yeah its different for reps but I for one tend to add extra reps by 5 anyway
3. This question confuses me. Areyou saying with no history, last time will make up something? I use it sometimes to pick up my last sessions weights and do them and sometimes just to peek in at what I did last session.
4. "Ergonomics learned through experience of using the app" sounds better than bemoaning a breaking refactor. Talk to me some more about the rest of it.
ENDREPLY;

---
## Claude reply — 2026-11-02

**1 — verified, and it's more interesting than "duplicates."** I checked every render site. The two
controls aren't a per-field choice (you can't pick type-vs-roll on a given field) — they're a
**division of labour by value-range**:
- **`NumberField` (typeable)** where multi-digit values matter — resistance **Reps / Weight**, the
  numeric cardio/calisthenics fields.
- **`DragStepper` (roll/drag)** for small bounded values — **Sets, Rounds, Seconds, Duration** in
  cardio / calisthenics / stretching / cooldown (and `ExerciseDetailPanel`).

For any one field there's exactly one control; the field decides. (The Sets×Reps DragStepper at the
bottom is an unknown-type *fallback* — effectively dead, since every exercise is one of the five types.)
Report-worthy nuance: the typeable rework was **resistance-scoped** — it fully landed on the resistance
path (your path); other modalities kept the roll-stepper. Fine for their small values, but a mild
**consistency seam** — "Sets" is typeable in resistance, roll in stretching. A scope line, not a bug.
*(If you actually want per-field type-or-roll as a real user choice — your "options for different
people" — that's a different, larger idea; say so and I'll park it. Today it isn't that.)*

**2 — kept as is.** "Determinate, not slippery" is the phrase — non-accelerating is the point; ×5
matching how you add reps is exactly the case for one constant step. No change.

**3 — no, it never makes anything up — my question was badly worded, sorry.** With "use last" ON the
add-sheet writes **no** target weight; the live set then initialises to
`targetWeight ?? lastSet?.weight ?? ''`. So: history exists → it **prefills** last session's weight/reps
into the (editable) field; **no** history → the field is just **empty** (`?? ''`), nothing invented.
Your two uses are precisely the two things it does: carry last weights forward *and* the
**"Last time: 100×8"** peek line under the input. The only thing I was (clumsily) flagging was a tiny
coupling — toggling "use last" ON also means "set no plan weight" — which your actual usage shows is
intuitive, not confusing. **Downgrading #3 from a tension to a non-issue.**

**4 — reframe taken, and it's better.** *Ergonomics learned through using the app* — the input design is
shaped by the friction an athlete actually hits mid-session, not a refactor post-mortem. The "rest of
it," expanded:
- **Compact intent-encoding (the Ramp).** Instead of hand-typing 10/8/6 you state the *rule* — start 10,
  step −2 — and it expands, still hand-editable. The plan captures *intent* compactly. Same "express the
  structure, don't hand-enter it" idea as the circuit box and the heat ladder — a tiny language for
  prescribing.
- **Derive-don't-store prefill.** "Use last" stores nothing; it reaches into history at the moment each
  set appears. The plan stays light (a reps scheme + optional start); the real numbers come from what you
  actually did. Same instinct as circuits (position derived from logged sets) and the body map (rendered
  from data). So even though this piece sits on the **Capture** (writing) side — opposite the three
  reading pieces — it shares the **design-values spine**: *derive-don't-store, control over speed,
  ergonomics from real use.* That's the cross-piece thread the report can land on.

**That closes all four reviews.** Ready to render reports whenever you are.

_— end Claude reply —_
---

## Afterward — gardening vet (2026-11-03)

Planted the set-targets cluster (8 notes); before Rendering, the doubts about **how I portrayed it**.

1. **Am I inflating an input-control fix into a design narrative?** This is the smallest, least visual
   feature — at its core, a typeable field plus a ramp and an opt-in prefill. The "Capture is
   load-bearing / ergonomics" framing is *true*, but the report has to earn its place through the
   **design-values** it exemplifies, not pretend it's a headline feature. I kept the report short and
   said plainly it's small-but-foundational rather than dressing it up.

2. **"Ergonomics learned through using the app" is partly aspirational over a plainer truth.** The Act
   Zero is literally "a refactor broke it." So some of this is **restoration**, and only the ramp /
   prefill / per-type metrics are genuinely use-shaped **refinement**. I split the two in the report
   rather than letting the elegant phrase erase the "we broke it, we fixed it" half.

3. **Division-of-labour may be a rationalised inconsistency.** I present NumberField-vs-DragStepper as a
   deliberate value-range split — but the verified reality includes a **seam** (Sets typeable in
   resistance, roll in stretching) and a dead fallback, because the rework was resistance-scoped. The
   report names it as *sensible division AND an unfinished sweep*, not a pure doctrine.

4. **"Use last" over-themed.** It's a modest opt-in convenience; I keep tying it to a grand
   derive-don't-store theme. I gave it its due as the concrete thing circuits leaned on, but didn't let
   a toggle carry a manifesto.

5. **The counterexample framing is clever — is it necessary?** Positioning this as "the Capture-side
   counterexample that defines the spine's boundary" is tidy symmetry I enjoy. For a *standalone*
   report it's a closing note, not a pillar — so I put it at the end, one paragraph, not the spine of
   the piece.

**Lowest-confidence call:** #1 — whether this feature warrants a full report at all, versus a shorter
note. I rendered it as the shortest of the four and foregrounded the transferable values. Flag if
you'd rather it be a page, not a report.

**Headline note:** rendered felt-first (open on "just type it" + the ramp), with "Capture ergonomics,
learned through use" as the thesis — consistent with the other three. Redirect if you want otherwise.
