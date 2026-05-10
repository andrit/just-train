// ------------------------------------------------------------
// components/dashboard/widgets/SelfTrainingWidget.tsx
//
// Quick-access tile for the trainer's own training profile.
// Shows current progression state, active goal, and a CTA
// button whose label comes from trainer preferences.
// ------------------------------------------------------------

import { useState } from 'react'
import { Link }           from 'react-router-dom'
import { cn }             from '@/lib/cn'
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

const KEY_CLASSES =
  'w-full py-3 rounded-xl text-sm font-semibold text-center ' +
  'transition-transform duration-100 ease-out ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue'

function useKeyTap(): [boolean, () => void] {
  const [tapping, setTapping] = useState(false)
  const tap = () => {
    setTapping(true)
    setTimeout(() => setTapping(false), 250)
  }
  return [tapping, tap]
}

export function SelfTrainingWidget({
  selfClient,
  activeGoal,
  ctaLabel,
}: SelfTrainingWidgetProps): React.JSX.Element {
  const [ctaTapping,     tapCta]     = useKeyTap()
  const [profileTapping, tapProfile] = useKeyTap()

  return (
    <div className="card overflow-hidden">
      {/* Header band */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-surface-border">
        <div className="relative">
          <SilhouetteAvatar
            name={selfClient.name}
            photoUrl={selfClient.photoUrl}
            size="md"
            className="ring-2 ring-command-blue/20"
          />
          <span className="absolute -bottom-1 -right-1 bg-command-blue text-white text-[9px] font-bold px-1 py-0.5 rounded uppercase leading-none">
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

      {/* Piano-key CTA row */}
      <div className="px-4 py-3 flex flex-col gap-2">
        {/* Key 1 — primary action */}
        <Link
          to={`/session/new?clientId=${selfClient.id}`}
          onClick={tapCta}
          className={cn(
            KEY_CLASSES,
            'bg-command-blue text-white shadow-md shadow-command-blue/25',
            ctaTapping && 'animate-key-tap',
          )}
        >
          {ctaLabel}
        </Link>

        {/* Key 2 — profile */}
        <Link
          to="/my-training"
          onClick={tapProfile}
          className={cn(
            KEY_CLASSES,
            'bg-surface-raised border border-surface-border text-gray-300',
            'hover:border-white/20 hover:text-white',
            profileTapping && 'animate-key-tap',
          )}
          aria-label="View my training profile"
        >
          Profile
        </Link>
      </div>
    </div>
  )
}
