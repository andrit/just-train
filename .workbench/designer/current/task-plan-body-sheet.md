# Body Sheet — tap the figure → ranked regions + "train this" suggestions

**Goal:** Make the Home body heat-map interactive and the first slice of the "suggestions"
vision: tap the figure → a bottom sheet ranking what you've trained (and neglected) in the last
30 days, and tapping a muscle shows library exercises that target it — so a cold region turns
straight into "here's how to work it."

**Written:** 2026-10-19 · **Status:** SPEC — VETTED 2026-10-19, awaiting the list-design decision + go-ahead.

## Vetting (2026-10-19) — read the exercises route, didn't guess

- **HELD:** `GET /exercises` already takes a filter querystring (`workoutType`/`bodyPartId`/`search`)
  and already scopes `or(trainerId = me, trainerId IS NULL)`. `?muscle=<slug>` is a real small
  extension — **no new route.** Add `muscle: MuscleEnum.optional()` to `ExerciseFilterSchema`.
- **CHANGED — filter is an EXISTS subquery, not an `eq` push.** The list is a relational `findMany`;
  filtering by muscle needs a correlated `EXISTS (select 1 from exercise_muscles …)` `sql` condition.
  Consequence: summary rows don't carry the muscle *role*, so **primary-first ordering is NOT free →
  dropped from v1.** v1 returns exercises targeting the muscle (either role), name-ordered. Role
  ranking = later.
- **CHANGED — "add to session" task DELETED (already exists).** The exercise **detail** view already
  has a context-aware "Add to Workout" CTA, and `GET /exercises/:id` already returns `muscles`. So a
  tapped suggestion → existing detail gives both the muscle map and add-to-session for free. Task 3's
  drill target is just the existing exercise detail.
- **HELD:** whole-figure tap (not per-polygon) — no hit-target risk; `BottomSheet` dismissal is built.
- **OPEN (product, needs the designer):** sheet list design — recommend grouping by the 7 body parts,
  each muscle + 30-day count, cold flagged, count-descending within a group; any muscle tappable
  (even 0-count) → its exercises. Rank-direction / flat-vs-grouped is the one decision blocking build.
- **Net:** backend shrinks to one `?muscle=` EXISTS filter + a schema line + tests; frontend is the
  sheet + a tap handler. Lower risk than first written.

## The shape (phone-first)

- Home figure stays a **glance** and stays no-scroll. A **whole-figure tap** (not per-polygon)
  opens a `BottomSheet` — "Body · last 30 days".
- Sheet = a ranked list of muscles with their 30-day session counts. Each row is a fat tap target
  (no tiny-polygon tapping). Tapping a muscle reveals **exercises that target it** (deterministic,
  from `exercise_muscles` — primary first, then secondary), each opening the existing exercise
  detail. No AI; library facts only.

## Tasks

1. **Backend — exercises by muscle** *(medium)*
   What: list library exercises visible to the trainer (public OR own) that target a given muscle,
   primary-role first. **Preferred: extend the existing `GET /exercises`** with an optional
   `?muscle=<slug>` (+ maybe `role`) filter rather than a new route — reuses its visibility scoping
   and response schema. Falls back to a dedicated route only if the list route can't take the join
   cleanly. TDD (401 / filter returns only matching / public+own visibility / unknown muscle → empty).
   Depends on: none. **VET first (see below).**

2. **Frontend hook** *(low)* — `useExercisesByMuscle(muscle)` (or reuse `useExercises` with the new
   filter param). `enabled: !!accessToken && !!muscle`.
   Depends on: 1.

3. **`BodyBreakdownSheet`** *(medium)*
   What: a `BottomSheet` fed the muscle-frequency counts already fetched on Home. Renders a ranked
   muscle list (label via `MUSCLE_LABEL`, count, a cold/under-trained flag). Tapping a row expands to
   the exercises for that muscle (task 2), each → existing exercise detail. Reuses `BottomSheet`
   (swipe/backdrop/Esc dismissal already built).
   Depends on: 2.

4. **Make the Home figure open it** *(low)*
   What: wrap `BodyHeatMap` in a button/tap handler on Home → opens `BodyBreakdownSheet`. Figure stays
   visually a glance; the sheet carries all interaction. No per-region hit targets in v1.
   Depends on: 3.

## Execution order
1 (after vetting) → 2 → 3 → 4. Task 1 is the only real backend work; the rest is UI over data we
already fetch.

