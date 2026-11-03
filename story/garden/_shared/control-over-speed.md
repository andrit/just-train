---
id: control-over-speed
stage: seed
author: claude
grew-from: "[[4-set-targets-input-ui]]"
tokens: [theme.control-over-speed]
created: 2026-11-03
---

# Control over speed — determinate, not slippery

Both steppers share one feel: `DragStepper`'s "slow is smooth" (8px = one step, linear) and
`NumberField`'s hold-to-jump at a **constant cadence that never accelerates**. The app deliberately
refuses the iOS-style accelerating spinner that overshoots — the value is **determinate, not
slippery.** (Writer: non-accelerating makes it more determinate; ×5 matches how reps get added
anyway.) A cross-piece feel-value worth naming.

Pulls on: [[affordance-pluralism]]
