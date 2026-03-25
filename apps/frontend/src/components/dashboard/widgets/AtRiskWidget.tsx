// ------------------------------------------------------------
// components/dashboard/widgets/AtRiskWidget.tsx
//
// Shows clients with no session in the last AT_RISK_DAYS days.
// Dismissable per session (reappears on next app open unless
// alertsEnabled is set to false in preferences).
//
// CUSTOMIZATION (Phase 4.5 will expose these via the Preferences screen):
//   colorScheme: 'amber' | 'red' | 'blue' | 'green'
//   tone:        'clinical' | 'motivating' | 'firm'
//
// Both props are easy to add without touching this component's
// structure — they just map to different className sets and message strings.
// ------------------------------------------------------------

import { Link }           from 'react-router-dom'
import { cn }             from '@/lib/cn'
import { interactions }   from '@/lib/interactions'
import { SilhouetteAvatar } from '@/components/clients/SilhouetteAvatar'
import { lastSessionLabel, isAtRisk, hasNoActivity } from '@/components/clients/utils'
import type { ClientResponse } from '@trainer-app/shared'

// ── Color scheme map ──────────────────────────────────────────────────────────
// To change the alert color, pass a different colorScheme prop.
// In Phase 4.5, this will come from trainer.alertColorScheme preference.

type ColorScheme = 'amber' | 'red' | 'blue' | 'green'

const COLOR_CLASSES: Record<ColorScheme, {
  border: string
  bg:     string
  icon:   string
  badge:  string
  dot:    string
}> = {
  amber: {
    border: 'border-amber-500/30',
    bg:     'bg-amber-500/5',
    icon:   'text-amber-400',
    badge:  'bg-amber-500/15 text-amber-400',
    dot:    'bg-amber-400',
  },
  red: {
    border: 'border-red-500/30',
    bg:     'bg-red-500/5',
    icon:   'text-red-400',
    badge:  'bg-red-500/15 text-red-400',
    dot:    'bg-red-400',
  },
  blue: {
    border: 'border-sky-500/30',
    bg:     'bg-sky-500/5',
    icon:   'text-sky-400',
    badge:  'bg-sky-500/15 text-sky-400',
    dot:    'bg-sky-400',
  },
  green: {
    border: 'border-emerald-500/30',
    bg:     'bg-emerald-500/5',
    icon:   'text-emerald-400',
    badge:  'bg-emerald-500/15 text-emerald-400',
    dot:    'bg-emerald-400',
  },
}

// ── Tone message map ──────────────────────────────────────────────────────────
// In Phase 4.5, tone will come from trainer.alertTone preference.

type Tone = 'clinical' | 'motivating' | 'firm'

function getAlertMessage(count: number, tone: Tone): string {
  const plural = count === 1 ? 'client' : 'clients'
  switch (tone) {
    case 'clinical':    return `${count} ${plural} with no session in 14+ days`
    case 'motivating':  return `${count} ${plural} could use a check-in — let's keep them moving`
    case 'firm':        return `${count} ${plural} need attention — don't let momentum slip`
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface AtRiskWidgetProps {
  clients:     ClientResponse[]
  /** Phase 4.5: will come from usePreferences().alertColorScheme */
  colorScheme?: ColorScheme
  /** Phase 4.5: will come from usePreferences().alertTone */
  tone?:        Tone
  onDismiss:   () => void
}

export function AtRiskWidget({
  clients,
  colorScheme = 'amber',
  tone        = 'clinical',
  onDismiss,
}: AtRiskWidgetProps): React.JSX.Element | null {
  const atRiskClients = clients.filter((c) => isAtRisk(c) || hasNoActivity(c))

  if (atRiskClients.length === 0) return null

  const colors = COLOR_CLASSES[colorScheme]

  return (
    <div
      role="alert"
      className={cn(
        'rounded-2xl border p-4 animate-slide-up',
        colors.border,
        colors.bg,
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {/* Pulsing dot */}
          <div className="relative w-2.5 h-2.5 shrink-0 mt-0.5">
            <div className={cn('absolute inset-0 rounded-full animate-ping opacity-50', colors.dot)} />
            <div className={cn('relative rounded-full w-full h-full', colors.dot)} />
          </div>

          <div>
            <p className={cn('text-sm font-medium', colors.icon)}>
              {getAlertMessage(atRiskClients.length, tone)}
            </p>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss alert"
          className={cn(
            'shrink-0 p-1 rounded-lg',
            'text-gray-600 hover:text-gray-400',
            interactions.icon.base,
            interactions.icon.hover,
            interactions.icon.press,
          )}
        >
          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3" aria-hidden>
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Client list — max 3, then "and N more" */}
      <ul className="space-y-2">
        {atRiskClients.slice(0, 3).map((client) => (
          <li key={client.id}>
            <Link
              to={`/clients/${client.id}`}
              className={cn(
                'flex items-center gap-2.5 p-2 rounded-xl',
                'hover:bg-white/5 transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-highlight',
              )}
            >
              <SilhouetteAvatar
                name={client.name}
                photoUrl={client.photoUrl}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300 truncate">{client.name}</p>
                <p className="text-xs text-gray-600">{lastSessionLabel(client)}</p>
              </div>
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', colors.badge)}>
                {hasNoActivity(client) ? 'No sessions' : 'Inactive'}
              </span>
            </Link>
          </li>
        ))}

        {atRiskClients.length > 3 && (
          <li>
            <Link
              to="/clients"
              className="block text-xs text-center text-gray-600 hover:text-gray-400 py-1 transition-colors"
            >
              +{atRiskClients.length - 3} more — view all clients
            </Link>
          </li>
        )}
      </ul>
    </div>
  )
}
