// ------------------------------------------------------------
// components/session/SessionCloseout.tsx
//
// The single end-of-session window. Replaces the old two-step flow
// (EndSessionModal for scores → PostSessionWrapUp for the name), which
// required ending the session twice to reach the name field.
//
// Order, top to bottom: session name → what you did → how you felt.
// Nothing is written until the user taps Finish — the session stays
// in_progress until then, so abandoning this window leaves something
// resumable rather than a closed record with no name and no scores.
// ------------------------------------------------------------

import { useState }                            from 'react'
import { cn }                                  from '@/lib/cn'
import { interactions }                        from '@/lib/interactions'
import { Spinner }                             from '@/components/ui/Spinner'
import { Modal }                               from '@/components/ui/Modal'
import { Button }                              from '@/components/ui/Button'
import { useChallenges }                       from '@/lib/queries/challenges'
import { resolveNameTokens, defaultSessionName } from '@/lib/sessionName'
import { HintPopover }                         from '@/components/ui/HintPopover'
import type { SessionDetailResponse }          from '@trainer-app/shared'
import { setVolume }                            from '@trainer-app/shared'

export interface SessionCloseoutData {
  name?:         string
  energyLevel:   number
  mobilityFeel:  number
  stressLevel:   number
  sessionNotes?: string
}

interface SessionCloseoutProps {
  open:       boolean
  session:    SessionDetailResponse
  onConfirm:  (data: SessionCloseoutData) => void
  onCancel:   () => void
  onDiscard?: () => void   // offered when the session has no logged sets
  loading:    boolean
  hasWork:    boolean      // true if at least one set was logged
}