## Unknowns (resolve before building)

- **Rank direction.** The point is often "what am I neglecting," so least-trained-first may beat
  most-trained-first. Options: ascending, descending, or both ends ("hot" + "cold" sections).
- **List scope.** All 34 muscles is long. Group by the 7 body parts? Show only the figure's regions?
  Top/bottom N? A grouped list (body part → muscles) likely reads best.
- **Suggestion ranking within a muscle.** Primary-before-secondary is clear; tiebreak by alphabetical
  (no usage-popularity signal exists). Flagging "you've done this before" needs a history join — v1 or
  defer?
- **"Add to session" from a suggestion?** v1 = tap → exercise detail (existing). Direct add-to-open-
  session is nicer but more wiring — include or defer?
- **Backend seam (the key vet):** does `GET /exercises` already take filter params so `?muscle=` is a
  small extension, or does it need a new route? (Verify by reading the route — cheap.)

## Files involved
- `apps/backend/src/routes/exercises.ts` (filter or new route), shared response (reuse
  `ExerciseSummaryResponseSchema`), `__tests__/routes/exercises*.test.ts`
- `apps/frontend`: `lib/queries/exercises.ts` (hook), `components/charts/BodyHeatMap.tsx` (tap →
  callback) or a wrapper on Home, new `components/.../BodyBreakdownSheet.tsx`, `pages/DashboardPage.tsx`

## Notes / guardrails
- **Deterministic, factual only** — "exercises that target muscle X," never programming prescriptions.
  The LLM/KB natural-language tier is a later, separate initiative on top of this UI.
- Reuses the muscle-frequency endpoint + `exercise_muscles` already shipped; no schema change expected.


REPLY:
List Scope: Group by body part but make it stil granular for each  muscle.
Group be body part lays a categorical ground level for the tool.
But targeting every muscle helps the athlete that wants to know how to work that one forearm muscle at the top, not the bottom. or the muscle by the shin in the front of the leg. 

rank direction: both ends. sometimes they might just want to feel some pride for finally getting good trap work in, for example.

lets build the ground work mapping before we get into suggestion and add to session with suggestions. valuable stuff but lets make sure mapping is sound on its own and reliable for utilization

talk to me more about the backend seam.

ENDREPLY;

---
## Claude reply — 2026-10-19

Decisions locked in: **grouped by body part + granular to every muscle**, **both ends** (hot and
cold), and **mapping first** — suggestions/add-to-session come after the map is solid. All good calls.

**The big consequence of "mapping first": Phase 1 is frontend-only — no backend at all.** The
muscle-frequency endpoint already returns a per-muscle session count, and the shared data already has
everything the sheet needs: `MUSCLE_BODY_PART` groups all **34 muscles** into 6 groups
(shoulders 4 · chest 3 · back 8 · arms 6 · core 3 · legs 10) and `MUSCLE_LABEL` gives gym names
("Tibialis Ant.", "Brachioradialis"). So the sheet is: enumerate those 34, group by body part, show
each muscle's count (default 0 when the endpoint omits it), style hot vs cold. Nothing new server-side
→ nothing that can drift or fail under load. That's exactly the "reliable on its own" you asked for.

**Your granularity point actually makes the list *better than the figure*, on purpose.** The SVG can
only paint the regions it has polygons for — the shin muscle (`tibialis_anterior`) and a couple of
others have **no region**, so they never light up on the body. But they're real muscles in the vocab
and in `exercise_muscles`. In a grouped *list* they get a row like everything else — so "that muscle
by the shin" and "the forearm muscle at the top" are reachable and tappable even though the figure
can't shade them. The list is the complete map; the figure is the glance.

**Both ends, concretely:** group by body part; within a group, sort count-descending so your best work
sits at the top of each; untrained (0 in 30 days) muscles get a clear "cold" treatment rather than
being hidden. Plus a one-line **highlights** strip at the top of the sheet — your single most-trained
muscle (the trap-work pride) next to a most-neglected one (the nudge). You see both extremes without
scrolling.

### The backend seam — what it is and why (this is Phase 2, but here's the detail you asked for)

When we get to "tap a muscle → exercises that work it", the seam is **one optional query param on the
existing `GET /exercises`**, not a new endpoint:

- `GET /exercises?muscle=obliques` → the same list route, same public-OR-own visibility, same response
  shape, just filtered to exercises that target that muscle.
