// ------------------------------------------------------------
// pages/SessionLauncherPage.tsx — /session/new (v1.5.0)
//
// Two paths:
//   1. Start fresh → creates session immediately → navigates to /session/:id
//   2. Load template → template picker → SessionLoader → /session/:id
//
// Always needs a clientId. If none provided (athlete mode), uses self-client.
// If trainer mode, a client selector is shown first.
// ------------------------------------------------------------

import { useState, useEffect }          from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { cn }                            from '@/lib/cn'
import { interactions }                  from '@/lib/interactions'
import { usePreferences }                from '@/hooks/usePreferences'
import { useUXEvent }                    from '@/hooks/useUXEvent'
import { useAuthStore }                  from '@/store/authStore'
import { useSelfClient, useClients }     from '@/lib/queries/clients'
import { useCreateSession, useStartSession } from '@/lib/queries/sessions'
import { useTemplates }                  from '@/lib/queries/templates'
import { Spinner }                       from '@/components/ui/Spinner'
import { Button }                        from '@/components/ui/Button'

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onSelect,
}: {
  template: { id: string; name: string; description: string | null; templateWorkouts?: { workoutType: string }[] }
  onSelect:  (id: string) => void
}): React.JSX.Element {
  const workoutCount = template.templateWorkouts?.length ?? 0

  return (
    <button
      type="button"
      onClick={() => onSelect(template.id)}
      className={cn(
        'w-full card p-4 text-left',
        interactions.card.base,
        interactions.card.hover,
        interactions.card.press,
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
      )}
    >
      <p className="font-display text-lg uppercase tracking-wide text-white">
        {template.name}
      </p>
      {template.description && (
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{template.description}</p>
      )}
      {workoutCount > 0 && (
        <p className="text-xs text-gray-600 mt-2">
          {workoutCount} workout block{workoutCount !== 1 ? 's' : ''}
        </p>
      )}
    </button>
  )
}

// ── Client selector ───────────────────────────────────────────────────────────

