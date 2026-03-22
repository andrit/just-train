// ------------------------------------------------------------
// store/sessionStore.ts (v2.1.0)
//
// Tracks both active (executing) and planned (being built) sessions.
//
// ACTIVE SESSIONS:
//   - clientId → ActiveSession (one per client at a time)
//   - Persisted to localStorage
//   - Cleared when session ends
//
// PLANNED SESSIONS:
//   - sessionId → PlannedSession (many open at once)
//   - Persisted to localStorage
//   - Cleared when executed or discarded
// ------------------------------------------------------------

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ActiveSession {
  sessionId:  string
  clientId:   string
  clientName: string
  startedAt:  string   // ISO string
}

export interface PlannedSession {
  sessionId:  string
  clientId:   string
  clientName: string
  name:       string   // e.g. "Chest Day", "Thursday Push"
  createdAt:  string   // ISO string
}

interface SessionStoreState {
  activeSessions:  Record<string, ActiveSession>   // clientId → session
  plannedSessions: Record<string, PlannedSession>  // sessionId → plan

  // Active
  startSession:  (clientId: string, sessionId: string, clientName: string) => void
  endSession:    (clientId: string) => void
  getSession:    (clientId: string) => ActiveSession | null
  hasSession:    (clientId: string) => boolean

  // Planned
  addPlannedSession:    (session: PlannedSession) => void
  removePlannedSession: (sessionId: string) => void
  getPlannedSessions:   () => PlannedSession[]
  hasPlannedSession:    (sessionId: string) => boolean

  clearAll: () => void
}

export const useSessionStore = create<SessionStoreState>()(
  persist(
    (set, get) => ({
      activeSessions:  {},
      plannedSessions: {},

      // ── Active ────────────────────────────────────────────────────────────

      startSession: (clientId, sessionId, clientName) => {
        set((state) => ({
          activeSessions: {
            ...state.activeSessions,
            [clientId]: { sessionId, clientId, clientName, startedAt: new Date().toISOString() },
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

      getSession:  (clientId)  => get().activeSessions[clientId] ?? null,
      hasSession:  (clientId)  => clientId in get().activeSessions,

      // ── Planned ───────────────────────────────────────────────────────────

      addPlannedSession: (session) => {
        set((state) => ({
          plannedSessions: { ...state.plannedSessions, [session.sessionId]: session },
        }))
      },

      removePlannedSession: (sessionId) => {
        set((state) => {
          const next = { ...state.plannedSessions }
          delete next[sessionId]
          return { plannedSessions: next }
        })
      },

      getPlannedSessions: () => Object.values(get().plannedSessions),
      hasPlannedSession:  (sessionId) => sessionId in get().plannedSessions,

      clearAll: () => set({ activeSessions: {}, plannedSessions: {} }),
    }),
    { name: 'trainer-app-sessions' }
  )
)
