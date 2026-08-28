# End Session: One Step, One Window — Task Plan

**Goal:** Ending a session finishes it — once — in a single window that carries the session name,
the session results, and an optional "how you felt" section.
**Written:** 2026-08-27

## The defect, as diagnosed

**Confirmed.** `LiveSessionContent.handleEndSession` (lines 112–117):

```ts
onSuccess: () => {
  if (session?.clientId) clearSessionStore(session.clientId)  // 113
  fire('session_end', ...)
  setShowEndModal(false)
  setShowWrapUp(true)                                         // 117
}
```

`clearSessionStore` empties `activeSessions`. `ActiveSessionOverlay:121` is
`if (sessionCount === 0) return null`, and that overlay **hosts** `LiveSessionContent`, which hosts
`PostSessionWrapUp`. Line 113 therefore unmounts the tree line 117 renders into. Hence the bounce to
the dashboard with no wrap-up and no name field.

**Why the second trip works.** The dashboard's Live Session card (`DashboardPage.tsx:174`) navigates
to `/session/:id`. That renders `LiveSessionContent` through `LiveSessionPage` as a **route child,
outside the overlay** — so clearing the store cannot unmount it, the wrap-up renders, and the name
saves. The two trips differ only in who hosts the component.

**Which of the two bugs actually fires first.** The screenshot
(`app-snapshots/endsession/secondtrip.png`) shows the Live Session card *still present* after the
first end, and the designer confirms they re-enter through it. That card renders only when
`sessionStore.hasSession(selfClientId)` is true — so the store was **never cleared**, which means
line 113 never executed and the block above never ran at all.

The leading explanation is the ordering inside React Query. `useEndSession`'s own `onSuccess`
(`queries/sessions.ts:170`) calls `invalidateQueries`, which returns a promise; React Query **awaits**
the hook-level `onSuccess` before invoking the per-call one, and per-call callbacks are **dropped** if
the observer unmounts in the meantime (hook-level ones are not).

**This is a hypothesis, not a finding.** For it to hold, something must unmount `LiveSessionContent`
between the PATCH resolving and the callback firing — and a search of both `LiveSessionContent` and
`ActiveSessionOverlay` shows **nothing branches on `status === 'completed'`**. So the trigger is
unidentified. What is certain is the observable pair: the session completes on the server, and the
store is not cleared, which means that callback block never ran.

Tasks 1 and 2 are therefore written to be correct under *either* cause — 1 removes the unmount that
clearing would itself provoke, 2 removes the callback's dependence on staying mounted. Task 5 on
device is what actually settles which was operative; if the flow still misbehaves after both, the
remaining suspect is whatever unmounts the component, and that needs finding before anything else is
built on top.

## Tasks

1. **Stop clearing the store before the flow is done** *(low)*
   What: remove `clearSessionStore` from the end-mutation success path; call it only once the user
   has finished the window and we are navigating to the summary. The overlay then stays mounted for
   the whole flow.
   Depends on: none

2. **Make post-success work survive an unmount** *(low)*
   What: move the completion side effects off the per-call `mutate(_, { onSuccess })` callback —
   either into `useEndSession`'s own `onSuccess` or by awaiting `mutateAsync`. Per-call callbacks are
   dropped if the component unmounts mid-flight, which is the one failure mode that leaves a session
   completed on the server with the client never learning it.
   Depends on: none

3. **Merge the two windows into one** *(high)*
   What: fold `EndSessionModal` and `PostSessionWrapUp` into a single end-of-session window, in the
   order the designer specified:
   1. **Session name** field at top (keep the `{date}` token + live "Saves as…" preview)
   2. **Session results** beneath it (exercises, sets, volume, PRs + PR callouts — already built in
      `PostSessionWrapUp`)
   3. **Optional notes + "how you felt"** (energy / mobility / stress + notes, from
      `EndSessionModal`), carrying a **dismiss (×)**
   One primary action closes it out.
   Preserve the `hasWork === false` path: an empty session still offers Discard / End Anyway rather
   than asking for scores.
   Depends on: 1, 2

