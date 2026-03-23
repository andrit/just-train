// ------------------------------------------------------------
// components/exercises/ExerciseDetailPanel.tsx (v1.9.0)
//
// Full exercise detail view. Replaces ExerciseDetail (old drawer).
// Used both from the library grid and from inline search.
//
// LAYOUT:
//   Hero — visualization image OR demonstration video, toggle
//   Meta — body part, equipment, difficulty, category chip
//   Description + Instructions
//   Add to Workout CTA (context-aware)
//   Edit / Delete (owner-only)
//
// "ADD TO WORKOUT" RULES:
//   - Disabled if no active sessions open
//   - Adds directly if exactly one session open
//   - Shows session picker sheet if multiple sessions open
//   - Planned sessions slot in here at v2.1.0
// ------------------------------------------------------------

import { useState }                              from 'react'
import { cn }                                    from '@/lib/cn'
import { interactions }                          from '@/lib/interactions'
import { useExercise, useDeleteExercise }        from '@/lib/queries/exercises'
import { useAddExercise }                        from '@/lib/queries/sessions'
import { useSessionStore }                       from '@/store/sessionStore'
import { useClients, useSelfClient }             from '@/lib/queries/clients'
import { BottomSheet }                           from '@/components/ui/BottomSheet'
import { DragStepper }                           from '@/components/ui/DragStepper'
import { Button }                                from '@/components/ui/Button'
import { Badge }                                 from '@/components/ui/Badge'
import { Spinner }                               from '@/components/ui/Spinner'
import { ConfirmDialog }                         from '@/components/ui/ConfirmDialog'
import {
  WORKOUT_TYPE_BADGE_VARIANT,
  EQUIPMENT_LABEL,
  DIFFICULTY_COLOR,
}                                                from '@/lib/exerciseLabels'
import ExerciseForm                              from './ExerciseForm'
import MediaUploader                             from './MediaUploader'
import type { ActiveSession }                    from '@/store/sessionStore'

// ── Hero section ──────────────────────────────────────────────────────────────

function ExerciseHero({
  visualization,
  demonstration,
  name,
}: {
  visualization: string | null
  demonstration: string | null
  name: string
}): React.JSX.Element {
  const [mode, setMode] = useState<'visualization' | 'demonstration'>(
    visualization ? 'visualization' : 'demonstration'
  )

  const hasVisualization = !!visualization
  const hasDemonstration = !!demonstration
  const hasAny           = hasVisualization || hasDemonstration

  return (
    <div className="relative">
      {/* Media area */}
      <div className="h-36 bg-brand-accent rounded-xl overflow-hidden">
        {!hasAny && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <span className="text-5xl opacity-20" aria-hidden>💪</span>
            <p className="text-xs text-gray-600">Visual coming in Phase 9</p>
          </div>
        )}

        {hasAny && mode === 'visualization' && visualization && (
          <img
            src={visualization}
            alt={`Muscle diagram for ${name}`}
            className="w-full h-full object-contain"
          />
        )}

        {hasAny && mode === 'demonstration' && demonstration && (
          <video
            src={demonstration}
            controls
            playsInline
            className="w-full h-full object-cover"
            aria-label={`Demonstration video for ${name}`}
          />
        )}

        {/* Placeholder when one type is selected but not available */}
        {hasAny && mode === 'visualization' && !visualization && (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-sm text-gray-600">Diagram coming soon</p>
          </div>
        )}
        {hasAny && mode === 'demonstration' && !demonstration && (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-sm text-gray-600">Video coming soon</p>
          </div>
        )}
      </div>

      {/* Toggle */}
      {(hasVisualization || hasDemonstration) && (
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => setMode('visualization')}
            className={cn(
              'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150',
              mode === 'visualization'
                ? 'bg-brand-highlight/10 border-brand-highlight/40 text-brand-highlight'
                : 'border-surface-border text-gray-500 hover:text-gray-300',
            )}
          >
            📊 Muscles
          </button>
          <button
            type="button"
            onClick={() => setMode('demonstration')}
            className={cn(
              'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150',
              mode === 'demonstration'
                ? 'bg-brand-highlight/10 border-brand-highlight/40 text-brand-highlight'
                : 'border-surface-border text-gray-500 hover:text-gray-300',
            )}
          >
            ▶ Demo
          </button>
        </div>
      )}
    </div>
  )
}

// ── Session picker sheet ──────────────────────────────────────────────────────

