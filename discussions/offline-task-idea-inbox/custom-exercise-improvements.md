add/enhance ability to add custom stretches, resistance/bodyweight exercises and cardio
indicate trainer-default exercises and distinguish from custom/athlete-added

also, have a design discussion to add design elemenets to make stretches, resistance/bodyweight and cardio exercises easy to identify. theme them individually as a set of exercise types.

---
## Claude reply — 2026-10-29

Read it. Good inbox idea — I'll treat anything dropped in `discussions/offline-task-idea-inbox/`
as a triage item: read it at session start, respond in-file, and convert to a `task_create` entry
once you confirm direction. It won't get built off an inbox note alone.

I grounded the below in the current code first, because two of these three already partly exist —
so the real work is *enhance/consolidate*, not *add from scratch*.

### Idea 1 — Add/enhance custom exercises (stretch · resistance/bodyweight · cardio)

**Already exists** (so we don't rebuild):
- **Full create flow:** ExercisesPage has a **"New"** button → `Modal` → `ExerciseForm`
  (`pages/ExercisesPage.tsx:105`, `components/exercises/ExerciseForm.tsx`). `POST /exercises`.
- **Mid-session quick-add:** `POST /exercises/quick-add` creates a minimal row with `isDraft=true`,
  then the library's **Draft** badge + enrichment form fills it in later.
- The `workout_type` enum already covers all five (resistance, cardio, calisthenics, stretching,
  cooldown), and ownership is modelled: `trainer_id` set = yours; `trainer_id IS NULL` = the shared
  seeded library.

**So "enhance" is the real ask.** The gap I'd expect you're hitting: `ExerciseForm` is built around
the resistance shape, so adding a *cardio* or *stretch* custom exercise doesn't surface the fields
that type actually needs. After the #21 redesign, cardio now carries `distance_unit` +
`target_intensity_level`; stretch/cooldown are time-based. A one-size form can't set those well.
**Open questions before this becomes a task:**
1. Which type(s) feel worst to add today — cardio (most likely, post-#21), stretch, or all?
2. Should `ExerciseForm` become **type-aware** (fields change when you pick the workout type —
   e.g. cardio shows distance-unit + default intensity; stretch shows hold-time)? That's my
   recommendation; it reuses the #21 field components.
3. "bodyweight" — is that a new intent, or the existing `resistance` + `equipment: none/bodyweight`?
   Today it's the latter. If you want bodyweight to read as its own thing, that's a labelling/filter
   decision, not a schema one.

### Idea 2 — Distinguish trainer-default vs custom/athlete-added

**The data already supports this** — `trainer_id IS NULL` = seeded/shared default, `trainer_id = you`
= custom. What's missing is purely **UI**: the library shows a **Draft** badge but no
default-vs-custom marker. So this is a badge + optional filter chip, no migration.

Two things to decide:
- **Terminology.** Our ubiquitous language calls the seeded set the shared/public **library** and the
  rest trainer-owned. I'd badge custom ones only (e.g. a quiet "Custom" / "Yours" pill) and leave the
  defaults unmarked, rather than badge both — less visual noise. Your call on the word.
- **One clarification I need from the code owner (you):** there's *also* an `is_public` boolean column
  (`exercises.is_public`, default false) that looks parallel to `trainer_id IS NULL`. I don't want to
  key a "default vs custom" badge off the wrong field. Is `is_public` live/authoritative, or vestigial
  next to the trainer_id-null convention? (Prod is authoritative here, not the seed JSON — I'd dry-run
  a `SELECT trainer_id, is_public, count(*)` against prod before wiring anything to it.)

### Idea 3 — Theme the five exercise types as a recognisable set

**Already partly built, and applied widely** — `lib/exerciseLabels.ts` defines `WORKOUT_TYPE_LABEL`,
`WORKOUT_TYPE_COLOR`, and `WORKOUT_TYPE_BADGE_VARIANT`, consumed in **8** components (cards, detail,
session blocks, both template pickers). So types already have colour. The gaps are consistency, not
existence:

1. **The two maps disagree on hue.** `WORKOUT_TYPE_COLOR` says stretching=violet, calisthenics=emerald,
   resistance=ember-red; `WORKOUT_TYPE_BADGE_VARIANT` says stretching=**success/green**,
   calisthenics=**warning/amber**, resistance=**danger/red**. A badge and a card for the same type can
   therefore show different colours. That's the main thing to fix.
2. **Not light-tokenized.** The colours are dark-tuned Tailwind `-400` shades (`text-sky-400`, etc.),
   so they're outside the #22 theme-token system we just finished — they won't be vetted for light.
3. **Colour is the only cue.** No per-type **icon**, which is the cheapest "easy to identify at a
   glance" win and is colour-blind-safe.

**My recommendation:** collapse it to a **single source of truth** — one `EXERCISE_TYPE_THEME` object
keyed by type, each entry carrying `{ label, icon, token }`, where `token` is a semantic theme token
(light+dark pair) rather than a raw shade. Every one of the 8 consumers reads from that. Straw-man to
react to (final colours need your eye on-device — I can't render in-container):

| Type | Icon (lucide) | Hue direction |
|---|---|---|
| Resistance | dumbbell | red/ember |
| Cardio | heart-pulse / activity | sky/blue |
| Calisthenics | person-standing | emerald/green |
| Stretching | stretch-horizontal | violet |
| Cooldown | snowflake / wind | slate/grey |

(Reconcile "bodyweight" here too — if it stays part of resistance it shares that theme; if it becomes
its own identity it needs its own row + hue.)

### Implications / how I'd sequence

These are **three separate tasks**, not one, and #3 is the enabler:
- **Do #3 first** (consolidate to one tokenized type-theme + icons). It's self-contained, pays off the
  disagreement bug immediately, and both other ideas render types, so they inherit it.
- **#2 next** (default/custom badge) — small, UI-only, once the `is_public` question is settled.
- **#1 last** (type-aware `ExerciseForm`) — largest, touches the form + reuses #21 field components.

None of this needs a schema migration *if* the `is_public` answer is "use trainer_id-null." If you want
bodyweight as a first-class type, that *is* an enum change (schema + the 4-file column-less enum path),
so flag that intent early.

**For you to decide, and then I'll turn each into a task:**
- #1: which type hurts most, and OK to make the form type-aware?
- #2: badge wording, and the `is_public` vs `trainer_id`-null question.
- #3: OK to consolidate the two maps into one tokenized theme + add icons? Any hue preferences?

_— end Claude reply —_
---
## Claude reply — 2026-10-29 (decisions locked + visual-system direction)

Designer confirmed in session. Recording here as the durable record; the live design discussion is
in chat.

**Confirmed decisions:**
- **#1 is approved as a type-aware form** — `ExerciseForm` fields change by workout type (cardio shows
  distance-unit + default intensity from #21; stretch/cooldown show hold-time). Built **last** per the
  sequence below.
- **Sequence: #3 → #2 → #1.** The tokenized type-theme is the enabler the other two render through.
- **Bodyweight stays inside `resistance`** (dips, pull-ups, push-ups — load optional). **New rule: when
  a logged set's weight is 0, it displays as "BW"** (not "0 kg"). Implication to handle at build time:
  load-based PR/1RM (Epley `weight×(1+reps/30)`) and volume (`weight×reps`) are both 0 at zero load, so
  a BW set earns **no PR today** — the meaningful BW PR is **max reps**. Flagged for #1 / the progress
  engine; not solved yet.

**Visual-system direction (proposed, under discussion — not final):**
- Treat this as **two orthogonal axes on different visual channels**, so they never collide (the
  current bug is both fighting over colour): **Type** (5-way, categorical) → **hue + icon**;
  **Provenance** (default vs custom, binary) → a **quieter, different** channel (grouping/position, and
  a light badge only on the custom minority) — *not* a background fill, which would fight type-hue.
- **Formalise as a layer over the data:** one `EXERCISE_TYPE_THEME` source of truth keyed by type,
  each entry `{ label, icon, token }` where `token` is a light/dark semantic pair (inside the #22
  system), plus a pure `provenance(exercise)` selector. Data stays neutral; presentation derives
  deterministically. Replaces the two divergent maps in `lib/exerciseLabels.ts`.
- **Research stance:** no formal market or psychological study — disproportionate. Use (1) settled
  information-design principles (channel separation; redundant coding — WCAG 1.4.1 never colour-alone,
  ~8% of men are colour-blind and this is a male-leaning segment), (2) the workbench **`dataviz`
  skill**'s categorical-palette method + validator (colour-blind + light/dark legibility) for the
  actual colours, and (3) a **light competitive convention scan** (Strong / Hevy / Fitbod + common UI
  kits) to avoid surprising users. The scan is the only "research" worth doing.

**Still open (designer to decide before #3 build):** `is_public` vs `trainer_id`-null as the
provenance field; provenance badge wording; final palette + icon set; whether to run the convention
scan.

_— end Claude reply —_
---
## Claude reply — 2026-10-29 (provenance field resolved + convention scan)

### Provenance field — decided: `trainer_id` (not `is_public`)

Checked the code; `trainer_id` is the authoritative signal and `is_public` is not:
- **Visibility already keys on `trainer_id`** — the list route filters `trainerId = you OR trainerId
  IS NULL` (`routes/exercises.ts:112-114`). `is_public` is **never read** by any visibility filter.
- **The frontend already derives provenance from it** — `ExerciseDetailPanel.tsx:365`:
  `const isPublicLibrary = !exercise.trainerId`. We'd centralise that, not invent it.
- **`trainerId` is exposed** on the response (`response-schemas.ts:337`, nullable) — the data to render
  "Yours" is already on the wire.
- **`is_public`** is documented as a *"future multi-trainer feature"* flag (`schema/exercises.ts:87`);
  it's set only by the seed and by account-rehome (`account.service.ts:103`, which also nulls
  `trainer_id`), so today it tracks 1:1 with `trainer_id IS NULL` but is not the signal the app uses.
- **Decisive architectural reason:** `trainer_id` extends to **three** provenance states without
  rework — `=== me` → **Yours**, `=== null` → **System/default**, `=== another trainer` →
  **Shared/community** (the future multi-trainer case). `is_public` is binary and can't express that.

Provenance becomes a pure selector over `trainer_id`: `provenance(ex, myId) → 'yours' | 'system' |
'shared'`. **Confirm-before-wiring:** dry-run `SELECT trainer_id IS NULL AS system, is_public,
count(*) FROM exercises GROUP BY 1,2;` against prod to verify the data is clean (no custom row with
`is_public=true`, no null-trainer row with `is_public=false`). Prod authoritative, not the seed.

### Provenance treatment — confirmed

Grouping ("Your exercises" / "Library") + a **"Yours"** badge on custom rows only (defaults unmarked).
**Also required:** sort + filter by **custom vs system** (a chip alongside the existing type tabs) —
matches the standard category-chip pattern and the way competitors separate the two.

### Bodyweight — confirmed

When an exercise is identified as bodyweight (resistance, 0 load), track the PR as **max reps** (load
PR/1RM is 0 at zero weight). Fold into #1 / the progress engine; "BW" is the set-display label.

### Convention scan — findings (sources in chat)

- **Provenance by grouping is the real-world convention.** Hevy keeps custom exercises in their own
  section ("your list of custom exercises once you pass the Recent Exercises section") rather than a
  per-row badge. Our grouping + light "Yours" badge is consistent and marginally clearer. (Strong,
  Hevy, Fitbod differ mainly in *creation* richness, not in a custom-vs-builtin marker.)
- **Type colour conventions corroborate the straw-man:** red/orange = strength/intensity (Strava,
  Nike), blue = cardio/calm, green = health/recovery. → resistance=red/ember, cardio=blue/sky,
  stretching=green (mobility/recovery), cooldown=cool slate/grey. The one to pin with the palette tool
  is **calisthenics** (bodyweight *effort*, no clean convention slot — must separate cleanly from
  resistance-red and cardio-blue) and keeping cooldown distinct from cardio-blue.
- **Icon + label, never colour alone** is the stated accessibility best practice — external
  confirmation of redundant coding. Common type icons: dumbbell (resistance), running-figure /
  heart-pulse (cardio), timer (time-based stretch/cooldown), person/figure (calisthenics).

### Next step for #3

Palette + icon set to be finalised with the workbench **`dataviz`** skill (categorical method +
colour-blind / light-dark validator) when #3 is built. No open blockers except the prod dry-run
confirm above.

_— end Claude reply —_
---
**Tracked:** workbench task **#25** (planned, Phase 19) — created 2026-10-29. #2 and #1 remain in-inbox pending #3.
