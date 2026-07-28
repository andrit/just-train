// ------------------------------------------------------------
// components/dashboard/widgets/RecentSessionsWidget.tsx
//
// Shows the last 3 completed sessions. Tap a row to open its history.
// Self-contained: fetches via useSessions (query hook) — no props needed.
// ------------------------------------------------------------

import { useSessions } from '@/lib/queries/sessions'
import { useNav }      from '@/services/navService'
import { formatDate }  from '@/lib/formatters'

export function RecentSessionsWidget(): React.JSX.Element {
  const { data: sessions, isLoading } = useSessions({ status: 'completed' })
  const nav = useNav()

  const recent = (sessions ?? [])
    .filter((s) => s.status === 'completed')
    .slice()
    .sort((a, b) => (b.endTime ?? b.date).localeCompare(a.endTime ?? a.date))
    .slice(0, 3)

  return (
    <div className="card p-4">
      <p className="section-label">Recent Sessions</p>

      {isLoading ? (
        <div className="space-y-2 mt-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[52px] rounded-xl bg-surface border border-surface-border animate-pulse" style={{ opacity: 0.5 }} />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <p className="text-xs text-gray-600 text-center mt-1 py-6">
          No sessions yet — your completed sessions will show up here.
        </p>
      ) : (
        <div className="space-y-2 mt-1">
          {recent.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => nav.openSessionHistory(s.id)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-surface border border-surface-border hover:border-command-blue/30 text-left transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 font-medium truncate">{s.name ?? 'Session'}</p>
                <p className="text-[11px] text-gray-500">{formatDate(s.date)}</p>
              </div>
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-gray-600 shrink-0" aria-hidden>
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
