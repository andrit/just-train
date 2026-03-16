// ------------------------------------------------------------
// components/dashboard/widgets/SelfTrainingWidget.tsx
//
// Quick-access tile for the trainer's own training profile.
// Shows current progression state, active goal, and a CTA
// button whose label comes from trainer preferences.
// ------------------------------------------------------------

import { Link }           from 'react-router-dom'
import { cn }             from '@/lib/cn'
import { interactions }   from '@/lib/interactions'
import { SilhouetteAvatar } from '@/components/clients/SilhouetteAvatar'
import {
  PROGRESSION_STATE_LABEL,
  PROGRESSION_STATE_COLOR,
  lastSessionLabel,
} from '@/components/clients/utils'
import type { ClientResponse, ClientGoalResponse } from '@trainer-app/shared'

interface SelfTrainingWidgetProps {
  selfClient:   ClientResponse
  activeGoal?:  ClientGoalResponse | null
  ctaLabel:     string
}

export function SelfTrainingWidget({
  selfClient,
  activeGoal,
  ctaLabel,
}: SelfTrainingWidgetProps): React.JSX.Element {
  return (
    <div className="card overflow-hidden">
      {/* Header band */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-surface-border">
        <div className="relative">
          <SilhouetteAvatar
            name={selfClient.name}
            photoUrl={selfClient.photoUrl}
            size="md"
            className="ring-2 ring-brand-highlight/20"
          />
          <span className="absolute -bottom-1 -right-1 bg-brand-highlight text-white text-[9px] font-bold px-1 py-0.5 rounded uppercase leading-none">
            Me
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-display text-lg uppercase tracking-wide text-white">
            My Training
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn(
              'text-[10px] font-medium px-1.5 py-0.5 rounded border uppercase tracking-wider',
              PROGRESSION_STATE_COLOR[selfClient.progressionState],
            )}>
              {PROGRESSION_STATE_LABEL[selfClient.progressionState]}
            </span>
            <span className="text-xs text-gray-600">
              {lastSessionLabel(selfClient)}
            </span>
          </div>
        </div>
      </div>

      {/* Active goal */}
      {activeGoal && (
        <div className="px-4 py-2.5 border-b border-surface-border">
          <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">
            Current Goal
          </p>
          <p className="text-sm text-gray-300 leading-snug">{activeGoal.goal}</p>
        </div>
      )}

      {/* CTA row */}
      <div className="px-4 py-3 flex gap-2">
        {/* CTA button — navigates to session launcher */}
        <Link
          to={`/session/new?clientId=${selfClient.id}`}
          className={cn(
            'flex-1 py-2.5 rounded-xl text-sm font-medium text-center',
            'bg-brand-highlight text-white',
            interactions.button.base,
            interactions.fab.hover,
            interactions.button.press,
            interactions.fab.pulse,
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
          )}
        >
          {ctaLabel}
        </Link>

        {/* Profile link */}
        <Link
          to={`/clients/${selfClient.id}`}
          className={cn(
            'px-3 py-2.5 rounded-xl text-sm font-medium',
            'bg-surface border border-surface-border text-gray-300',
            'hover:border-brand-highlight/30 hover:text-white',
            interactions.button.base,
            interactions.button.hover,
            interactions.button.press,
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
          )}
          aria-label="View my training profile"
        >
          Profile
        </Link>
      </div>
    </div>
  )
}