4. **One request, not two** *(medium)*
   What: `PATCH /sessions/:id` already accepts `name`, and `useEndSession` already PATCHes that route
   with `status: 'completed'` + `endTime`. Send name and scores in the **same** call instead of
   chaining `endSession` then `updateSession`. Removes the window where a session is completed but
   unnamed.
   Depends on: 3

5. **Verify on device** *(low)*
   What: end a session from the overlay and confirm it finishes in one pass, the Live Session card
   clears from the dashboard, and the name saves. Confirms which of the two causes above was real.
   Depends on: 3, 4

## Feel data — decision taken

The sliders currently default to **7 / 7 / 5 and are saved on every session whether touched or not**,
so sessions where nothing was reported are recorded as if 7/7/5 had been, and the Avg energy / Avg
stress KPI cards average those invented values in with real ones.

Designer's call: **a dismiss icon; if it is not interacted with, do not save it.**

**Mechanism correction (verified 2026-08-27):** "save nothing" must mean **omit the keys**, not send
`null`. `packages/shared/src/schemas/index.ts:204-207` and `:280-284` declare all three as
`z.number().int().min(1).max(10).optional()` — **optional but NOT nullable**, so a literal `null`
fails validation and the PATCH returns 400. Omitting them is already supported end to end: Drizzle
drops `undefined` keys from the SET clause, so the columns simply stay null.

Consequence for the client types: `EndSessionInput` (`queries/sessions.ts:153-159`) currently types
the three scores as required `number` and must become optional. No schema or migration change is
needed on the backend.

Consequence to accept knowingly: historical rows keep their synthetic 7/7/5, so the KPI series
straddles two meanings. Not backfilled — inventing or deleting past values is worse than a documented
discontinuity.

## Task 6 (dismissible feel section) — plan and vet

**Verified before building:**

- `PATCH /sessions/:id` does `.set({ ...body, … })` (`sessions.ts:362-369`) and Zod strips absent
  optional keys, so an omitted score never reaches the SET clause and the column is left untouched.
- Scores are `.optional()` but **not** `.nullable()` — sending `null` returns 400. Omit the keys.
- KPI and report code already treat an absent score as "no data" (task 5): both `avg()` helpers
  return `null` on an empty array and the report omits the section. Nothing downstream reads 0.
- `EndSessionInput` types the three scores as required `number`; they must become optional.

**Decisions:**

1. **Omit unless *touched*, not merely unless dismissed.** Most people will ignore the section
   rather than tap the ×. If omission required an explicit dismiss, 7/7/5 would still be written for
   everyone who scrolls past — which is precisely the pollution this task exists to stop. The × is a
   way to say "not today" and reclaim the space, not the only path to not recording.
2. **Sliders render muted until touched**, with copy stating they are not being recorded. A control
   showing "7" that silently saves nothing is a lie; a muted control that says so is honest.
3. **Dismiss is reversible** via an "Add how you felt" link. A mis-tap should not force cancelling
   the whole closeout to recover.
4. **The session note is a separate field and is unaffected.** It stays visible and saves on its own
   merits. Dismissing "how you felt" must never silently discard text the user typed — notes are not
   scores, and collapsing one should not destroy the other.
5. **Bug introduced in task 3, fixed here:** the `hasWork === false` path ("End Anyway") calls the
   same confirm handler and currently sends 7/7/5 — for a session where the sliders were never even
   rendered and the user was never asked. That path must always omit.

**Consequence, accepted:** historical rows keep their synthetic 7/7/5 while new un-touched sessions
write nothing, so Avg energy / Avg stress straddle two meanings. Document the cutover in the
changelog; do **not** backfill.

## Unknowns

- Whether the KPI/report code paths treat a null score as "no data" or coerce it to 0. Must be
  checked before task 3 ships, or the Avg energy card reads 0 instead of omitting the session.
- Whether any other caller depends on `clearSessionStore` running at end-mutation time.

## Verification boundary

`tsc` + `eslint` run in-container; **vitest does not** (`node_modules` is mounted from the Mac, so
the Linux rollup/esbuild binaries are absent). Test runs are the designer's. I stage; the designer
commits.