function SessionPickerSheet({
  open,
  sessions,
  onPick,
  onClose,
}: {
  open:     boolean
  sessions: Array<ActiveSession & { clientName: string }>
  onPick:   (session: ActiveSession) => void
  onClose:  () => void
}): React.JSX.Element {
  return (
    <BottomSheet open={open} onClose={onClose} title="Add to which session?" maxHeight="50vh">
      <div className="p-4 space-y-2 pb-8">
        {sessions.map((session) => (
          <button
            key={session.sessionId}
            type="button"
            onClick={() => onPick(session)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left',
              'bg-surface border border-surface-border',
              'hover:border-brand-highlight/40 hover:bg-brand-highlight/5',
              'transition-all duration-150',
              interactions.button.base,
              interactions.button.press,
            )}
          >
            <div className="w-2 h-2 rounded-full bg-brand-highlight shrink-0 animate-pulse" />
            <div>
              <p className="text-sm font-medium text-gray-200">{session.clientName}</p>
              <p className="text-xs text-gray-500 mt-0.5">Active session</p>
            </div>
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-gray-600 ml-auto">
              <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}

// ── Add to Workout sheet ──────────────────────────────────────────────────────

function AddToWorkoutSheet({
  open,
  exerciseName,
  session,
  onClose,
  onSuccess,
}: {
  open:         boolean
  exerciseName: string
  session:      ActiveSession | null
  onClose:      () => void
  onSuccess:    () => void
}): React.JSX.Element {
  const [targetSets, setTargetSets] = useState(3)
  const [targetReps, setTargetReps] = useState(10)
  const addExercise                 = useAddExercise()

  // session.sessionId is the session — but we need a workoutId.
  // We need to pick which workout block to add to, or create one.
  // For v1.9.0: add to the most recent workout in the session, or
  // show a simple workout picker if there are multiple.
  // This is handled server-side — if no workoutId is available,
  // the trainer needs to be in a live session to use this flow.
  // A simplified approach: show the sheet, on confirm navigate to session.

  // The clean solution: this CTA navigates to the live session page
  // with the exercise pre-selected for quick-add. The session screen
  // already has the full add-exercise flow. This avoids duplicating
  // the workout-picker logic here.

  return (
    <BottomSheet open={open} onClose={onClose} title="Add to Session" maxHeight="55vh">
      <div className="p-6 pb-8">
        <p className="text-center font-display text-xl uppercase tracking-wide text-white mb-1">
          {exerciseName}
        </p>
        <p className="text-center text-xs text-gray-500 mb-6">
          {session?.clientName ?? 'Session'} · Active now
        </p>

        {/* Target sets × reps */}
        <div className="flex justify-around items-start mb-6">
          <DragStepper
            value={targetSets}
            onChange={setTargetSets}
            min={1}
            max={10}
            label="Sets"
          />
          <div className="text-2xl text-gray-700 pt-8">×</div>
          <DragStepper
            value={targetReps}
            onChange={setTargetReps}
            min={1}
            max={30}
            label="Reps"
          />
        </div>

        <p className="text-center text-xs text-gray-600 mb-6">
          You'll be taken to the live session to pick the workout block
        </p>

        <button
          type="button"
          onClick={() => {
            // Navigate to session — the session screen handles workout block selection
            if (session) {
              window.location.href = `/session/${session.sessionId}?addExercise=true`
            }
            onSuccess()
          }}
          className={cn(
            'w-full py-4 rounded-xl font-display text-lg uppercase tracking-wide',
            'bg-brand-highlight text-white',
            interactions.button.base,
            interactions.button.press,
          )}
        >
          Go to Session
        </button>
      </div>
    </BottomSheet>
  )
}

// ── Draft enrichment inline form ──────────────────────────────────────────────

// ── Main component ────────────────────────────────────────────────────────────

interface ExerciseDetailPanelProps {
  exerciseId: string
  onClose:    () => void
  onDeleted?: () => void
}

export default function ExerciseDetailPanel({
  exerciseId,
  onClose,
  onDeleted,
}: ExerciseDetailPanelProps): React.JSX.Element {
  const [isEditing,          setIsEditing]          = useState(false)
  const [showDeleteConfirm,  setShowDeleteConfirm]  = useState(false)
  const [showSessionPicker,  setShowSessionPicker]  = useState(false)
  const [showAddSheet,       setShowAddSheet]       = useState(false)
  const [pickedSession,      setPickedSession]      = useState<ActiveSession | null>(null)

  const { data: exercise, isLoading, error } = useExercise(exerciseId)
  const deleteExercise                        = useDeleteExercise()
  const { activeSessions }                   = useSessionStore()
  const { data: clients }                    = useClients()
  const { data: selfClient }                 = useSelfClient()

  // Build enriched session list with client names
  const openSessions = Object.values(activeSessions).map((session) => {
    const client = clients?.find(c => c.id === session.clientId)
      ?? (selfClient?.id === session.clientId ? selfClient : null)
    return {
      ...session,
      clientName: client?.name ?? session.clientName,
    }
  })

  const sessionCount = openSessions.length

  const handleAddToWorkout = (): void => {
    if (sessionCount === 0) return
    if (sessionCount === 1) {
      setPickedSession(openSessions[0] ?? null)
      setShowAddSheet(true)
    } else {
      setShowSessionPicker(true)
    }
  }

  const handleSessionPicked = (session: ActiveSession): void => {
    setShowSessionPicker(false)
    setPickedSession(session)
    setShowAddSheet(true)
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" className="text-brand-highlight" />
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (error || !exercise) {
    return (
      <div className="py-8 text-center">
        <p className="text-red-400 text-sm">{error?.message ?? 'Exercise not found'}</p>
        <Button variant="ghost" size="sm" onClick={onClose} className="mt-4">Close</Button>
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

  const isPublicLibrary = !exercise.trainerId

  return (
    <>
      <div className="space-y-4 pb-28">

        {/* Draft banner */}
        {exercise.isDraft && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <span className="text-amber-400 text-lg">✏️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-400">Draft exercise</p>
              <p className="text-xs text-amber-400/70 mt-0.5">Add a description and body part when you have a moment</p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-xs text-amber-400 border border-amber-500/40 px-2 py-1 rounded-lg hover:bg-amber-500/10 shrink-0"
            >
              Enrich
            </button>
          </div>
        )}

        {/* Hero */}
        <ExerciseHero
          visualization={exercise.visualization ?? null}
          demonstration={exercise.demonstration ?? null}
          name={exercise.name}
        />

        {/* Name + type */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={WORKOUT_TYPE_BADGE_VARIANT[exercise.workoutType] ?? 'default'}>
              {exercise.workoutType}
            </Badge>
            {exercise.category && (
              <span className="text-[10px] uppercase tracking-wider text-gray-500 border border-surface-border px-2 py-0.5 rounded-full">
                {exercise.category}
              </span>
            )}
          </div>
          <h1 className="font-display text-2xl uppercase tracking-wide text-white leading-tight">
            {exercise.name}
          </h1>
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-2">
          {exercise.bodyPart && (
            <span className="text-xs px-3 py-1.5 rounded-full border border-surface-border text-gray-400 capitalize">
              {exercise.bodyPart.name.replace('_', ' ')}
            </span>
          )}
          <span className="text-xs px-3 py-1.5 rounded-full border border-surface-border text-gray-400">
            {EQUIPMENT_LABEL[exercise.equipment] ?? exercise.equipment}
          </span>
          <span className={cn(
            'text-xs px-3 py-1.5 rounded-full border capitalize',
            DIFFICULTY_COLOR[exercise.difficulty] ?? 'text-gray-400 border-surface-border',
          )}>
            {exercise.difficulty}
          </span>
          {isPublicLibrary && (
            <span className="text-xs px-3 py-1.5 rounded-full border border-surface-border text-gray-600">
              Public library
            </span>
          )}
        </div>

        {/* Description */}
        {exercise.description && (
          <section>
            <h3 className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Description</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{exercise.description}</p>
          </section>
        )}

        {/* Instructions */}
        {exercise.instructions && (
          <section>
            <h3 className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Form Instructions</h3>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{exercise.instructions}</p>
          </section>
        )}

        {/* Media uploader — trainer-owned exercises only */}
        {!isPublicLibrary && (
          <MediaUploader exerciseId={exercise.id} media={exercise.media} />
        )}

        {/* Edit / Delete — trainer-owned only */}
        {!isPublicLibrary && (
          <div className="pt-2 space-y-2 border-t border-surface-border">
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)} className="w-full">
              Edit Exercise
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full"
            >
              Delete Exercise
            </Button>
          </div>
        )}
      </div>

      {/* Add to Workout — sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-brand-secondary/95 backdrop-blur-sm border-t border-surface-border">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={handleAddToWorkout}
            disabled={sessionCount === 0}
            className={cn(
              'w-full py-4 rounded-xl font-display text-lg uppercase tracking-wide',
              'transition-all duration-150',
              interactions.button.base,
              interactions.button.press,
              sessionCount > 0
                ? 'bg-brand-highlight text-white'
                : 'bg-surface border border-surface-border text-gray-600 cursor-not-allowed',
            )}
          >
            {sessionCount === 0
              ? 'No Active Session'
              : sessionCount === 1
              ? `Add to ${openSessions[0]?.clientName ?? 'Session'}`
              : `Add to Session (${sessionCount} open)`
            }
          </button>
          {sessionCount === 0 && (
            <p className="text-center text-xs text-gray-600 mt-2">
              Start a session to add exercises from the library
            </p>
          )}
        </div>
      </div>

      {/* Session picker (multiple sessions open) */}
      <SessionPickerSheet
        open={showSessionPicker}
        sessions={openSessions}
        onPick={handleSessionPicked}
        onClose={() => setShowSessionPicker(false)}
      />

      {/* Add with sets/reps config */}
      <AddToWorkoutSheet
        open={showAddSheet}
        exerciseName={exercise.name}
        session={pickedSession}
        onClose={() => { setShowAddSheet(false); setPickedSession(null) }}
        onSuccess={() => { setShowAddSheet(false); setPickedSession(null) }}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete exercise?"
        message={`"${exercise.name}" will be permanently removed from your library.`}
        onConfirm={() => {
          deleteExercise.mutate(exercise.id, {
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
        loading={deleteExercise.isPending}
      />
    </>
  )
}
