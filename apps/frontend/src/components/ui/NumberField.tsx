// ------------------------------------------------------------
// components/ui/NumberField.tsx
//
// Directly typeable numeric input with optional − / + stepper buttons.
// The typeable replacement for DragStepper where entering multi-digit
// values matters (weight, reps, sets).
//
// - `type="text" inputMode="numeric|decimal"` — full typing control, the
//   mobile numeric keypad, and NO native desktop spinner arrows.
// - Keeps an internal text buffer so partial/empty states while typing
//   don't fight the caller; commits a clamped number on change/blur.
// - Steppers are an adjunct, not the only way in.
// ------------------------------------------------------------

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

// Hold-to-jump: press and hold a ▲/▼ to move in coarse ×5 jumps at a constant
// cadence (never accelerating), with a brief buffer between each. A quick tap
// still nudges by one `step`. Tune these three to change the feel.
const HOLD_ARM_MS    = 500   // hold this long before coarse ×5 stepping begins
const HOLD_REPEAT_MS = 600   // constant gap between ×5 jumps — never accelerates
const HOLD_STEP      = 5     // coarse jump size on hold

interface NumberFieldProps {
  value:        number | null
  onChange:     (value: number | null) => void
  min?:         number
  max?:         number
  step?:        number
  decimal?:     boolean
  /** Allow an empty value (emits null). For optional fields like weight. */
  allowEmpty?:  boolean
  label?:       string
  placeholder?: string
  /** Small unit shown inside the field, e.g. "lbs". */
  suffix?:      string
  inputClassName?: string
}

export function NumberField({
  value, onChange,
  min, max, step = 1,
  decimal = false, allowEmpty = false,
  label, placeholder, suffix, inputClassName,
}: NumberFieldProps): React.JSX.Element {
  const [text, setText]  = useState<string>(value == null ? '' : String(value))
  const isFocused        = useRef(false)

  // Sync the buffer when the value changes from outside (ramp expand, stepper)
  // — but never clobber what the user is actively typing.
  useEffect(() => {
    if (isFocused.current) return
    setText(value == null ? '' : String(value))
  }, [value])

  const clamp = (n: number): number => {
    if (min != null) n = Math.max(min, n)
    if (max != null) n = Math.min(max, n)
    return n
  }

  const parse = (raw: string): number | null => {
    if (raw.trim() === '') return null
    const n = decimal ? parseFloat(raw) : parseInt(raw, 10)
    return Number.isNaN(n) ? null : n
  }

  const commit = (raw: string): void => {
    // Allow a lone "." (or "") mid-typing without forcing a value.
    setText(raw)
    const n = parse(raw)
    if (n == null) { if (allowEmpty) onChange(null); return }
    onChange(clamp(n))
  }

  const nudge = (dir: 1 | -1): void => {
    const base = parse(text) ?? value ?? min ?? 0
    const next = clamp(base + dir * step)
    setText(String(next))
    onChange(next)
  }

  // ── Hold-to-jump (coarse ×5 stepping) ──────────────────────────────────────
  const liveValue   = useRef<number>(value ?? min ?? 0)
  const holdTimer   = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const didHold     = useRef(false)
  const suppressTap = useRef(false)

  // Seeded on press and updated every jump, so each repeat adds to the latest
  // value rather than a stale one captured when the hold began.
  const jump = (dir: 1 | -1): void => {
    const next = clamp(liveValue.current + dir * HOLD_STEP)
    liveValue.current = next
    setText(String(next))
    onChange(next)
  }

  const startHold = (dir: 1 | -1) => (): void => {
    didHold.current   = false
    liveValue.current = parse(text) ?? value ?? min ?? 0
    holdTimer.current = setTimeout(() => {
      didHold.current = true
      jump(dir)                                               // first coarse jump
      repeatTimer.current = setInterval(() => jump(dir), HOLD_REPEAT_MS)
    }, HOLD_ARM_MS)
  }

  const endHold = (): void => {
    if (holdTimer.current)   { clearTimeout(holdTimer.current);   holdTimer.current = null }
    if (repeatTimer.current) { clearInterval(repeatTimer.current); repeatTimer.current = null }
    if (didHold.current) suppressTap.current = true            // swallow the release-click
    didHold.current = false
  }

  // A quick tap nudges by one `step`; the click that trails a hold is suppressed.
  const handleTap = (dir: 1 | -1) => (): void => {
    if (suppressTap.current) { suppressTap.current = false; return }
    nudge(dir)
  }

  // Clear any running timers if the field unmounts mid-hold.
  useEffect(() => () => {
    if (holdTimer.current)   clearTimeout(holdTimer.current)
    if (repeatTimer.current) clearInterval(repeatTimer.current)
  }, [])

  const handleBlur = (): void => {
    isFocused.current = false
    const n = parse(text)
    if (n == null) {
      if (allowEmpty) { setText(''); onChange(null) }
      else { const f = clamp(value ?? min ?? 0); setText(String(f)); onChange(f) }
    } else {
      const c = clamp(n)
      setText(String(c))
      onChange(c)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      {label && <p className="text-[10px] uppercase tracking-widest text-ink-subtle">{label}</p>}
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label ?? 'value'}`}
          onPointerDown={startHold(-1)}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
          onContextMenu={(e) => e.preventDefault()}
          onClick={handleTap(-1)}
          className="w-9 select-none rounded-xl border border-surface-border text-ink-muted hover:text-ink hover:border-command-blue/40 transition-colors flex items-center justify-center active:scale-95"
        >
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none"><path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>

        <div className="relative">
          <input
            type="text"
            inputMode={decimal ? 'decimal' : 'numeric'}
            value={text}
            placeholder={placeholder}
            onFocus={() => { isFocused.current = true }}
            onChange={(e) => commit(e.target.value)}
            onBlur={handleBlur}
            className={cn('field w-24 text-center text-2xl font-mono font-bold', suffix && 'pr-8', inputClassName)}
          />
          {suffix && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-faint pointer-events-none">
              {suffix}
            </span>
          )}
        </div>

        <button
          type="button"
          aria-label={`Increase ${label ?? 'value'}`}
          onPointerDown={startHold(1)}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
          onContextMenu={(e) => e.preventDefault()}
          onClick={handleTap(1)}
          className="w-9 select-none rounded-xl border border-surface-border text-ink-muted hover:text-ink hover:border-command-blue/40 transition-colors flex items-center justify-center active:scale-95"
        >
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </div>
    </div>
  )
}
