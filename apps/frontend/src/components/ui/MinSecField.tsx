// ------------------------------------------------------------
// components/ui/MinSecField.tsx
//
// Two-box minutes : seconds input for a duration stored as total
// seconds. Used for cardio "time" targets (setup) and live logging,
// so a 20-minute bike is entered as 20 : 00 rather than 1200 seconds.
//
// The value in and out is always total seconds — the component owns
// only the min/sec split for display. Each box keeps its own string
// state so it can be cleared and overwritten freely (an empty box
// counts as 0 when emitting); seconds clamp 0–59, minutes 0–300.
// External changes to `seconds` (prefill, next set) resync the boxes;
// the component's own emits do not, so typing is never clobbered.
// ------------------------------------------------------------

import { useState, useEffect, useRef } from 'react'
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

// Keep only digits, then clamp numerically — an empty string stays empty
// (so the box can be cleared) and emits as 0.
const sanitize = (raw: string, clamp: (n: number) => number): string => {
  const digits = raw.replace(/\D/g, '')
  if (digits === '') return ''
  return String(clamp(parseInt(digits, 10)))
}

export function MinSecField({ seconds, onChange, label, size = 'md', onEnter }: MinSecFieldProps): React.JSX.Element {
  const [minStr, setMinStr] = useState(String(Math.floor(seconds / 60)))
  const [secStr, setSecStr] = useState(String(seconds % 60))
  // The last total this component emitted — lets us tell an external change
  // (prefill, set advance) apart from the echo of our own onChange.
  const lastTotal = useRef(seconds)

  useEffect(() => {
    if (seconds !== lastTotal.current) {
      setMinStr(String(Math.floor(seconds / 60)))
      setSecStr(String(seconds % 60))
      lastTotal.current = seconds
    }
  }, [seconds])

  const emit = (mStr: string, sStr: string): void => {
    const total = (parseInt(mStr, 10) || 0) * 60 + (parseInt(sStr, 10) || 0)
    lastTotal.current = total
    onChange(total)
  }

  const onMin = (raw: string): void => {
    const next = sanitize(raw, clampMin)
    setMinStr(next)
    emit(next, secStr)
  }
  const onSec = (raw: string): void => {
    const next = sanitize(raw, clampSec)
    setSecStr(next)
    emit(minStr, next)
  }

  const boxClass = cn(
    'text-center font-mono font-bold rounded-xl',
    'bg-brand-primary border-2 border-surface-border text-ink placeholder-ink-faint',
    'focus:outline-none focus:border-command-blue transition-colors',
    size === 'lg' ? 'text-3xl py-3 w-24' : 'text-2xl py-2 w-20',
  )

  return (
    <div className="flex flex-col items-center gap-1.5">
      {label && (
        <p className="text-[10px] uppercase tracking-widest text-ink-subtle">{label}</p>
      )}
      <div className="flex items-end gap-2">
        <div className="flex flex-col items-center gap-1">
          <input
            type="text"
            inputMode="numeric"
            value={minStr}
            onChange={(e) => onMin(e.target.value)}
            placeholder="0"
            aria-label="Minutes"
            className={boxClass}
          />
          <span className="text-[9px] uppercase tracking-wider text-ink-faint">min</span>
        </div>
        <span className="font-mono font-bold text-ink-subtle pb-5 text-2xl">:</span>
        <div className="flex flex-col items-center gap-1">
          <input
            type="text"
            inputMode="numeric"
            value={secStr}
            onChange={(e) => onSec(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter() }}
            placeholder="0"
            aria-label="Seconds"
            className={boxClass}
          />
          <span className="text-[9px] uppercase tracking-wider text-ink-faint">sec</span>
        </div>
      </div>
    </div>
  )
}
