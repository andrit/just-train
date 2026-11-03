---
kind: compost dump — factual freeze of a shipped system
author: claude (on the writer's instruction)
source:
  - apps/frontend/src/lib/circuits.ts                       (pure grouping + label)
  - apps/frontend/src/components/session/CircuitBlock.tsx   (live round-major execution)
  - apps/frontend/src/components/session/CircuitBuilderSheet.tsx (creation)
  - apps/frontend/src/__tests__/unit/circuits.test.ts
  - backend: db/schema/{sessions,templates}.ts · routes/{sessions,templates}.ts ·
    lib/exerciseCopy.ts (circuitId + POST /circuits + template→session copy)
  - task plan: task-plan-circuits.md
frozen: 2026-11-02
note: Factual snapshot as shipped. Reactions live in 3-circuits-machinima.md.
---

# The circuits feature — the shipped system (frozen facts)

## What a circuit is (terminology — locked)

A **circuit** = a group of exercises performed **round-major (interwoven)**: one set of each
exercise per round, then loop. Members share a **`circuit_id`**; **rounds = the shared target sets.**
Contrast with the default **exercise-major** order (all sets of A, then all sets of B).

## The model (`lib/circuits.ts` — pure)

- `groupExercisesByCircuit(flat ordered session-exercises)` → display groups. Grouping is
  **contiguous**: members of one circuit are adjacent by `orderIndex`, so a run of the same
  `circuitId` forms one `CircuitGroup`; `null` circuitId → a `SoloGroup`.
- **A circuit that drops to a single member is demoted to solo** — "one exercise should never render
  as a bracketed 'circuit' of one" (robust to a member being deleted without ungrouping the rest).
- `circuitLabel(members)` → `"<BodyPart> Circuit"` if every member shares a body part, else
  `"Circuit"`.
- `rounds = max(1, …members.targetSets)`.

## Live execution (`CircuitBlock`)

- Walks **round-major**: log the current exercise's set → advance to the next member → after the
  last member, the round ticks over and **rest fires**.
- **Round-major position is DERIVED from each member's logged set count** — not stored as a cursor.
  So it's robust to reload and to logging out of order; the circuit reads reality.
- Reuses **`ExerciseBlock`** for the current member's input — "per-side, prefill, cardio all come
  free." The circuit is a new *arrangement* of the existing exercise atom, not a parallel build.
- **Progress grid:** one row per exercise, one dot per round (filled = done, ringed = current) — a
  2D map of the whole circuit's progress.
- **Rest fires ONLY when the last exercise of a round is logged** — "rest · next round" (you don't
  rest between interwoven exercises, only between rounds).
- PR flash per set (shared amber reward); **complete** state → emerald check + "N rounds · M
  exercises." Command-Blue accent throughout; horizontal layout = `w-[85vw]` card.

## Creation (`CircuitBuilderSheet`)

- Multi-select exercises **in round order** (numbered selection chips = the order, shown live) →
  set **Rounds → Reps → Starting weight · + / set** → create.
- Targets **stack vertically, matching the exercise "Set targets" step.** Shared reps/weight/step
  apply to every member (per-exercise weights are "later"). Weight ramp preview via
  `weightRampSequence`.
- **Minimum 2 exercises.** Copy: *"Pick the exercises for your box — you'll do one set of each per
  round, in this order."*
- **v1 is single-type: the picker is scoped to `resistance`** (the interwoven-box case); mixed-type
  is later. Error on violation: *"All exercises must be resistance."*
- The **same builder serves sessions and templates** (`isTemplate` switches the mutation →
  `POST /sessions/:id/circuits` or the template equivalent; `exerciseCopy.ts` copies a template
  circuit into a session). Circuits are **plannable**, not only live-improvised.
