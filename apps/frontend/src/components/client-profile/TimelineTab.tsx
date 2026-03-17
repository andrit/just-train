// ------------------------------------------------------------
// components/client-profile/TimelineTab.tsx (v1.6.1)
//
// Unified chronological timeline of sessions, goals, snapshots.
// Color-coded dots per event type — designed for future filter.
// Tapping a session navigates to /session/:id/history with
// exact scroll restoration on back.
// ------------------------------------------------------------

import { useNavigate }           from 'react-router-dom'
import { cn }                    from '@/lib/cn'
import { useScrollRestoration }  from '@/hooks/useScrollRestoration'
import { useClientGoals, useClientSnapshots } from '@/lib/queries/clients'
import { useSessions }           from '@/lib/queries/sessions'
import { Spinner }               from '@/components/ui/Spinner'

interface TimelineTabProps {
  clientId:   string
  clientName: string
}

export function TimelineTab({ clientId, clientName }: TimelineTabProps): React.JSX.Element {
  const navigate = useNavigate()
  const { data: goals,     isLoading: goalsLoading }     = useClientGoals(clientId)
  const { data: snapshots, isLoading: snapshotsLoading } = useClientSnapshots(clientId)
  const { data: sessions,  isLoading: sessionsLoading }  = useSessions({ clientId })
  const { saveScroll } = useScrollRestoration(`client-profile-${clientId}`)

  const isLoading = goalsLoading || snapshotsLoading || sessionsLoading

  if (isLoading) {
    return (
      <div className="flex justify-center py-12" role="tabpanel" id="panel-timeline" aria-labelledby="tab-timeline">
        <Spinner size="md" className="text-brand-highlight" />
      </div>
    )
  }

  type TimelineEvent =
    | { type: 'session';  date: Date; session:  NonNullable<typeof sessions>[0] }
    | { type: 'goal';     date: Date; goal:     NonNullable<typeof goals>[0] }
    | { type: 'snapshot'; date: Date; snapshot: NonNullable<typeof snapshots>[0] }

  const events: TimelineEvent[] = [
    ...(sessions?.map((s) => ({ type: 'session'  as const, date: new Date(s.date + 'T00:00:00'), session: s }))  ?? []),
    ...(goals?.map((g)    => ({ type: 'goal'     as const, date: new Date(g.setAt),              goal: g }))     ?? []),
    ...(snapshots?.map((s) => ({ type: 'snapshot' as const, date: new Date(s.capturedAt),         snapshot: s })) ?? []),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  if (events.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 text-sm" role="tabpanel" id="panel-timeline" aria-labelledby="tab-timeline">
        <p className="text-2xl mb-3" aria-hidden>📅</p>
        <p>No timeline events yet.</p>
        <p className="text-xs text-gray-600 mt-1">Sessions, goals and snapshots will appear here.</p>
      </div>
    )
  }

  // Dot color per event type — data-type attribute ready for future filter
  const DOT_BORDER: Record<TimelineEvent['type'], string> = {
    session:  'border-brand-highlight',
    goal:     'border-emerald-500',
    snapshot: 'border-sky-500',
  }
  const DOT_INNER: Record<TimelineEvent['type'], string> = {
    session:  'bg-brand-highlight',
    goal:     'bg-emerald-500',
    snapshot: 'bg-sky-500',
  }

  const handleSessionTap = (sessionId: string): void => {
    saveScroll()
    navigate(`/session/${sessionId}/history`, {
      state: {
        from:       `/clients/${clientId}`,
        scrollKey:  `client-profile-${clientId}`,
        clientName,
        returnTab:  'timeline',
      },
    })
  }

  return (
    <div className="relative" role="tabpanel" id="panel-timeline" aria-labelledby="tab-timeline">
      <div className="absolute left-[19px] top-2 bottom-2 w-px bg-surface-border" aria-hidden />

      <div className="space-y-4 pl-10">
        {events.map((event, i) => (
          <div
            key={i}
            className="relative animate-slide-up"
            style={{ animationDelay: `${i * 30}ms` }}
            data-type={event.type}
          >
            {/* Dot */}
            <div
              className={cn(
                'absolute -left-[29px] top-1 w-4 h-4 rounded-full border-2 bg-brand-primary flex items-center justify-center',
                DOT_BORDER[event.type],
              )}
              aria-hidden
            >
              <div className={cn('w-1.5 h-1.5 rounded-full', DOT_INNER[event.type])} />
            </div>

            {/* Date */}
            <p className="text-[10px] text-gray-600 mb-0.5 uppercase tracking-wider">
              {event.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>

            {/* Content */}
            {event.type === 'session' ? (
              <button
                type="button"
                onClick={() => handleSessionTap(event.session.id)}
                className={cn(
                  'w-full card p-3 text-left',
                  'hover:border-brand-highlight/30 hover:bg-brand-highlight/5',
                  'transition-all duration-150 active:scale-[0.99]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs text-brand-highlight uppercase tracking-wider mb-1">
                    {event.session.status === 'completed' ? 'Session' : event.session.status}
                  </p>
                  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-gray-600">
                    <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-sm text-gray-200 font-medium">
                  {event.session.name ?? 'Training Session'}
                </p>
                {event.session.energyLevel != null && (
                  <p className="text-xs text-gray-500 mt-1">Energy {event.session.energyLevel}/10</p>
                )}
              </button>
            ) : event.type === 'goal' ? (
              <div className="card p-3">
                <p className="text-xs text-emerald-400 uppercase tracking-wider mb-1">
                  {event.goal.achievedAt ? '✓ Goal Achieved' : 'Goal Set'}
                </p>
                <p className="text-sm text-gray-300">{event.goal.goal}</p>
              </div>
            ) : (
              <div className="card p-3">
                <p className="text-xs text-sky-400 uppercase tracking-wider mb-1">Snapshot</p>
                <div className="flex gap-4 text-sm text-gray-400">
                  {event.snapshot.weightLbs     && <span>{event.snapshot.weightLbs} lbs</span>}
                  {event.snapshot.energyLevel   && <span>Energy {event.snapshot.energyLevel}/10</span>}
                  {event.snapshot.selfImageScore && <span>Self-image {event.snapshot.selfImageScore}/10</span>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
