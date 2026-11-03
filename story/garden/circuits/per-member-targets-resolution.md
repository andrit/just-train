---
id: per-member-targets-resolution
stage: sprout
author: claude
grew-from: "[[3-circuits]]"
tokens: [theme.derive-dont-store]
created: 2026-11-03
---

# Per-member targets — a resolution via "weight is athlete-owned" (NOT yet built)

v1 applies **shared** reps/weight across every circuit member. Per-member targets look clunky to add
(4 exercises × reps + weight + step = an input wall). The clunk dissolves once weight and reps are
treated differently — leaning on the set-targets decision ([[set-targets]] cluster, not yet gardened)
that **weight is athlete-owned**:
- **Per-member weight** shouldn't live in the plan at all — a shared start + live prefill-from-last
  when each exercise comes up (derive-don't-store).
- **Per-member reps** is plan-worthy; reuse the existing **All same / Per exercise** disclosure so the
  simple case stays one-tap.

**Status: a design resolution for later, not shipped.** v1's reality is shared targets. The report
must not portray this as built.

Pulls on: [[circuits-v1-scope]]
