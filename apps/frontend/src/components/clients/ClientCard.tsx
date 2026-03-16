// ------------------------------------------------------------
// components/clients/ClientCard.tsx
//
// A single client card in the list. Shows:
//   - Silhouette/photo avatar
//   - Name and progression state badge
//   - Primary focus tag
//   - Last session label
//   - At-risk warning if no session in 14+ days
// ------------------------------------------------------------

import { Link }             from 'react-router-dom'
import { cn }               from '@/lib/cn'
import { interactions }     from '@/lib/interactions'
import { SilhouetteAvatar } from './SilhouetteAvatar'
import {
  PROGRESSION_STATE_LABEL,
  PROGRESSION_STATE_COLOR,
  FOCUS_LABEL,
  FOCUS_ICON,
  isAtRisk,
  hasNoActivity,
  lastSessionLabel,
} from './utils'
import type { ClientResponse } from '@trainer-app/shared'

interface ClientCardProps {
  client: ClientResponse
}

export function ClientCard({ client }: ClientCardProps): React.JSX.Element {
  const atRisk     = isAtRisk(client)
  const noActivity = hasNoActivity(client)

  return (
    <Link
      to={`/clients/${client.id}`}
      className={cn(
        'card block p-4 relative overflow-hidden',
        interactions.card.base,
        interactions.card.hover,
        interactions.card.press,
        // At-risk gets a subtle left border accent
        atRisk && 'border-l-2 border-l-amber-500/60',
      )}
    >
      <div className="flex items-center gap-3">

        {/* Avatar */}
        <SilhouetteAvatar
          name={client.name}
          photoUrl={client.photoUrl}
          size="md"
          className="shrink-0"
        />

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display text-lg uppercase tracking-wide text-white truncate">
              {client.name}
            </span>

            {/* Progression state badge */}
            <span
              className={cn(
                'shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border uppercase tracking-wider',
                PROGRESSION_STATE_COLOR[client.progressionState],
              )}
            >
              {PROGRESSION_STATE_LABEL[client.progressionState]}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            {/* Focus tag */}
            {client.primaryFocus && (
              <span className="flex items-center gap-1">
                <span aria-hidden>{FOCUS_ICON[client.primaryFocus]}</span>
                <span>{FOCUS_LABEL[client.primaryFocus]}</span>
              </span>
            )}

            {/* Divider */}
            {client.primaryFocus && <span aria-hidden>·</span>}

            {/* Last session */}
            <span className={cn(atRisk && 'text-amber-500')}>
              {atRisk && <span className="mr-1" aria-hidden>⚠</span>}
              {lastSessionLabel(client)}
            </span>
          </div>
        </div>

        {/* Chevron */}
        <svg
          className="w-4 h-4 text-gray-600 shrink-0"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* No activity hint */}
      {noActivity && (
        <p className="mt-2 text-[11px] text-gray-600 pl-[60px]">
          No sessions logged yet
        </p>
      )}
    </Link>
  )
}
