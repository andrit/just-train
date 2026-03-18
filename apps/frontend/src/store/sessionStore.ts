// ------------------------------------------------------------
// store/sessionStore.ts (v1.8.0)
//
// Persists active session IDs per client so navigating away
// and back doesn't lose the session.
//
// DESIGN:
//   - Map of clientId → ActiveSession
//   - Persisted to localStorage (session IDs are not sensitive)
//   - Each client has at most one active session at a time
//   - Session is removed when ended (EndSessionModal confirms)
//   - Athlete's own session uses their self-client ID as the key
//
// BACKWARD COMPAT:
//   The old store had a single activeSessionId — removed in v1.8.0.
//   The offline pendingSets queue is kept for Phase 8 (offline sync).
// ------------------------------------------------------------

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ActiveSession {
  sessionId:  string
  clientId:   string
  clientName: string
  startedAt:  string   // ISO string
}

interface SessionStoreState {
  // clientId → ActiveSession
  activeSessions: Record<string, ActiveSession>

  startSession:  (clientId: string, sessionId: string, clientName: string) => void
  endSession:    (clientId: string) => void
  getSession:    (clientId: string) => ActiveSession | null
  hasSession:    (clientId: string) => boolean
  clearAll:      () => void
}

export const useSessionStore = create<SessionStoreState>()(
  persist(
    (set, get) => ({
      activeSessions: {},

      startSession: (clientId, sessionId, clientName) => {
        set((state) => ({
          activeSessions: {
            ...state.activeSessions,
            [clientId]: {
              sessionId,
              clientId,
              clientName,
              startedAt: new Date().toISOString(),
            },
          },
        }))
      },

      endSession: (clientId) => {
        set((state) => {
          const next = { ...state.activeSessions }
          delete next[clientId]
          return { activeSessions: next }
        })
      },

      getSession: (clientId) => {
        return get().activeSessions[clientId] ?? null
      },

      hasSession: (clientId) => {
        return clientId in get().activeSessions
      },

      clearAll: () => set({ activeSessions: {} }),
    }),
    {
      name: 'trainer-app-sessions',
    }
  )
)
