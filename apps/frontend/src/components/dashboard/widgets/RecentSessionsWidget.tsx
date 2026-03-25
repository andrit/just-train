// ------------------------------------------------------------
// components/dashboard/widgets/RecentSessionsWidget.tsx
//
// Phase 5: will show the last N sessions with client name,
// workout types, and set counts.
// Phase 4: shows a well-designed "coming soon" placeholder
// that makes the widget feel present and intentional.
// ------------------------------------------------------------


interface RecentSessionsWidgetProps {
  /** Phase 5: pass real sessions here */
  sessions?: never[]
}

export function RecentSessionsWidget({}: RecentSessionsWidgetProps): React.JSX.Element {
  return (
    <div className="card p-4">
      <p className="section-label">Recent Sessions</p>

      {/* Phase 5 placeholder */}
      <div className="space-y-2 mt-1">
        {/* Skeleton rows to give the widget visual weight */}
        {[0.8, 0.6, 0.7].map((opacity, i) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            className="flex items-center gap-3 p-2.5 rounded-xl bg-surface border border-surface-border"
            style={{ opacity: opacity * 0.4 }}
            aria-hidden
          >
            <div className="w-8 h-8 rounded-full bg-brand-accent/40 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 bg-surface-border rounded-full w-3/4" />
              <div className="h-2 bg-surface-border rounded-full w-1/2" />
            </div>
            <div className="h-2 bg-surface-border rounded-full w-8" />
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-600 text-center mt-3">
        Session logging arrives in the next update
      </p>
    </div>
  )
}
