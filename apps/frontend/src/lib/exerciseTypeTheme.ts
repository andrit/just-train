// ------------------------------------------------------------
// lib/exerciseTypeTheme.ts
//
// Single source of truth for the EXERCISE-TYPE visual system.
// One entry per workout type, each carrying its label + the theme-token
// class strings (text / border / subtle tint). The colour values live as
// `--type-*` tokens in index.css (flip per light/dark) and are exposed as
// Tailwind `type.*` colours in tailwind.config.js.
//
// Replaces the two previously-divergent maps (WORKOUT_TYPE_COLOR +
// WORKOUT_TYPE_BADGE_VARIANT) that could show different colours for the
// same type. The matching icon glyphs + the <ExerciseTypeBadge> pill live
// in components/exercises/ExerciseTypeBadge.tsx (JSX), which reads this map.
//
// Palette validated colour-blind-safe via the dataviz skill: normal-vision
// ΔE ≥ 15 on every pair, contrast ≥ 3:1 on both grounds. CVD separation sits
// in the 6–8 band, which is legal BECAUSE every surface pairs the colour with
// an icon + text label (secondary encoding). Cooldown is the neutral/null
// slot (grey) and leans on its icon + label.
// ------------------------------------------------------------

export interface ExerciseTypeTheme {
  /** Display label (Title Case). */
  label: string
  /** Text-colour class — the icon tint + any coloured label. */
  text: string
  /** Border-colour class — hairline accents. */
  border: string
  /** Subtle fill for a chip/pill background. */
  tint: string
}

export const EXERCISE_TYPE_THEME: Record<string, ExerciseTypeTheme> = {
  resistance: {
    label:  'Resistance',
    text:   'text-type-resistance',
    border: 'border-type-resistance',
    tint:   'bg-type-resistance/10',
  },
  cardio: {
    label:  'Cardio',
    text:   'text-type-cardio',
    border: 'border-type-cardio',
    tint:   'bg-type-cardio/10',
  },
  calisthenics: {
    label:  'Calisthenics',
    text:   'text-type-calisthenics',
    border: 'border-type-calisthenics',
    tint:   'bg-type-calisthenics/10',
  },
  stretching: {
    label:  'Stretching',
    text:   'text-type-stretching',
    border: 'border-type-stretching',
    tint:   'bg-type-stretching/10',
  },
  cooldown: {
    label:  'Cooldown',
    text:   'text-type-cooldown',
    border: 'border-type-cooldown',
    tint:   'bg-type-cooldown/10',
  },
}

/** Neutral fallback for an unknown workout type. */
export const EXERCISE_TYPE_FALLBACK: ExerciseTypeTheme = EXERCISE_TYPE_THEME.cooldown

/** Theme for a workout type, with a safe neutral fallback. */
export function exerciseTypeTheme(type: string): ExerciseTypeTheme {
  return EXERCISE_TYPE_THEME[type] ?? EXERCISE_TYPE_FALLBACK
}
