// ------------------------------------------------------------
// components/challenges/ChallengeForm.tsx (v2.12.0)
//
// Bottom sheet for creating a new challenge. Metric type picker
// drives which subsequent fields appear. Exercise selector shown
// for exercise-specific metrics, hidden for sessions_completed
// and qualitative.
//
// Shared between trainer flow (client profile) and athlete flow
// (dashboard / self-client). The `contextLabel` prop controls
// whether copy says "Challenge for [name]" vs "Set a challenge".
// ------------------------------------------------------------

import { useState, useId }   from 'react'
import { cn }                from '@/lib/cn'
import { interactions }      from '@/lib/interactions'
import { BottomSheet }       from '@/components/ui/BottomSheet'
import { Button }            from '@/components/ui/Button'
import { Input }             from '@/components/ui/Input'
import { useExercises }      from '@/lib/queries/exercises'
import { useCreateChallenge } from '@/lib/queries/challenges'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChallengeFormProps {
  open:         boolean
  onClose:      () => void
  clientId:     string
  /** "Challenge for Jordan" or "Set a challenge" */
  contextLabel: string
}

const METRIC_OPTIONS = [
  { value: 'weight_lifted',      label: 'Heaviest Lift',   unit: 'lbs', needsExercise: true },
  { value: 'reps_achieved',      label: 'Max Reps',        unit: 'reps', needsExercise: true },
  { value: 'distance',           label: 'Distance',        unit: 'km',  needsExercise: true },
  { value: 'duration',           label: 'Duration',        unit: 'seconds', needsExercise: true },
  { value: 'sessions_completed', label: 'Sessions Count',  unit: 'sessions', needsExercise: false },
  { value: 'qualitative',        label: 'Qualitative',     unit: null,  needsExercise: false },
] as const

type MetricValue = typeof METRIC_OPTIONS[number]['value']

// ── Component ─────────────────────────────────────────────────────────────────

