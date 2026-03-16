// ------------------------------------------------------------
// components/exercises/ExerciseDetail.tsx
//
// Full detail view for a single exercise, rendered inside a Drawer.
// Switches between view and edit modes in-place.
// ------------------------------------------------------------

import { useState }                          from 'react'
import { useExercise, useDeleteExercise }    from '@/lib/queries/exercises'
import { Button }         from '@/components/ui/Button'
import { Badge }          from '@/components/ui/Badge'
import { Spinner }        from '@/components/ui/Spinner'
import { ConfirmDialog }  from '@/components/ui/ConfirmDialog'
import ExerciseForm       from './ExerciseForm'
import MediaUploader      from './MediaUploader'
import type { BadgeVariant } from '@/components/ui/Badge'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExerciseDetailProps {
  exerciseId: string
  onClose:    () => void
  onDeleted?: () => void
}

// ── Label maps ────────────────────────────────────────────────────────────────

const WORKOUT_TYPE_VARIANTS: Record<string, BadgeVariant> = {
  cardio:       'info',
  stretching:   'success',
  calisthenics: 'warning',
  resistance:   'danger',
  cooldown:     'default',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExerciseDetail({
  exerciseId,
  onClose,
  onDeleted,
}: ExerciseDetailProps): React.JSX.Element {
  const [isEditing, setIsEditing]               = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { data: exercise, isLoading, error } = useExercise(exerciseId)
  const deleteMutation                        = useDeleteExercise()

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" className="text-brand-highlight" />
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (error != null || exercise == null) {
    return (
      <div className="py-8 text-center">
        <p role="alert" className="text-red-400 text-sm">
          {error?.message ?? 'Exercise not found'}
        </p>
        <Button variant="ghost" size="sm" onClick={onClose} className="mt-4">
          Close
        </Button>
      </div>
    )
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────

  if (isEditing) {
    return (
      <ExerciseForm
        exercise={exercise}
        onSuccess={() => setIsEditing(false)}
        onCancel={() => setIsEditing(false)}
      />
    )
  }

  // ── View mode ─────────────────────────────────────────────────────────────

  const metaItems: Array<{ label: string; value: string }> = [
    { label: 'Body Part',  value: exercise.bodyPart?.name.replace('_', ' ') ?? '—' },
    { label: 'Equipment',  value: exercise.equipment },
    { label: 'Difficulty', value: exercise.difficulty },
    { label: 'Added',      value: new Date(exercise.createdAt).toLocaleDateString() },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={WORKOUT_TYPE_VARIANTS[exercise.workoutType] ?? 'default'}>
            {exercise.workoutType}
          </Badge>
          {exercise.isDraft && (
            <span className="badge-draft">✏️ Draft</span>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)}>
          Edit
        </Button>
      </div>

      {/* Name */}
      <h1 className="font-display text-2xl text-gray-100 leading-tight">
        {exercise.name}
      </h1>

      {/* Meta grid */}
      <dl className="grid grid-cols-2 gap-3">
        {metaItems.map(({ label, value }) => (
          <div key={label} className="bg-brand-primary rounded-lg px-3 py-2.5">
            <dt className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">
              {label}
            </dt>
            <dd className="text-sm text-gray-200 capitalize">{value}</dd>
          </div>
        ))}
      </dl>

      {/* Description */}
      {exercise.description != null && exercise.description.length > 0 && (
        <section>
          <h3 className="field-label mb-2">Description</h3>
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
            {exercise.description}
          </p>
        </section>
      )}

      {/* Instructions */}
      {exercise.instructions != null && exercise.instructions.length > 0 && (
        <section>
          <h3 className="field-label mb-2">Form Instructions</h3>
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
            {exercise.instructions}
          </p>
        </section>
      )}

      {/* Media */}
      <MediaUploader exerciseId={exercise.id} media={exercise.media} />

      {/* Danger zone */}
      <div className="pt-4 border-t border-surface-border">
        <Button
          variant="danger"
          size="sm"
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full"
        >
          Delete Exercise
        </Button>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete exercise?"
        message={`"${exercise.name}" will be permanently removed from your library. Sessions or templates using it will retain a reference but the exercise data will be gone.`}
        onConfirm={() => {
          deleteMutation.mutate(exercise.id, {
            onSuccess: () => {
              setShowDeleteConfirm(false)
              onDeleted?.()
              onClose()
            },
          })
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
