// ------------------------------------------------------------
// components/exercises/ExerciseForm.tsx
//
// Unified create / edit form for exercises.
// Used inside a Modal (create) or Drawer (edit).
// ------------------------------------------------------------

import { useState }                             from 'react'
import { useBodyParts, useCreateExercise, useUpdateExercise } from '@/lib/queries/exercises'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { TextArea } from '@/components/ui/TextArea'
import { Select }   from '@/components/ui/Select'
import { WORKOUT_TYPE_OPTIONS, EQUIPMENT_OPTIONS, DIFFICULTY_OPTIONS } from './utils'
import type { ExerciseDetailResponse, ExerciseSummaryResponse } from '@trainer-app/shared'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormState {
  name:         string
  workoutType:  string
  bodyPartId:   string
  equipment:    string
  difficulty:   string
  description:  string
  instructions: string
}

type FormErrors = Partial<Record<keyof FormState, string>>

interface ExerciseFormProps {
  /** When provided — edit mode. When undefined — create mode. */
  exercise?: ExerciseDetailResponse
  onSuccess: (exercise: ExerciseSummaryResponse | ExerciseDetailResponse) => void
  onCancel:  () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExerciseForm({
  exercise,
  onSuccess,
  onCancel,
}: ExerciseFormProps): React.JSX.Element {
  const isEdit = exercise != null

  const [form, setForm] = useState<FormState>({
    name:         exercise?.name         ?? '',
    workoutType:  exercise?.workoutType  ?? 'resistance',
    bodyPartId:   exercise?.bodyPartId   ?? '',
    equipment:    exercise?.equipment    ?? 'none',
    difficulty:   exercise?.difficulty   ?? 'beginner',
    description:  exercise?.description  ?? '',
    instructions: exercise?.instructions ?? '',
  })

  const [errors, setErrors] = useState<FormErrors>({})

  const { data: bodyParts }   = useBodyParts()
  const createMutation        = useCreateExercise()
  const updateMutation        = useUpdateExercise()
  const isPending             = createMutation.isPending || updateMutation.isPending
  const serverError           = createMutation.error?.message ?? updateMutation.error?.message

  const bodyPartOptions = (bodyParts ?? []).map((bp) => ({
    value: bp.id,
    label: bp.name.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  }))

  const setField = (field: keyof FormState, value: string): void => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field] != null) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const validate = (): boolean => {
    const next: FormErrors = {}
    if (form.name.trim().length === 0) next.name       = 'Name is required'
    if (form.workoutType.length === 0)  next.workoutType = 'Workout type is required'
    if (form.bodyPartId.length === 0)   next.bodyPartId  = 'Body part is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (!validate()) return

    const payload = {
      name:         form.name.trim(),
      workoutType:  form.workoutType,
      bodyPartId:   form.bodyPartId,
      equipment:    form.equipment  || undefined,
      difficulty:   form.difficulty || undefined,
      description:  form.description.trim()  || undefined,
      instructions: form.instructions.trim() || undefined,
    }

    if (isEdit && exercise != null) {
      updateMutation.mutate(
        { id: exercise.id, ...payload },
        { onSuccess: (data) => onSuccess(data) },
      )
    } else {
      createMutation.mutate(payload, { onSuccess: (data) => onSuccess(data) })
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Server error */}
      {serverError != null && (
        <div
          role="alert"
          className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
        >
          {serverError}
        </div>
      )}

      <Input
        label="Exercise Name"
        placeholder="e.g. Barbell Back Squat"
        value={form.name}
        onChange={(e) => setField('name', e.target.value)}
        error={errors.name}
        autoFocus={!isEdit}
        maxLength={150}
        required
      />

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Workout Type"
          options={WORKOUT_TYPE_OPTIONS}
          value={form.workoutType}
          onChange={(e) => setField('workoutType', e.target.value)}
          error={errors.workoutType}
          required
        />
        <Select
          label="Body Part"
          options={bodyPartOptions}
          placeholder="Select…"
          value={form.bodyPartId}
          onChange={(e) => setField('bodyPartId', e.target.value)}
          error={errors.bodyPartId}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Equipment"
          options={EQUIPMENT_OPTIONS}
          value={form.equipment}
          onChange={(e) => setField('equipment', e.target.value)}
        />
        <Select
          label="Difficulty"
          options={DIFFICULTY_OPTIONS}
          value={form.difficulty}
          onChange={(e) => setField('difficulty', e.target.value)}
        />
      </div>

      <TextArea
        label="Description"
        placeholder="Brief overview of the exercise…"
        value={form.description}
        onChange={(e) => setField('description', e.target.value)}
        rows={2}
        maxLength={2000}
        hint="Optional — shown in exercise detail"
      />

      <TextArea
        label="Form Instructions"
        placeholder="Step-by-step cues for proper form…"
        value={form.instructions}
        onChange={(e) => setField('instructions', e.target.value)}
        rows={4}
        maxLength={5000}
        hint="Optional — used as coaching reference during sessions"
      />

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending} className="flex-1">
          {isEdit ? 'Save Changes' : 'Create Exercise'}
        </Button>
      </div>
    </form>
  )
}