export function ChallengeForm({
  open,
  onClose,
  clientId,
  contextLabel,
}: ChallengeFormProps): React.JSX.Element {
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [metricType, setMetricType]   = useState<MetricValue>('weight_lifted')
  const [exerciseId, setExerciseId]   = useState<string>('')
  const [targetValue, setTargetValue] = useState('')
  const [targetUnit, setTargetUnit]   = useState('lbs')
  const [deadline, setDeadline]       = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const uid           = useId()
  const exerciseErrId = `${uid}-exercise-error`
  const deadlineErrId = `${uid}-deadline-error`
  const _targetErrId  = `${uid}-target-error`

  const _setFieldError = (field: string, msg: string): void =>
    setFieldErrors((prev) => ({ ...prev, [field]: msg }))
  const clearFieldError = (field: string): void =>
    setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next })

  const createChallenge = useCreateChallenge()
  const { data: exercises } = useExercises()

  const selectedMetric = METRIC_OPTIONS.find((m) => m.value === metricType)
  const needsExercise = selectedMetric?.needsExercise ?? false

  // Update default unit when metric type changes
  const handleMetricChange = (value: MetricValue): void => {
    setMetricType(value)
    const opt = METRIC_OPTIONS.find((m) => m.value === value)
    if (opt?.unit) setTargetUnit(opt.unit)
    if (!opt?.needsExercise) setExerciseId('')
  }

  const handleSubmit = (): void => {
    const next: Record<string, string> = {}
    if (!title.trim())                             next.title    = 'Title is required'
    if (!targetValue || Number(targetValue) <= 0)  next.target   = 'Enter a positive number'
    if (!deadline)                                 next.deadline = 'Deadline is required'
    if (needsExercise && !exerciseId)              next.exercise = 'Select an exercise for this metric type'
    setFieldErrors(next)
    if (Object.keys(next).length > 0) return

    createChallenge.mutate(
      {
        clientId,
        body: {
          title: title.trim(),
          description: description.trim() || undefined,
          metricType,
          exerciseId: needsExercise ? exerciseId : undefined,
          targetValue: Number(targetValue),
          targetUnit: metricType === 'qualitative' ? undefined : targetUnit,
          deadline,
        },
      },
      {
        onSuccess: () => {
          setTitle('')
          setDescription('')
          setMetricType('weight_lifted')
          setExerciseId('')
          setTargetValue('')
          setTargetUnit('lbs')
          setDeadline('')
          setFieldErrors({})
          onClose()
        },
        onError: (err) => setFieldErrors({ server: err.message }),
      },
    )
  }

  // Default deadline to 30 days from now
  const defaultDeadline = (): string => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={contextLabel} maxHeight="90vh">
      <div className="px-5 pb-6 space-y-4">

        {fieldErrors.server && (
          <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
            {fieldErrors.server}
          </div>
        )}

        {/* Title */}
        <div>
          <Input
            label="Title"
            placeholder='e.g. "10 unassisted pull-ups"'
            value={title}
            onChange={(e) => { setTitle(e.target.value); clearFieldError('title') }}
            error={fieldErrors.title}
            maxLength={200}
            required
          />
        </div>

        {/* Description (optional) */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Description (optional)</label>
          <Input
            placeholder="Context, instructions, motivation..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Metric type */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">How is progress measured?</label>
          <div className="grid grid-cols-2 gap-1.5">
            {METRIC_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleMetricChange(opt.value)}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs text-left border transition-colors',
                  metricType === opt.value
                    ? 'border-command-blue/40 bg-command-blue/5 text-white'
                    : 'border-surface-border text-gray-400 hover:text-gray-200 hover:border-gray-500',
                  interactions.button.base,
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Exercise selector — only for exercise-specific metrics */}
        {needsExercise && (
          <div>
            <label
              htmlFor={`${uid}-exercise`}
              className="text-xs text-gray-500 uppercase tracking-wider block mb-1"
            >
              Exercise <span className="text-ember-red" aria-hidden>*</span>
            </label>
            <select
              id={`${uid}-exercise`}
              value={exerciseId}
              onChange={(e) => { setExerciseId(e.target.value); clearFieldError('exercise') }}
              aria-invalid={fieldErrors.exercise ? true : undefined}
              aria-describedby={fieldErrors.exercise ? exerciseErrId : undefined}
              aria-required
              className={cn(
                'w-full bg-surface border rounded-lg px-3 py-2 text-sm text-gray-300',
                fieldErrors.exercise ? 'border-red-500' : 'border-surface-border',
              )}
            >
              <option value="">Select an exercise...</option>
              {(exercises ?? []).map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
            {fieldErrors.exercise && (
              <p id={exerciseErrId} role="alert" className="mt-1.5 text-xs text-red-400">
                {fieldErrors.exercise}
              </p>
            )}
          </div>
        )}

        {/* Target value + unit */}
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              label={metricType === 'qualitative' ? 'Target (1–10 scale)' : 'Target'}
              type="number"
              inputMode="decimal"
              placeholder={metricType === 'qualitative' ? '10' : '100'}
              value={targetValue}
              onChange={(e) => { setTargetValue(e.target.value); clearFieldError('target') }}
              error={fieldErrors.target}
              required
            />
          </div>
          {metricType !== 'qualitative' && (
            <div className="w-28">
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Unit</label>
              <select
                value={targetUnit}
                onChange={(e) => setTargetUnit(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-gray-300"
              >
                {metricType === 'weight_lifted' && (
                  <>
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </>
                )}
                {metricType === 'reps_achieved' && <option value="reps">reps</option>}
                {metricType === 'distance' && (
                  <>
                    <option value="km">km</option>
                    <option value="mi">mi</option>
                  </>
                )}
                {metricType === 'duration' && <option value="seconds">seconds</option>}
                {metricType === 'sessions_completed' && <option value="sessions">sessions</option>}
              </select>
            </div>
          )}
        </div>

        {/* Deadline */}
        <div>
          <label
            htmlFor={`${uid}-deadline`}
            className="text-xs text-gray-500 uppercase tracking-wider block mb-1"
          >
            Deadline <span className="text-ember-red" aria-hidden>*</span>
          </label>
          <input
            id={`${uid}-deadline`}
            type="date"
            value={deadline || defaultDeadline()}
            onChange={(e) => { setDeadline(e.target.value); clearFieldError('deadline') }}
            min={new Date().toISOString().slice(0, 10)}
            aria-invalid={fieldErrors.deadline ? true : undefined}
            aria-describedby={fieldErrors.deadline ? deadlineErrId : undefined}
            aria-required
            className={cn(
              'w-full bg-surface border rounded-lg px-3 py-2 text-sm text-gray-300',
              fieldErrors.deadline ? 'border-red-500' : 'border-surface-border',
            )}
          />
          {fieldErrors.deadline && (
            <p id={deadlineErrId} role="alert" className="mt-1.5 text-xs text-red-400">
              {fieldErrors.deadline}
            </p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="button"
          onClick={handleSubmit}
          loading={createChallenge.isPending}
          className="w-full"
        >
          Create Challenge
        </Button>
      </div>
    </BottomSheet>
  )
}
