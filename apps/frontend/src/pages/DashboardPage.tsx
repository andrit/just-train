// ------------------------------------------------------------
// pages/DashboardPage.tsx — Action-hub dashboard (Phase 3)
//
// Primary content: TRAIN / PLAN / GOALS / HISTORY / BUILD action cards.
// Secondary content: user-configured KPI widgets + active challenges.
//
// TRAIN card has three states driven by session store + planned sessions API:
//   1. "Start Training"  — no active or planned session
//   2. "Begin: [name]"   — a planned session exists (API: status=planned)
//   3. "Resume: [name]"  — an in-progress session is live (sessionStore)
//
// Trainer-specific widgets (atRisk, activeClients) appear in the widget
// stack below the fold, gated by trainerMode.
// ------------------------------------------------------------

import { useState, useMemo, useEffect } from 'react'
import { useNavigate }                  from 'react-router-dom'
import { usePreferences }               from '@/hooks/usePreferences'
import { useClients, useSelfClient, useClientGoals } from '@/lib/queries/clients'
import { useChallenges }                from '@/lib/queries/challenges'
import { usePlannedSessions }           from '@/lib/queries/sessions'
import { WidgetRenderer }               from '@/components/dashboard/WidgetRenderer'
import { ChallengeProgressCard }        from '@/components/challenges/ChallengeProgressCard'
import { ChallengeForm }                from '@/components/challenges/ChallengeForm'
import { Spinner }                      from '@/components/ui/Spinner'
import { useAuthStore }                 from '@/store/authStore'
import { useSessionStore }              from '@/store/sessionStore'
import { useUXEvent }                   from '@/hooks/useUXEvent'
import { useNav }                       from '@/services/navService'
import type { WidgetId }               from '@/lib/widgets'
import type { ClientGoalResponse }     from '@trainer-app/shared'

// ── Action card sub-components ────────────────────────────────────────────────

interface ActionCardProps {
  label:       string
  description: string
  accent?:     boolean
  onClick:     () => void
}

function ActionCard({ label, description, accent = false, onClick }: ActionCardProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full text-left rounded-lg border px-4 py-3 transition-colors active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        accent
          ? 'bg-command-blue/10 border-command-blue/30 hover:bg-command-blue/15'
          : 'bg-surface-raised border-surface-border hover:border-gray-500',
      ].join(' ')}
    >
      <span className={`block font-display text-sm uppercase tracking-widest ${accent ? 'text-command-blue' : 'text-gray-200'}`}>
        {label}
      </span>
      <span className="block text-xs text-gray-500 mt-0.5">{description}</span>
    </button>
  )
}

// ── TRAIN card — three states ─────────────────────────────────────────────────

interface TrainCardProps {
  selfClientId: string | undefined
  onStart:      () => void
}

