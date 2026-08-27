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

That points at the ordering inside React Query. `useEndSession`'s own `onSuccess`
(`queries/sessions.ts:170`) calls `invalidateQueries`, which returns a promise; React Query **awaits**
the hook-level `onSuccess` before invoking the per-call one. The invalidation refetches the session,
which now returns `status: 'completed'` — and by the time that settles the component has gone, so the
per-call `mutate(_, { onSuccess })` callback is **dropped**. Per-call callbacks are skipped on
unmount; hook-level ones are not.

So the live defect is the dropped callback (task 2), and the clear-before-render at line 113 is a
second, latent bug that would start firing the moment the callback is made reliable (task 1). Both
are fixed; task 5 confirms on device.

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

Designer's call: **a dismiss icon; if it is not interacted with, do not save it.** So an untouched or
dismissed section writes `null` for energyLevel / mobilityFeel / stressLevel (all three columns are
already nullable) rather than the defaults.

Consequence to accept knowingly: historical rows keep their synthetic 7/7/5, so the KPI series
straddles two meanings. Not backfilled — inventing or deleting past values is worse than a documented
discontinuity.

## Unknowns

- Whether the KPI/report code paths treat a null score as "no data" or coerce it to 0. Must be
  checked before task 3 ships, or the Avg energy card reads 0 instead of omitting the session.
- Whether any other caller depends on `clearSessionStore` running at end-mutation time.

## Verification boundary

`tsc` + `eslint` run in-container; **vitest does not** (`node_modules` is mounted from the Mac, so
the Linux rollup/esbuild binaries are absent). Test runs are the designer's. I stage; the designer
commits.
