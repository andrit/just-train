# Set-Targets Input — Design Report

> **Just Train** · product design & development
> **Area:** the add-exercise "Set Targets" step (`AddExerciseSheet`, `NumberField`, `DragStepper`)
> **Date:** 2026-11-03 · **Status:** shipped (resistance path reworked)
> **Lens:** aesthetics · affordance · product-story fit

*The smallest of these reports, deliberately — this is an input control, not a visual feature. It
earns a report not by its size but by the design values it exemplifies most plainly.*

---

## In one line

Set your targets by **just typing the number** — or express a whole scheme (10 / 8 / 6) as a single
**rule** instead of entering each set by hand.

It's the least glamorous surface in the app and the most **load-bearing**: logging is the input the
whole Capture → Compare → Communicate chain runs on. If setting a target is annoying, everything
downstream starves. Low friction to log *is* the product.

---

## Act Zero — typing was missing

A paradigm change (the flat-session refactor) had left the target editor **roll-only** and dropping
focus after each digit — you couldn't just type "135." The most basic affordance was gone.
`NumberField` restored it (typeable, mobile numeric keypad, no desktop spinner) and **root-caused** the
focus bug — an internal text buffer that never clobbers what you're typing — rather than patching
around it.

Worth being honest about what this is: **part restoration, part refinement.** Typing is a restoration
of something a refactor broke; the ramp, the prefill, and the per-type metrics below are the genuinely
*use-shaped* additions.

---

## Aesthetics

The number is the hero — a big mono-bold value, small −/+ beside it, label above; the thing you're
setting is always the loud element. And a deliberate **control-over-speed** stance: both the drag
("slow is smooth," linear) and the hold-to-jump (×5, at a cadence that **never accelerates**) refuse
the iOS-style spinner that overshoots. The value is **determinate, not slippery.**

---

## Affordance

- **Many paths to one value.** Type, tap the −/+, hold for coarse ×5 jumps, drag — meeting the user
  where they are (precise → type; nudge → tap; big jump → hold). "Steppers are an adjunct," says the
  code; no single path is the only one.
- **The Ramp — compact intent.** Rather than hand-typing 10 / 8 / 6, you state the *rule* (start 10,
  step −2) and it expands, still editable. The plan captures intent compactly — the same "express the
  structure, don't hand-enter it" idea as the circuit box and the heat ladder.
- **"Use last time" — derive, don't store.** An opt-in control (default off, kept away from the numeric
  fields): when on, the plan stores no weight and the live set fills from history — prefilling last
  session's numbers when there's history, and simply staying **empty** when there isn't (nothing is
  invented). It also surfaces a "Last time: 100×8" peek. No schema change; it leans on the existing
  prefill-from-last path. (This is the concrete decision the circuits builder leans on too: weight is
  athlete-owned, so it's derived, not planned.)
- **The editor morphs to the modality.** Resistance shows Sets × Reps × Weight; cardio shows Distance /
  Time / Intensity; stretching shows Hold. The input speaks each type's native metric — the data-level
  companion to type coding's *visual* differentiation: types don't just look different, they're
  *captured* differently.

One honest seam: the typeable rework was **resistance-scoped**. The other modalities still use the
roll-stepper for their small, bounded values (sets, seconds, rounds) — which is sensible where values
are small, but it does mean the division between the two controls is partly a deliberate value-range
split and partly just where the rework has reached so far.

---

## Product-story fit

This is **Capture ergonomics, learned through using the app** — the input shaped by the friction an
athlete actually hits mid-session. It sits on the **writing** side of the thesis, opposite the three
reading-side features (the body map, type coding, circuits, which are about seeing). So it's the
app's deliberate counterexample: it doesn't share their "legible at a glance" spine. What it *does*
share is the design-values layer — **derive-don't-store** (use-last pulls from history instead of
storing a plan weight), **control over speed** (determinate steppers), and **root-cause over
band-aid** (the focus bug fixed at its source). The same instincts, pointed at the moment of input
rather than the moment of reading.
