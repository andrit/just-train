// ------------------------------------------------------------
// components/ui/MinSecField.tsx
//
// Two-box minutes : seconds input for a duration stored as total
// seconds. Used for cardio "time" targets (setup) and live logging,
// so a 20-minute bike is entered as 20 : 00 rather than 1200 seconds.
//
// The value in and out is always total seconds — the component owns
// only the min/sec split for display. Seconds clamp 0–59; minutes 0–300.
// ------------------------------------------------------------

import { cn } from '@/lib/cn'

interface MinSecFieldProps {
  /** Current value as total seconds. */
  seconds:  number
  /** Emits the new total seconds whenever either box changes. */
  onChange: (totalSeconds: number) => void
  label?:   string
  size?:    'md' | 'lg'
  /** Fired on Enter in the seconds box (live logging hooks its log action here). */
  onEnter?: () => void
}

const clampMin = (m: number): number => Math.max(0, Math.min(300, m))
const clampSec = (s: number): number => Math.max(0, Math.min(59, s))

export function MinSecField({ seconds, onChange, label, size = 'md', onEnter }: MinSecFieldProps): React.JSX.Element {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  const setMinutes = (raw: string): void => onChange(clampMin(parseInt(raw, 10) || 0) * 60 + secs)
  const setSeconds = (raw: string): void => onChange(mins * 60 + clampSec(parseInt(raw, 10) || 0))

  const boxClass = cn(
    'text-center font-mono font-bold rounded-xl',
    'bg-brand-primary border-2 border-surface-border text-white',
    'focus:outline-none focus:border-command-blue transition-colors',
    size === 'lg' ? 'text-3xl py-3 w-24' : 'text-2xl py-2 w-20',
  )

  return (
    <div className="flex flex-col items-center gap-1.5">
      {label && (
        <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
      )}
      <div className="flex items-end gap-2">
        <div className="flex flex-col items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            value={mins}
            min={0}
            max={300}
            onChange={(e) => setMinutes(e.target.value)}
            aria-label="Minutes"
            className={boxClass}
          />
          <span className="text-[9px] uppercase tracking-wider text-gray-600">min</span>
        </div>
        <span className="font-mono font-bold text-gray-500 pb-5 text-2xl">:</span>
        <div className="flex flex-col items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            value={secs}
            min={0}
            max={59}
            onChange={(e) => setSeconds(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter() }}
            aria-label="Seconds"
            className={boxClass}
          />
          <span className="text-[9px] uppercase tracking-wider text-gray-600">sec</span>
        </div>
      </div>
    </div>
  )
}
