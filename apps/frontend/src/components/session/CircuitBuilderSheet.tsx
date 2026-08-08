// ------------------------------------------------------------
// components/session/CircuitBuilderSheet.tsx
//
// Build a circuit: multi-select exercises (in round order), set rounds + shared
// reps/weight, create. Calls POST /sessions/:id/circuits. v1 single-type —
// the picker is scoped to resistance (the interwoven-box case); mixed-type later.
// ------------------------------------------------------------

import { useState, useMemo }     from 'react'
import { cn }                    from '@/lib/cn'
import { interactions }          from '@/lib/interactions'
import { BottomSheet }           from '@/components/ui/BottomSheet'
import { NumberField }           from '@/components/ui/NumberField'
import { Spinner }               from '@/components/ui/Spinner'
import { useExercises }          from '@/lib/queries/exercises'
import { useCreateCircuit }      from '@/lib/queries/sessions'

interface CircuitBuilderSheetProps {
  open:      boolean
  onClose:   () => void
  sessionId: string
  weightUnit: string
  onCreated?: () => void
}

export function CircuitBuilderSheet({
  open, onClose, sessionId, weightUnit, onCreated,
}: CircuitBuilderSheetProps): React.JSX.Element {
  const { data: exercises, isLoading } = useExercises()
  const createCircuit = useCreateCircuit()

  const [search,      setSearch]      = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])  // ordered = round order
  const [rounds,      setRounds]      = useState<number | null>(3)
  const [reps,        setReps]        = useState<number | null>(10)
  const [weight,      setWeight]      = useState<number | null>(null)

  // v1: resistance only.
  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (exercises ?? [])
      .filter((e) => e.workoutType === 'resistance')
      .filter((e) => !q || e.name.toLowerCase().includes(q))
  }, [exercises, search])

  const toggle = (id: string): void => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const reset = (): void => {
    setSearch(''); setSelectedIds([]); setRounds(3); setReps(10); setWeight(null)
  }

  const canCreate = selectedIds.length >= 2 && (rounds ?? 0) >= 1 && !createCircuit.isPending

  const handleCreate = (): void => {
    if (!canCreate) return
    createCircuit.mutate(
      {
        sessionId,
        exerciseIds:      selectedIds,
        rounds:           rounds ?? 1,
        targetReps:       reps ?? undefined,
        targetWeight:     weight ?? undefined,
        targetWeightUnit: weightUnit === 'kg' ? 'kg' : 'lbs',
      },
      {
        onSuccess: () => { reset(); onCreated?.(); onClose() },
      },
    )
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="New circuit" maxHeight="90vh">
      <div className="px-4 pb-6 space-y-4">
        <p className="text-xs text-gray-600">
          Pick the exercises for your box — you'll do one set of each per round, in this order.
        </p>

        {/* Rounds / reps / weight — wraps so the weight field can't be pushed
            off-screen on narrow phones (three stepper fields don't fit one row). */}
        <div className="flex flex-wrap justify-center gap-3">
          <NumberField value={rounds} onChange={setRounds} min={1} max={10} label="Rounds" />
          <NumberField value={reps} onChange={setReps} min={1} max={50} label="Reps / set" allowEmpty />
          <NumberField value={weight} onChange={setWeight} min={0} label="Weight" suffix={weightUnit} allowEmpty decimal />
        </div>

        {/* Selected order preview */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedIds.map((id, i) => {
              const ex = list.find((e) => e.id === id) ?? exercises?.find((e) => e.id === id)
              return (
                <span key={id} className="text-[11px] px-2 py-1 rounded-full bg-command-blue/10 text-command-blue border border-command-blue/30">
                  {i + 1}. {ex?.name ?? '—'}
                </span>
              )
            })}
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search resistance exercises…"
          className="field w-full"
        />

        {/* Exercise list */}
        <div className="max-h-[38vh] overflow-y-auto overscroll-contain space-y-1 -mx-1 px-1">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner className="text-command-blue" /></div>
          ) : list.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-8">No resistance exercises found.</p>
          ) : (
            list.map((ex) => {
              const idx = selectedIds.indexOf(ex.id)
              const selected = idx >= 0
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => toggle(ex.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left border transition-colors',
                    selected
                      ? 'bg-command-blue/10 border-command-blue/40'
                      : 'border-surface-border hover:border-gray-600',
                  )}
                >
                  <span className={cn(
                    'w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-medium border',
                    selected ? 'bg-command-blue border-command-blue text-white' : 'border-surface-border text-transparent',
                  )}>
                    {selected ? idx + 1 : ''}
                  </span>
                  <span className="flex-1 text-sm text-gray-200 truncate">{ex.name}</span>
                  {ex.bodyPart && (
                    <span className="text-[10px] text-gray-600 capitalize shrink-0">{ex.bodyPart.name.replace('_', ' ')}</span>
                  )}
                </button>
              )
            })
          )}
        </div>

        {createCircuit.isError && (
          <p className="text-sm text-red-400">Couldn't create the circuit. All exercises must be resistance.</p>
        )}

        {/* Create */}
        <button
          type="button"
          onClick={handleCreate}
          disabled={!canCreate}
          className={cn(
            'w-full py-4 rounded-xl font-display text-lg uppercase tracking-wide',
            interactions.button.base,
            interactions.button.press,
            canCreate ? 'bg-command-blue text-white' : 'bg-surface border border-surface-border text-gray-600 cursor-not-allowed',
          )}
        >
          {createCircuit.isPending
            ? <Spinner size="sm" />
            : selectedIds.length < 2
            ? 'Pick at least 2 exercises'
            : `Create circuit · ${selectedIds.length} exercises × ${rounds ?? 1}`}
        </button>
      </div>
    </BottomSheet>
  )
}
