// ------------------------------------------------------------
// components/shell/SessionPlanPanel.tsx (v2.1.0)
//
// Plan builder for a planned session. Opened as a panel (z-10)
// from the Sessions page or client profile.
//
// FLOW:
//   1. Trainer picks a client (if trainer mode)
//   2. Names the session ("Chest Day", "Thursday Push", optional)
//   3. Adds workout blocks + exercises with targets (same UI as live)
//   4. Saves — session stays as status: planned
//   5. Execute button → transitions to in_progress, expands overlay
//
// The plan builder reuses WorkoutBlock and AddBlockSheet from
// the live session UI — same interaction, different context.
// ------------------------------------------------------------

import { useState }                              from 'react'
import { cn }                                    from '@/lib/cn'
import { interactions }                          from '@/lib/interactions'
import { usePreferences }                        from '@/hooks/usePreferences'
import { useAuthStore }                          from '@/store/authStore'
import { useSessionStore }                       from '@/store/sessionStore'
import { useOverlayStore }                       from '@/store/overlayStore'
import { useClients, useSelfClient }             from '@/lib/queries/clients'
import {
  useSession,
  useCreateSession,
  useExecuteSession,
  useUpdateSessionName,
  useDiscardSession,
} from '@/lib/queries/sessions'
import { WorkoutBlock }                          from '@/components/session/WorkoutBlock'
import { AddBlockSheet }                         from '@/components/session/AddBlockSheet'
import { Spinner }                               from '@/components/ui/Spinner'
import { NamePromptModal }                       from '@/components/ui/NamePromptModal'
import { TemplatePickerSheet }                   from '@/components/templates/TemplatePickerSheet'
import { useCreateTemplate }                     from '@/lib/queries/templates'
import { toast }                                 from '@/store/toastStore'

interface SessionPlanPanelProps {
  /** If provided, editing an existing planned session */
  sessionId?:  string
  /** Pre-selected client */
  clientId?:   string
  onClose:     () => void
}

