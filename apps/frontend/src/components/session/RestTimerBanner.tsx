// ------------------------------------------------------------
// components/session/RestTimerBanner.tsx (v1.5.0)
//
// Persistent top banner shown during rest periods.
// Stays visible while the trainer scrolls between exercises.
// Shows: countdown number, depleting progress bar, Skip Rest button.
//
// Number flip animation fires on each tick via CSS.
// Sharp pulse fires when timer hits zero.
// ------------------------------------------------------------

import { cn } from '@/lib/cn'
import { interactions } from '@/lib/interactions'
import type { useRestTimer } from '@/hooks/useRestTimer'

type RestTimerState = ReturnType<typeof useRestTimer>

interface RestTimerBannerProps {
  timer: RestTimerState
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`
}

export function RestTimerBanner({ timer }: RestTimerBannerProps): React.JSX.Element | null {
  if (!timer.isRunning) return null

  const isLow = timer.remaining <= 10
  const isVeryLow = timer.remaining <= 3

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label={`Rest timer: ${timer.remaining} seconds remaining`}
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        'flex items-center justify-between px-4 py-2.5',
        'border-b transition-colors duration-500',
        isVeryLow
          ? 'bg-ember-red border-ember-red/50'
          : isLow
          ? 'bg-amber-500/20 border-amber-500/30'
          : 'bg-brand-accent/95 border-surface-border',
        'backdrop-blur-sm',
        isVeryLow && 'animate-pulse-sharp',
      )}
    >
      {/* Progress bar — depletes left to right */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-surface-border overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-1000 ease-linear',
            isVeryLow ? 'bg-white' : isLow ? 'bg-amber-400' : 'bg-command-blue',
          )}
          style={{ width: `${100 - timer.progressPct}%` }}
        />
      </div>

      {/* Label */}
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-gray-400 shrink-0" aria-hidden>
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 5v3.5l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className={cn(
          'text-sm font-medium',
          isVeryLow ? 'text-white' : 'text-gray-300',
        )}>
          Rest
        </span>
      </div>

      {/* Countdown */}
      <span
        key={timer.remaining} // key change triggers CSS animation on each tick
        className={cn(
          'font-mono text-xl font-bold tabular-nums animate-bounce-in',
          isVeryLow ? 'text-white' : isLow ? 'text-amber-300' : 'text-white',
        )}
      >
        {formatTime(timer.remaining)}
      </span>

      {/* Skip button */}
      <button
        type="button"
        onClick={timer.skip}
        className={cn(
          'text-xs px-3 py-1.5 rounded-lg border',
          'transition-all duration-150',
          isVeryLow
            ? 'border-white/30 text-white hover:bg-white/10'
            : 'border-surface-border text-gray-400 hover:text-gray-200 hover:border-gray-500',
          interactions.button.base,
          interactions.button.press,
        )}
      >
        Skip
      </button>
    </div>
  )
}
