// ------------------------------------------------------------
// pages/SessionSummaryPage.tsx — /session/:id/summary (v1.5.0)
//
// Shown after a session is ended.
// Displays: session stats, sets logged, subjective scores, client link.
// The "well done" moment — should feel like a completion screen.
// ------------------------------------------------------------

import { useParams, useNavigate, Link } from 'react-router-dom'
import { cn }                            from '@/lib/cn'
import { interactions }                  from '@/lib/interactions'
import { useSession }                    from '@/lib/queries/sessions'
import { Spinner }                       from '@/components/ui/Spinner'

function ScoreBar({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="font-mono text-gray-300">{value}/10</span>
      </div>
      <div className="h-1.5 bg-surface-border rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-highlight rounded-full transition-all duration-700"
          style={{ width: `${value * 10}%` }}
        />
      </div>
    </div>
  )
}

export default function SessionSummaryPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: session, isLoading } = useSession(id ?? null)

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" className="text-brand-highlight" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Session not found.</p>
        <button type="button" onClick={() => navigate('/')} className="mt-4 text-sm text-brand-highlight hover:underline">
          Go home
        </button>
      </div>
    )
  }

  // Compute stats from the session tree
  const workouts   = session.workouts ?? []
  const totalSets  = workouts.reduce(
    (acc, w) => acc + w.sessionExercises.reduce((a, se) => a + se.sets.length, 0), 0
  )
  const totalReps  = workouts.reduce(
    (acc, w) => acc + w.sessionExercises.reduce(
      (a, se) => a + se.sets.reduce((s, set) => s + (set.reps ?? 0), 0), 0
    ), 0
  )
  const totalVolume = workouts.reduce(
    (acc, w) => acc + w.sessionExercises.reduce(
      (a, se) => a + se.sets.reduce(
        (s, set) => s + ((set.weight ?? 0) * (set.reps ?? 0)), 0
      ), 0
    ), 0
  )

  const durationMin = session.startTime && session.endTime
    ? Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000)
    : null

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto pb-24">

      {/* Completion header */}
      <div className="text-center py-8 animate-slide-up">
        <div className="text-5xl mb-4" aria-hidden>🏆</div>
        <h1 className="font-display text-4xl uppercase tracking-wide text-white mb-2">
          Session Done
        </h1>
        <p className="text-gray-500 text-sm">
          {session.client?.name ?? 'Session'} · {session.date}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Sets',    value: String(totalSets)                        },
          { label: 'Reps',    value: String(totalReps)                        },
          { label: 'Volume',  value: totalVolume > 0 ? `${Math.round(totalVolume).toLocaleString()}` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="card p-3 text-center">
            <p className="font-mono text-2xl font-bold text-white">{value}</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-600 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {durationMin != null && (
        <div className="card p-3 text-center mb-6">
          <p className="text-sm text-gray-400">
            Duration: <span className="font-mono text-white">{durationMin} min</span>
          </p>
        </div>
      )}

      {/* Subjective scores */}
      {(session.energyLevel || session.mobilityFeel || session.stressLevel) && (
        <div className="card p-4 mb-6">
          <h3 className="section-label">How you felt</h3>
          <div className="space-y-3">
            {session.energyLevel  != null && <ScoreBar label="Energy"   value={session.energyLevel}  />}
            {session.mobilityFeel != null && <ScoreBar label="Mobility" value={session.mobilityFeel} />}
            {session.stressLevel  != null && <ScoreBar label="Stress"   value={session.stressLevel}  />}
          </div>
        </div>
      )}

      {/* Session notes */}
      {session.sessionNotes && (
        <div className="card p-4 mb-6">
          <h3 className="section-label">Notes</h3>
          <p className="text-sm text-gray-300 leading-relaxed">{session.sessionNotes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        {session.client && (
          <Link
            to={`/clients/${session.clientId}`}
            className={cn(
              'block w-full py-3 rounded-xl text-center text-sm font-medium',
              'bg-surface border border-surface-border text-gray-300',
              'hover:border-brand-highlight/30 hover:text-white',
              interactions.button.base,
              interactions.button.hover,
              interactions.button.press,
            )}
          >
            View {session.client.name}'s Profile
          </Link>
        )}

        <button
          type="button"
          onClick={() => navigate('/')}
          className={cn(
            'w-full py-3 rounded-xl text-sm font-medium',
            'bg-brand-highlight text-white',
            interactions.button.base,
            interactions.fab.hover,
            interactions.button.press,
          )}
        >
          Back to Dashboard
        </button>
      </div>

    </div>
  )
}
