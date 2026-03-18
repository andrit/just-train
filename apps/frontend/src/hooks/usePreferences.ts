// ------------------------------------------------------------
// hooks/usePreferences.ts — Trainer preference values (Phase 4)
//
// Reads preference fields from authStore and exposes them
// with sensible defaults so components never have to guard
// against null or unknown values.
//
// Also exposes updatePreference() for one-field updates so
// components don't need to import apiClient directly.
//
// USAGE:
//   const { ctaLabel, alertsEnabled, widgetOrder } = usePreferences()
//   const { updatePreference } = usePreferences()
//   updatePreference('ctaLabel', 'Just Do It')
// ------------------------------------------------------------

import { useCallback }          from 'react'
import { useAuthStore }         from '@/store/authStore'
import { apiClient }            from '@/lib/api'
import {
  parseWidgetProgression,
  serializeWidgetProgression,
  type WidgetId,
} from '@/lib/widgets'
import type { TrainerResponse } from '@trainer-app/shared'

export interface Preferences {
  ctaLabel:            string
  alertsEnabled:       boolean
  alertColorScheme:    'amber' | 'red' | 'blue' | 'green'
  alertTone:           'clinical' | 'motivating' | 'firm'
  sessionLayout:       'horizontal' | 'vertical'
  weeklySessionTarget: number
  show1rmEstimate:     boolean
  autoReportEnabled:   boolean
  timezone:            string
  widgetOrder:         WidgetId[]
  trainerMode:         'athlete' | 'trainer'
}

export function usePreferences(): Preferences & {
  updatePreference: <K extends keyof UpdateablePrefs>(key: K, value: UpdateablePrefs[K]) => Promise<void>
  updateWidgetOrder: (order: WidgetId[]) => Promise<void>
} {
  const trainer    = useAuthStore((s) => s.trainer)
  const setTrainer = useAuthStore((s) => s.setTrainer)

  const mode = (trainer?.trainerMode ?? 'trainer') as 'athlete' | 'trainer'

  const preferences: Preferences = {
    ctaLabel:            trainer?.ctaLabel         ?? 'Start Training',
    alertsEnabled:       trainer?.alertsEnabled     ?? true,
    alertColorScheme:    (trainer?.alertColorScheme as Preferences['alertColorScheme']) ?? 'amber',
    alertTone:           (trainer?.alertTone        as Preferences['alertTone'])        ?? 'clinical',
    sessionLayout:       (trainer?.sessionLayout    as Preferences['sessionLayout'])    ?? 'horizontal',
    weeklySessionTarget: trainer?.weeklySessionTarget ?? 3,
    show1rmEstimate:     trainer?.show1rmEstimate    ?? false,
    autoReportEnabled:   trainer?.autoReportEnabled  ?? true,
    timezone:            trainer?.timezone            ?? 'UTC',
    widgetOrder:         parseWidgetProgression(trainer?.widgetProgression, mode),
    trainerMode:         mode,
  }

  const updatePreference = useCallback(async <K extends keyof UpdateablePrefs>(
    key:   K,
    value: UpdateablePrefs[K],
  ): Promise<void> => {
    const updated = await apiClient.patch<TrainerResponse>('/auth/me', { [key]: value })
    setTrainer(updated)
  }, [setTrainer])

  const updateWidgetOrder = useCallback(async (order: WidgetId[]): Promise<void> => {
    const serialized = serializeWidgetProgression(order)
    const updated = await apiClient.patch<TrainerResponse>('/auth/me', {
      widgetProgression: serialized,
    })
    setTrainer(updated)
  }, [setTrainer])

  return { ...preferences, updatePreference, updateWidgetOrder }
}

// Fields that can be updated via updatePreference()
interface UpdateablePrefs {
  ctaLabel:            string
  alertsEnabled:       boolean
  alertColorScheme:    'amber' | 'red' | 'blue' | 'green'
  alertTone:           'clinical' | 'motivating' | 'firm'
  sessionLayout:       'horizontal' | 'vertical'
  weeklySessionTarget: number
  show1rmEstimate:     boolean
  autoReportEnabled:   boolean
  timezone:            string
  widgetProgression:   string | null
}
