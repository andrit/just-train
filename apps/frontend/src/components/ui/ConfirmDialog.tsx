/**
 * ConfirmDialog — a specialised modal for destructive or irreversible actions.
 *
 * Composes `Modal` and `Button` — it is not a new primitive but a pattern.
 * Provides a consistent two-button (cancel / confirm) layout with a clear
 * visual distinction between neutral and dangerous confirmations.
 *
 * @example
 *   <ConfirmDialog
 *     open={showDelete}
 *     title="Delete exercise?"
 *     message="This cannot be undone."
 *     onConfirm={handleDelete}
 *     onCancel={() => setShowDelete(false)}
 *     confirmLabel="Delete"
 *     danger
 *   />
 */

import { Modal }   from './Modal'
import { Button }  from './Button'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConfirmDialogProps {
  /** Controls visibility. */
  open: boolean
  /** Short headline — what is the user confirming? */
  title: string
  /** Supporting detail — what will happen if they confirm? */
  message: string
  /** Called when the user clicks the confirm button. */
  onConfirm: () => void
  /** Called when the user clicks Cancel or dismisses the dialog. */
  onCancel: () => void
  /** Label for the confirm button. Defaults to `"Confirm"`. */
  confirmLabel?: string
  /**
   * When true, the confirm button uses the `danger` variant and the icon
   * changes to a warning symbol. Use for irreversible actions.
   */
  danger?: boolean
  /**
   * When true, the confirm button shows a loading spinner.
   * Prevents double-submission during async operations.
   */
  loading?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  danger       = false,
  loading      = false,
}: ConfirmDialogProps): React.JSX.Element | null {
  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      // Prevent accidental dismissal while a destructive action is in flight
      dismissOnBackdrop={!loading}
    >
      <div className="text-center">
        {/* Icon */}
        <div
          className={
            'w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl ' +
            (danger ? 'bg-ember-red/15' : 'bg-command-blue/15')
          }
          aria-hidden
        >
          {danger ? '⚠️' : '❓'}
        </div>

        {/* Copy */}
        <h3 className="font-display text-xl text-gray-100 mb-2">{title}</h3>
        <p className="text-sm text-gray-400 mb-6 leading-relaxed">{message}</p>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>

          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
