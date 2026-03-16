// ------------------------------------------------------------
// pages/ClientProfilePage.tsx — Client profile (Phase 4)
//
// Three tabs:
//   Overview  — current goal, focus, progression state, quick stats
//   Timeline  — phase transitions, goals, snapshots, session dots
//   Baseline  — snapshot history, "Take Snapshot" entry point
//
// Tab incomplete indicators:
//   Overview  — dot if primaryFocus or startDate missing
//   Baseline  — dot if no snapshots exist
//
// The Edit Client button (top right) opens the ClientDrawer
// in edit mode, pre-filled with this client's data.
// ------------------------------------------------------------

import { useState }              from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { cn }                     from '@/lib/cn'
import { interactions }           from '@/lib/interactions'
import { useUXEvent, useUXEventRef } from '@/hooks/useUXEvent'
import {
  useClient, useClientGoals, useClientSnapshots, useLatestSnapshot,
  useCreateGoal, useUpdateGoal, useDeleteGoal,
} from '@/lib/queries/clients'
import { SilhouetteAvatar }       from '@/components/clients/SilhouetteAvatar'
import { ClientDrawer }           from '@/components/clients/ClientDrawer'
import { Spinner }                from '@/components/ui/Spinner'
import { Button }                 from '@/components/ui/Button'
import { Input }                  from '@/components/ui/Input'
import { ConfirmDialog }          from '@/components/ui/ConfirmDialog'
import { cn as cx }               from '@/lib/cn'
import {
  PROGRESSION_STATE_LABEL,
  PROGRESSION_STATE_COLOR,
  FOCUS_LABEL,
  FOCUS_ICON,
  lastSessionLabel,
  isAtRisk,
  isOverviewIncomplete,
  isBaselineIncomplete,
  hasNoActiveGoals,
} from '@/components/clients/utils'
import type { ClientGoalResponse } from '@trainer-app/shared'

// ── Tab types ─────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'timeline' | 'baseline'

// ── Tab button ────────────────────────────────────────────────────────────────

interface TabButtonProps {
  id:          Tab
  label:       string
  active:      boolean
  incomplete?: boolean
  onClick:     () => void
}

