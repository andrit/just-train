// ------------------------------------------------------------
// components/ui/BottomSheet.tsx (v1.8.0)
//
// Mobile-first slide-up overlay. Faster to dismiss than a modal
// during a live session — swipe down or tap backdrop.
//
// Uses a CSS transform transition rather than a portal, keeping
// it simple and predictable within the session layout.
// ------------------------------------------------------------

import { useEffect, useRef } from 'react'
import { cn }                from '@/lib/cn'

interface BottomSheetProps {
  open:      boolean
  onClose:   () => void
  title?:    string
  children:  React.ReactNode
  /** Max height as a CSS value — default 80vh */
  maxHeight?: string
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeight = '80vh',
}: BottomSheetProps): React.JSX.Element {
  const sheetRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm',
          'transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal
        aria-label={title}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'bg-brand-secondary rounded-t-2xl border-t border-surface-border',
          'transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{ maxHeight }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-surface-border" />
        </div>

        {/* Title */}
        {title && (
          <div className="flex items-center justify-between px-5 pb-3 border-b border-surface-border">
            <h2 className="font-display text-lg uppercase tracking-wide text-white">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-gray-500 hover:text-gray-300 p-1"
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: `calc(${maxHeight} - 80px)` }}>
          {children}
        </div>
      </div>
    </>
  )
}
