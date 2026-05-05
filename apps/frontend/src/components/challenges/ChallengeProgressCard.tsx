// ------------------------------------------------------------
// components/challenges/ChallengeProgressCard.tsx (v2.12.0)
//
// Shared card showing a single challenge with progress bar,
// days remaining, exercise name, and status badge.
// Used in both client profile Challenges tab and athlete dashboard.
// ------------------------------------------------------------

import { cn }           from '@/lib/cn'
import { interactions } from '@/lib/interactions'
import type { ChallengeResponse } from '@trainer-app/shared'

// ── Label maps ──────────────────────────────────────────────────────────────

const METRIC_LABEL: Record<string, string> = {
  weight_lifted:      'Heaviest lift',
  reps_achieved:      'Max reps',
  distance:           'Distance',
  duration:           'Duration',
  sessions_completed: 'Sessions',
  qualitative:        'Progress',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:    { label: 'Active',    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  completed: { label: 'Completed', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  expired:   { label: 'Expired',   color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  cancelled: { label: 'Cancelled', color: 'text-gray-500 bg-gray-500/10 border-gray-500/20' },
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChallengeProgressCardProps {
  challenge: ChallengeResponse
  onTap?:    () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChallengeProgressCard({
  challenge,
  onTap,
}: ChallengeProgressCardProps): React.JSX.Element {
  const pct = challenge.targetValue > 0
    ? Math.min(100, (challenge.currentValue / challenge.targetValue) * 100)
    : 0

  const daysRemaining = Math.ceil(
    (new Date(challenge.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  const isUrgent = challenge.status === 'active' && daysRemaining <= 7 && pct < 50
  const statusCfg = STATUS_CONFIG[challenge.status] ?? STATUS_CONFIG.active

  // Progress bar color — shifts toward green as it approaches 100%
  const barColor = pct >= 90
    ? 'bg-emerald-500'
    : pct >= 50
      ? 'bg-emerald-600'
      : isUrgent
        ? 'bg-amber-500'
        : 'bg-command-blue'

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={!onTap}
      className={cn(
        'w-full text-left card p-4 border transition-colors',
        onTap && interactions.card.hover,
        onTap && interactions.card.press,
        isUrgent && challenge.status === 'active' && 'border-amber-500/20',
      )}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-white truncate">{challenge.title}</p>
          {challenge.exercise && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {challenge.exercise.name}
            </p>
          )}
        </div>
        <span className={cn(
          'text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0',
          statusCfg.color,
        )}>
          {statusCfg.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="h-2 bg-surface-border rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">
          <span className="font-mono text-gray-200">{challenge.currentValue}</span>
          {' / '}
          <span className="font-mono">{challenge.targetValue}</span>
          {challenge.targetUnit && <span className="ml-0.5">{challenge.targetUnit}</span>}
        </span>

        <div className="flex items-center gap-2">
          <span className="text-gray-600">
            {METRIC_LABEL[challenge.metricType] ?? challenge.metricType}
          </span>
          {challenge.status === 'active' && (
            <span className={cn(
              'font-mono',
              daysRemaining <= 0
                ? 'text-red-400'
                : isUrgent
                  ? 'text-amber-400'
                  : 'text-gray-500',
            )}>
              {daysRemaining <= 0 ? 'Due today' : `${daysRemaining}d left`}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