function ClientSelector({
  selected,
  onSelect,
}: {
  selected: string | null
  onSelect: (id: string) => void
}): React.JSX.Element {
  const { data: clients, isLoading } = useClients()
  const { data: selfClient }         = useSelfClient()

  const all = [
    ...(selfClient ? [{ ...selfClient, isSelf: true }] : []),
    ...(clients ?? []),
  ]

  if (isLoading) return <Spinner size="sm" className="text-gray-500" />

  return (
    <div className="space-y-2">
      {all.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left',
            'transition-all duration-150',
            selected === c.id
              ? 'border-brand-highlight/50 bg-brand-highlight/5'
              : 'border-surface-border bg-surface hover:border-gray-500',
            interactions.button.base,
            interactions.button.press,
          )}
        >
          <div className="w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-gray-400">
              {c.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-medium', selected === c.id ? 'text-white' : 'text-gray-300')}>
              {c.isSelf ? 'My Training' : c.name}
            </p>
            <p className="text-xs text-gray-600">{c.progressionState}</p>
          </div>
          {selected === c.id && (
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-brand-highlight shrink-0">
              <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type View = 'main' | 'client-select' | 'template-pick'

export default function SessionLauncherPage(): React.JSX.Element {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const trainer        = useAuthStore((s) => s.trainer)
  const { trainerMode, ctaLabel } = usePreferences()
  const { fire } = useUXEvent()

  const { data: selfClient } = useSelfClient()
  const { data: templates, isLoading: templatesLoading } = useTemplates()

  const createSession = useCreateSession()
  const startSession  = useStartSession()

  // clientId from URL param (e.g. from client profile "start session" button)
  const urlClientId = searchParams.get('clientId')

  const [view,            setView]            = useState<View>('main')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    urlClientId ?? (trainerMode === 'athlete' ? null : null)
  )
  const [error, setError] = useState<string | null>(null)

  // Athlete mode: auto-select self-client
  useEffect(() => {
    if (trainerMode === 'athlete' && selfClient && !selectedClientId) {
      setSelectedClientId(selfClient.id)
    }
  }, [trainerMode, selfClient, selectedClientId])

  const today = new Date().toISOString().split('T')[0]!

  // ── Start blank session ───────────────────────────────────────────────────

  const handleStartBlank = async (): Promise<void> => {
    const clientId = selectedClientId
    if (!clientId) {
      setView('client-select')
      return
    }

    setError(null)
    try {
      // 1. Create the session record
      const session = await createSession.mutateAsync({
        clientId,
        date: today,
      })

      // 2. Immediately start it
      await startSession.mutateAsync(session.id)

      fire('session_start', { entityId: session.id })
      navigate(`/session/${session.id}`)
    } catch {
      setError('Could not start session — please try again')
    }
  }

  // ── Start from template ────────────────────────────────────────────────────

  const handleSelectTemplate = async (templateId: string): Promise<void> => {
    const clientId = selectedClientId
    if (!clientId) {
      setView('client-select')
      return
    }

    setError(null)
    try {
      const session = await createSession.mutateAsync({
        clientId,
        date: today,
        templateId,
      })

      await startSession.mutateAsync(session.id)

      fire('session_start', { entityId: session.id, entity: 'session' })
      navigate(`/session/${session.id}`)
    } catch {
      setError('Could not load template — please try again')
    }
  }

  const isLoading = createSession.isPending || startSession.isPending

  // ── Client select view ────────────────────────────────────────────────────

  if (view === 'client-select') {
    return (
      <div className="p-4 md:p-6 max-w-xl mx-auto">
        <button
          type="button"
          onClick={() => setView('main')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 mb-6"
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        <h1 className="font-display text-3xl uppercase tracking-wide text-white mb-6">
          Who is training?
        </h1>

        <ClientSelector
          selected={selectedClientId}
          onSelect={(id) => {
            setSelectedClientId(id)
            setView('main')
          }}
        />
      </div>
    )
  }

  // ── Template pick view ────────────────────────────────────────────────────

  if (view === 'template-pick') {
    return (
      <div className="p-4 md:p-6 max-w-xl mx-auto">
        <button
          type="button"
          onClick={() => setView('main')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 mb-6"
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        <h1 className="font-display text-3xl uppercase tracking-wide text-white mb-6">
          Choose a template
        </h1>

        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {templatesLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" className="text-brand-highlight" />
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-2xl mb-3">📄</p>
            <p className="text-gray-400 text-sm">No templates yet.</p>
            <p className="text-gray-600 text-xs mt-1">
              Create templates in the Templates section to use them here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onSelect={handleSelectTemplate}
              />
            ))}
          </div>
        )}

        {isLoading && (
          <div className="fixed inset-0 bg-brand-primary/80 flex items-center justify-center z-50">
            <div className="text-center">
              <Spinner size="lg" className="text-brand-highlight mx-auto" />
              <p className="text-gray-300 text-sm mt-4">Loading template…</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Main view ─────────────────────────────────────────────────────────────

  const clientName = selectedClientId === selfClient?.id
    ? 'My Training'
    : null // TODO: resolve from clients list

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto">

      {/* Header */}
      <div className="mb-8 animate-slide-up">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 mb-4"
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        <h1 className="font-display text-4xl uppercase tracking-wide text-white">
          {ctaLabel}
        </h1>
        {clientName && (
          <p className="text-sm text-gray-500 mt-1">Training: {clientName}</p>
        )}
      </div>

      {/* Trainer mode: show client selector */}
      {trainerMode === 'trainer' && (
        <div className="card p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-200">Training</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedClientId ? (selectedClientId === selfClient?.id ? 'Myself' : 'A client') : 'Select who is training'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setView('client-select')}
              className={cn(
                'px-3 py-1.5 rounded-lg border text-sm transition-all duration-150',
                selectedClientId
                  ? 'border-surface-border text-gray-400 hover:text-gray-200'
                  : 'border-brand-highlight/40 text-brand-highlight',
                interactions.button.base,
                interactions.button.press,
              )}
            >
              {selectedClientId ? 'Change' : 'Select'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Primary CTA — Start blank */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={handleStartBlank}
          disabled={isLoading}
          className={cn(
            'w-full py-5 rounded-2xl text-lg font-display uppercase tracking-wide',
            'bg-brand-highlight text-white',
            interactions.button.base,
            interactions.fab.hover,
            interactions.button.press,
            interactions.fab.pulse,
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
            isLoading && 'opacity-60 cursor-not-allowed',
          )}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" />
              Starting…
            </span>
          ) : (
            ctaLabel
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-surface-border" />
          <span className="text-xs uppercase tracking-widest text-gray-600">or</span>
          <div className="flex-1 h-px bg-surface-border" />
        </div>

        {/* Load template */}
        <button
          type="button"
          onClick={() => setView('template-pick')}
          disabled={isLoading}
          className={cn(
            'w-full py-4 rounded-2xl text-sm font-medium',
            'bg-surface border border-surface-border text-gray-300',
            'hover:border-brand-highlight/30 hover:text-white',
            interactions.button.base,
            interactions.button.hover,
            interactions.button.press,
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4" aria-hidden>
              <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Load a Template Session
          </div>
        </button>
      </div>

    </div>
  )
}