- **Why it can't be a normal column filter:** the existing filters (`workoutType`, `bodyPartId`,
  `search`) compare a column *on the exercise row*. "Targets muscle X" lives in the **child table**
  `exercise_muscles` (one exercise → many muscle rows). So the filter is a correlated **EXISTS**
  subquery: `EXISTS (SELECT 1 FROM exercise_muscles em WHERE em.exercise_id = exercises.id AND
  em.muscle = :muscle)`, pushed into the route's existing `conditions[]` as a raw `sql` fragment.
- **Why EXISTS, not a JOIN:** a join to `exercise_muscles` would return one row *per matching muscle*,
  duplicating exercises and forcing a `DISTINCT`/group — and it'd disturb the route's relational
  `with: { bodyPart, media }` shape. EXISTS keeps it exactly one row per exercise and leaves the rest
  of the query untouched.
- **Why primary-first ordering isn't free (and is dropped from v1):** EXISTS answers a yes/no — "does
  this exercise hit the muscle at all" — it doesn't carry *whether it's primary or secondary* back
  into the summary rows. To rank prime movers first we'd need the role in the SELECT, which means
  either a join+aggregate or a second `?muscleRole=` param. Not worth it for v1 — "exercises that work
  your obliques", name-ordered, is the useful thing; Russian Twist shows up whether it's tagged
  primary or secondary.
- **Alternative I rejected:** a dedicated `GET /muscles/:muscle/exercises`. It would re-implement the
  visibility scoping and response schema the list route already has — extend, don't fork.
- **The one thing I'll vet before building it:** that Drizzle lets a raw `sql` EXISTS condition that
  references the parent column (`exercises.id`) sit in a relational `findMany({ where })` and generate
  the right correlated SQL. I expect yes (the `sql` template takes column refs), but I'll confirm
  against the generated query / a test rather than assume — same as I did reading the route this time.

So Phase 2 is: that one filter + a `muscle: MuscleEnum.optional()` schema line + tests; then the sheet's
muscle rows become tappable → exercises → the existing exercise detail (which already carries the
muscle map *and* the context-aware "Add to Workout" CTA, so add-to-session is free there).

### Proposed build now (Phase 1, frontend-only)
1. `BodyBreakdownSheet` — a `BottomSheet` fed the muscle-frequency counts already on Home: body-part
   groups → every muscle with its 30-day count, hot/cold styling, a highlights strip (top + neglected).
   Rows are display-only in v1 (no drill yet).
2. Make the Home figure a whole-figure tap that opens it.

Reliable map, no server change, nothing to break. Say go and I'll build Phase 1; Phase 2 (the seam +
tappable suggestions) follows once you've seen the map work.

_— end Claude reply —_
---

## Claude reply — 2026-10-20 (refinements built)

Discussed and built the refinements. Decisions that landed:

- **Equipment labels** — raw enum (`none`→"NONE") read as missing; now via `EQUIPMENT_LABEL`.
- **Primary-first = grouped, not silent.** The `?muscle=` two-step already queries `exercise_muscles`,
  so carrying `role` is free (the EXISTS worry in the earlier vet was moot once the impl became an
  `inArray`). Added `muscleRole` (additive, nullable, optional) to the summary schema; the sheet groups
  **Primary movers / Also works it**. Role stays **binary**; three-way `stabilizer` logged to DEFERRED.
- **Region-tap scoping (Design A), all-muscles path kept.** Figure regions are individually tappable →
  sheet scoped to the region's muscles (derived `REGION_MUSCLES`, inverse of `MUSCLE_TO_REGION`, single
  source); whole-figure tap → full map; "‹ All muscles" escape inside the scoped view. Single-muscle
  regions auto-expand.
- **No static region-role.** The key correction (yours): secondary/stabilizer is **exercise-relative**,
  not a region property (hip flexors are primary in the rotary-machine exercise). So the region grouping
  only *orders* rows (frequency → name), never asserts a role; the real role lives on `exercise_muscles`
  and surfaces inside each muscle's exercise list. Primary-prevalence tiebreak + per-region a11y →
  DEFERRED.

Verified in-container: shared build + both apps `tsc --noEmit` + eslint on all touched files, all clean.
Vitest is the user's run (3 new backend cases: role surfaced / primary-before-secondary / null-on-unfiltered).

_— end Claude reply —_
---