export function SessionCloseout({
  open, session, onConfirm, onCancel, onDiscard, loading, hasWork,
}: SessionCloseoutProps): React.JSX.Element | null {
  const [name,     setName]     = useState(session.name ?? '')
  const [energy,   setEnergy]   = useState(7)
  const [mobility, setMobility] = useState(7)
  const [stress,   setStress]   = useState(5)
  const [notes,    setNotes]    = useState('')

  const { data: activeChallenges } = useChallenges(session.clientId, 'active')

  const handleConfirm = (): void => {
    onConfirm({
      name:         name.trim() || undefined,
      energyLevel:  energy,
      mobilityFeel: mobility,
      stressLevel:  stress,
      sessionNotes: notes.trim() || undefined,
    })
  }

  if (!open) return null

  // Empty session — nothing to celebrate or name, so offer the old choice.
  if (!hasWork) {
    return (
      <Modal open={open} onClose={onCancel} title="No work logged">
        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-400">
            No sets were logged in this session. You can discard it (no record kept) or end it anyway.
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={loading} className="flex-1">
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={onDiscard} disabled={loading || !onDiscard} className="flex-1">
              Discard
            </Button>
            <Button type="button" variant="secondary" onClick={handleConfirm} loading={loading} className="flex-1">
              End Anyway
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const allExercises = session.sessionExercises ?? []
  const allSets      = allExercises.flatMap(se => se.sets)

  const totalSets     = allSets.length
  const totalVolume   = allSets.reduce((sum, s) => sum + setVolume(s), 0)
  const prCount       = allSets.filter(s => s.isLoadRecord || s.isVolumeRecord).length
  const exercisesDone = allExercises.filter(se => se.sets.length > 0).length

  // endTime is not set yet — the session is still in_progress until Finish — so
  // measure against now rather than showing nothing.
  const durationMin = session.startTime
    ? Math.round((new Date(session.endTime ?? Date.now()).getTime() - new Date(session.startTime).getTime()) / 60000)
    : null

  return (
    <div className="fixed inset-0 z-[55] flex items-end bg-black/70 backdrop-blur-sm">
      <div className="w-full max-h-[92vh] overflow-y-auto overscroll-contain bg-brand-secondary rounded-t-3xl border-t border-surface-border p-6 pb-sheet-bottom space-y-6">

        {/* Header — the work is done and worth marking; the record is saved on Finish. */}
        <div className="text-center">
          <p className="text-4xl mb-2" aria-hidden>🏆</p>
          <h2 className="text-xl font-display font-bold text-white">Nice work</h2>
          {durationMin != null && (
            <p className="text-sm text-gray-500 mt-1">{durationMin} minutes</p>
          )}
        </div>

        {/* Session name — first, so the results read as a summary of what you are naming */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">
            Session name <span className="text-gray-700 normal-case">(optional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Push Day, Leg Day - {date}…"
            className="w-full bg-brand-primary border border-surface-border rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-command-blue/50"
          />
          {/* Always show what will be stored — including the date-stamped default
              for an empty field, so it is a visible choice rather than a surprise
              discovered later in history. */}
          <div className="relative mt-2 pr-5">
            <p className="text-[11px] text-gray-500">
              Saves as{' '}
              <span className="text-gray-300 font-medium">
                {name.trim() !== ''
                  ? resolveNameTokens(name, { date: session.date })
                  : defaultSessionName(session.date)}
              </span>
            </p>
            <HintPopover
              className="absolute top-0 right-0"
              side="bottom"
              text="Leave this blank and the session is named for its date. Use {date} anywhere in your own name to insert it — “Leg Day - {date}” becomes “Leg Day - Jul-28-26”. Swipe this hint away to dismiss."
            />
          </div>
        </div>

        {/* What you did */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Exercises" value={String(exercisesDone)} />
          <StatCard label="Sets logged" value={String(totalSets)} />
          {totalVolume > 0 && (
            <StatCard
              label="Total volume"
              value={`${totalVolume >= 1000
                ? `${(totalVolume / 1000).toFixed(1)}k`
                : String(Math.round(totalVolume))
              }`}
              unit={allExercises[0]?.targetWeightUnit ?? 'lbs'}
            />
          )}
          {prCount > 0 && <StatCard label="New PRs" value={String(prCount)} highlight />}
        </div>

        {prCount > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-400 font-medium mb-1.5">Personal records</p>
            <div className="space-y-1">
              {allExercises
                .filter(se => se.sets.some(s => s.isLoadRecord || s.isVolumeRecord))
                .map(se => (
                  <p key={se.id} className="text-sm text-amber-300">
                    {se.exercise?.name ?? 'Exercise'} — new {se.sets.some(s => s.isLoadRecord) ? 'load' : 'volume'} PR
                  </p>
                ))}
            </div>
          </div>
        )}

        {activeChallenges && activeChallenges.length > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-400 font-medium mb-1.5">Challenge progress</p>
            <div className="space-y-2">
              {activeChallenges.map(c => {
                const pct = c.targetValue > 0 ? Math.min(100, Math.round((c.currentValue / c.targetValue) * 100)) : 0
                return (
                  <div key={c.id}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-blue-300 truncate mr-2">{c.title}</p>
                      <span className="text-xs text-blue-400 font-mono shrink-0">
                        {c.currentValue} / {c.targetValue}{c.targetUnit ? ` ${c.targetUnit}` : ''}
                      </span>
                    </div>
                    <div className="h-1.5 bg-blue-900/50 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* How you felt + note */}
        <div className="space-y-5 pt-2 border-t border-surface-border/60">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">How you felt</p>
            <p className="text-[11px] text-gray-600 mt-0.5">
              Tracked over time, these tell the whole story.
            </p>
          </div>

          <SliderRow label="Energy"   hint="How energised did you feel?"    value={energy}   onChange={setEnergy}   lowLabel="Exhausted" highLabel="Full energy" />
          <SliderRow label="Mobility" hint="How did your body feel moving?" value={mobility} onChange={setMobility} lowLabel="Very stiff" highLabel="Full range" />
          <SliderRow label="Stress"   hint="General stress level today"     value={stress}   onChange={setStress}   lowLabel="Calm"      highLabel="Very stressed" />

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">
              Session note <span className="text-gray-700">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth noting…"
              rows={2}
              className="w-full field resize-none text-sm"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading} className="flex-1">
            Cancel
          </Button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              'flex-[2] py-4 rounded-2xl font-semibold text-white bg-command-blue',
              interactions.button.base,
              interactions.button.press,
              loading && 'opacity-60',
            )}
          >
            {loading ? <Spinner size="sm" /> : 'Finish session'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SliderRow({ label, hint, value, onChange, lowLabel, highLabel }: {
  label: string; hint: string; value: number
  onChange: (v: number) => void
  lowLabel: string; highLabel: string
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-200">{label}</p>
          <p className="text-xs text-gray-600">{hint}</p>
        </div>
        <span className="font-mono text-2xl font-bold text-white w-8 text-right">{value}</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer
          bg-surface-border
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-5
          [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-command-blue
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:shadow-md"
        aria-label={`${label}: ${value} out of 10`}
      />
      <div className="flex justify-between text-[10px] text-gray-700 uppercase tracking-wider">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )
}

function StatCard({ label, value, unit, highlight }: {
  label: string; value: string; unit?: string; highlight?: boolean
}): React.JSX.Element {
  return (
    <div className={cn(
      'rounded-xl border p-3 text-center',
      highlight ? 'bg-amber-500/10 border-amber-500/30' : 'bg-brand-primary border-surface-border',
    )}>
      <p className={cn('text-2xl font-bold font-mono', highlight ? 'text-amber-400' : 'text-white')}>
        {value}
        {unit && <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>}
      </p>
      <p className={cn('text-xs mt-0.5', highlight ? 'text-amber-500' : 'text-gray-500')}>{label}</p>
    </div>
  )
}
