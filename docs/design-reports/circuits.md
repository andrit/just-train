# The Circuits Feature — Design Report

> **Just Train** · product design & development
> **Area:** session planning + live execution (`CircuitBuilderSheet`, `CircuitBlock`, `lib/circuits.ts`)
> **Date:** 2026-11-03 · **Status:** shipped (v1, resistance-only)
> **Lens:** aesthetics · affordance · product-story fit

---

## In one line

A circuit is a **box you move through** — one set of each exercise per round, round after round — and
the screen always shows exactly where you are in it.

---

## Act Zero — a modality the flat model couldn't express

Before circuits, the app modelled a session as **exercise-major** blocks: all your sets of one
movement, then the next. But a lot of real training is **round-major** — a circuit, interwoven: one
set of each exercise, then loop. The flat model simply couldn't represent that order, so logging a
circuit meant either faking the interleave by hand or throwing the structure away. Circuits make
round-major a **first-class** way to train — for resistance, in v1 (scope below).

---

## Aesthetics — the box and the scorecard

The circuit renders as a **bounded card** — "your box" — matching the mental model of a loop you cycle
through. Its centre is a **dot-grid**: one row per exercise, one dot per round, filled as you go, the
current one ringed. It's a scorecard that puts the whole two-dimensional progress space — *which
exercise, which round* — in a single glance. It reuses the app's semantic palette (Command-Blue for
active, emerald for complete, amber for a PR), so a circuit reads as part of the system, not a bolt-on.

---

## Affordance — the flow, and what keeps it honest

**The felt experience is the flow:** you always know where you are. The dot-grid is a live map of the
circuit; you never have to remember which exercise or round you're on.

- **Rest matches the modality.** The timer fires only when you finish the *last* exercise of a round —
  because you don't rest between the interwoven moves, only between rounds. The timer behaves the way a
  circuit is actually performed, not like a generic per-set clock.
- **It won't show an impossible state.** If a circuit drops to a single member (say a member is deleted
  without ungrouping the rest), it **demotes to a solo exercise** rather than rendering a nonsensical
  "circuit of one."
- **It names the model where you need it.** Building a circuit, the numbered chips make selection order
  *be* round order, shown live, and the copy states it plainly — *"one set of each per round, in this
  order."* A well-placed label at the one spot the concept could confuse you.

**And under the hood, what keeps it reliable:** the live circuit reads *where you are* from each
member's logged set count, rather than storing a cursor — so it survives a reload and tolerates logging
out of order. You won't notice this directly; you'd only have noticed its absence. It's the quiet
reason the box never loses its place.

---

## Product-story fit

Circuits are a **Capture**-side move: they let the app record training in its *true structure* instead
of forcing it into one paradigm — and that protects **Compare**, because a circuit's sets stay
comparable round over round. It's built by composition, not duplication — the live member input reuses
the same exercise block everything else uses, so a circuit is the familiar atom rearranged.

The through-line (the feature's thesis): **the design is what makes it trustworthy.** The box, the
scorecard, the modality-matched rest, and the state it *derives rather than stores* are what turn "a
supersets feature" into an execution modality the app can be relied on to represent correctly.

---

## Scope, honestly

v1 is **resistance-only** — the interwoven-box case that fits a lot of structured strength work (and
the designer's own style). The most common circuit in the wild — **bodyweight / HIIT** — is
deliberately out of scope for now, so "first-class" holds for *this* modality's circuits, not all of
them. Targets are **shared** across a circuit's members in v1.

Per-member targets have a clean **resolution for later** (not yet built): don't put per-member *weight*
in the plan at all — it's athlete-owned, so it comes from live prefill when each exercise's turn
arrives; vary *reps* through the same All-same / Per-exercise control the rest of the app already uses.
Two gaps surfaced in review and were **parked** rather than rushed into v1: capturing the unlogged HIIT
work people do *between* sets, and drag-reordering the box before you start.

---

## Where it sits in the design language

Circuits express the same **thread** that runs through the app's other surfaces (offered as a thread,
not a law): *honest representation* — a live position **derived** from what actually happened (so it
can't drift), a state that **self-heals** rather than lies, and behaviour that **matches the real
modality**. The same instinct, in motion.
