// ------------------------------------------------------------
// components/templates/TemplateDetailSheet.tsx
//
// Read-only view of a template's contents, opened by tapping a
// template card. Shows name, description, created date, and the
// exercise list (circuits grouped), with Edit / Duplicate / Delete
// actions in the header. This view never mutates the template —
// all editing happens in TemplateBuilderSheet.
// ------------------------------------------------------------

import { cn }                        from '@/lib/cn'
import { BottomSheet }               from '@/components/ui/BottomSheet'
import { Spinner }                   from '@/components/ui/Spinner'
import { useTemplate }               from '@/lib/queries/templates'
import { WORKOUT_TYPE_LABEL }        from '@/lib/exerciseLabels'
import { exerciseTypeTheme }         from '@/lib/exerciseTypeTheme'
import { formatSeconds }             from '@/lib/formatters'
import type { TemplateDetailResponse } from '@trainer-app/shared'

type TemplateEx = TemplateDetailResponse['templateExercises'][number]

interface TemplateDetailSheetProps {
  open:       boolean
  templateId: string | null
  isOnline:   boolean
  onEdit:     () => void
  onFork:     () => void
  onDelete:   () => void
  onClose:    () => void
}

// Faithful read-only target summary: per-set ramp, sets×reps, duration, weight, intensity.
function targetSummary(ex: TemplateEx): string {
  const parts: string[] = []
  const perSet = (ex.targetRepsPerSet ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (perSet.length > 1) {
    parts.push(`${perSet.join(' · ')} reps`)
  } else if (ex.targetSets && ex.targetReps) {
    parts.push(`${ex.targetSets}×${ex.targetReps}`)
  } else if (ex.targetSets && ex.targetDurationSeconds) {
    parts.push(`${ex.targetSets}×${formatSeconds(ex.targetDurationSeconds)}`)
  } else if (ex.targetReps) {
    parts.push(`${ex.targetReps} reps`)
  } else if (ex.targetDurationSeconds) {
    parts.push(formatSeconds(ex.targetDurationSeconds))
  }
  if (ex.targetWeight != null) parts.push(`${ex.targetWeight} ${ex.targetWeightUnit}`)
  if (ex.targetIntensityLevel != null) parts.push(`lvl ${ex.targetIntensityLevel}`)
  return parts.join(' · ')
}

// Group consecutive exercises sharing a circuitId into a circuit block; others stand alone.
type Row =
  | { kind: 'single';  ex: TemplateEx }
  | { kind: 'circuit'; id: string; rounds: number | null; members: TemplateEx[] }

function groupRows(exercises: TemplateEx[]): Row[] {
  const rows: Row[] = []
  for (const ex of exercises) {
    if (ex.circuitId) {
      const last = rows[rows.length - 1]
      if (last && last.kind === 'circuit' && last.id === ex.circuitId) {
        last.members.push(ex)
        continue
      }
      rows.push({ kind: 'circuit', id: ex.circuitId, rounds: ex.targetSets, members: [ex] })
    } else {
      rows.push({ kind: 'single', ex })
    }
  }
  return rows
}

function ExerciseRow({ ex }: { ex: TemplateEx }): React.JSX.Element {
  const typeLabel  = WORKOUT_TYPE_LABEL[ex.workoutType] ?? ex.workoutType
  const colorClass = exerciseTypeTheme(ex.workoutType).text
  const summary    = targetSummary(ex)
  return (
    <div className="bg-brand-primary rounded-xl border border-surface-border px-3 py-2.5">
      <p className="text-sm text-ink truncate">{ex.exercise?.name ?? 'Unknown'}</p>
      <div className="flex items-center gap-2 mt-0.5">
        <span className={cn('text-[10px] uppercase tracking-widest font-medium', colorClass)}>{typeLabel}</span>
        {summary && <span className="text-xs text-ink-faint font-mono">{summary}</span>}
      </div>
    </div>
  )
}

export function TemplateDetailSheet({
  open, templateId, isOnline, onEdit, onFork, onDelete, onClose,
}: TemplateDetailSheetProps): React.JSX.Element {
  const { data: template } = useTemplate(templateId)
  const rows = template ? groupRows(template.templateExercises) : []

  const actionBtn = (extra: string): string => cn(
    'p-2 rounded-lg transition-colors',
    extra,
    !isOnline && 'opacity-40 cursor-not-allowed',
  )

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="90vh">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-surface-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-ink-subtle hover:text-ink text-sm transition-colors"
          >
            Close
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!isOnline}
              onClick={() => { if (isOnline) onEdit() }}
              title={isOnline ? undefined : 'Connect to edit'}
              aria-label="Edit template"
              className={actionBtn('text-ink-muted hover:text-ink hover:bg-surface-border/30')}
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <path d="M11.5 2.5l2 2L6 12l-2.5.5L4 10l7.5-7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              disabled={!isOnline}
              onClick={() => { if (isOnline) onFork() }}
              title={isOnline ? undefined : 'Connect to duplicate'}
              aria-label="Duplicate template"
              className={actionBtn('text-ink-faint hover:text-ink hover:bg-surface-border/30')}
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M3 10.5V4a1 1 0 011-1h6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              disabled={!isOnline}
              onClick={() => { if (isOnline) onDelete() }}
              title={isOnline ? undefined : 'Connect to delete'}
              aria-label="Delete template"
              className={actionBtn('text-ink-faint hover:text-red-400 hover:bg-red-500/10')}
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z"
                  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!template ? (
            isOnline ? (
              <div className="flex justify-center py-12"><Spinner size="md" className="text-command-blue" /></div>
            ) : (
              <p className="text-center text-sm text-ink-faint py-12">Connect to view this template&rsquo;s details.</p>
            )
          ) : (
            <>
              <div>
                <h2 className="text-xl font-display font-medium text-ink">{template.name}</h2>
                {template.description && (
                  <p className="text-sm text-ink-subtle mt-1">{template.description}</p>
                )}
                <p className="text-[10px] text-ink-faint mt-2">
                  Created {new Date(template.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              {rows.length === 0 ? (
                <p className="text-center text-sm text-ink-faint py-6">This template has no exercises yet.</p>
              ) : (
                <div className="space-y-2">
                  {rows.map((row) => row.kind === 'single' ? (
                    <ExerciseRow key={row.ex.id} ex={row.ex} />
                  ) : (
                    <div key={row.id} className="rounded-xl border border-command-blue/30 bg-command-blue/5 p-2 space-y-2">
                      <p className="text-[10px] uppercase tracking-widest font-medium text-command-blue px-1">
                        Circuit{row.rounds ? ` · ${row.rounds} ${row.rounds === 1 ? 'round' : 'rounds'}` : ''}
                      </p>
                      {row.members.map((m) => <ExerciseRow key={m.id} ex={m} />)}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}
