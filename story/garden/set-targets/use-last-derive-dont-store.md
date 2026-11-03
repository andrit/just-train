---
id: use-last-derive-dont-store
stage: sprout
author: claude
grew-from: "[[4-set-targets-input-ui]]"
tokens: [theme.derive-dont-store]
created: 2026-11-03
---

# "Use last time" — derive, don't store

An opt-in control (default off, kept away from the numeric fields): when on, the plan writes **no**
target weight, and the live set initialises from history — `targetWeight ?? lastSet?.weight ?? ''`. So
with history it prefills last session's numbers (editable); with **no** history the field is simply
**empty** (`?? ''`) — nothing invented. Two real uses: carry last session's weights forward, and the
"Last time: 100×8" **peek**. No schema change, no migration — it leans on the existing
prefill-from-last seam.

This is the concrete decision circuits leaned on ([[per-member-targets-resolution]]): **weight is
athlete-owned**, so it's derived from history, not stored in the plan. Same instinct as
[[render-from-data-not-stored]] and [[derived-not-stored-position]].

**Vet:** it's a modest opt-in convenience — don't let a toggle carry too much thematic weight.

Pulls on: [[set-targets-capture-ergonomics]], [[render-from-data-not-stored]], [[derived-not-stored-position]]
