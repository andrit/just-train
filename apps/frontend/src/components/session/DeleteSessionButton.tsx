// ------------------------------------------------------------
// components/session/DeleteSessionButton.tsx
//
// Two-step delete affordance for a saved session: a trash icon that flips to
// "Keep / Delete" in place, matching the inline confirm the in-progress session
// card already uses rather than introducing a modal.
//
// Shared because a session is reachable from several places — the Sessions list,
// the review panel, and the standalone history page (linked from the client
// timeline and from per-exercise history) — and a destructive action that only
// exists on some of those routes is worse than one that exists on none: you learn
// it is there, then cannot find it.
// ------------------------------------------------------------

import { useState }          from 'react'
import { cn }                from '@/lib/cn'
import { interactions }      from '@/lib/interactions'
import { Spinner }           from '@/components/ui/Spinner'
import { useDeleteSession }  from '@/hooks/useDeleteSession'

interface DeleteSessionButtonProps {
  session:    { id: string; clientId: string }
  /** Called after a successful delete — close the panel, navigate away, etc. */
  onDeleted?: () => void
  className?: string
}

export function DeleteSessionButton({
  session, onDeleted, className,
}: DeleteSessionButtonProps): React.JSX.Element {
  const [confirming, setConfirming] = useState(false)
  const { deleteSession, isDeleting } = useDeleteSession()

  const handleDelete = async (): Promise<void> => {
    try {
      await deleteSession(session)
    } catch {
      // Drop back to the idle state so the failure is visible rather than the
      // caller navigating away from a session that is still there.
      setConfirming(false)
      return
    }
    onDeleted?.()
  }

  if (confirming) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="px-2.5 py-1.5 rounded-lg text-xs text-gray-400 border border-surface-border hover:text-gray-200 transition-colors"
        >
          Keep
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className={cn(
            'px-2.5 py-1.5 rounded-lg text-xs font-medium',
            'bg-red-500/20 border border-red-500/40 text-red-400',
            interactions.button.base,
            interactions.button.press,
            isDeleting && 'opacity-50',
          )}
        >
          {isDeleting ? <Spinner size="sm" /> : 'Delete'}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label="Delete session"
      title="Delete session"
      className={cn('p-1.5 rounded-lg text-gray-600 hover:text-red-400 transition-colors', className)}
    >
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
        <path d="M3 4h10M6.5 4V3h3v1M5 4l.5 8h5L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
