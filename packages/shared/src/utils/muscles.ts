// ------------------------------------------------------------
// utils/muscles.ts — muscle taxonomy helpers (domain, backend + frontend).
//
// Maps the 34 anatomical muscles (MuscleEnum) up to the 7 coarse BodyParts
// (for grouping, validation, and reverse display) and to human-readable
// labels. The muscle→SVG-region map is a rendering concern and lives with
// the MuscleMap component in the frontend, not here.
// ------------------------------------------------------------

import type { Muscle, BodyPart } from '../enums/index'

// Which coarse body part each muscle belongs to. Neck has no BodyPart of its
// own in this app, so sternocleidomastoid is grouped under 'back' (cervical).
export const MUSCLE_BODY_PART: Record<Muscle, BodyPart> = {
  deltoid_anterior:    'shoulders',
  deltoid_lateral:     'shoulders',
  deltoid_posterior:   'shoulders',
  rotator_cuff:        'shoulders',
  pectoralis_major:    'chest',
  pectoralis_minor:    'chest',
  serratus_anterior:   'chest',
  latissimus_dorsi:    'back',
  trapezius_upper:     'back',
  trapezius_middle:    'back',
  trapezius_lower:     'back',
  rhomboids:           'back',
  teres_major:         'back',
  erector_spinae:      'back',
  biceps_brachii:      'arms',
  brachialis:          'arms',
  triceps_brachii:     'arms',
  brachioradialis:     'arms',
  forearm_flexors:     'arms',
  forearm_extensors:   'arms',
  rectus_abdominis:    'core',
  obliques:            'core',
  transverse_abdominis:'core',
  gluteus_maximus:     'legs',
  gluteus_medius:      'legs',
  hip_flexors:         'legs',
  hip_adductors:       'legs',
  hip_abductors:       'legs',
  quadriceps:          'legs',
  hamstrings:          'legs',
  gastrocnemius:       'legs',
  soleus:              'legs',
  tibialis_anterior:   'legs',
  sternocleidomastoid: 'back',
}

// Human-readable gym labels (shown under the muscle map, in reports, etc.).
export const MUSCLE_LABEL: Record<Muscle, string> = {
  deltoid_anterior:    'Front Delts',
  deltoid_lateral:     'Side Delts',
  deltoid_posterior:   'Rear Delts',
  rotator_cuff:        'Rotator Cuff',
  pectoralis_major:    'Chest',
  pectoralis_minor:    'Pec Minor',
  serratus_anterior:   'Serratus',
  latissimus_dorsi:    'Lats',
  trapezius_upper:     'Upper Traps',
  trapezius_middle:    'Mid Traps',
  trapezius_lower:     'Lower Traps',
  rhomboids:           'Rhomboids',
  teres_major:         'Teres Major',
  erector_spinae:      'Spinal Erectors',
  biceps_brachii:      'Biceps',
  brachialis:          'Brachialis',
  triceps_brachii:     'Triceps',
  brachioradialis:     'Brachioradialis',
  forearm_flexors:     'Forearm Flexors',
  forearm_extensors:   'Forearm Extensors',
  rectus_abdominis:    'Abs',
  obliques:            'Obliques',
  transverse_abdominis:'Transverse Abs',
  gluteus_maximus:     'Glute Max',
  gluteus_medius:      'Glute Med',
  hip_flexors:         'Hip Flexors',
  hip_adductors:       'Adductors',
  hip_abductors:       'Abductors',
  quadriceps:          'Quads',
  hamstrings:          'Hamstrings',
  gastrocnemius:       'Calves (Gastroc)',
  soleus:              'Soleus',
  tibialis_anterior:   'Tibialis Ant.',
  sternocleidomastoid: 'Neck',
}

export function muscleLabel(m: Muscle): string {
  return MUSCLE_LABEL[m] ?? m
}