function TabButton({ id, label, active, incomplete, onClick }: TabButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      id={`tab-${id}`}
      aria-controls={`panel-${id}`}
      onClick={onClick}
      className={cn(
        'relative flex-1 py-3 text-sm font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
        active
          ? 'text-white border-b-2 border-brand-highlight'
          : 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent',
      )}
    >
      {label}
      {/* Incomplete indicator */}
      {incomplete && !active && (
        <span
          className="absolute top-2 right-[calc(50%-16px)] w-1.5 h-1.5 rounded-full bg-amber-400"
          aria-label="Incomplete — some information is missing"
        />
      )}
    </button>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  clientId,
  progressionState,
  primaryFocus,
  secondaryFocus,
  startDate,
  lastActiveAt,
}: {
  clientId:        string
  progressionState: string
  primaryFocus?:   string | null
  secondaryFocus?: string | null
  startDate?:      string | null
  lastActiveAt?:   string | null
}): React.JSX.Element {
  const { data: goals, isLoading } = useClientGoals(clientId)
  const [newGoal, setNewGoal]       = useState('')
  const [addingGoal, setAddingGoal] = useState(false)
  const [goalToDelete, setGoalToDelete] = useState<ClientGoalResponse | null>(null)

  const createGoal = useCreateGoal()
  const updateGoal = useUpdateGoal()
  const deleteGoal = useDeleteGoal()

  const activeGoals   = goals?.filter((g) => g.achievedAt === null) ?? []
  const achievedGoals = goals?.filter((g) => g.achievedAt !== null) ?? []

  const handleAddGoal = (): void => {
    const text = newGoal.trim()
    if (!text) return
    createGoal.mutate(
      { clientId, goal: text },
      { onSuccess: () => setNewGoal('') },
    )
  }

  const handleAchieve = (goal: ClientGoalResponse): void => {
    updateGoal.mutate({
      clientId,
      goalId:     goal.id,
      achievedAt: new Date().toISOString(),
    })
  }

  const handleDeleteConfirm = (): void => {
    if (!goalToDelete) return
    deleteGoal.mutate(
      { clientId, goalId: goalToDelete.id },
      { onSettled: () => setGoalToDelete(null) },
    )
  }

  // Days since start
  const daysSinceStart = startDate
    ? Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="space-y-6" role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="State"
          value={PROGRESSION_STATE_LABEL[progressionState]}
          colorClass={PROGRESSION_STATE_COLOR[progressionState]}
        />
        <StatCard
          label="Last Session"
          value={lastActiveAt ? lastSessionLabel({ lastActiveAt } as any) : '—'}
          warning={lastActiveAt ? isAtRisk({ lastActiveAt } as any) : false}
        />
        <StatCard
          label="Days In"
          value={daysSinceStart !== null ? String(daysSinceStart) : '—'}
        />
      </div>

      {/* Focus */}
      {(primaryFocus || secondaryFocus) && (
        <section>
          <h3 className="section-label">Training Focus</h3>
          <div className="flex gap-2 flex-wrap">
            {primaryFocus && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-sm text-gray-300">
                <span aria-hidden>{FOCUS_ICON[primaryFocus]}</span>
                {FOCUS_LABEL[primaryFocus]}
                <span className="text-xs text-gray-600 ml-1">Primary</span>
              </span>
            )}
            {secondaryFocus && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-sm text-gray-400">
                <span aria-hidden>{FOCUS_ICON[secondaryFocus]}</span>
                {FOCUS_LABEL[secondaryFocus]}
                <span className="text-xs text-gray-600 ml-1">Secondary</span>
              </span>
            )}
          </div>
        </section>
      )}

      {/* Goals */}
      <section>
        <h3 className="section-label">Goals</h3>

        {isLoading ? (
          <Spinner size="sm" className="text-gray-500" />
        ) : (
          <div className="space-y-2">
            {/* Active goals */}
            {activeGoals.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                onAchieve={() => handleAchieve(goal)}
                onDelete={() => setGoalToDelete(goal)}
                isAchieving={updateGoal.isPending}
              />
            ))}

            {/* Add goal input */}
            {addingGoal ? (
              <div className="flex gap-2 items-start">
                <Input
                  placeholder="e.g. Run a 5K in under 30 minutes"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleAddGoal() }
                    if (e.key === 'Escape') { setAddingGoal(false); setNewGoal('') }
                  }}
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  loading={createGoal.isPending}
                  onClick={handleAddGoal}
                  className="shrink-0"
                >
                  Add
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setAddingGoal(false); setNewGoal('') }}
                  className="shrink-0"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingGoal(true)}
                className={cn(
                  'flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 py-1',
                  interactions.button.base,
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-highlight rounded',
                )}
              >
                <span className="w-5 h-5 rounded-full border border-dashed border-gray-600 flex items-center justify-center text-xs" aria-hidden>+</span>
                Add a goal
              </button>
            )}

            {/* Achieved goals (collapsed) */}
            {achievedGoals.length > 0 && (
              <details className="group mt-1">
                <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400 list-none flex items-center gap-1 py-1">
                  <svg className="w-3 h-3 transition-transform group-open:rotate-90" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {achievedGoals.length} achieved
                </summary>
                <div className="mt-2 space-y-1.5 pl-2 border-l border-surface-border">
                  {achievedGoals.map((goal) => (
                    <div key={goal.id} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-emerald-600 mt-0.5 shrink-0" aria-hidden>✓</span>
                      <span className="line-through">{goal.goal}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </section>

      {/* Delete goal confirm */}
      <ConfirmDialog
        open={goalToDelete !== null}
        title="Delete goal?"
        message={`"${goalToDelete?.goal}" will be permanently removed. Prefer marking as achieved instead.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setGoalToDelete(null)}
        confirmLabel="Delete"
        danger
        loading={deleteGoal.isPending}
      />
    </div>
  )
}

// ── Goal row ──────────────────────────────────────────────────────────────────

function GoalRow({
  goal, onAchieve, onDelete, isAchieving,
}: {
  goal:        ClientGoalResponse
  onAchieve:   () => void
  onDelete:    () => void
  isAchieving: boolean
}): React.JSX.Element {
  const [achieveRef, fireOnAchieve] = useUXEventRef<HTMLButtonElement>()

  const handleAchieve = (): void => {
    fireOnAchieve('achieve', { entity: 'goal', entityId: goal.id })
    onAchieve()
  }
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-surface border border-surface-border group">
      {/* Achieve button */}
      <button
        ref={achieveRef}
        type="button"
        onClick={handleAchieve}
        disabled={isAchieving}
        aria-label="Mark as achieved"
        className={cn(
          'mt-0.5 w-5 h-5 rounded-full border-2 border-gray-600 shrink-0',
          'hover:border-emerald-500 hover:bg-emerald-500/10',
          'transition-all duration-150',
          interactions.button.base,
          interactions.button.press,
        )}
      />

      {/* Goal text */}
      <p className="flex-1 text-sm text-gray-300 leading-relaxed">{goal.goal}</p>

      {/* Delete — appears on hover */}
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete goal"
        className={cn(
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'text-gray-600 hover:text-red-400',
          interactions.icon.base,
          interactions.icon.hover,
          'p-0.5',
        )}
      >
        <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" aria-hidden>
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, colorClass, warning,
}: {
  label:       string
  value:       string
  colorClass?: string
  warning?:    boolean
}): React.JSX.Element {
  return (
    <div className="card p-3 text-center">
      <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{label}</p>
      <p className={cn(
        'text-sm font-medium leading-tight',
        colorClass ? colorClass.split(' ').find((c) => c.startsWith('text-')) : '',
        warning && 'text-amber-400',
        !colorClass && !warning && 'text-gray-200',
      )}>
        {value}
      </p>
    </div>
  )
}

// ── Timeline tab ──────────────────────────────────────────────────────────────

function TimelineTab({ clientId }: { clientId: string }): React.JSX.Element {
  const { data: goals,     isLoading: goalsLoading }     = useClientGoals(clientId)
  const { data: snapshots, isLoading: snapshotsLoading } = useClientSnapshots(clientId)

  const isLoading = goalsLoading || snapshotsLoading

  if (isLoading) {
    return (
      <div className="flex justify-center py-12" role="tabpanel" id="panel-timeline" aria-labelledby="tab-timeline">
        <Spinner size="md" className="text-brand-highlight" />
      </div>
    )
  }

  // Merge goals and snapshots into a single timeline sorted by date
  type TimelineEvent =
    | { type: 'goal';     date: Date; goal:     typeof goals[0] }
    | { type: 'snapshot'; date: Date; snapshot: typeof snapshots[0] }

  const events: TimelineEvent[] = [
    ...(goals?.map((g) => ({ type: 'goal' as const, date: new Date(g.setAt), goal: g })) ?? []),
    ...(snapshots?.map((s) => ({ type: 'snapshot' as const, date: new Date(s.capturedAt), snapshot: s })) ?? []),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  if (events.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 text-sm" role="tabpanel" id="panel-timeline" aria-labelledby="tab-timeline">
        <p className="text-2xl mb-3" aria-hidden>📅</p>
        <p>No timeline events yet.</p>
        <p className="text-xs text-gray-600 mt-1">Goals and snapshots will appear here as you add them.</p>
      </div>
    )
  }

  return (
    <div className="relative" role="tabpanel" id="panel-timeline" aria-labelledby="tab-timeline">
      {/* Vertical line */}
      <div className="absolute left-[19px] top-2 bottom-2 w-px bg-surface-border" aria-hidden />

      <div className="space-y-4 pl-10">
        {events.map((event, i) => (
          <div key={i} className="relative animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
            {/* Dot */}
            <div
              className={cn(
                'absolute -left-[29px] top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center',
                event.type === 'goal'
                  ? 'border-brand-highlight bg-brand-primary'
                  : 'border-sky-500 bg-brand-primary',
              )}
              aria-hidden
            >
              <div className={cn(
                'w-1.5 h-1.5 rounded-full',
                event.type === 'goal' ? 'bg-brand-highlight' : 'bg-sky-500',
              )} />
            </div>

            {/* Date */}
            <p className="text-[10px] text-gray-600 mb-0.5 uppercase tracking-wider">
              {event.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>

            {/* Content */}
            {event.type === 'goal' ? (
              <div className="card p-3">
                <p className="text-xs text-brand-highlight uppercase tracking-wider mb-1">
                  {event.goal.achievedAt ? '✓ Goal Achieved' : 'Goal Set'}
                </p>
                <p className="text-sm text-gray-300">{event.goal.goal}</p>
              </div>
            ) : (
              <div className="card p-3">
                <p className="text-xs text-sky-400 uppercase tracking-wider mb-1">Snapshot</p>
                <div className="flex gap-4 text-sm text-gray-400">
                  {event.snapshot.weightLbs && <span>{event.snapshot.weightLbs} lbs</span>}
                  {event.snapshot.energyLevel && <span>Energy {event.snapshot.energyLevel}/10</span>}
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

// ── Baseline tab ──────────────────────────────────────────────────────────────

function BaselineTab({ clientId }: { clientId: string }): React.JSX.Element {
  const { data: latest,    isLoading: latestLoading    } = useLatestSnapshot(clientId)
  const { data: snapshots, isLoading: snapshotsLoading } = useClientSnapshots(clientId)

  const isLoading = latestLoading || snapshotsLoading

  if (isLoading) {
    return (
      <div className="flex justify-center py-12" role="tabpanel" id="panel-baseline" aria-labelledby="tab-baseline">
        <Spinner size="md" className="text-brand-highlight" />
      </div>
    )
  }

  // First snapshot (for "then vs now")
  const firstSnapshot = snapshots && snapshots.length > 0
    ? snapshots[snapshots.length - 1]
    : null

  return (
    <div className="space-y-5" role="tabpanel" id="panel-baseline" aria-labelledby="tab-baseline">

      {/* Take Snapshot CTA */}
      <button
        type="button"
        className={cn(
          'w-full card p-4 text-left border-dashed',
          'hover:border-brand-highlight/30 hover:bg-surface',
          interactions.card.base,
          interactions.card.hover,
          interactions.card.press,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-highlight/10 border border-brand-highlight/20 flex items-center justify-center text-brand-highlight">
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden>
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 7v6M7 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-sm text-white">Take a Snapshot</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {snapshots?.length === 0 ? 'Capture the initial baseline' : 'Record current measurements'}
            </p>
          </div>
        </div>
      </button>

      {/* No snapshots yet */}
      {!latest && (
        <div className="text-center py-8 text-gray-500 text-sm">
          <p className="text-2xl mb-3" aria-hidden>📏</p>
          <p>No baseline data yet.</p>
          <p className="text-xs text-gray-600 mt-1">Take the first snapshot to start tracking progress.</p>
        </div>
      )}

      {/* Latest snapshot */}
      {latest && (
        <section>
          <h3 className="section-label">Current</h3>
          <SnapshotCard snapshot={latest} compareSnapshot={firstSnapshot !== latest ? firstSnapshot : null} />
        </section>
      )}

      {/* History */}
      {snapshots && snapshots.length > 1 && (
        <section>
          <h3 className="section-label">History</h3>
          <div className="space-y-2">
            {snapshots.slice(1).map((snap) => (
              <div key={snap.id} className="card p-3 text-sm text-gray-400">
                <p className="text-xs text-gray-600 mb-1">
                  {new Date(snap.capturedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' · '}
                  <span className="capitalize">{snap.progressionState}</span>
                </p>
                <div className="flex flex-wrap gap-3">
                  {snap.weightLbs     && <span>{snap.weightLbs} lbs</span>}
                  {snap.energyLevel   && <span>Energy {snap.energyLevel}/10</span>}
                  {snap.selfImageScore && <span>Self-image {snap.selfImageScore}/10</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Snapshot card ─────────────────────────────────────────────────────────────

function SnapshotCard({
  snapshot, compareSnapshot,
}: {
  snapshot:        NonNullable<ReturnType<typeof useLatestSnapshot>['data']>
  compareSnapshot: NonNullable<ReturnType<typeof useLatestSnapshot>['data']> | null
}): React.JSX.Element {
  function delta(current: number | null, baseline: number | null): string | null {
    if (current === null || baseline === null) return null
    const diff = current - baseline
    if (diff === 0) return null
    return `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`
  }

  const rows: { label: string; value: number | null; unit: string; baseline: number | null }[] = [
    { label: 'Weight',        value: snapshot.weightLbs,     unit: 'lbs', baseline: compareSnapshot?.weightLbs ?? null },
    { label: 'Body Fat',      value: snapshot.bodyFatPct,    unit: '%',   baseline: compareSnapshot?.bodyFatPct ?? null },
    { label: 'Resting HR',    value: snapshot.restingHeartRateBpm, unit: 'bpm', baseline: compareSnapshot?.restingHeartRateBpm ?? null },
    { label: 'Energy',        value: snapshot.energyLevel,   unit: '/10', baseline: compareSnapshot?.energyLevel ?? null },
    { label: 'Sleep',         value: snapshot.sleepQuality,  unit: '/10', baseline: compareSnapshot?.sleepQuality ?? null },
    { label: 'Stress',        value: snapshot.stressLevel,   unit: '/10', baseline: compareSnapshot?.stressLevel ?? null },
    { label: 'Mobility',      value: snapshot.mobilityFeel,  unit: '/10', baseline: compareSnapshot?.mobilityFeel ?? null },
    { label: 'Self-image',    value: snapshot.selfImageScore, unit: '/10', baseline: compareSnapshot?.selfImageScore ?? null },
    { label: 'Push-ups',      value: snapshot.maxPushUps,    unit: '',    baseline: compareSnapshot?.maxPushUps ?? null },
    { label: 'Mile time',     value: snapshot.mileTimeSecs ? Math.floor(snapshot.mileTimeSecs / 60) : null, unit: 'min', baseline: compareSnapshot?.mileTimeSecs ? Math.floor(compareSnapshot.mileTimeSecs / 60) : null },
  ].filter((r) => r.value !== null)

  if (rows.length === 0) {
    return <p className="text-sm text-gray-600">No measurements recorded in this snapshot.</p>
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-3 py-2 bg-brand-accent/30 border-b border-surface-border">
        <p className="text-xs text-gray-500">
          {new Date(snapshot.capturedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          {compareSnapshot && <span className="ml-2 text-gray-600">· vs. baseline</span>}
        </p>
      </div>
      <div className="divide-y divide-surface-border">
        {rows.map((row) => {
          const d = delta(row.value, row.baseline)
          return (
            <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-gray-400">{row.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-200 font-mono">
                  {row.value}{row.unit}
                </span>
                {d && (
                  <span className={cn(
                    'text-xs font-mono',
                    d.startsWith('+') ? 'text-emerald-400' : 'text-red-400',
                  )}>
                    {d}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClientProfilePage(): React.JSX.Element {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const [tab, setTab]           = useState<Tab>('overview')
  const [editOpen, setEditOpen] = useState(false)

  const { data: client, isLoading, error } = useClient(id ?? null)
  const { data: snapshots }                = useClientSnapshots(id ?? null)
  const { data: goals }                    = useClientGoals(id ?? null)

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" className="text-brand-highlight" />
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Client not found.</p>
        <button
          type="button"
          onClick={() => navigate('/clients')}
          className="mt-4 text-sm text-brand-highlight hover:underline"
        >
          Back to clients
        </button>
      </div>
    )
  }

  // Tab incomplete indicators
  const overviewIncomplete  = isOverviewIncomplete(client)
  const baselineIncomplete  = isBaselineIncomplete((snapshots?.length ?? 0) > 0)

  return (
    <div className="max-w-2xl mx-auto">

      {/* Profile header */}
      <div className="px-4 pt-5 pb-0 md:px-6">

        {/* Back + Edit row */}
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={() => navigate('/clients')}
            className={cn(
              'flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300',
              interactions.button.base,
            )}
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden>
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Clients
          </button>

          {/* Edit button — animated */}
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            aria-label={`Edit ${client.name}`}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm',
              'bg-surface border border-surface-border text-gray-300',
              'hover:border-brand-highlight/40 hover:text-white',
              interactions.button.base,
              interactions.button.hover,
              interactions.button.press,
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
            )}
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" aria-hidden>
              <path d="M11 2l3 3-9 9H2v-3L11 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Edit
          </button>
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-4 mb-5">
          <SilhouetteAvatar
            name={client.name}
            photoUrl={client.photoUrl}
            size="lg"
          />
          <div>
            <h1 className="font-display text-3xl uppercase tracking-wide text-white leading-none">
              {client.name}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded border uppercase tracking-wider',
                PROGRESSION_STATE_COLOR[client.progressionState],
              )}>
                {PROGRESSION_STATE_LABEL[client.progressionState]}
              </span>
              {client.isSelf && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-brand-highlight/30 text-brand-highlight/80 uppercase tracking-wider">
                  My Training
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Client profile sections"
          className="flex border-b border-surface-border"
        >
          <TabButton id="overview"  label="Overview"  active={tab === 'overview'}  incomplete={overviewIncomplete} onClick={() => setTab('overview')} />
          <TabButton id="timeline"  label="Timeline"  active={tab === 'timeline'}  onClick={() => setTab('timeline')} />
          <TabButton id="baseline"  label="Baseline"  active={tab === 'baseline'}  incomplete={baselineIncomplete} onClick={() => setTab('baseline')} />
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 pt-5 pb-24 md:px-6">
        {tab === 'overview' && (
          <OverviewTab
            clientId={client.id}
            progressionState={client.progressionState}
            primaryFocus={client.primaryFocus}
            secondaryFocus={client.secondaryFocus}
            startDate={client.startDate}
            lastActiveAt={client.lastActiveAt}
          />
        )}
        {tab === 'timeline' && <TimelineTab clientId={client.id} />}
        {tab === 'baseline' && <BaselineTab clientId={client.id} />}
      </div>

      {/* Edit drawer */}
      <ClientDrawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        client={client}
        onSuccess={() => setEditOpen(false)}
      />
    </div>
  )
}
