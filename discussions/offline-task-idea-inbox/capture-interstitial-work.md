# Capture the in-between work (interstitial HIIT) without ceremony

**Source:** surfaced in the circuits product-design review (`story/compost-heap/3-circuits-machinima.md`,
2026-11-02). Designer's words: *"I do some hiit style exercises in between some sets i don't even list
as circuits. would be good to be able to capture that."*
**Status:** parked idea — not yet scheduled, no task_create yet.

## The gap

Work done **between** logged sets — HIIT bursts, filler movements — is invisible to the app. It never
gets logged, so it never reaches the narrative engine. A blind spot on the **Capture** side (the input
the whole Capture → Compare → Communicate chain runs on).

## Why it matters

The app's thesis is that logging is the input and progress is the output. Unlogged real training is
silent progress the engine can't see — and the friction of "start a whole circuit/exercise" is exactly
why it goes uncaptured.

## Two possible shapes (decide later)

1. **Lightweight interstitial log** — a quick, low-ceremony "also did X" capture attachable to a session
   without building a block (the point is *no ceremony*).
2. **Mixed-type circuits** — extend circuits past the v1 resistance-only scope so bodyweight/HIIT
   interleaves are first-class. (Bigger; circuits v1 is deliberately resistance-only.)

Distinct from "circuits for other types" — the core want is *capture without setup overhead*.

## Where it would touch (rough)

- Live session surface (`LiveSessionContent` / `ExerciseBlock`) for a quick-add path, or
- `CircuitBuilderSheet` + the circuit backend if pursued as mixed-type circuits.

## Notes

Real gap, not a blocker. Needs a direction decision (shape 1 vs 2) before it's a task.