function TrainCard({ selfClientId, onStart }: TrainCardProps): React.JSX.Element {
  const navigate = useNavigate()
  const hasSession = useSessionStore((s) => s.hasSession)
  const getSession = useSessionStore((s) => s.getSession)
  const { openSessionLauncher } = useNav()

  const { data: plannedData } = usePlannedSessions(selfClientId)
  const firstPlanned = plannedData?.[0] ?? null

  const activeSession = selfClientId ? getSession(selfClientId) : null
  const isActive      = selfClientId ? hasSession(selfClientId) : false

  if (isActive && activeSession) {
    return (
      <div className="rounded-lg border border-signal-yellow/30 bg-signal-yellow/10 px-4 py-4">
        <p className="font-display text-xs uppercase tracking-widest text-signal-yellow mb-1">Live session</p>
        <p className="text-white text-sm font-medium mb-3 truncate">
          Resume: {activeSession.clientName}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate(`/session/${activeSession.sessionId}`)}
            className="flex-1 rounded-md bg-signal-yellow text-black text-sm font-semibold py-2 hover:bg-signal-yellow/90 transition-colors"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={() => {/* end session will be wired in live session UI */}}
            className="rounded-md border border-signal-yellow/30 text-signal-yellow text-sm px-3 py-2 hover:bg-signal-yellow/10 transition-colors"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  if (firstPlanned) {
    const label = firstPlanned.name ?? 'Planned session'
    return (
      <div className="rounded-lg border border-command-blue/30 bg-command-blue/10 px-4 py-4">
        <p className="font-display text-xs uppercase tracking-widest text-command-blue mb-1">Planned</p>
        <p className="text-white text-sm font-medium mb-3 truncate">
          Begin: {label}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openSessionLauncher(selfClientId)}
            className="flex-1 rounded-md bg-command-blue text-white text-sm font-semibold py-2 hover:bg-command-blue/90 shadow-pressable transition-colors"
          >
            Start
          </button>
          <button
            type="button"
            onClick={onStart}
            className="rounded-md border border-surface-border text-gray-400 text-sm px-3 py-2 hover:bg-surface-raised transition-colors"
            aria-label="Start blank instead"
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => openSessionLauncher(selfClientId)}
      className={[
        'w-full rounded-lg border border-command-blue/30 bg-command-blue/10 px-4 py-5',
        'hover:bg-command-blue/15 active:scale-[0.98] transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue focus-visible:ring-offset-2 focus-visible:ring-offset-black',
      ].join(' ')}
    >
      <span className="block font-display text-base uppercase tracking-widest text-command-blue">
        Train
      </span>
      <span className="block text-xs text-gray-500 mt-0.5">
        Start a session — type inferred from exercises
      </span>
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage(): React.JSX.Element {
  const trainer = useAuthStore((s) => s.trainer)
  const {
    ctaLabel, alertsEnabled, alertColorScheme, alertTone,
    widgetOrder, trainerMode,
  } = usePreferences()
  const { fire } = useUXEvent()
  const { openSessionLauncher, openSessionPlan, goToTab } = useNav()
  const navigate = useNavigate()

  useEffect(() => { fire('page_enter') }, [fire])

  const [alertDismissed, setAlertDismissed] = useState(false)
  const showAlert = alertsEnabled && !alertDismissed

  const { data: clients,    isLoading: clientsLoading } = useClients()
  const { data: selfClient, isLoading: selfLoading     } = useSelfClient()

  const { data: selfGoals } = useClientGoals(selfClient?.id ?? null)
  const selfActiveGoal = selfGoals?.find((g) => g.achievedAt === null) ?? null

  const allGoals: ClientGoalResponse[] = []

  const { data: selfChallenges } = useChallenges(selfClient?.id ?? null, 'active')
  const [challengeFormOpen, setChallengeFormOpen] = useState(false)

  const isLoading = clientsLoading || selfLoading

  const visibleWidgets = useMemo(() => {
    return widgetOrder.filter((id: WidgetId) => {
      if (id === 'atRisk' && !showAlert) return false
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
        <Spinner size="lg" className="text-command-blue" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">

      {/* Greeting */}
      <div className="mb-5 animate-slide-up">
        <p className="text-gray-500 text-sm mb-0.5">{greeting}</p>
        <h1 className="font-display text-3xl md:text-4xl uppercase tracking-wide text-white">
          {trainerMode === 'athlete' ? 'Your Training' : 'Dashboard'}
        </h1>
      </div>

      {/* ── Action hub ── */}
      <div className="space-y-2 mb-6 animate-slide-up" style={{ animationDelay: '50ms' }}>

        {/* TRAIN — primary card, full width */}
        <TrainCard
          selfClientId={selfClient?.id}
          onStart={() => openSessionLauncher(selfClient?.id)}
        />

        {/* Secondary actions — 2 column grid */}
        <div className="grid grid-cols-2 gap-2">
          <ActionCard
            label="Plan"
            description="Schedule a future session"
            onClick={() => openSessionPlan(undefined, selfClient?.id)}
          />
          <ActionCard
            label="Goals"
            description="View and set targets"
            onClick={() => navigate('/my-training')}
          />
          <ActionCard
            label="History"
            description="Past sessions and PRs"
            onClick={() => goToTab('/sessions')}
          />
          <ActionCard
            label="Build"
            description="Create a reusable template"
            onClick={() => goToTab('/templates')}
          />
        </div>
      </div>

      {/* ── KPI widgets (below fold) ── */}
      {visibleWidgets.length > 0 && (
        <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="font-display text-xs uppercase tracking-widest text-gray-600">Your stats</span>
            <div className="flex-1 border-t border-surface-border" />
          </div>
          <div className="space-y-4">
            {visibleWidgets.map((id: WidgetId, i: number) => (
              <div
                key={id}
                className="animate-slide-up"
                style={{ animationDelay: `${100 + i * 50}ms` }}
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
        </div>
      )}

      {/* Active challenges */}
      {selfClient && (selfChallenges?.length ?? 0) > 0 && (
        <div className="mt-6 space-y-3 animate-slide-up" style={{ animationDelay: `${150 + visibleWidgets.length * 50}ms` }}>
          <h2 className="font-display text-lg uppercase tracking-wide text-white">
            Active Challenges
          </h2>
          <div className="space-y-2">
            {(selfChallenges ?? []).map((c) => (
              <ChallengeProgressCard key={c.id} challenge={c} />
            ))}
          </div>
        </div>
      )}

      {selfClient && trainerMode === 'athlete' && (
        <>
          <button
            type="button"
            onClick={() => setChallengeFormOpen(true)}
            className="mt-4 w-full text-center text-sm text-command-blue hover:text-command-blue/80 py-2"
          >
            + Set a challenge
          </button>
          <ChallengeForm
            open={challengeFormOpen}
            onClose={() => setChallengeFormOpen(false)}
            clientId={selfClient.id}
            contextLabel="Set a challenge"
          />
        </>
      )}

    </div>
  )
}
