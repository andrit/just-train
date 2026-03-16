// ------------------------------------------------------------
// pages/ClientsPage.tsx — Client roster (Phase 4)
//
// Shows:
//   - "My Training" tile (self-client, trainer mode only)
//   - Client cards for all active external clients
//   - "Add Client" card at the top of the list
//   - Empty state when no external clients yet
//
// Athlete mode: only shows the self-client / training tile.
// Trainer mode: shows full roster.
// ------------------------------------------------------------

import { useState }           from 'react'
import { Link }               from 'react-router-dom'
import { useAuthStore }       from '@/store/authStore'
import { useClients, useSelfClient } from '@/lib/queries/clients'
import { ClientCard }          from '@/components/clients/ClientCard'
import { AddClientCard }       from '@/components/clients/AddClientCard'
import { ClientDrawer }        from '@/components/clients/ClientDrawer'
import { SilhouetteAvatar }    from '@/components/clients/SilhouetteAvatar'
import { Spinner }             from '@/components/ui/Spinner'
import { EmptyState }          from '@/components/ui/EmptyState'
import { cn }                  from '@/lib/cn'
import { interactions }        from '@/lib/interactions'
import { PROGRESSION_STATE_LABEL, PROGRESSION_STATE_COLOR } from '@/components/clients/utils'

export default function ClientsPage(): React.JSX.Element {
  const trainer    = useAuthStore((s) => s.trainer)
  const isTrainer  = trainer?.trainerMode === 'trainer'

  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data: clients,    isLoading: clientsLoading } = useClients()
  const { data: selfClient, isLoading: selfLoading     } = useSelfClient()

  const isLoading = clientsLoading || selfLoading

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl uppercase tracking-wide text-white">
          {isTrainer ? 'Clients' : 'My Training'}
        </h1>

        {/* Add Client button — trainer mode only, animated */}
        {isTrainer && (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Add new client"
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl',
              'bg-brand-highlight text-white text-sm font-medium',
              interactions.button.base,
              interactions.fab.hover,
              interactions.button.press,
              interactions.fab.pulse,   // ← remove to disable pulse on header button
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
            )}
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden>
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add Client
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" className="text-brand-highlight" />
        </div>
      ) : (
        <div className="space-y-3">

          {/* Self-client tile — always shown */}
          {selfClient && (
            <Link
              to={`/clients/${selfClient.id}`}
              className={cn(
                'card block p-4 border-brand-highlight/20',
                interactions.card.base,
                interactions.card.hover,
                interactions.card.press,
              )}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <SilhouetteAvatar
                    name={selfClient.name}
                    photoUrl={selfClient.photoUrl}
                    size="md"
                    className="ring-2 ring-brand-highlight/30"
                  />
                  {/* "Me" badge */}
                  <span className="absolute -bottom-1 -right-1 bg-brand-highlight text-white text-[9px] font-bold px-1 py-0.5 rounded uppercase leading-none">
                    Me
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg uppercase tracking-wide text-white">
                      My Training
                    </span>
                    <span className={cn(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded border uppercase tracking-wider',
                      PROGRESSION_STATE_COLOR[selfClient.progressionState],
                    )}>
                      {PROGRESSION_STATE_LABEL[selfClient.progressionState]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Track your own training and progress
                  </p>
                </div>

                <svg className="w-4 h-4 text-gray-600 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </Link>
          )}

          {/* Client list — trainer mode only */}
          {isTrainer && (
            <>
              {/* Divider if there are external clients or the add card */}
              {selfClient && (
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-surface-border" />
                  <span className="text-[11px] uppercase tracking-widest text-gray-600">Clients</span>
                  <div className="flex-1 h-px bg-surface-border" />
                </div>
              )}

              {/* Add Client card — always first in the external clients section */}
              <AddClientCard onClick={() => setDrawerOpen(true)} />

              {/* Client cards */}
              {clients && clients.length > 0 ? (
                clients.map((client) => (
                  <ClientCard key={client.id} client={client} />
                ))
              ) : (
                <EmptyState
                  icon="👥"
                  title="No clients yet"
                  description="Add your first client to start tracking their progress."
                />
              )}
            </>
          )}

        </div>
      )}

      {/* Add Client drawer */}
      <ClientDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        client={null}
      />
    </div>
  )
}
