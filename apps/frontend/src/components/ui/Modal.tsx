/**
 * Modal — a centred overlay dialog.
 *
 * Accessibility checklist:
 *   ✓ `role="dialog"` with `aria-modal="true"`
 *   ✓ `aria-labelledby` pointing at the title heading
 *   ✓ Focus trapped inside while open (useFocusTrap)
 *   ✓ Body scroll locked while open (useBodyScrollLock)
 *   ✓ Closes on Escape (useKeyDown)
 *   ✓ Closes on backdrop click (pointer-events guard prevents inner clicks)
 *   ✓ Focus restored to trigger element on close (useFocusTrap)
 *   ✓ Rendered into `document.body` via React Portal so z-index and
 *     stacking contexts are never an issue
 *
 * Three sizes: sm (max-w-sm), md (max-w-lg, default), lg (max-w-2xl)
 */

import { useRef, useId }    from 'react'
import { createPortal }     from 'react-dom'
import { cn }               from '@/lib/cn'
import { useKeyDown }       from '@/hooks/useKeyDown'
import { useBodyScrollLock} from '@/hooks/useBodyScrollLock'
import { useFocusTrap }     from '@/hooks/useFocusTrap'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ModalSize = 'sm' | 'md' | 'lg'

export interface ModalProps {
  /** Controls visibility. */
  open: boolean
  /** Called when the user dismisses the modal (Escape, backdrop, close button). */
  onClose: () => void
  /** Heading text rendered in the modal header. Also used for `aria-labelledby`. */
  title?: string
  /** Width constraint. Defaults to `"md"`. */
  size?: ModalSize
  children: React.ReactNode
  /**
   * When true, clicking the backdrop does NOT close the modal.
   * Useful for forms with unsaved state.
   */
  dismissOnBackdrop?: boolean
  className?: string
}

// ── Style map ─────────────────────────────────────────────────────────────────

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  children,
  dismissOnBackdrop = true,
  className,
}: ModalProps): React.JSX.Element | null {
  const panelRef  = useRef<HTMLDivElement>(null)
  const titleId   = useId()

  useKeyDown('Escape', onClose, open)
  useBodyScrollLock(open)
  useFocusTrap(panelRef, open)

  if (!open) return null

  const handleBackdropPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    // Only close if the click landed directly on the backdrop, not a child
    if (dismissOnBackdrop && e.target === e.currentTarget) onClose()
  }

  return createPortal(
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onPointerDown={handleBackdropPointerDown}
      aria-hidden={!open}
    >
      {/* Background blur */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        aria-hidden
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby={title != null ? titleId : undefined}
        className={cn(
          'relative w-full rounded-2xl',
          'bg-brand-secondary border border-surface-border',
          'shadow-2xl animate-slide-up',
          sizeClasses[size],
          className,
        )}
      >
        {/* Header */}
        {title != null && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
            <h2
              id={titleId}
              className="font-display text-xl text-gray-100"
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className={cn(
                'w-8 h-8 flex items-center justify-center rounded-lg',
                'text-gray-500 hover:text-gray-300 hover:bg-surface-raised',
                'transition-colors focus-visible:outline-none',
                'focus-visible:ring-2 focus-visible:ring-command-blue',
              )}
            >
              ✕
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
