// ------------------------------------------------------------
// components/dashboard/widgets/ActiveClientsWidget.tsx
//
// Shows client count broken down by progression state.
// Links through to the client list.
// ------------------------------------------------------------

import { Link }     from 'react-router-dom'
import { cn }       from '@/lib/cn'
import { interactions } from '@/lib/interactions'
import { PROGRESSION_STATE_COLOR } from '@/components/clients/utils'
import type { ClientResponse }  from '@trainer-app/shared'

interface ActiveClientsWidgetProps {
  clients: ClientResponse[]
}

export function ActiveClientsWidget({ clients }: ActiveClientsWidgetProps): React.JSX.Element {
  const total       = clients.length
  const assessment  = clients.filter((c) => c.progressionState === 'assessment').length
  const programming = clients.filter((c) => c.progressionState === 'programming').length
  const maintenance = clients.filter((c) => c.progressionState === 'maintenance').length

  // Active = had a session this month
  const now = new Date()
  const activeThisMonth = clients.filter((c) => {
    if (!c.lastActiveAt) return false
    const last = new Date(c.lastActiveAt)
    return last.getMonth() === now.getMonth() && last.getFullYear() === now.getFullYear()
  }).length

  return (
    <Link
      to="/clients"
      className={cn(
        'card block p-4',
        interactions.card.base,
        interactions.card.hover,
        interactions.card.press,
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
      )}
      aria-label={`${total} clients — view all`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="section-label mb-0">Clients</p>
        <svg className="w-3.5 h-3.5 text-gray-600" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Big number */}
      <div className="flex items-end gap-2 mb-4">
        <span className="font-display text-5xl text-white leading-none">{total}</span>
        <span className="text-sm text-gray-500 mb-1">
          {activeThisMonth} active this month
        </span>
      </div>

      {/* State breakdown */}
      <div className="space-y-2">
        {[
          { label: 'Assessment',  count: assessment,  state: 'assessment'  },
          { label: 'Programming', count: programming, state: 'programming' },
          { label: 'Maintenance', count: maintenance, state: 'maintenance' },
        ].map(({ label, count, state }) => (
          <div key={state} className="flex items-center gap-2">
            {/* Progress bar */}
            <div className="flex-1 h-1.5 bg-surface-border rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  state === 'assessment'  && 'bg-amber-500',
                  state === 'programming' && 'bg-emerald-500',
                  state === 'maintenance' && 'bg-sky-500',
                )}
                style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }}
              />
            </div>
            <span className={cn(
              'text-[10px] font-medium w-16 shrink-0',
              PROGRESSION_STATE_COLOR[state].split(' ').find((c) => c.startsWith('text-')),
            )}>
              {count} {label}
            </span>
          </div>
        ))}
      </div>
    </Link>
  )
}
