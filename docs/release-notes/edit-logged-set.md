# Edit a logged set during a live session

**Date:** 2026-11-17
**Task:** library thread — `edit-logged-set` (self-model carried item)
**Reported:** 2026-10-29 — "Planned 135/10, did 155/7, changed reps to 7 but forgot the weight off 135,
hit Submit. The set logged 135/7 and there was no way to fix it." Also the recurring fat-finger case:
an extra zero on the weight, Submit tapped too fast.

## What changed

A set you've already logged is no longer read-only **while the session is live**. Its row in the set
spine now carries a pencil; tap it and the recorded values become inputs, correct the wrong one, Save.
Once you **end** the session, its sets are frozen.

### The rule, and where it lives

> Editable while the session is `in_progress`; frozen once it is `completed` (or any terminal state).

This is enforced **server-side**, which is the real guarantee — a completed session's set cannot be
changed even by a direct API call:

- `PATCH /sets/:id` and `DELETE /sets/:id` now return **409** when the parent session's status is not
  `in_progress`.
- `lib/ownership.ts` → `ownedSet` now selects the session `status` alongside `trainerId`. The route
  checks ownership **first** (unchanged `404`, no existence leak), then the status gate (`409`).

The frontend edit affordance lives in `ExerciseBlock`, which only renders during the active session, so
the UI is naturally live-only; the backend gate is what makes the freeze a guarantee rather than a
convention.

## Files

| File | Change |
|---|---|
| `apps/backend/src/lib/ownership.ts` | `ownedSet` returns the session `status` (added to the nested `columns`). |
| `apps/backend/src/routes/sessions.ts` | `PATCH /sets/:id` + `DELETE /sets/:id`: resolve `ownedSet`, `404` if not owned, **`409` if status ≠ `in_progress`**. `409` added to both response schemas. |
| `apps/backend/src/__tests__/routes/sessions.test.ts` | `setOwnedBy(trainerId, status='in_progress')`; new tests: `PATCH`/`DELETE /sets/:id` → `409` when completed, no write. |
| `apps/frontend/src/lib/queries/sessions.ts` | `useEditSet` wired in for the first time: widened `EditSetInput` (adds `durationSeconds`/`distance`/`intensityLevel`); switched to `offlineAwareApi.patch` for offline parity with logging. |
| `apps/frontend/src/components/session/ExerciseBlock.tsx` | New `SetEditRow` inline editor + pencil affordance on `PastSetRow`; `useEditSet` + `handleEdit` in `ExerciseBlock`. |
| `docs/GESTURE_GUIDE.md` | New tap gesture under *In a running session*. |

## Design decisions

- **Edit what's recorded, don't invent metrics.** The editor renders one input per numeric metric the
  set already holds (`weight`, `reps`, `durationSeconds`, `distance`, `intensityLevel`) — so a resistance
  set offers weight + reps, a cardio round offers time/distance/level. You correct a captured value; you
  can't add a metric that wasn't logged. Duration edits as raw seconds, matching how logging already
  inputs it.
- **PR/record chips need no manual recompute.** `isLoadRecord`/`isVolumeRecord` are derived on read
  (`computeSessionRecords`), so after an edit + cache invalidation the session refetch re-derives the
  markers — a corrected weight moves the Load/Vol chip automatically.
- **Only real changes are sent.** Save diffs each field against the stored value and PATCHes only what
  changed; an emptied field is left unchanged (never nulled). No change → the editor just closes.
- **409, not 404.** A completed-session edit attempt is a legitimate-but-refused action on a resource the
  caller owns — a conflict with the session's state — so `409` is the honest code. (`404` stays reserved
  for "not yours / doesn't exist".)

## Out of scope (left read-only this pass)

- **Circuit sets** — `CircuitBlock` renders round-major and doesn't use `PastSetRow`; a circuit-aware
  editor is a separate pass.
- **Asymmetric L/R split sets** — sets carrying `repsLeft`/`repsRight`; the pencil is hidden for them.
- **Delete from the UI** — the request was edit, not delete. The `DELETE /sets/:id` gate is hardened
  regardless, so when a delete affordance is added it inherits the same freeze.

## Verification

- Container: `tsc --noEmit` (both apps) clean; `eslint` (both apps, changed files) clean.
- **Owed to the user (Mac):** `pnpm --filter backend test` (the new 409 tests + the real-DB ownership
  matrix, whose `/sets` owner-sanity is unaffected — it only GETs), and an on-device glance: log a set,
  tap the pencil, correct the weight, confirm it saves and the PR chip re-settles; then end the session
  and confirm the pencil is gone.
