/**
 * Drawer — a panel that slides in from the right edge of the screen.
 *
 * Used for detail views (exercise, client) where the trainer needs to
 * see contextual info without losing their place in the list behind it.
 *
 * Accessibility checklist:
 *   ✓ `role="dialog"` with `aria-modal="true"`
 *   ✓ `aria-labelledby` pointing at the title
 *   ✓ Focus trapped inside (useFocusTrap)
 *   ✓ Body scroll locked (useBodyScrollLock)
 *   ✓ Escape closes (useKeyDown)
 *   ✓ Backdrop click closes
 *   ✓ Rendered into `document.body` via React Portal
 */

import { useRef, useId }     from 'react'
import { createPortal }      from 'react-dom'
import { cn }                from '@/lib/cn'
import { useKeyDown }        from '@/hooks/useKeyDown'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useFocusTrap }      from '@/hooks/useFocusTrap'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DrawerProps {
  /** Controls visibility. */
  open: boolean
  /** Called when the user dismisses the drawer. */
  onClose: () => void
  /** Heading text rendered in the drawer header. */
  title?: string
  children: React.ReactNode
  /**
   * Maximum width of the drawer panel.
   * Defaults to `"max-w-md"` (~448 px).
   */
  width?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Drawer({
  open,
  onClose,
  title,
  children,
  width = 'max-w-md',
}: DrawerProps): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId  = useId()

  useKeyDown('Escape', onClose, open)
  useBodyScrollLock(open)
  useFocusTrap(panelRef, open)

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex" aria-hidden={!open}>
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/60 backdrop-blur-sm animate-fade-in"
        aria-hidden
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby={title != null ? titleId : undefined}
        className={cn(
          'w-full bg-brand-secondary border-l border-surface-border',
          'flex flex-col animate-slide-in-right overflow-y-auto',
          width,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border shrink-0">
          <h2
            id={titleId}
            className="font-display text-xl text-gray-100"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className={cn(
              'w-8 h-8 flex items-center justify-center rounded-lg',
              'text-gray-500 hover:text-gray-300 hover:bg-surface-raised',
              'transition-colors focus-visible:outline-none',
              'focus-visible:ring-2 focus-visible:ring-brand-highlight',
            )}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
