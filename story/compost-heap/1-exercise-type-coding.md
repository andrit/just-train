---
kind: compost dump — factual freeze of a shipped system (not a brain-spill)
author: claude (on the writer's instruction)
source:
  - apps/frontend/src/lib/exerciseTypeTheme.ts
  - apps/frontend/src/components/exercises/ExerciseTypeBadge.tsx
  - apps/frontend/src/index.css   (--type-* tokens, 3 blocks)
  - apps/frontend/tailwind.config.js   (type.* colours)
  - shipped as #25 — commits ead4e77, 321c5ed, d50a721
frozen: 2026-11-02
note: Frozen snapshot of the facts as shipped on this date. Code may move; this does not.
      Reactions live in 1-exercise-type-coding-machinima.md, never here.
---

# Exercise-type color & icon coding — the shipped system (frozen facts)

## The five types

`resistance · cardio · calisthenics · stretching · cooldown` — one accent per workout type,
categorical (not a scale).

## Palette (dataviz-validated)

RGB triplets live as `--type-*` CSS variables; the system flips them per theme — **brighter on
dark, darker on white**.

| Type | Light (`:root`) | Dark (`[data-theme=dark]` + `prefers-color-scheme`) | Note |
|---|---|---|---|
| resistance | `#D91B1B` (217 27 27) | `#B91C1C` (185 28 28) | red |
| cardio | `#3B82F6` (59 130 246) | `#1D4ED8` (29 78 216) | blue |
| calisthenics | `#C026D3` (192 38 211) | `#A21CAF` (162 28 175) | fuchsia |
| stretching | `#059669` (5 150 105) | `#047857` (4 120 87) | emerald |
| cooldown | `#94A3B8` (148 163 184) | `#334155` (51 65 85) | slate — **neutral / null slot** |

Validation (recorded in the `exerciseTypeTheme.ts` header): validated colour-blind-safe via the
dataviz skill — **normal-vision ΔE ≥ 15 on every pair; contrast ≥ 3:1 on both grounds.** CVD
separation sits in the **6–8 band**, which is legal *because* every surface pairs the colour with
an icon + a text label (secondary encoding). Cooldown is the neutral/null slot and leans on its
icon + label.

## Token architecture (one source of truth)

```
index.css  --type-* (RGB triplets, ×3 theme blocks: :root / [data-theme=dark] / @media dark)
   ↓  rgb(var(--type-*) / <alpha-value>)
tailwind.config.js  theme.extend.colors.type.{resistance,cardio,calisthenics,stretching,cooldown}
   ↓  text-type-* · border-type-* · bg-type-*/10
lib/exerciseTypeTheme.ts  EXERCISE_TYPE_THEME  (the consumed map)
```

Tailwind comment on the `type` colours: *"The single colour source for EXERCISE_TYPE_THEME; never
reuse for anything else."*

`EXERCISE_TYPE_THEME` — one entry per type, each carrying:
- `label` — Title Case display string
- `text` — `text-type-<type>` (icon tint + any coloured label)
- `border` — `border-type-<type>` (hairline accents)
- `tint` — `bg-type-<type>/10` (subtle chip/pill fill)

`EXERCISE_TYPE_FALLBACK = cooldown`. `exerciseTypeTheme(type)` returns the entry `?? fallback` —
i.e. an **unknown type degrades to the neutral slate slot**, never to a wrong-colour signal.

History: this map **replaced two previously-divergent maps** (`WORKOUT_TYPE_COLOR` +
`WORKOUT_TYPE_BADGE_VARIANT`) that could show **different colours for the same type.**

## The glyphs (hand-rolled, deliberately distinct shapes)

Five SVG glyphs in `ExerciseTypeBadge.tsx` — **no icon library.** All share one `<Svg>`: `viewBox
0 0 24 24`, `stroke="currentColor"`, `strokeWidth 2`, round caps/joins, `aria-hidden`.

| Type | Glyph | Depiction |
|---|---|---|
| resistance | barbell | long bar + grouped plates at each end |
| cardio | bicycle | two wheels + frame |
| calisthenics | jumping jack | figure, arms up/out, legs spread |
| stretching | split | upright torso, legs spread wide and low |
| cooldown | snowflake | six-spoke asterisk |

Stated rationale (component header): the glyphs are *"deliberately distinct SHAPES so the type is
identifiable without colour — the secondary encoding that lets the validated palette sit in the CVD
6–8 band safely."*

## Where it surfaces (the presentational API)

- `ExerciseTypeIcon` — the glyph alone, `currentColor`, for compact spots that already show the
  label as text (e.g. session headers).
- `ExerciseTypeBadge` — icon + label pill: `inline-flex items-center gap-1 px-2 py-1 rounded-full
  border text-xs font-medium`, coloured via `theme.text / border / tint`. Prop **`showIcon`**
  (default `true`) — turned **off** where the icon already appears nearby (e.g. card art).
- **Card thumbnail = the type icon in the type colour**; the exercise photo is demoted to the
  detail drawer. On cards the corner pill is **label-only** (icon suppressed via `showIcon={false}`
  because the art already carries it); in the drawer the badge shows **icon + label**.

## Design-system context

- Lands on the **#22 token system** (named palette + semantic tokens, light/dark).
- Part of the exercise-library UI push, the **3→2→1** sequence (#3 visual system → #2 provenance →
  #1 type-aware form). This is the #3 piece.
- Display typeface is **Barlow Condensed** ("gym-poster energy"); near-black ground in dark theme.
