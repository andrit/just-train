// ------------------------------------------------------------
// lib/mode.ts — the athlete/trainer "mode theme".
//
// Single source for everything that varies by trainerMode: capabilities,
// vocabulary, and mode-specific behaviour flags. A surface that differs by
// mode reads MODE_CONFIG[mode] (via useMode()) instead of scattering
// `trainerMode === 'athlete'` checks — so flipping the mode flips every
// relevant thing at once, and a new label/capability is one edit with both
// variants side by side (mode.test.ts fails if one variant is missing).
//
// `role` (auth: trainer|admin) is a DIFFERENT axis — this file is only about
// `trainerMode` (product UX) and is frontend-only; the backend is shared.
//
// Consumed in v1 (steps 1+2+4): `labels`. The nav / route-guard / client-picker
// migration (steps 3/5/6) consumes `can` + `hidesClientPicker` — declared here
// now so the capability vocabulary is standardized once: the same names feed the
// v3 billing gates and the admin bypass (isGated = tierCheck && role !== 'admin').
// ------------------------------------------------------------

import type { TrainerMode } from '@trainer-app/shared'
import { usePreferences } from '@/hooks/usePreferences'
import { PROGRESSION_STATE_LABEL, PROGRESSION_STATE_LABEL_ATHLETE } from '@/components/clients/utils'

export type Capability = 'viewRoster' | 'manageClients' | 'sendReports' | 'viewBilling'

export interface ModeLabels {
  /** Dashboard page header. */
  dashboardTitle:   string
  /** How the trainer's own self-client is named in lists (e.g. the sessions client filter). */
  selfClientLabel:  string
  /** Progression-state phrasing for surfaces an athlete can see (keyed by ProgressionState). */
  progressionState: Record<string, string>
}

export interface ModeConfig {
  isAthlete: boolean
  isTrainer: boolean
  /** Capability flags. Consumed by the route-guard / client-picker migration (steps 5/6) and the v3 billing gates. */
  can:       Record<Capability, boolean>
  labels:    ModeLabels
  /** Athlete trains only themselves → the client picker is hidden and the self-client is auto-selected. */
  hidesClientPicker: boolean
}

export const MODE_CONFIG: Record<TrainerMode, ModeConfig> = {
  athlete: {
    isAthlete: true,
    isTrainer: false,
    can: { viewRoster: false, manageClients: false, sendReports: false, viewBilling: false },
    labels: {
      dashboardTitle:   'Your Training',
      selfClientLabel:  'My Training',
      progressionState: PROGRESSION_STATE_LABEL_ATHLETE,
    },
    hidesClientPicker: true,
  },
  trainer: {
    isAthlete: false,
    isTrainer: true,
    can: { viewRoster: true, manageClients: true, sendReports: true, viewBilling: true },
    labels: {
      dashboardTitle:   'Dashboard',
      selfClientLabel:  'Me',
      progressionState: PROGRESSION_STATE_LABEL,
    },
    hidesClientPicker: false,
  },
}

/** The active mode theme, derived from the trainer's `trainerMode`. */
export function useMode(): ModeConfig {
  const { trainerMode } = usePreferences()
  return MODE_CONFIG[trainerMode] ?? MODE_CONFIG.trainer
}
