# Edit a logged set (no correction path after submit)

Reported in-session 2026-10-29 (designer was training).

**What happened:** Planned 135/10. Actually did 155/7. Changed the reps to 7 but forgot to change the
weight off 135, then hit **Submit set**. The set logged as 135/7. **There is no way to edit a set once
it's submitted** — the wrong value is now the record.

**The gap:** a logged ("past") set is read-only. Need an edit (and probably delete) path for a set
already logged in the live session — and likely in session history too, since bad data propagates to
volume, PRs, and the progress narrative.

**To scope (not yet investigated):** how the set accordion renders past sets (`SetRow` /
`LiveSessionContent`), whether a PATCH set endpoint exists, and PR/volume recompute on edit.

---

## BUILT — 2026-11-17

Shipped edit-while-live. A logged set in the `ExerciseBlock` spine shows a pencil → inline editor
(`SetEditRow`) over the metrics the set records → `useEditSet` (now wired + offline-aware). Editing is
revoked once the session ends, **enforced server-side**: `PATCH`/`DELETE /sets/:id` 409 unless the
session is `in_progress` (`ownedSet` now carries status). Record chips re-derive on read. Circuit sets,
L/R split sets, and a delete UI are out of scope this pass. Full writeup:
`docs/release-notes/edit-logged-set.md`. Verified container tsc+eslint; vitest + on-device glance owed
to the user.

---
_Status: built; delete-UI and circuit/split editing remain for a later pass._
