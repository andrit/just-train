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

import type { BadgeVariant } from '@/components/ui/Badge'

// ── Workout type ──────────────────────────────────────────────────────────────

export const WORKOUT_TYPE_LABEL: Record<string, string> = {
  cardio:       'Cardio',
  stretching:   'Stretching',
  calisthenics: 'Calisthenics',
  resistance:   'Resistance',
  cooldown:     'Cooldown',
}

export const WORKOUT_TYPE_BADGE_VARIANT: Record<string, BadgeVariant> = {
  cardio:       'info',
  stretching:   'success',
  calisthenics: 'warning',
  resistance:   'danger',
  cooldown:     'default',
}

// Tailwind color strings for filter chips and inline labels
export const WORKOUT_TYPE_COLOR: Record<string, string> = {
  cardio:       'text-sky-400   border-sky-500/60',
  stretching:   'text-violet-400 border-violet-500/60',
  calisthenics: 'text-emerald-400 border-emerald-500/60',
  resistance:   'text-brand-highlight border-brand-highlight/60',
  cooldown:     'text-gray-400  border-gray-500/60',
}

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
