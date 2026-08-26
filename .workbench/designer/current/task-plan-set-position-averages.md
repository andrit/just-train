# Per-Set-Position Averages + Per-Set Prefill: Task Plan

**Goal:** Two independent things that share the idea of *set position*:
(A) an **insight** — "what do I average on set 1 vs set 2 vs set 3 of this exercise?", over the last
5 sessions; and (B) a **prefill fix** — each live set starts from last session's *matching* set
instead of one weight repeated down the stack.

**A does not feed B.** The prefill reads last session's set N directly; it never reads the average.
Keep them separate — averaging into a prefill would hand the athlete a weight they lifted three
weeks ago instead of the one they lifted last time.
**Written:** 2026-08-26

## Decisions taken (designer, this session)

1. **Average window:** last 5 sessions. An all-time average over months of progression lands on a
   midpoint the athlete lifted long ago and will never lift again — useless as a prefill hint.
2. **Average metric:** avg weight **and** avg reps per position. `118×6` and `118×10` are
   different sets; weight alone hides that.
   **Reps round to a whole number, half-up** — `8.4 → 8`, `8.5 → 9`. Reps are a count; a fractional
   rep is not a thing you can do. Weight keeps 1 decimal (plates are fractional).
3. **Live prefill priority for set N:**
   `ramp (start + step×N)` → `last session's set N` → `today's previous set` → `targetWeight`.
   The ramp keeps winning because it is explicit intent set at setup time.

## What already exists (verified, not assumed)

- `GET /clients/:id/exercise-history/:exerciseId` (`kpis.ts:462`) already returns **every set** of
  the last completed session, ordered by set number.
- `GET /clients/:id/exercise-progress/:exerciseId` already returns `sessions[].sets` with
  `setNumber` / `weight` / `reps` for the full history.

**Therefore: no new endpoint, no schema change, no migration.** Both asks are a pure-math addition
plus a prefill-precedence fix.

## Tasks

1. **`bySetPosition` in the progress builder** *(medium)*
   What: extend the pure `buildExerciseProgress` (`apps/backend/src/lib/exerciseProgress.ts`) with a
   `bySetPosition` array — one row per set position present in the **last 5 sessions**, each with
   `setNumber`, `avgWeight`, `avgReps`, `sessionCount`.
   Rules: average only over sessions that actually *had* a set at that position (`sessionCount`
   makes the thinness visible — set 3 averaged over 2 of 5 sessions is a weaker number than set 1
   over 5). Null weights and null reps are skipped independently, so a position with weights but no
   recorded reps still reports a weight. Round both to 1 decimal.
   Rounding: `avgWeight` to 1 decimal; `avgReps` to a **whole number, half-up** (`Math.round` is
   exactly this for positives — `8.4 → 8`, `8.5 → 9`). Rounding happens in the builder, not the UI,
   so every consumer reports the same number.
   Per-side note: averages the **entered** `reps` (what the athlete types), not doubled side-reps —
   it must match what the input field takes. Consistent with the existing per-limb est-1RM choice.
   Depends on: none

2. **Response schema** *(low)*
   What: `SetPositionAverageSchema` + `bySetPosition` on `ExerciseProgressResponseSchema` in
   `packages/shared/src/schemas/response-schemas.ts`. Then rebuild shared.
   Depends on: 1

3. **Builder unit tests** *(medium)*
   What: extend `apps/backend/src/__tests__/lib/exerciseProgress.test.ts` — window truncates to the
   newest 5 sessions; a position missing from some sessions averages over only the ones that had it;
   null weights excluded without dropping the row; single-session history; empty history; and the
   rep-rounding boundary explicitly (`8.4 → 8`, `8.5 → 9`).
   Depends on: 1

4. **"Average per set" UI block** *(medium)*
   What: a compact table in `ExerciseProgressSection.tsx` (already on `ExerciseDetailPanel`) —
   `Set 1 · 102 kg × 8` per row, with the session count shown when a position is thinner than the
   others. Reuses `useExerciseProgress`; no new hook, no new fetch.
   Depends on: 2

5. **Fix `exercise-history` grouping: session, not date** *(low — prerequisite for 6)*
   What: `kpis.ts` (~line 505–532) selects no `sessionId` and picks "last session" with
   `filter(s => s.sessionDate === mostRecentDate)`. `sessions.date` is `text('date')` — `'YYYY-MM-DD'`,
   no time component — so two completed sessions on the same day containing this exercise are
   indistinguishable and both survive the filter, returning `[1, 1, 2, 2, 3, 3]`.
   Why it becomes urgent now: today only `lastSessionSets[0]` is ever read, and index 0 is a genuine
   set 1 either way — the bug is latent. Task 6 makes **every index live**, so index 1 would hand the
   athlete the *other* session's set 1 as their set 2. Two-a-days and morning-cardio/evening-lifting
   both hit it.
   Fix: add `sessionId: sessions.id` to the select, keep `orderBy(desc(date), setNumber)`, and filter
   on `recentSets[0].sessionId`. Add a route test with two same-date completed sessions.
   Depends on: none

