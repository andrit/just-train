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
_Status: captured, not yet scoped. Queued behind task #25 unless reprioritised._
