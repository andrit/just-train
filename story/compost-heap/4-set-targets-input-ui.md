---
kind: compost dump — factual freeze of a shipped system
author: claude (on the writer's instruction)
source:
  - apps/frontend/src/components/ui/NumberField.tsx        (typeable input + hold-to-jump)
  - apps/frontend/src/components/ui/DragStepper.tsx         (drag/▲▼ stepper, v1.8.0 — still present)
  - apps/frontend/src/components/session/AddExerciseSheet.tsx (the target editor + reps modes)
  - apps/frontend/src/lib/weightRamp.ts
  - task plan: .workbench/designer/current/exerciseui-task-plan.md
  - direction: discussions/exerciseUI/exerciseui-discuss.md
frozen: 2026-11-02
note: Factual snapshot as shipped. Reactions live in 4-set-targets-input-ui-machinima.md.
      OPEN FACT TO VERIFY before the report asserts it: DragStepper is still imported in
      AddExerciseSheet alongside NumberField — confirm whether it's still used (sets?) or vestigial.
---

# Set-targets input UI — the shipped system (frozen facts)

## Act Zero (from the task plan)

A **regression from the flat-session paradigm change** (predates Phase 17): the target editor was
**roll-only** (`DragStepper`) — you couldn't type multi-digit values — and it had a **focus-loss
bug** ("type a digit → focus drops → click to reclaim"). The rework made it typeable, added reps
modes + a weight ramp + opt-in prefill, renamed the weight label. **No schema change, no migration.**

## `NumberField` — the typeable control

- `type="text" inputMode="numeric|decimal"` → full typing, the mobile numeric keypad, and **no
  native desktop spinner arrows.**
- Keeps an **internal text buffer** so partial/empty states while typing don't fight the caller;
  commits a clamped number on change/blur. An `isFocused` ref **never clobbers what the user is
  actively typing** (this is the root-cause fix for the focus-loss bug — not a band-aid).
- **Steppers (−/+) are an adjunct, not the only way in.**
- **Hold-to-jump:** hold ▲/▼ → coarse **×5** jumps at a **constant cadence that never accelerates**
  (`HOLD_ARM 500ms`, `HOLD_REPEAT 600ms`, `HOLD_STEP 5`); a quick tap nudges by `step`; the
  release-click that trails a hold is suppressed.

## `DragStepper` (v1.8.0 — still in the tree)

▲/▼ buttons **plus a drag gesture**: `8px = 1 step`, **linear, no acceleration** ("slow is smooth,
smooth is fast"), never skips. `role="spinbutton"` + arrow keys. Still imported by
`AddExerciseSheet`. (See the OPEN FACT above.)

## The target editor (`AddExerciseSheet`) — config by workout type

| Type | Target config |
|---|---|
| resistance | Sets × Reps × Weight |
| cardio | Rounds + metric picker (Distance / Time / Intensity) |
| calisthenics | Sets × Reps **or** Sets × Time (toggle) |
| stretching | Sets × Hold duration |
| cooldown | Duration only |

- **Reps — three modes** (`RepsModeToggle`): **All same** (`uniform` → `targetReps`) · **Ramp**
  (start + `±step`/set, expands to per-set values e.g. `10, −2 → 10·8·6`, live preview, still
  hand-editable; writes `targetRepsPerSet`) · **Per set** (hand-type each; writes
  `targetRepsPerSet`). Applies to **resistance + calisthenics**.
- **Weight** — label renamed **"Target Weight" → "Starting weight."** Typeable start value
  (`targetWeight`) + a **Ramp** (start + step) that pre-fills live sets 2, 3… as a **one-time
  expand, not stored.** Resistance only.
- **"Use last time"** — an **opt-in** control (default off) at the **top**, visually separated from
  the numeric controls. ON → **no starting weight is written** → the existing
  `targetWeight == null → prefill-from-last` path takes over in the live session (leans on
  `GET /clients/:id/exercise-history/:exerciseId`, v2.8.0). No store, no migration. *(The task plan
  itself flagged this ON = "write nothing" mechanism as possibly "too implicit.")*
- **Quick-add:** typing a name with no library match → "Create as draft."