6. **Pure prefill picker** *(medium)*
   What: new `apps/frontend/src/lib/setPrefill.ts` — `pickPrefillSet({ setIndex, loggedSets,
   lastSessionSets, weightStep })` returning `{ set, source: 'ramp' | 'history' | 'in-session' }`.
   Encodes the priority above in one testable place.
   Why a returned `source`: `ActiveSetHero` gates ramp compounding on `priorInSession`
   (`ExerciseBlock.tsx:143`). Once history can supply set N *while* in-session sets exist, that flag
   can no longer be inferred from `loggedSets.length` — it has to come from which branch won, or the
   ramp silently breaks.
   Depends on: none

7. **Wire the picker into the live session** *(medium)*
   What: replace the inline ternary at `ExerciseBlock.tsx:699` with `pickPrefillSet`, and derive
   `priorInSession` from `source`. Net effect: set 2 prefills from last session's set 2, and the
   "Last: 110kg × 8" line under the input finally describes the set you're about to do rather than
   the one before it.
   Depends on: 5, 6

8. **Prefill unit tests** *(low)*
   What: `apps/frontend/src/__tests__/unit/setPrefill.test.ts` — ramp wins over history; history wins
   over in-session; falls back to in-session when history is short; null when neither exists.
   Depends on: 6

9. **"Use last time" shows what last time actually was** *(medium)*
   What: `AddExerciseSheet` takes an optional `clientId`, fetches `useExerciseHistory` for the
   selected exercise, and replaces the generic *"Weights will prefill from your last session"*
   sentence with the real sequence — `Last time: 100 · 110 · 120 kg`. Pass `clientId` from the two
   call sites (`WorkoutBlock.tsx:325`, `AddBlockSheet.tsx:21`).
   Optional prop so the plan-builder path keeps working with no client in scope — it just falls back
   to the current sentence.
   Depends on: 7

## Execution order

**Part A (insight):** 1 → 2 → 3 and 4. Tasks 3 and 4 are independent of each other once the schema
lands.
**Part B (prefill):** 5 (backend fix) → 6 → 7 → 8 → 9.
The two parts share no files and can ship separately. Task 5 is the only backend work in Part B and
is a strict prerequisite for 7 — landing 7 without it converts a latent bug into a visible one.

## Unknowns and known ceilings

- **Set position is a noisy key — accepted, not solved.** `exerciseProgress.ts:63` already ranks by
  *weight* (`byRank`) precisely because position is unreliable: "a warm-up drops out on its own once
  there are ≥3 work sets." `bySetPosition` reintroduces what that design dodged. If a warm-up is
  logged as set 1 in some sessions and not others, the set-1 average blends 60kg warm-ups with 100kg
  work sets and reports a weight the athlete has never lifted. Mitigation is visibility, not
  correction: `sessionCount` per row, plus a `ponytail:` comment in the builder naming the ceiling
  (upgrade path: filter sets below some % of that session's top weight — deliberately not built,
  since it guesses at intent the athlete hasn't expressed).
- **The same warm-up drift, worse, in the prefill (task 7).** If last session opened with a warm-up
  and today it's skipped, set 1 prefills the warm-up weight — that is true today too. What changes is
  that the misalignment now *propagates down the whole stack*, and in-session carry-forward no longer
  self-corrects it after set 1 is overridden. Every field stays editable and the "Last:" line names
  its source, so it is recoverable — but expect it in any session whose set count differs from the
  last one. Watch for it on device before deciding whether a guard is warranted.
- **Task 4 layout on a phone.** Three numbers per row in the existing `ExerciseProgressSection`
  column may crowd the sparkline above it. May need the session count as a subscript rather than a
  column.
- **Task 9 interaction with the ramp preview.** The sheet already renders a `weightRampSequence`
  preview when a step is set. Two "sequence" lines (last-time vs ramp) must never show at once —
  they're mutually exclusive states ("use last time" hides the weight controls entirely), but worth
  confirming visually on device.

## Verification boundary

This container runs `tsc` / `eslint` / the shared build only — `node_modules` are mounted from the
Mac. **Both suites (`pnpm typecheck`, `pnpm --filter backend test`, `pnpm --filter frontend test`)
are the designer's to run.** I stage; the designer commits.
