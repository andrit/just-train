// ------------------------------------------------------------
// store/sessionStore.ts — Active session tracking state
//
// Tracks the currently open training session.
// When a session is active (trainer has tapped "Start Session"),
// this store holds the session data and queues any sets logged
// while offline for background sync (Phase 6).
//
// OFFLINE NOTE:
//   pendingSets are sets logged while offline. They are persisted
//   to IndexedDB (Phase 6) and synced when connectivity returns.
//   syncCount is the badge shown on the sync indicator in the UI.
// ------------------------------------------------------------

import { create } from 'zustand'

interface PendingSet {
  localId:           string   // Client-generated UUID for deduplication
  sessionExerciseId: string
  setNumber:         number
  payload:           Record<string, unknown>
  createdLocallyAt:  string   // ISO timestamp
}

interface SessionStore {
  // The ID of the currently open session, or null if no session is active
  activeSessionId: string | null

  // Sets queued for sync (offline mode — Phase 6)
  pendingSets: PendingSet[]

  // Number of pending operations waiting to sync
  syncCount: number

  // Actions
  setActiveSession: (sessionId: string | null) => void
  addPendingSet:    (set: PendingSet) => void
  clearPendingSet:  (localId: string) => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  activeSessionId: null,
  pendingSets:     [],
  syncCount:       0,

  setActiveSession: (sessionId) =>
    set({ activeSessionId: sessionId }),

  addPendingSet: (pendingSet) =>
    set((state) => ({
      pendingSets: [...state.pendingSets, pendingSet],
      syncCount:   state.syncCount + 1,
    })),

  clearPendingSet: (localId) =>
    set((state) => {
      const pendingSets = state.pendingSets.filter((s) => s.localId !== localId)
      return { pendingSets, syncCount: pendingSets.length }
    }),
}))
