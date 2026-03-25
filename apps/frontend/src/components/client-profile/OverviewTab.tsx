// ------------------------------------------------------------
// components/client-profile/OverviewTab.tsx (v1.6.1)
//
// Overview tab for the client profile page.
// Shows: quick stats, training focus, active/achieved goals.
// Extracted from ClientProfilePage for Single Responsibility.
// ------------------------------------------------------------

import { useState }         from 'react'
import { cn }               from '@/lib/cn'
import { interactions }     from '@/lib/interactions'
import { useUXEventRef }    from '@/hooks/useUXEvent'
import {
  useClientGoals,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
} from '@/lib/queries/clients'
import { Spinner }          from '@/components/ui/Spinner'
import { Button }           from '@/components/ui/Button'
import { Input }            from '@/components/ui/Input'
import { ConfirmDialog }    from '@/components/ui/ConfirmDialog'
import {
  PROGRESSION_STATE_LABEL,
  PROGRESSION_STATE_COLOR,
  FOCUS_LABEL,
  FOCUS_ICON,
  lastSessionLabel,
  isAtRisk,
} from '@/components/clients/utils'
import type { ClientGoalResponse, ClientResponse } from '@trainer-app/shared'

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
      <p className="flex-1 text-sm text-gray-300 leading-relaxed">{goal.goal}</p>
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

// ── Overview tab ──────────────────────────────────────────────────────────────

interface OverviewTabProps {
  clientId:         string
  progressionState: string
  primaryFocus?:    string | null
  secondaryFocus?:  string | null
  startDate?:       string | null
  lastActiveAt?:    string | null
}

export function OverviewTab({
  clientId,
  progressionState,
  primaryFocus,
  secondaryFocus,
  startDate,
  lastActiveAt,
}: OverviewTabProps): React.JSX.Element {
  const { data: goals, isLoading } = useClientGoals(clientId)
  const [newGoal,      setNewGoal]     = useState('')
  const [addingGoal,   setAddingGoal]  = useState(false)
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
    updateGoal.mutate({ clientId, goalId: goal.id, achievedAt: new Date().toISOString() })
  }

  const handleDeleteConfirm = (): void => {
    if (!goalToDelete) return
    deleteGoal.mutate(
      { clientId, goalId: goalToDelete.id },
      { onSettled: () => setGoalToDelete(null) },
    )
  }

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
          value={lastActiveAt ? lastSessionLabel({ lastActiveAt } as ClientResponse) : '—'}
          warning={lastActiveAt ? isAtRisk({ lastActiveAt } as ClientResponse) : false}
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
            {activeGoals.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                onAchieve={() => handleAchieve(goal)}
                onDelete={() => setGoalToDelete(goal)}
                isAchieving={updateGoal.isPending}
              />
            ))}

            {addingGoal ? (
              <div className="flex gap-2 items-start">
                <Input
                  placeholder="e.g. Run a 5K in under 30 minutes"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')  { e.preventDefault(); handleAddGoal() }
                    if (e.key === 'Escape') { setAddingGoal(false); setNewGoal('') }
                  }}
                  autoFocus
                />
                <Button type="button" size="sm" loading={createGoal.isPending} onClick={handleAddGoal} className="shrink-0">Add</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setAddingGoal(false); setNewGoal('') }} className="shrink-0">Cancel</Button>
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
