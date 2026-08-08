// ------------------------------------------------------------
// components/session/CircuitBuilderSheet.tsx
//
// Build a circuit: multi-select exercises (in round order), set rounds + shared
// reps/weight/step, create. Calls POST /sessions/:id/circuits. v1 single-type —
// the picker is scoped to resistance (the interwoven-box case); mixed-type later.
//
// Target controls stack vertically (Rounds → Reps → Starting weight · + / set),
// visually matching the exercise "Set targets" step. Shared weight/step apply to
// every member for now (per-exercise weights come later).
// ------------------------------------------------------------

import { useState, useMemo }     from 'react'
import { cn }                    from '@/lib/cn'
import { interactions }          from '@/lib/interactions'
import { weightRampSequence }    from '@/lib/weightRamp'
import { BottomSheet }           from '@/components/ui/BottomSheet'
import { NumberField }           from '@/components/ui/NumberField'
import { Spinner }               from '@/components/ui/Spinner'
import { useExercises, useBodyParts } from '@/lib/queries/exercises'
import { useCreateCircuit }      from '@/lib/queries/sessions'
import { useCreateTemplateCircuit } from '@/lib/queries/templates'
import type { BodyPart }         from '@trainer-app/shared'

interface CircuitBuilderSheetProps {
  open:      boolean
  onClose:   () => void
  /** Provide exactly one of sessionId / templateId — it decides where the circuit lands. */
  sessionId?:  string
  templateId?: string
  weightUnit: string
  onCreated?: () => void
}

