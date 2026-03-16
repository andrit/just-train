// ------------------------------------------------------------
// pages/DashboardPage.tsx — Main dashboard (Phase 4)
//
// Branches on trainerMode from preferences:
//   athlete  → personal training focus, CTA front and center
//   trainer  → roster overview, at-risk alert, client stats
//
// Widgets are ordered by trainer.widgetProgression (preference).
// The at-risk alert is dismissable per session — state stored in
// component memory, resets on next app open (as designed).
//
// Phase 5: session launcher replaces the placeholder CTA behavior.
// Phase 7: volume, streak, newClients widgets become available.
// ------------------------------------------------------------

import { useState, useMemo, useEffect } from 'react'
import { usePreferences }       from '@/hooks/usePreferences'
import { useClients, useSelfClient, useClientGoals } from '@/lib/queries/clients'
import { WidgetRenderer }       from '@/components/dashboard/WidgetRenderer'
import { Spinner }              from '@/components/ui/Spinner'
import { useAuthStore }         from '@/store/authStore'
import { useUXEvent }           from '@/hooks/useUXEvent'
import { cn }                   from '@/lib/cn'
import type { WidgetId }        from '@/lib/widgets'
import type { ClientGoalResponse } from '@trainer-app/shared'

export default function DashboardPage(): React.JSX.Element {
  const trainer    = useAuthStore((s) => s.trainer)
  const {
    ctaLabel, alertsEnabled, alertColorScheme, alertTone,
    widgetOrder, trainerMode,
  } = usePreferences()
  const { fire } = useUXEvent()

  // Fire page_enter once on mount
  useEffect(() => { fire('page_enter') }, [fire])

  // Dismissal state — resets on every app open (by design, stored in memory)
  const [alertDismissed, setAlertDismissed] = useState(false)
  const showAlert = alertsEnabled && !alertDismissed

  // Data
  const { data: clients,    isLoading: clientsLoading } = useClients()
  const { data: selfClient, isLoading: selfLoading     } = useSelfClient()

  // Fetch goals for self-client (used in SelfTrainingWidget)
  const { data: selfGoals } = useClientGoals(selfClient?.id ?? null)
  const selfActiveGoal = selfGoals?.find((g) => g.achievedAt === null) ?? null

  // Fetch goals for all clients (used in GoalsWidget — trainer mode)
  // We aggregate goals from the client list for the goals count
  // Phase 7: this will be a dedicated aggregate endpoint
  const allGoals: ClientGoalResponse[] = [] // placeholder until Phase 7 aggregate

  const isLoading = clientsLoading || selfLoading

  // The widget order, filtering out 'atRisk' if alert is dismissed or disabled
  const visibleWidgets = useMemo(() => {
    return widgetOrder.filter((id: WidgetId) => {
      if (id === 'atRisk' && !showAlert) return false
      // athlete mode: hide trainer-only widgets
      if (trainerMode === 'athlete' && ['atRisk', 'activeClients', 'newClients'].includes(id)) return false
      return true
    })
  }, [widgetOrder, showAlert, trainerMode])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    const name = trainer?.name?.split(' ')[0] ?? ''
    if (hour < 12) return `Good morning${name ? `, ${name}` : ''}`
    if (hour < 17) return `Good afternoon${name ? `, ${name}` : ''}`
    return `Good evening${name ? `, ${name}` : ''}`
  }, [trainer?.name])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner size="lg" className="text-brand-highlight" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">

      {/* Greeting header */}
      <div className="mb-6 animate-slide-up">
        <p className="text-gray-500 text-sm mb-0.5">{greeting}</p>
        <h1 className="font-display text-3xl md:text-4xl uppercase tracking-wide text-white">
          {trainerMode === 'athlete' ? 'Your Training' : 'Dashboard'}
        </h1>
      </div>

      {/* Widget stack */}
      <div className="space-y-4">
        {visibleWidgets.map((id: WidgetId, i: number) => (
          <div
            key={id}
            className="animate-slide-up"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <WidgetRenderer
              id={id}
              clients={clients ?? []}
              selfClient={selfClient ?? null}
              activeGoal={selfActiveGoal}
              goals={allGoals}
              ctaLabel={ctaLabel}
              alertColorScheme={alertColorScheme}
              alertTone={alertTone}
              onDismissAlert={() => setAlertDismissed(true)}
            />
          </div>
        ))}
      </div>

      {/* Empty state — should never happen but good to have */}
      {visibleWidgets.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-600 text-sm">
            Your dashboard is empty.{' '}
            <button
              type="button"
              className="text-brand-highlight hover:underline"
              onClick={() => {/* Phase 4.5: open preferences */}}
            >
              Customize widgets
            </button>
          </p>
        </div>
      )}

    </div>
  )
}