export function SessionPlanPanel({
  sessionId: existingSessionId,
  clientId:  initialClientId,
  onClose,
}: SessionPlanPanelProps): React.JSX.Element {
  const trainer        = useAuthStore((s) => s.trainer)
  const { trainerMode }= usePreferences()
  const weightUnit     = trainer?.weightUnitPreference ?? 'lbs'

  const { data: selfClient }  = useSelfClient()
  const { data: clients }     = useClients()
  const { addPlannedSession, removePlannedSession } = useSessionStore()
  const { expand }             = useOverlayStore()

  const createSession  = useCreateSession()
  const executeSession = useExecuteSession()
  const updateName     = useUpdateSessionName()
  const discardSession = useDiscardSession()
  const createTemplate = useCreateTemplate()

  // ── Save current session plan as a template ───────────────────────────────
  // Opens name prompt — then saves and shows toast on success
  const handleSaveAsTemplate = (): void => {
    if (!session || !workouts.length) return
    setNamePromptOpen(true)
  }

  const handleSaveAsTemplateConfirm = async (name: string): Promise<void> => {
    setNamePromptOpen(false)
    setSavingAsTemplate(true)
    try {
      await createTemplate.mutateAsync({ name })
      toast.success('Template saved!')
    } catch {
      toast.error('Failed to save template')
    } finally {
      setSavingAsTemplate(false)
    }
  }

  // ── State ─────────────────────────────────────────────────────────────────

  const [sessionId,        setSessionId]        = useState<string | null>(existingSessionId ?? null)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    initialClientId ?? (trainerMode === 'athlete' ? selfClient?.id ?? null : null)
  )
  const [sessionName,   setSessionName]   = useState('')
  const [nameEditing,   setNameEditing]   = useState(false)
  const [addBlockOpen,  setAddBlockOpen]  = useState(false)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [namePromptOpen,     setNamePromptOpen]     = useState(false)
  const [savingAsTemplate,   setSavingAsTemplate]   = useState(false)
  const [error,              setError]              = useState<string | null>(null)
  const [creating,           setCreating]           = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  // Load session if editing existing
  const { data: session, isLoading: sessionLoading } = useSession(sessionId)

  // ── Create the session record (deferred until first block is added) ───────
  // We create lazily so we don't create ghost sessions if the user cancels.

  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId

    const clientId = selectedClientId
    if (!clientId) throw new Error('No client selected')

    setCreating(true)
    try {
      const created = await createSession.mutateAsync({
        clientId,
        date:   new Date().toISOString().split('T')[0] ?? '',
        name:   sessionName.trim() || undefined,
      })

      const clientName = clients?.find(c => c.id === clientId)?.name
        ?? selfClient?.name
        ?? 'Client'

      addPlannedSession({
        sessionId:  created.id,
        clientId,
        clientName,
        name:       sessionName.trim() || 'Untitled Plan',
        createdAt:  new Date().toISOString(),
      })

      setSessionId(created.id)
      return created.id
    } finally {
      setCreating(false)
    }
  }

  const handleAddBlock = async (): Promise<void> => {
    try {
      await ensureSession()
      setAddBlockOpen(true)
    } catch (_e) {
      setError('Please select a client first')
    }
  }

  const handleNameBlur = async (): Promise<void> => {
    setNameEditing(false)
    if (sessionId && sessionName.trim()) {
      updateName.mutate({ id: sessionId, name: sessionName.trim() })
    }
  }

  // ── Execute — transition planned → in_progress, open overlay ─────────────

  const handleExecute = async (): Promise<void> => {
    if (!sessionId || !selectedClientId) return
    setError(null)
    try {
      await executeSession.mutateAsync({ id: sessionId })

      const clientName = clients?.find(c => c.id === selectedClientId)?.name
        ?? selfClient?.name
        ?? 'Client'

      removePlannedSession(sessionId)
      useSessionStore.getState().startSession(selectedClientId, sessionId, clientName)
      expand(selectedClientId)
      onClose()
    } catch {
      setError('Could not start session — please try again')
    }
  }

  const handleDiscard = (): void => {
    if (!sessionId) {
      // Session never created — just close
      onClose()
      return
    }
    discardSession.mutate(
      { id: sessionId },
      {
        onSuccess: () => {
          removePlannedSession(sessionId)
          onClose()
        },
        onError: () => setError('Could not discard session — please try again'),
      },
    )
  }

  const workouts   = session?.workouts ?? []
  const clientName = selectedClientId
    ? (clients?.find(c => c.id === selectedClientId)?.name ?? selfClient?.name ?? 'Client')
    : null

  const allClients = [
    ...(selfClient ? [selfClient] : []),
    ...(clients ?? []).filter(c => !c.isSelf),
  ]

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-surface-border shrink-0">

        {/* Nav */}
        <div className="flex items-center justify-between mb-4">
          {showDiscardConfirm ? (
            <div className="flex items-center gap-2 w-full">
              <span className="text-xs text-gray-400 flex-1">Discard this plan?</span>
              <button
                type="button"
                onClick={handleDiscard}
                disabled={discardSession.isPending}
                className="text-xs text-red-400 hover:text-red-300 font-medium"
              >
                {discardSession.isPending ? '…' : 'Discard'}
              </button>
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className={cn('flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300', interactions.button.base)}
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                  <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back
              </button>

              <div className="flex items-center gap-2">
                {/* Discard button — subtle, always available once a session exists or is being built */}
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(true)}
                  className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1"
                >
                  Discard
                </button>

                {/* Save as template */}
                {sessionId && workouts.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSaveAsTemplate}
                    disabled={savingAsTemplate}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium',
                      'border border-surface-border text-gray-400',
                      'hover:border-brand-highlight/40 hover:text-brand-highlight',
                      interactions.button.base,
                      interactions.button.press,
                    )}
                  >
                    {savingAsTemplate ? <Spinner size="sm" /> : (
                      <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3">
                        <path d="M3 3h7l3 3v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M5 3v4h6V3" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M4 10h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    )}
                    Save as template
                  </button>
                )}

                {/* Save Plan — always available once session is created in DB */}
                {sessionId && (
                  <button
                    type="button"
                    onClick={() => { toast.success('Plan saved!'); onClose() }}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium',
                      'border border-surface-border text-gray-300',
                      'hover:border-brand-highlight/40 hover:text-white',
                      interactions.button.base,
                      interactions.button.press,
                    )}
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                      <path d="M2 9l4 4 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Save Plan
                  </button>
                )}

                {/* Execute — only when session has blocks */}
                {sessionId && workouts.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExecute}
                    disabled={executeSession.isPending}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium',
                      'bg-brand-highlight text-white',
                      interactions.button.base,
                      interactions.button.press,
                      executeSession.isPending && 'opacity-50',
                    )}
                  >
                    {executeSession.isPending ? (
                      <Spinner size="sm" />
                    ) : (
                      <>
                        <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                          <path d="M4 3l10 5-10 5V3z" fill="currentColor" />
                        </svg>
                        Execute
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Session name input */}
        {nameEditing ? (
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNameBlur() }}
            placeholder="e.g. Chest Day, Thursday Push..."
            autoFocus
            className="field text-lg font-display uppercase tracking-wide w-full mb-2"
          />
        ) : (
          <button
            type="button"
            onClick={() => setNameEditing(true)}
            className="text-left mb-2 group"
          >
            <h1 className={cn(
              'font-display text-2xl uppercase tracking-wide leading-tight',
              sessionName ? 'text-white' : 'text-gray-600',
            )}>
              {sessionName || 'Untitled Plan'}
            </h1>
            <p className="text-xs text-gray-600 group-hover:text-gray-400 mt-0.5">
              {clientName ?? 'Select a client'} · tap to rename
              {sessionId
                ? <span className="text-emerald-600/70"> · saved</span>
                : <span className="text-gray-700"> · not saved yet</span>
              }
            </p>
          </button>
        )}

        {/* Client selector — trainer mode, before session created */}
        {!sessionId && trainerMode === 'trainer' && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hidden mt-2">
            {allClients.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => setSelectedClientId(client.id)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  selectedClientId === client.id
                    ? 'bg-brand-highlight text-white border-brand-highlight'
                    : 'border-surface-border text-gray-500 hover:border-gray-400 hover:text-gray-300',
                )}
              >
                {client.isSelf ? 'My Training' : client.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {sessionLoading || creating ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" className="text-brand-highlight" />
          </div>
        ) : workouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-3xl mb-4" aria-hidden>📋</p>
            <p className="text-gray-300 font-medium mb-1">Plan your session</p>
            <p className="text-gray-600 text-sm mb-6">
              Build from scratch or load a saved template.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                type="button"
                onClick={handleAddBlock}
                disabled={!selectedClientId}
                className={cn(
                  'flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium',
                  interactions.button.base,
                  interactions.button.press,
                  selectedClientId
                    ? 'bg-brand-highlight text-white'
                    : 'bg-surface border border-surface-border text-gray-600 cursor-not-allowed',
                )}
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {selectedClientId ? 'Add exercise block' : 'Select a client first'}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!selectedClientId) {
                    setError('Select a client first, then load a template')
                    return
                  }
                  setTemplatePickerOpen(true)
                }}
                disabled={!selectedClientId}
                className={cn(
                  'flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium',
                  'border border-surface-border text-sm',
                  interactions.button.base,
                  interactions.button.press,
                  selectedClientId
                    ? 'text-gray-300 hover:border-brand-highlight/40 hover:text-brand-highlight'
                    : 'text-gray-600 cursor-not-allowed',
                )}
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                  <rect x="2" y="2" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
                  <rect x="2" y="7" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
                  <rect x="2" y="12" width="6" height="2" rx="1" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Load session template
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {workouts.map((workout) => (
              <WorkoutBlock
                key={workout.id}
                workout={workout}
                sessionId={sessionId ?? ""}
                weightUnit={weightUnit}
                layout="vertical"
                onSetLogged={() => {}}  // no-op — planning mode, no logging
              />
            ))}
          </div>
        )}
      </div>

      {/* Add block FAB */}
      {sessionId && workouts.length > 0 && (
        <button
          type="button"
          onClick={handleAddBlock}
          aria-label="Add workout block"
          className={cn(
            'fixed bottom-6 right-4 z-30',
            'w-12 h-12 rounded-full',
            'bg-brand-highlight text-white shadow-lg',
            'flex items-center justify-center',
            interactions.button.base,
            interactions.fab.hover,
            interactions.button.press,
          )}
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-5 h-5">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {/* Add block sheet */}
      {sessionId && (
        <AddBlockSheet
          open={addBlockOpen}
          sessionId={sessionId}
          onClose={() => setAddBlockOpen(false)}
        />
      )}

      {/* Template picker — rendered always so it works before session exists */}
      <TemplatePickerSheet
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={async (templateId) => {
          if (!selectedClientId) return
          setTemplatePickerOpen(false)
          setCreating(true)
          try {
            const today = new Date().toISOString().split('T')[0] ?? ''
            const created = await createSession.mutateAsync({
              clientId:   selectedClientId,
              date:       today,
              templateId,
            })
            setSessionId(created.id)
            addPlannedSession({
              sessionId:  created.id,
              clientId:   created.clientId,
              clientName: created.client?.name ?? '',
              name:       created.name ?? '',
              createdAt:  created.createdAt,
            })
          } catch {
            setError('Failed to load template')
          } finally {
            setCreating(false)
          }
        }}
        loading={creating}
      />

      <NamePromptModal
        open={namePromptOpen}
        title="Name this template"
        placeholder="e.g. Push Day A, Full Body Strength…"
        initialValue={session?.name ?? ''}
        confirmLabel="Save template"
        saving={savingAsTemplate}
        onConfirm={handleSaveAsTemplateConfirm}
        onCancel={() => setNamePromptOpen(false)}
      />
    </div>
  )
}
