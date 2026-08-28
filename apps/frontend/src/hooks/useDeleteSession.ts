// ------------------------------------------------------------
// hooks/useDeleteSession.ts
//
// Deleting a session is more than the DELETE call: the session may still be
// registered client-side (it was resumed at some point, or the store was never
// cleaned up), and leaving it there produces a phantom — a "Resume" card on the
// dashboard or a pill above the nav pointing at a session that no longer exists.
//
// Both delete affordances (the Sessions list card and the session review panel)
// go through here so that cleanup can't drift apart between them.
// ------------------------------------------------------------

import { useDiscardSession } from '@/lib/queries/sessions'
import { useSessionStore }   from '@/store/sessionStore'
import { useOverlayStore }   from '@/store/overlayStore'

interface DeletableSession {
  id:       string
  clientId: string
}

interface UseDeleteSession {
  /** Resolves once the session is gone and the client-side state is clean. Throws on failure. */
  deleteSession: (session: DeletableSession) => Promise<void>
  isDeleting:    boolean
}

export function useDeleteSession(): UseDeleteSession {
  const discard                              = useDiscardSession()
  const { endSession: clearFromStore }       = useSessionStore()
  const { focusedClientId, hide }            = useOverlayStore()

  const deleteSession = async (session: DeletableSession): Promise<void> => {
    // DELETE /sessions/:id is trainer-scoped and cascades to workouts,
    // exercises and sets. There is no undo — callers confirm first.
    await discard.mutateAsync({ id: session.id })
    clearFromStore(session.clientId)
    if (focusedClientId === session.clientId) hide()
  }

  return { deleteSession, isDeleting: discard.isPending }
}
