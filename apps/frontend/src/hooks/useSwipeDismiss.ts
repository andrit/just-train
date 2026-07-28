// ------------------------------------------------------------
// hooks/useSwipeDismiss.ts
//
// Downward swipe-to-dismiss for a drag handle. Spread the returned handlers onto
// the HANDLE element (not the scrollable body) so scrolling never triggers it:
//
//   const swipe = useSwipeDismiss(onClose)
//   <div {...swipe} className="drag-handle" />
//
// Records the touch-start Y; if the touch ends more than `threshold` px lower,
// calls onDismiss. Used by ActiveSessionOverlay (minimise) and BottomSheet (close).
// (HintPopover's sideways live-follow fling is a different interaction and stays
// bespoke.)
// ------------------------------------------------------------

import { useRef } from 'react'

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchEnd:   (e: React.TouchEvent) => void
}

export function useSwipeDismiss(onDismiss: () => void, threshold = 60): SwipeHandlers {
  const startY = useRef<number | null>(null)
  return {
    onTouchStart: (e) => { startY.current = e.touches[0]?.clientY ?? null },
    onTouchEnd: (e) => {
      if (startY.current === null) return
      const dy = (e.changedTouches[0]?.clientY ?? 0) - startY.current
      if (dy > threshold) onDismiss()
      startY.current = null
    },
  }
}
