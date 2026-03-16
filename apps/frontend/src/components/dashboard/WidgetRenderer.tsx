// ------------------------------------------------------------
// components/dashboard/WidgetRenderer.tsx
//
// Maps a WidgetId to its component. This is the single place
// where new widgets are registered for rendering.
//
// TO ADD A NEW WIDGET:
//   1. Build the component in widgets/
//   2. Import it here
//   3. Add a case to the switch
// ------------------------------------------------------------

import type { WidgetId }        from '@/lib/widgets'
import { AtRiskWidget }         from './widgets/AtRiskWidget'
import { SelfTrainingWidget }   from './widgets/SelfTrainingWidget'
import { ActiveClientsWidget }  from './widgets/ActiveClientsWidget'
import { GoalsWidget }          from './widgets/GoalsWidget'
import { RecentSessionsWidget } from './widgets/RecentSessionsWidget'
import type { ClientResponse, ClientGoalResponse } from '@trainer-app/shared'

interface WidgetRendererProps {
  id:              WidgetId
  clients?:        ClientResponse[]
  selfClient?:     ClientResponse | null
  activeGoal?:     ClientGoalResponse | null
  goals?:          ClientGoalResponse[]
  ctaLabel?:       string
  alertColorScheme?: 'amber' | 'red' | 'blue' | 'green'
  alertTone?:        'clinical' | 'motivating' | 'firm'
  onDismissAlert?: () => void
}

export function WidgetRenderer({
  id,
  clients          = [],
  selfClient       = null,
  activeGoal       = null,
  goals            = [],
  ctaLabel         = 'Start Training',
  alertColorScheme = 'amber',
  alertTone        = 'clinical',
  onDismissAlert,
}: WidgetRendererProps): React.JSX.Element | null {
  switch (id) {
    case 'atRisk':
      if (!onDismissAlert) return null
      return (
        <AtRiskWidget
          clients={clients}
          colorScheme={alertColorScheme}
          tone={alertTone}
          onDismiss={onDismissAlert}
        />
      )

    case 'selfTraining':
      if (!selfClient) return null
      return (
        <SelfTrainingWidget
          selfClient={selfClient}
          activeGoal={activeGoal}
          ctaLabel={ctaLabel}
        />
      )

    case 'activeClients':
      return <ActiveClientsWidget clients={clients} />

    case 'goals': {
      const activeGoals   = goals.filter((g) => g.achievedAt === null)
      const now = new Date()
      const achievedThisMonth = goals.filter((g) => {
        if (!g.achievedAt) return false
        const d = new Date(g.achievedAt)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      }).length
      return (
        <GoalsWidget
          activeGoalCount={activeGoals.length}
          achievedThisMonth={achievedThisMonth}
        />
      )
    }

    case 'recentSessions':
      return <RecentSessionsWidget />

    // Phase 7 widgets — not yet available
    case 'volume':
    case 'streak':
    case 'newClients':
      return null

    default:
      return null
  }
}
