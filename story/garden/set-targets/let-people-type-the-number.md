---
id: let-people-type-the-number
stage: seed
author: claude
grew-from: "[[4-set-targets-input-ui]]"
tokens: []
created: 2026-11-03
---

# Act Zero — let people just type the number

A paradigm change (the flat-session refactor) had left the target editor **roll-only** (`DragStepper`)
and dropping focus after a digit. The most basic affordance — typing a value — was missing.
`NumberField` restored it (typeable, mobile numeric keypad, no desktop spinner) and **root-caused** the
focus bug (an internal text buffer + an `isFocused` guard that never clobbers active typing) rather
than papering over it.

**Honest nuance (vet):** this is **part restoration, part refinement**. The typeable input is a
restoration of something a refactor broke; the ramp, prefill, and per-type metrics are the genuinely
*use-shaped* additions. Don't let "ergonomics learned through use" erase the plainer "we broke it, we
fixed it" half.

Pulls on: [[set-targets-capture-ergonomics]], [[affordance-pluralism]]
