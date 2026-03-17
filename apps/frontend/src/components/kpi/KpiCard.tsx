// ------------------------------------------------------------
// components/kpi/KpiCard.tsx (v1.6.0)
// Single KPI stat card used inside KpiCarousel.
// ------------------------------------------------------------

import { cn } from '@/lib/cn'

export type KpiTrend = 'up' | 'down' | 'flat' | null

export interface KpiCardData {
  label:      string
  value:      string
  context?:   string
  trend?:     KpiTrend
  highlight?: boolean
  isEmpty?:   boolean
}

function TrendArrow({ trend }: { trend: KpiTrend }): React.JSX.Element | null {
  if (!trend || trend === 'flat') return trend === 'flat' ? <span className="text-gray-600 text-xs">—</span> : null
  return (
    <svg viewBox="0 0 12 12" fill="none" className={cn('w-3 h-3 shrink-0', trend === 'up' ? 'text-emerald-400' : 'text-amber-400')}>
      {trend === 'up'
        ? <path d="M6 10V2M2 6l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        : <path d="M6 2v8M2 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

export function KpiCard({ data }: { data: KpiCardData }): React.JSX.Element {
  const { label, value, context, trend, highlight, isEmpty } = data
  return (
    <div className={cn(
      'flex flex-col justify-between bg-surface rounded-2xl border p-4 min-h-[100px] w-full',
      highlight ? 'border-amber-500/30 bg-amber-500/5' : 'border-surface-border',
    )}>
      <p className={cn('text-[10px] uppercase tracking-widest font-medium mb-2', highlight ? 'text-amber-400' : 'text-gray-500')}>
        {label}
      </p>
      <div className="flex items-end gap-1.5 mt-auto">
        <p className={cn('font-mono font-bold leading-none text-xl', isEmpty ? 'text-gray-700' : highlight ? 'text-amber-300' : 'text-white')}>
          {isEmpty ? '—' : value}
        </p>
        {!isEmpty && trend !== undefined && <TrendArrow trend={trend ?? null} />}
      </div>
      {context && !isEmpty && <p className="text-[11px] text-gray-600 mt-1 leading-snug">{context}</p>}
      {isEmpty && <p className="text-[11px] text-gray-700 mt-1">No sessions yet</p>}
    </div>
  )
}
