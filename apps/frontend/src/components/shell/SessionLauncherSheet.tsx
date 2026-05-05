// ------------------------------------------------------------
// components/shell/SessionLauncherSheet.tsx (v2.0.0)
//
// Session launcher as a BottomSheet.
// No navigation — replaces the /session/new route for the SPA flow.
// SessionLauncherPage (route) kept as URL-addressable fallback.
//
// On session start: registers in sessionStore + expands overlay.
// On resume: expands existing session overlay directly.
// ------------------------------------------------------------

import { useState, useEffect }              from 'react'
import { cn }                                from '@/lib/cn'
import { interactions }                      from '@/lib/interactions'
import { useUXEvent }                        from '@/hooks/useUXEvent'
import { usePreferences }                    from '@/hooks/usePreferences'
import { useAuthStore }                      from '@/store/authStore'
import { useSessionStore }                   from '@/store/sessionStore'
import { useOverlayStore }                   from '@/store/overlayStore'
import { useClients, useSelfClient }         from '@/lib/queries/clients'
import { useTemplates }                      from '@/lib/queries/templates'
import { useCreateSession, useStartSession } from '@/lib/queries/sessions'
import { BottomSheet }                       from '@/components/ui/BottomSheet'
import { Spinner }                           from '@/components/ui/Spinner'

interface SessionLauncherSheetProps {
  open:       boolean
  clientId?:  string   // pre-selected client (e.g. from client profile)
  onClose:    () => void
}

export function SessionLauncherSheet({
  open,
  clientId: initialClientId,
  onClose,
}: SessionLauncherSheetProps): React.JSX.Element {
  const _trainer        = useAuthStore((s) => s.trainer)
  const { trainerMode, ctaLabel } = usePreferences()
  const { fire }       = useUXEvent()

  const { startSession: storeSession, getSession, hasSession } = useSessionStore()
  const { expand }     = useOverlayStore()

  const { data: selfClient }                          = useSelfClient()
  const { data: clients }                             = useClients()
  const { data: templates, isLoading: templsLoading } = useTemplates()

  const createSession = useCreateSession()
  const startSession  = useStartSession()

  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    initialClientId ?? null
  )
  const [error, setError] = useState<string | null>(null)

  // Sync initial client when sheet opens
  useEffect(() => {
    if (open) {
      setSelectedClientId(initialClientId ?? null)
      setError(null)
    }
  }, [open, initialClientId])

  // Athlete auto-select
  useEffect(() => {
    if (trainerMode === 'athlete' && selfClient && !selectedClientId) {
      setSelectedClientId(selfClient.id)
    }
  }, [trainerMode, selfClient, selectedClientId])

  const today = new Date().toISOString().split('T')[0] ?? ''

  const getClientName = (id: string): string =>
    clients?.find(c => c.id === id)?.name ?? selfClient?.name ?? 'Client'

  const handleStart = async (templateId?: string): Promise<void> => {
    const clientId = selectedClientId
    if (!clientId) return

    // Resume if session already active
    const existing = getSession(clientId)
    if (existing) {
      expand(clientId)
      onClose()
      return
    }

    setError(null)
    try {
      const session = await createSession.mutateAsync({
        clientId,
        date: today,
        ...(templateId && { templateId }),
      })
      await startSession.mutateAsync(session.id)

      storeSession(clientId, session.id, getClientName(clientId))
      fire('session_start', { entityId: session.id })

      // Expand the overlay instead of navigating
      expand(clientId)
      onClose()
    } catch {
      setError('Could not start session — please try again')
    }
  }

  const isLoading  = createSession.isPending || startSession.isPending
  const clientName = selectedClientId
    ? (selectedClientId === selfClient?.id ? 'My Training' : getClientName(selectedClientId))
    : null
  const sessionActive   = selectedClientId ? hasSession(selectedClientId) : false
  const displayCta      = sessionActive ? 'Continue Session' : ctaLabel

  const allClients = [
    ...(selfClient ? [{ ...selfClient, isSelf: true }] : []),
    ...(clients ?? []),
  ]

  return (
    <BottomSheet open={open} onClose={onClose} title={displayCta} maxHeight="85vh">
      <div className="px-4 pb-8 pt-2 space-y-5">

        {/* Client name subheading */}
        {clientName && (
          <p className="text-sm text-gray-500">Training: {clientName}</p>
        )}

        {/* Client selector — trainer mode only */}
        {trainerMode === 'trainer' && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Client</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {allClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => setSelectedClientId(client.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left',
                    'border transition-all duration-150',
                    selectedClientId === client.id
                      ? 'border-command-blue/60 bg-command-blue/10 text-white'
                      : 'border-surface-border bg-surface text-gray-300 hover:border-command-blue/30',
                  )}
                >
                  <span className="text-sm font-medium truncate">{client.name}</span>
                  {client.isSelf && (
                    <span className="text-[10px] text-command-blue/70 border border-command-blue/30 px-1.5 py-0.5 rounded ml-auto shrink-0">
                      Me
                    </span>
                  )}
                  {hasSession(client.id) && (
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-auto shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 text-center">{error}</p>
        )}

        {/* Start blank */}
        <button
          type="button"
          onClick={() => handleStart()}
          disabled={isLoading || !selectedClientId}
          className={cn(
            'w-full py-4 rounded-xl font-display text-lg uppercase tracking-wide',
            'transition-all duration-150',
            interactions.button.base,
            interactions.button.press,
            selectedClientId
              ? sessionActive
                ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                : 'bg-command-blue text-white'
              : 'bg-surface border border-surface-border text-gray-600 cursor-not-allowed',
            isLoading && 'opacity-50',
          )}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" />
              Starting…
            </span>
          ) : displayCta}
        </button>

        {/* Templates */}
        {!sessionActive && (templates ?? []).length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-500">From Template</p>
            {templsLoading ? (
              <div className="flex justify-center py-4">
                <Spinner size="sm" className="text-gray-500" />
              </div>
            ) : (
              (templates ?? []).map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleStart(template.id)}
                  disabled={isLoading || !selectedClientId}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left',
                    'border border-surface-border bg-surface',
                    'hover:border-command-blue/30',
                    'transition-all duration-150',
                    interactions.button.base,
                    interactions.button.press,
                    (!selectedClientId || isLoading) && 'opacity-50 pointer-events-none',
                  )}
                >
                  <span className="text-sm font-medium text-gray-200 truncate">{template.name}</span>
                  <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-gray-600 ml-auto shrink-0">
                    <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
