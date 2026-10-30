# Exercise-type visual system (#25)

**Date:** 2026-10-29 · **Phase:** 19 (Go Live) · **Status:** built, awaiting on-device colour QA

First of the 3 → 2 → 1 exercise-library sequence (see
`discussions/offline-task-idea-inbox/custom-exercise-improvements.md`). Formalises the exercise **type**
distinction as a visual system that lives *over* the data (the data is just `workout_type`).

## The problem

`lib/exerciseLabels.ts` carried **two** colour maps that disagreed:

- `WORKOUT_TYPE_COLOR` (used by `WorkoutBlock`, `TemplateBuilderSheet`): stretching=violet,
  calisthenics=emerald, resistance=ember-red.
- `WORKOUT_TYPE_BADGE_VARIANT` (used by the card/detail `<Badge>`s): stretching=success/green,
  calisthenics=warning/amber, resistance=danger/red.

So a card and a badge for the *same* type could show different colours. The colours were also dark-tuned
Tailwind `-400` shades — outside the #22 light/dark token system, never vetted for light — and colour
was the only cue (no icon), failing WCAG 1.4.1 for the ~8 % colour-blind segment.

## The change

**One source of truth** — `lib/exerciseTypeTheme.ts`:

```ts
export const EXERCISE_TYPE_THEME: Record<string, ExerciseTypeTheme> = {
  resistance: { label: 'Resistance', text: 'text-type-resistance', border: 'border-type-resistance', tint: 'bg-type-resistance/10' },
  // cardio, calisthenics, stretching, cooldown …
}
export function exerciseTypeTheme(type: string): ExerciseTypeTheme { /* with neutral fallback */ }
```

**Colour in the token system** — five `--type-*` tokens defined in all three `index.css` blocks (dark
`:root`, `:root[data-theme="light"]`, and the `prefers-color-scheme: light` media block) and exposed as
Tailwind `type.*` colours. Brighter on dark, darker on white:

| Type | Dark | Light |
|---|---|---|
| resistance | `#D91B1B` | `#B91C1C` |
| cardio | `#3B82F6` | `#1D4ED8` |
| calisthenics | `#C026D3` | `#A21CAF` |
| stretching | `#059669` | `#047857` |
| cooldown (neutral) | `#94A3B8` | `#334155` |

**Icon as secondary encoding** — `components/exercises/ExerciseTypeBadge.tsx` ships five hand-rolled,
shape-distinct SVG glyphs (dumbbell / pulse / star-jump figure / outward arrows / snowflake — no new
dependency) plus `ExerciseTypeBadge` (icon + label pill) and `ExerciseTypeIcon` (icon alone).

**Palette validation** — run through the `dataviz` skill's validator in both modes: normal-vision
ΔE ≥ 15 on every pair, contrast ≥ 3:1 on both grounds. CVD separation sits in the 6–8 band, which is
legal *because* every surface pairs the colour with an icon + text label. Cooldown is the deliberate
neutral/null slot.

## Files

- **New:** `src/lib/exerciseTypeTheme.ts` (data SoR), `src/components/exercises/ExerciseTypeBadge.tsx`
  (icons + pill).
- **Tokens:** `src/index.css` (×3 blocks), `tailwind.config.js` (`type.*`).
- **Refactor:** `src/lib/exerciseLabels.ts` (removed both divergent maps; `WORKOUT_TYPE_LABEL` now
  derives from the theme).
- **Consumers:** `ExerciseCard`, `ExerciseDetail`, `ExerciseDetailPanel` (→ `<ExerciseTypeBadge>`),
  `WorkoutBlock`, `TemplateBuilderSheet` (→ `exerciseTypeTheme().text`).

## Verification

tsc + eslint clean in-container; CSS cleared `postcss.parse`. **Not yet** rendered — the five hues and
glyphs need an eyeball on device in both themes (vite can't run in-container). `pnpm verify` is the
user's gate before commit.
