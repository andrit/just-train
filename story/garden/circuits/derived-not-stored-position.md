---
id: derived-not-stored-position
stage: sprout
author: claude
grew-from: "[[3-circuits]]"
tokens: [theme.honest-representation, theme.derive-dont-store]
created: 2026-11-03
---

# Round-major position is derived from logged sets, not stored

The live circuit reads **where you are** from each member's logged set count — not from a stored
cursor. So it's robust to a reload and to logging out of order: the UI can't lie about your position
because it reads what actually happened. This is the circuits form of the app's recurring instinct
([[render-from-data-not-stored]], [[honest-representation]]) — "a readout that can't lie."

**Rank honestly (vet):** this is a *robustness* virtue, mostly engineer-visible. The user doesn't feel
"derived state"; they feel that it just works after a reload — i.e. they'd only notice its *absence*.
It's the *why it's trustworthy*, not the lead affordance.

Pulls on: [[render-from-data-not-stored]], [[honest-representation]], [[circuit-as-a-box]]
