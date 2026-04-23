// ------------------------------------------------------------
// components/client-profile/ChallengesTab.tsx (v2.12.0)
//
// Challenges tab on the client profile panel.
// Shows active challenges as progress cards, with completed/
// expired/cancelled collapsed below. "New Challenge" button
// opens the ChallengeForm bottom sheet.
// ------------------------------------------------------------

import { useState }                from 'react'
import { cn }                      from '@/lib/cn'
import { interactions }            from '@/lib/interactions'
import { useChallenges }           from '@/lib/queries/challenges'
import { Spinner }                 from '@/components/ui/Spinner'
import { ChallengeProgressCard }   from '@/components/challenges/ChallengeProgressCard'
import { ChallengeForm }           from '@/components/challenges/ChallengeForm'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChallengesTabProps {
  clientId:   string
  clientName: string
  /** true for athlete mode — changes CTA copy */
  isSelf?:    boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChallengesTab({
  clientId,
  clientName,
  isSelf = false,
}: ChallengesTabProps): React.JSX.Element {
  const { data: challenges, isLoading } = useChallenges(clientId)
  const [formOpen, setFormOpen] = useState(false)

  const active    = challenges?.filter((c) => c.status === 'active') ?? []
  const completed = challenges?.filter((c) => c.status === 'completed') ?? []
  const other     = challenges?.filter((c) => c.status === 'expired' || c.status === 'cancelled') ?? []

  const contextLabel = isSelf ? 'Set a challenge' : `Challenge for ${clientName}`

  if (isLoading) {
    return (
      <div className="flex justify-center py-12" role="tabpanel" id="panel-challenges" aria-labelledby="tab-challenges">
        <Spinner size="md" className="text-brand-highlight" />
      </div>
    )
  }

  return (
    <div className="space-y-5" role="tabpanel" id="panel-challenges" aria-labelledby="tab-challenges">

      {/* New Challenge CTA */}
      <button
        type="button"
        onClick={() => setFormOpen(true)}
        className={cn(
          'w-full card p-4 text-left border-dashed',
          'hover:border-brand-highlight/30 hover:bg-surface',
          interactions.card.base,
          interactions.card.hover,
          interactions.card.press,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-highlight/10 border border-brand-highlight/20 flex items-center justify-center text-brand-highlight">
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden>
              <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-sm text-white">
              {isSelf ? 'Set a Challenge' : 'New Challenge'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {isSelf ? 'Give yourself a goal with a deadline' : 'Set a measurable goal with a deadline'}
            </p>
          </div>
        </div>
      </button>

      {/* Active challenges */}
      {active.length > 0 && (
        <section>
          <h3 className="section-label">Active</h3>
          <div className="space-y-2">
            {active.map((c) => (
              <ChallengeProgressCard key={c.id} challenge={c} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!isLoading && challenges?.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          <p className="text-2xl mb-3" aria-hidden>🎯</p>
          <p>No challenges yet.</p>
          <p className="text-xs text-gray-600 mt-1">
            {isSelf
              ? 'Set your first challenge to track a specific goal.'
              : 'Create a challenge to give this client something concrete to chase.'}
          </p>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <section>
          <details className="group">
            <summary className="section-label cursor-pointer hover:text-gray-400 list-none flex items-center gap-1">
              <svg className="w-3 h-3 transition-transform group-open:rotate-90" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {completed.length} completed
            </summary>
            <div className="mt-2 space-y-2">
              {completed.map((c) => (
                <ChallengeProgressCard key={c.id} challenge={c} />
              ))}
            </div>
          </details>
        </section>
      )}

      {/* Expired / cancelled */}
      {other.length > 0 && (
        <section>
          <details className="group">
            <summary className="section-label cursor-pointer hover:text-gray-400 list-none flex items-center gap-1">
              <svg className="w-3 h-3 transition-transform group-open:rotate-90" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {other.length} expired / cancelled
            </summary>
            <div className="mt-2 space-y-2">
              {other.map((c) => (
                <ChallengeProgressCard key={c.id} challenge={c} />
              ))}
            </div>
          </details>
        </section>
      )}

      {/* Challenge creation form */}
      <ChallengeForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        clientId={clientId}
        contextLabel={contextLabel}
      />
    </div>
  )
}
