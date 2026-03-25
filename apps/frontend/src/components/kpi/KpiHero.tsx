// ------------------------------------------------------------
// components/kpi/KpiHero.tsx (v1.6.0)
//
// KPI hero section shown above the tabs on the client profile.
// Translates the backend ClientKpiResponse into KpiCardData[]
// and renders the carousel.
//
// Also handles:
//   - The 1RM tip nudge for athlete mode (shown once, tracked in localStorage)
//   - Empty state when the client has no sessions yet
// ------------------------------------------------------------

import { useState } from 'react'
import { Link }                  from 'react-router-dom'
import { cn }                    from '@/lib/cn'
import { KpiCarousel }           from './KpiCarousel'
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

  // Build the 8 cards
  const cards: KpiCardData[] = kpis ? [
    // Card 1 — Streak
    {
      label:   'Streak',
      value:   `${kpis.currentStreakWeeks} wk${kpis.currentStreakWeeks !== 1 ? 's' : ''}`,
      context: kpis.bestStreakWeeks > 0 ? `best: ${kpis.bestStreakWeeks} wks` : undefined,
      isEmpty: kpis.totalSessionsAllTime === 0,
    },
    // Card 1b — Consistency score
    {
      label:     'Consistency',
      value:     `${kpis.consistencyScore}%`,
      context:   '4-week rolling',
      highlight: kpis.consistencyScore < 50 && kpis.totalSessionsAllTime > 0,
      isEmpty:   kpis.totalSessionsAllTime === 0,
    },
    // Card 2 — This week
    {
      label:     'This week',
      value:     `${kpis.sessionsThisWeek}/${kpis.weeklySessionTarget}`,
      context:   'sessions',
      highlight: kpis.sessionsThisWeek < kpis.weeklySessionTarget && (kpis.daysSinceLastSession ?? 0) > 6,
      isEmpty:   kpis.totalSessionsAllTime === 0,
    },
    // Card 3 — Last session
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
    // Card 4 — Focus KPI
    buildFocusCard(kpis.focusKpi),
    // Card 5 — Volume this month
    {
      label:   'Volume · month',
      value:   kpis.volumeThisMonthLbs != null
        ? `${kpis.volumeThisMonthLbs.toLocaleString()}`
        : '—',
      context: kpis.volumeThisMonthLbs != null ? 'lbs' : undefined,
      isEmpty: !kpis.volumeThisMonthLbs,
    },
    // Card 6 — Total sessions
    {
      label:   'All time',
      value:   String(kpis.totalSessionsAllTime),
      context: 'sessions',
      isEmpty: kpis.totalSessionsAllTime === 0,
    },
    // Card 7 — Avg energy
    {
      label:   'Avg energy',
      value:   kpis.avgEnergyThisMonth != null ? `${kpis.avgEnergyThisMonth}/10` : '—',
      context: 'this month',
      isEmpty: !kpis.avgEnergyThisMonth,
    },
    // Card 8 — Avg stress
    {
      label:   'Avg stress',
      value:   kpis.avgStressThisMonth != null ? `${kpis.avgStressThisMonth}/10` : '—',
      context: 'this month',
      highlight: (kpis.avgStressThisMonth ?? 0) >= 7,
      isEmpty: !kpis.avgStressThisMonth,
    },
  ] : Array.from({ length: 8 }, (_, i) => ({
    label: ['Streak', 'This week', 'Last session', 'Performance',
            'Volume · month', 'All time', 'Avg energy', 'Avg stress'][i] ?? '',
    value: '—',
    isEmpty: true,
  }))

  return (
    <div className="px-4 pt-4 pb-2">
      {/* Tip nudge — athlete mode 1RM tip */}
      {showTip && (
        <div className={cn(
          'flex items-start gap-2 mb-3 px-3 py-2.5 rounded-xl',
          'bg-brand-highlight/5 border border-brand-highlight/20',
        )}>
          <TipIcon size="sm" className="mt-0.5 shrink-0" />
          <p className="text-xs text-gray-400 flex-1">
            Enable 1RM estimates in{' '}
            <Link to="/preferences" className="text-brand-highlight hover:underline">
              Preferences
            </Link>{' '}
            to see your estimated max lifts.
          </p>
          <button
            type="button"
            onClick={dismissTip}
            aria-label="Dismiss tip"
            className="text-gray-600 hover:text-gray-400 ml-1 text-sm leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Carousel */}
      <KpiCarousel cards={cards} isLoading={isLoading} />
    </div>
  )
}
