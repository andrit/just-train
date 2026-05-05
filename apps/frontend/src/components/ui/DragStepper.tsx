// ------------------------------------------------------------
// components/ui/DragStepper.tsx (v1.8.0)
//
// A number input with ▲/▼ stepper buttons AND a drag gesture.
// Dragging up increases, dragging down decreases.
//
// DRAG FEEL: "slow is smooth, smooth is fast"
//   - Linear, no acceleration or velocity jumps
//   - 8px of drag = 1 step (controlled, deliberate)
//   - No skipping — only ever changes by 1 per drag threshold
//   - Works on both touch and mouse
//
// Used for: target reps and target sets when adding an exercise.
// ------------------------------------------------------------

import { useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/cn'

interface DragStepperProps {
  value:     number
  onChange:  (value: number) => void
  min?:      number
  max?:      number
  label?:    string
}

const PX_PER_STEP = 8   // drag pixels needed for one increment/decrement
const MIN_DEFAULT = 1
const MAX_DEFAULT = 30

export function DragStepper({
  value,
  onChange,
  min = MIN_DEFAULT,
  max = MAX_DEFAULT,
  label,
}: DragStepperProps): React.JSX.Element {
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY    = useRef<number>(0)
  const dragAccum     = useRef<number>(0)  // accumulated px since last step
  const valueAtStart  = useRef<number>(value)

  const clamp = useCallback((v: number): number =>
    Math.min(max, Math.max(min, v)), [min, max])

  const increment = (): void => onChange(clamp(value + 1))
  const decrement = (): void => onChange(clamp(value - 1))

  // ── Touch handlers ────────────────────────────────────────────────────────

  const onTouchStart = useCallback((e: React.TouchEvent): void => {
    e.preventDefault()
    const touch = e.touches[0]
    if (!touch) return
    dragStartY.current   = touch.clientY
    dragAccum.current    = 0
    valueAtStart.current = value
    setIsDragging(true)
  }, [value])

  const onTouchMove = useCallback((e: React.TouchEvent): void => {
    if (!isDragging) return
    const touch = e.touches[0]
    if (!touch) return
    const dy = dragStartY.current - touch.clientY  // positive = dragging up = increase

    // How many steps since drag start (total, not delta)
    const steps = Math.trunc(dy / PX_PER_STEP)
    const next  = clamp(valueAtStart.current + steps)
    if (next !== value) onChange(next)
  }, [isDragging, value, onChange, clamp])

  const onTouchEnd = useCallback((): void => {
    setIsDragging(false)
    dragAccum.current = 0
  }, [])

  // ── Mouse handlers (desktop support) ──────────────────────────────────────

  const onMouseDown = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    dragStartY.current   = e.clientY
    dragAccum.current    = 0
    valueAtStart.current = value
    setIsDragging(true)

    const onMove = (ev: MouseEvent): void => {
      const dy    = dragStartY.current - ev.clientY
      const steps = Math.trunc(dy / PX_PER_STEP)
      const next  = clamp(valueAtStart.current + steps)
      onChange(next)
    }
    const onUp = (): void => {
      setIsDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }, [value, onChange, clamp])

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {label && (
        <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
      )}

      {/* Up button */}
      <button
        type="button"
        onClick={increment}
        disabled={value >= max}
        aria-label={`Increase ${label ?? 'value'}`}
        className={cn(
          'w-8 h-6 flex items-center justify-center rounded-lg',
          'text-gray-400 hover:text-white hover:bg-surface',
          'transition-colors duration-100 active:scale-95',
          value >= max && 'opacity-30 cursor-not-allowed',
        )}
      >
        <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
          <path d="M2 8l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Value — draggable */}
      <div
        role="spinbutton"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={0}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp')   { e.preventDefault(); increment() }
          if (e.key === 'ArrowDown') { e.preventDefault(); decrement() }
        }}
        className={cn(
          'w-12 h-12 flex items-center justify-center rounded-xl',
          'font-mono font-bold text-2xl text-white',
          'border-2 transition-all duration-100 cursor-ns-resize',
          isDragging
            ? 'border-command-blue bg-command-blue/10 scale-105'
            : 'border-surface-border bg-surface hover:border-command-blue/40',
          'focus-visible:outline-none focus-visible:border-command-blue',
        )}
      >
        {value}
      </div>

      {/* Down button */}
      <button
        type="button"
        onClick={decrement}
        disabled={value <= min}
        aria-label={`Decrease ${label ?? 'value'}`}
        className={cn(
          'w-8 h-6 flex items-center justify-center rounded-lg',
          'text-gray-400 hover:text-white hover:bg-surface',
          'transition-colors duration-100 active:scale-95',
          value <= min && 'opacity-30 cursor-not-allowed',
        )}
      >
        <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
