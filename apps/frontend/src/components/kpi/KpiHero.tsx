// ------------------------------------------------------------
// components/kpi/KpiHero.tsx (v1.6.0)
//
// KPI hero section shown above the tabs on the client profile.
// Translates the backend ClientKpiResponse into KpiCardData[] and renders a
// fixed headline row (Streak / This week / Last session) above a carousel of
// the remaining secondary stats.
//
// Also handles:
//   - The 1RM tip nudge for athlete mode (shown once, tracked in localStorage)
//   - Empty state when the client has no sessions yet
// ------------------------------------------------------------

import { useState } from 'react'
import { Link }                  from 'react-router-dom'
import { cn }                    from '@/lib/cn'
import { KpiCarousel }           from './KpiCarousel'
import { KpiCard }               from './KpiCard'
import { TipIcon }               from '@/components/ui/TipIcon'
import type { KpiCardData }      from './KpiCard'
import type { ClientKpiResponse, ClientResponse } from '@trainer-app/shared'

const TIP_KEY = 'tip_1rm_dismissed'

// ── Focus KPI card builder ─────────────────────────────────────────────────────

function buildFocusCard(focusKpi: ClientKpiResponse['focusKpi']): KpiCardData {
  switch (focusKpi.type) {
    case 'resistance':
      return {
        label:   'Top lift',
        value:   focusKpi.topExercise ?? '—',
        context: focusKpi.estOnermKg != null
          ? `Est. 1RM ${focusKpi.estOnermKg} kg`
          : focusKpi.volumeTrend !== 'insufficient_data'
          ? `Volume ${focusKpi.volumeTrend}`
          : undefined,
        trend:   focusKpi.volumeTrend === 'insufficient_data' ? null
                 : focusKpi.volumeTrend as 'up' | 'down' | 'flat',
        isEmpty: !focusKpi.topExercise,
      }
    case 'calisthenics':
      return {
        label:   'Best exercise',
        value:   focusKpi.topExercise ?? '—',
        context: focusKpi.maxReps != null ? `${focusKpi.maxReps} reps max` : undefined,
        trend:   focusKpi.repsTrend === 'insufficient_data' ? null
                 : focusKpi.repsTrend as 'up' | 'down' | 'flat',
        isEmpty: !focusKpi.topExercise,
      }
    case 'cardio':
      return {
        label:   'Cardio',
        value:   focusKpi.totalDistanceKm != null ? `${focusKpi.totalDistanceKm} km` : '—',
        context: focusKpi.avgPaceMinPerKm != null
          ? `${focusKpi.avgPaceMinPerKm} min/km avg`
          : undefined,
        isEmpty: !focusKpi.totalDistanceKm,
      }
    case 'mixed':
      return {
        label:   'Volume',
        value:   focusKpi.totalVolumeLbs != null
          ? `${focusKpi.totalVolumeLbs.toLocaleString()} lbs`
          : '—',
        trend:   focusKpi.volumeTrend === 'insufficient_data' ? null
                 : focusKpi.volumeTrend as 'up' | 'down' | 'flat',
        isEmpty: !focusKpi.totalVolumeLbs,
      }
    case 'insufficient_data':
    default:
      return { label: 'Performance', value: '—', isEmpty: true }
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

interface KpiHeroProps {
  client:     ClientResponse
  kpis:       ClientKpiResponse | null | undefined
  isLoading:  boolean
  isAthlete:  boolean
}

export function KpiHero({ client, kpis, isLoading, isAthlete }: KpiHeroProps): React.JSX.Element {
  const [tipDismissed, setTipDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(TIP_KEY) === '1' } catch { return true }
  })

  const dismissTip = (): void => {
    try { localStorage.setItem(TIP_KEY, '1') } catch { /* noop */ }
    setTipDismissed(true)
  }

  // Show 1RM tip for athlete mode when:
  //   - client is self (athlete) and 1rm estimate is off and hasn't been dismissed
  //   - there are actual sessions to show the tip alongside
  const showTip = isAthlete
    && client.isSelf
    && !client.show1rmEstimate
    && !tipDismissed
    && (kpis?.totalSessionsAllTime ?? 0) > 0

  // Headline — the three "are you moving forward?" signals, shown in a fixed
  // 3-up row above the carousel so they never require a swipe to read.
  const headlineCards: KpiCardData[] = kpis ? [
    {
      label:   'Streak',
      value:   `${kpis.currentStreakWeeks} wk${kpis.currentStreakWeeks !== 1 ? 's' : ''}`,
      context: kpis.bestStreakWeeks > 0 ? `best: ${kpis.bestStreakWeeks} wks` : undefined,
      isEmpty: kpis.totalSessionsAllTime === 0,
    },
    {
      label:     'This week',
      value:     `${kpis.sessionsThisWeek}/${kpis.weeklySessionTarget}`,
      context:   'sessions',
      highlight: kpis.sessionsThisWeek < kpis.weeklySessionTarget && (kpis.daysSinceLastSession ?? 0) > 6,
      isEmpty:   kpis.totalSessionsAllTime === 0,
    },
    {
      label:     'Last session',
      value:     kpis.daysSinceLastSession != null
        ? kpis.daysSinceLastSession === 0 ? 'Today'
        : kpis.daysSinceLastSession === 1 ? 'Yesterday'
        : `${kpis.daysSinceLastSession}d ago`
        : '—',
      context:   kpis.lastSessionDate
        ? new Date(kpis.lastSessionDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : undefined,
      highlight: (kpis.daysSinceLastSession ?? 0) >= 14,
      isEmpty:   kpis.totalSessionsAllTime === 0,
    },
  ] : [
    { label: 'Streak',       value: '—', isEmpty: true },
    { label: 'This week',    value: '—', isEmpty: true },
    { label: 'Last session', value: '—', isEmpty: true },
  ]

  // Secondary — carousel below the headline.
  const carouselCards: KpiCardData[] = kpis ? [
    // Consistency score
    {
      label:     'Consistency',
      value:     `${kpis.consistencyScore}%`,
      context:   '4-week rolling',
      highlight: kpis.consistencyScore < 50 && kpis.totalSessionsAllTime > 0,
      isEmpty:   kpis.totalSessionsAllTime === 0,
    },
    // Focus KPI
    buildFocusCard(kpis.focusKpi),
    // Volume this month
    {
      label:   'Volume · month',
      value:   kpis.volumeThisMonthLbs != null
        ? `${kpis.volumeThisMonthLbs.toLocaleString()}`
        : '—',
      context: kpis.volumeThisMonthLbs != null ? 'lbs' : undefined,
      isEmpty: !kpis.volumeThisMonthLbs,
    },
    // Total sessions
    {
      label:   'All time',
      value:   String(kpis.totalSessionsAllTime),
      context: 'sessions',
      isEmpty: kpis.totalSessionsAllTime === 0,
    },
    // Avg energy
    {
      label:   'Avg energy',
      value:   kpis.avgEnergyThisMonth != null ? `${kpis.avgEnergyThisMonth}/10` : '—',
      context: 'this month',
      isEmpty: !kpis.avgEnergyThisMonth,
    },
    // Avg stress
    {
      label:   'Avg stress',
      value:   kpis.avgStressThisMonth != null ? `${kpis.avgStressThisMonth}/10` : '—',
      context: 'this month',
      highlight: (kpis.avgStressThisMonth ?? 0) >= 7,
      isEmpty: !kpis.avgStressThisMonth,
    },
  ] : ['Consistency', 'Performance', 'Volume · month', 'All time', 'Avg energy', 'Avg stress']
    .map((label) => ({ label, value: '—', isEmpty: true }))

  return (
    <div className="px-4 pt-4 pb-2">
      {/* Tip nudge — athlete mode 1RM tip */}
      {showTip && (
        <div className={cn(
          'flex items-start gap-2 mb-3 px-3 py-2.5 rounded-xl',
          'bg-command-blue/5 border border-command-blue/20',
        )}>
          <TipIcon size="sm" className="mt-0.5 shrink-0" />
          <p className="text-xs text-ink-muted flex-1">
            Enable 1RM estimates in{' '}
            <Link to="/preferences" className="text-command-blue hover:underline">
              Preferences
            </Link>{' '}
            to see your estimated max lifts.
          </p>
          <button
            type="button"
            onClick={dismissTip}
            aria-label="Dismiss tip"
            className="text-ink-faint hover:text-ink-muted ml-1 text-sm leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Headline — fixed 3-up, always visible (no swipe) */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2 mb-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="min-h-[100px] rounded-2xl bg-surface border border-surface-border animate-pulse"
              style={{ opacity: 0.5 }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {headlineCards.map((c) => (
            <KpiCard key={c.label} data={c} />
          ))}
        </div>
      )}

      {/* Secondary stats — carousel */}
      <KpiCarousel cards={carouselCards} isLoading={isLoading} />
    </div>
  )
}
