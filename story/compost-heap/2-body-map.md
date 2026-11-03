---
kind: compost dump — factual freeze of a shipped system
author: claude (on the writer's instruction)
source:
  - apps/frontend/src/components/charts/MuscleMap.tsx       (per-exercise role figure)
  - apps/frontend/src/components/charts/BodyHeatMap.tsx     (home frequency figure)
  - apps/frontend/src/components/charts/heatRamp.ts         (the shared ramp SoR)
  - apps/frontend/src/components/charts/BodyBreakdownSheet.tsx (the tap-in sheet)
  - apps/frontend/src/components/charts/muscleMapData.ts    (vendored SVG geometry)
  - task plans: task-plan-home-body-heatmap.md · task-plan-body-sheet.md ·
    task-plan-exercise-muscle-map.md · task-plan-body-map-history.md
frozen: 2026-11-02
note: Factual snapshot as shipped. Reactions live in 2-body-map-machinima.md.
---

# The body map — the shipped system (frozen facts)

## Two figures, one geometry

Both figures are **pure inline SVG** (no charting/illustration dependency), anterior + posterior,
sharing vendored polygon geometry (`muscleMapData.ts`) and the `MUSCLE_TO_REGION` map:

- **`MuscleMap`** — the **per-exercise role figure.** Highlights worked muscles: **primary = Ember
  Red `#D91B1B`**, **secondary = the same red at 0.4 opacity** ("the gym-placard convention").
- **`BodyHeatMap`** — the **Home frequency figure.** Shades each region by **how often it was
  trained in the last 30 days.** Reuses the same geometry; only the colouring differs.

## DATA > RENDER

The exercise stores precise muscles in a **34-term vocab** (`exercise_muscles` join, primary/
secondary role). The figure paints at the SVG's **coarser region resolution** via
`MUSCLE_TO_REGION`. Muscles with no region (e.g. `tibialis_anterior`) **don't paint** — but they
still appear as **text rows** in the sheet, so every muscle is reachable somewhere. `REGION_MUSCLES`
is the inverse, derived at module load so the two can't drift.

Rendered **client-side from data** — there is no stored muscle-diagram image. (The old
`exercises.visualization` URL column is now vestigial.)

## The heat ramp (`heatRamp.ts` — one source, so figure + sheet can't drift)

> They drifted once — the sheet kept Ember Red after the figure moved to blue. `heatRamp` exists to
> prevent that.

- **"How often trained" is a magnitude → one hue, discrete buckets, never a rainbow.**
- `heatFill(value, max)`: `0` → **base gray** (untrained); else tier by `r = value/max` in thirds →
  **three Command-Blue tiers** (low / med / high) that brighten with frequency.
- **Blue, not red** — *"red on a body reads as soreness/injury."*
- Tiers are **normalized to the athlete's own busiest region**, so the top tier always lights up.
- A region's value = the **MAX** session-count among the muscles mapping to it (summing would
  double-count a session that hit two of them).
- Variable-backed (`--chart-base`, `--heat-1/2/3`) → flips by theme.
- v1 = a single (neutral/male) silhouette; a **male/female toggle is deferred** until a second
  silhouette with matching region slugs exists.

## Tap behavior (figure)

- A region is **tappable only if it stands for ≥ 1 muscle** (head / knees carry none → inert).
- Tapping a region → `onRegionTap(region)`; the tapped polygon **stops propagation** so the
  figure's outer "all muscles" button doesn't also fire.
- Current metric = **session-count**; `metric` is a documented seam for sets / reps / volume later.

## The breakdown sheet (`BodyBreakdownSheet`)

The tap-in companion — **more granular than the figure on purpose** (it lists muscles the SVG can't
paint). Two entry modes:

- **Full** (tap the whole figure) — every muscle grouped by body part, plus a highlights strip:
  **"Most trained"** (top muscle · N×) and **"Neglected · N muscles untrained"** (a tappable tile →
  the untrained list).
- **Scoped** (tap a region) — only that region's muscles, **busiest-first**, with a `‹ All muscles`
  escape. If the region maps to a **single muscle**, it auto-expands straight to its exercises (no
  extra tap).

Each muscle row shows a **heat dot** (`heatFill`) + count (`N×` or `—`). Expanding a muscle opens a
3-tab drill:

- **Your history** — the client's own logged exercises for that muscle (empty → "see Primary
  movers ›").
- **Primary movers** / **Also works it** — library exercises by exercise→muscle role.

Tapping any exercise → opens its detail on the **Exercises page** (which carries the context-aware
**Add to Workout** CTA) and closes the sheet.

## Data chain

`exercise_muscles` (34 vocab, primary/secondary) → `MuscleFrequencyCount` → figure + sheet.
Home figure uses the self-client's counts; the sheet's "Your history" tab is gated on a `clientId`.
