// ------------------------------------------------------------
// components/ui/HintPopover.tsx
//
// A small circular "?"/"i" button (see `glyph`) that opens a hint bubble. The
// bubble is swipe-to-dismiss (drag horizontally past a threshold to fling it
// away) and also closes on backdrop tap, Escape, or tapping the button again.
//
// Reusable tip affordance — used for the {date} hint (SessionCloseout) and the
// metric tooltips on the Personal Bests tab.
// ------------------------------------------------------------

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

interface HintPopoverProps {
  /** Hint body text. */
  text:       string
  /** Glyph inside the circular button — "?" (help) or "i" (info). */
  glyph?:     string
  /** Extra classes on the button wrapper (usually positioning). */
  className?: string
  /** Bubble placement relative to the button. */
  side?:      'top' | 'bottom'
  ariaLabel?: string
}

const DISMISS_THRESHOLD = 50   // px of horizontal travel to fling-dismiss

export function HintPopover({
  text,
  glyph = '?',
  className,
  side = 'bottom',
  ariaLabel = 'More info',
}: HintPopoverProps): React.JSX.Element {
  const [open, setOpen]         = useState(false)
  const [dragX, setDragX]       = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)

  const close = (): void => { setOpen(false); setDragX(0); setDragging(false) }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const onTouchStart = (e: React.TouchEvent): void => {
    startX.current = e.touches[0]?.clientX ?? 0
    setDragging(true)
  }
  const onTouchMove = (e: React.TouchEvent): void => {
    setDragX((e.touches[0]?.clientX ?? startX.current) - startX.current)
  }
  const onTouchEnd = (): void => {
    setDragging(false)
    if (Math.abs(dragX) > DISMISS_THRESHOLD) {
      setDragX(dragX > 0 ? 340 : -340)   // fling out; transition animates it
      window.setTimeout(close, 180)
    } else {
      setDragX(0)                         // snap back
    }
  }

  return (
    <span className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className="w-4 h-4 rounded-full border border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300 text-[10px] font-bold leading-none flex items-center justify-center transition-colors"
      >
        {glyph}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div
            role="tooltip"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{
              transform: `translateX(calc(-50% + ${dragX}px))`,
              opacity:   Math.max(0, 1 - Math.abs(dragX) / 200),
            }}
            className={cn(
              'absolute left-1/2 z-50 w-60 px-3 py-2.5 rounded-xl',
              'text-xs text-gray-300 leading-relaxed touch-pan-y select-none',
              'bg-brand-primary border border-surface-border shadow-lg',
              side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
              dragging ? 'transition-none' : 'transition-all duration-200',
            )}
          >
            {text}
          </div>
        </>
      )}
    </span>
  )
}
