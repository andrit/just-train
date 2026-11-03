# Circuit builder — drag-to-reorder exercises before Create

**Source:** surfaced in the circuits product-design review (`story/compost-heap/3-circuits-machinima.md`,
2026-11-02). Parked at the designer's request.
**Status:** parked idea — not yet scheduled, no task_create yet.

## The idea

In `CircuitBuilderSheet`, selection order currently *is* the round order (tap order, shown as numbered
chips). There's no way to reorder without deselect/reselect. Add **drag-to-reorder of the selected
chips** before the circuit is created, so you can set a specific sequence without re-picking.

## Why / scope

- Low-risk: the box order is still soft **before** execution. Reorder the *plan* only — never
  mid-execution, where the round-major position is derived from logged set counts and a reorder would
  fight it.
- Small: reorder the `selectedIds` array (it already drives order); the round-major live logic is
  unaffected.

## Where it lives

- `apps/frontend/src/components/session/CircuitBuilderSheet.tsx` — the "Selected order preview" chip row
  (`selectedIds`, the numbered chips).

## Notes

Enhancement, not a blocker. Classic reorder affordance (drag handle or long-press). No schema change.
