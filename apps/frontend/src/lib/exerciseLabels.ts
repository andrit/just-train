// ------------------------------------------------------------
// lib/exerciseLabels.ts (v2.5.0)
//
// Single source of truth for all exercise display label maps.
// Previously copy-pasted across ExerciseCard, ExerciseDetailPanel,
// ExerciseBlock, AddExerciseSheet, SessionHistoryPanel.
//
// USAGE:
//   import { WORKOUT_TYPE_LABEL, EQUIPMENT_LABEL, DIFFICULTY_COLOR } from '@/lib/exerciseLabels'
// ------------------------------------------------------------

import { EXERCISE_TYPE_THEME } from './exerciseTypeTheme'

// ── Workout type ──────────────────────────────────────────────────────────────
//
// The type COLOUR system now lives in `exerciseTypeTheme.ts` (one source of
// truth) — consume `EXERCISE_TYPE_THEME` / `<ExerciseTypeBadge>` for colour +
// icon. The old WORKOUT_TYPE_COLOR and WORKOUT_TYPE_BADGE_VARIANT maps are gone
// (they disagreed on hue). Labels still live here, derived from that one source.

export const WORKOUT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(EXERCISE_TYPE_THEME).map(([type, theme]) => [type, theme.label]),
)

// ── Equipment ─────────────────────────────────────────────────────────────────

export const EQUIPMENT_LABEL: Record<string, string> = {
  none:            'Bodyweight',
  bodyweight:      'Bodyweight',
  barbell:         'Barbell',
  dumbbell:        'Dumbbell',
  cable:           'Cable',
  machine:         'Machine',
  kettlebell:      'Kettlebell',
  resistance_band: 'Band',
  cardio_machine:  'Cardio Machine',
  other:           'Other',
}

// ── Difficulty ────────────────────────────────────────────────────────────────

// Tailwind text + bg + border classes
export const DIFFICULTY_COLOR: Record<string, string> = {
  beginner:     'text-green-400 bg-green-500/10 border-green-500/30',
  intermediate: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  advanced:     'text-red-400   bg-red-500/10   border-red-500/30',
}

// Text-only variant (for compact use)
export const DIFFICULTY_TEXT_COLOR: Record<string, string> = {
  beginner:     'text-green-400',
  intermediate: 'text-amber-400',
  advanced:     'text-red-400',
}
