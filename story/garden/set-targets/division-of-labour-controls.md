---
id: division-of-labour-controls
stage: seed
author: claude
grew-from: "[[4-set-targets-input-ui]]"
tokens: []
created: 2026-11-03
---

# NumberField vs DragStepper — a division of labour (partly deliberate, partly scope)

Verified: the two controls aren't offered as a per-field user choice. `NumberField` (typeable) carries
the **multi-digit** values (resistance reps/weight); `DragStepper` (roll/drag) carries the **small,
bounded** ones (sets, rounds, seconds, duration) in the other modalities. One control per field; the
field decides.

**Honest nuance (vet):** this is *partly* a deliberate value-range split and *partly* just where the
rework reached — the typeable upgrade was **resistance-scoped**, so there's a real **seam** ("Sets" is
typeable in resistance, roll in stretching) and a dead unknown-type fallback. Present it as a sensible
division *and* an unfinished sweep, not a pure doctrine.

Pulls on: [[affordance-pluralism]], [[let-people-type-the-number]]