function niceBodyPart(name: string): string {
  const s = name.replace('_', ' ')
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}`
}

export function CircuitBuilderSheet({
  open, onClose, sessionId, templateId, weightUnit, onCreated,
}: CircuitBuilderSheetProps): React.JSX.Element {
  const { data: exercises, isLoading } = useExercises()
  const { data: bodyParts }            = useBodyParts()
  const createCircuit         = useCreateCircuit()
  const createTemplateCircuit = useCreateTemplateCircuit()

  // Template circuits have no weight-ramp column, so the "+ / set" control is
  // session-only. `isTemplate` also selects which mutation runs.
  const isTemplate = templateId != null
  const pending    = isTemplate ? createTemplateCircuit.isPending : createCircuit.isPending
  const submitError = isTemplate ? createTemplateCircuit.isError : createCircuit.isError

  const [search,      setSearch]      = useState('')
  const [bodyPart,    setBodyPart]    = useState<BodyPart | null>(null)
  const [bpMenuOpen,  setBpMenuOpen]  = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])  // ordered = round order
  const [rounds,      setRounds]      = useState<number | null>(3)
  const [reps,        setReps]        = useState<number | null>(10)
  const [weight,      setWeight]      = useState<number | null>(null)
  const [weightStep,  setWeightStep]  = useState<number>(0)

  // v1: resistance only, optionally narrowed to one body part.
  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (exercises ?? [])
      .filter((e) => e.workoutType === 'resistance')
      .filter((e) => !bodyPart || e.bodyPart?.name === bodyPart)
      .filter((e) => !q || e.name.toLowerCase().includes(q))
  }, [exercises, search, bodyPart])

  const toggle = (id: string): void => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const reset = (): void => {
    setSearch(''); setBodyPart(null); setBpMenuOpen(false)
    setSelectedIds([]); setRounds(3); setReps(10); setWeight(null); setWeightStep(0)
  }

  const canCreate = selectedIds.length >= 2 && (rounds ?? 0) >= 1 && !pending

  const handleCreate = (): void => {
    if (!canCreate) return
    const onSuccess = (): void => { reset(); onCreated?.(); onClose() }
    const targetWeightUnit = weightUnit === 'kg' ? 'kg' : 'lbs'

    if (isTemplate && templateId) {
      createTemplateCircuit.mutate(
        {
          templateId,
          exerciseIds:  selectedIds,
          rounds:       rounds ?? 1,
          targetReps:   reps ?? undefined,
          targetWeight: weight ?? undefined,
          targetWeightUnit,
        },
        { onSuccess },
      )
    } else if (sessionId) {
      createCircuit.mutate(
        {
          sessionId,
          exerciseIds:      selectedIds,
          rounds:           rounds ?? 1,
          targetReps:       reps ?? undefined,
          targetWeight:     weight ?? undefined,
          targetWeightStep: weightStep !== 0 ? weightStep : undefined,
          targetWeightUnit,
        },
        { onSuccess },
      )
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={isTemplate ? 'New template circuit' : 'New circuit'} maxHeight="90vh">
      <div className="px-4 pb-6 space-y-5">
        <p className="text-xs text-gray-600">
          Pick the exercises for your box — you'll do one set of each per round, in this order.
        </p>

        {/* Targets — stacked, matching the exercise "Set targets" layout.
            Rounds → Reps → Starting weight · + / set. Shared across the circuit. */}
        <div className="space-y-6">
          {/* Rounds */}
          <div className="flex justify-center">
            <NumberField value={rounds} onChange={setRounds} min={1} max={10} label="Rounds" />
          </div>

          {/* Reps */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 text-center">Reps</p>
            <div className="flex justify-center">
              <NumberField value={reps} onChange={setReps} min={1} max={50} label="Reps / set" allowEmpty />
            </div>
          </div>

          {/* Weight — a shared starting weight + optional per-set ramp. Only the
              start and step are stored; each live set expands from the previous. */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 text-center">Weight</p>
            <div className="flex items-start justify-center gap-5">
              <NumberField
                value={weight}
                onChange={setWeight}
                min={0}
                decimal
                allowEmpty
                placeholder="optional"
                label="Starting weight"
                suffix={weightUnit}
              />
              {!isTemplate && (
                <NumberField
                  value={weightStep}
                  onChange={(v) => setWeightStep(v ?? 0)}
                  min={-500}
                  max={500}
                  decimal
                  label="+ / set"
                  suffix={weightUnit}
                />
              )}
            </div>
            {!isTemplate && weightStep !== 0 && weight != null && (
              <p className="text-center text-sm text-gray-400 font-mono tracking-wide">
                {weightRampSequence(weight, weightStep, rounds ?? 1).join(' · ')} {weightUnit}
              </p>
            )}
          </div>
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

        {/* Search + body-part filter */}
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resistance exercises…"
            className="field flex-1 min-w-0"
          />
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setBpMenuOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={bpMenuOpen}
              className={cn(
                'h-full flex items-center gap-1.5 px-3 rounded-xl border text-xs font-medium transition-colors',
                bodyPart
                  ? 'bg-command-blue/10 border-command-blue/40 text-command-blue'
                  : 'border-surface-border text-gray-400 hover:text-gray-200',
              )}
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" aria-hidden>
                <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="max-w-[80px] truncate">{bodyPart ? niceBodyPart(bodyPart) : 'All'}</span>
              <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" aria-hidden>
                <path d="M3 4.5L6 7.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {bpMenuOpen && (
              <>
                {/* Outside-tap catcher */}
                <div className="fixed inset-0 z-10" onClick={() => setBpMenuOpen(false)} aria-hidden />
                <div
                  role="listbox"
                  className="absolute right-0 mt-1 z-20 min-w-[150px] max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-surface-border bg-brand-primary py-1 shadow-pressable"
                >
                  <BpOption label="All body parts" active={!bodyPart} onClick={() => { setBodyPart(null); setBpMenuOpen(false) }} />
                  {(bodyParts ?? []).map((bp) => (
                    <BpOption
                      key={bp.id}
                      label={niceBodyPart(bp.name)}
                      active={bodyPart === bp.name}
                      onClick={() => { setBodyPart(bp.name); setBpMenuOpen(false) }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Exercise list */}
        <div className="max-h-[34vh] overflow-y-auto overscroll-contain space-y-1 -mx-1 px-1">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner className="text-command-blue" /></div>
          ) : list.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-8">
              {bodyPart ? `No ${niceBodyPart(bodyPart).toLowerCase()} resistance exercises found.` : 'No resistance exercises found.'}
            </p>
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

        {submitError && (
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
          {pending
            ? <Spinner size="sm" />
            : selectedIds.length < 2
            ? 'Pick at least 2 exercises'
            : `Create circuit · ${selectedIds.length} exercises × ${rounds ?? 1}`}
        </button>
      </div>
    </BottomSheet>
  )
}

function BpOption({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2 text-sm transition-colors',
        active ? 'text-command-blue bg-command-blue/10' : 'text-gray-300 hover:bg-surface',
      )}
    >
      {label}
    </button>
  )
}
