// ------------------------------------------------------------
// components/exercises/utils.ts — Shared helpers for exercise UI
// ------------------------------------------------------------

/**
 * Transforms a Cloudinary URL to a 400×300 thumbnail by inserting
 * transformation parameters into the upload path segment.
 *
 * Input:  https://res.cloudinary.com/<cloud>/image/upload/<public_id>
 * Output: https://res.cloudinary.com/<cloud>/image/upload/c_fill,h_300,w_400,f_webp,q_auto/<public_id>
 */
export function getThumbnailUrl(cloudinaryUrl: string): string {
  return cloudinaryUrl.replace(
    '/upload/',
    '/upload/c_fill,h_300,w_400,f_webp,q_auto/',
  )
}

export const WORKOUT_TYPE_OPTIONS = [
  { value: 'cardio',       label: 'Cardio' },
  { value: 'stretching',   label: 'Stretching' },
  { value: 'calisthenics', label: 'Calisthenics' },
  { value: 'resistance',   label: 'Resistance' },
  { value: 'cooldown',     label: 'Cooldown' },
]

export const EQUIPMENT_OPTIONS = [
  { value: 'none',             label: 'None / Bodyweight' },
  { value: 'bodyweight',       label: 'Bodyweight' },
  { value: 'barbell',          label: 'Barbell' },
  { value: 'dumbbell',         label: 'Dumbbell' },
  { value: 'cable',            label: 'Cable' },
  { value: 'machine',          label: 'Machine' },
  { value: 'kettlebell',       label: 'Kettlebell' },
  { value: 'resistance_band',  label: 'Resistance Band' },
  { value: 'cardio_machine',   label: 'Cardio Machine' },
  { value: 'other',            label: 'Other' },
]

export const DIFFICULTY_OPTIONS = [
  { value: 'beginner',     label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced',     label: 'Advanced' },
]
