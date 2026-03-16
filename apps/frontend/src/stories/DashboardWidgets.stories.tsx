import type { Meta, StoryObj }  from '@storybook/react'
import { MemoryRouter }          from 'react-router-dom'
import { AtRiskWidget }          from '@/components/dashboard/widgets/AtRiskWidget'
import { SelfTrainingWidget }    from '@/components/dashboard/widgets/SelfTrainingWidget'
import { ActiveClientsWidget }   from '@/components/dashboard/widgets/ActiveClientsWidget'
import { GoalsWidget }           from '@/components/dashboard/widgets/GoalsWidget'
import { RecentSessionsWidget }  from '@/components/dashboard/widgets/RecentSessionsWidget'
import type { ClientResponse, ClientGoalResponse } from '@trainer-app/shared'

// ── Shared fixtures ───────────────────────────────────────────────────────────

const makeClient = (overrides: Partial<ClientResponse> = {}): ClientResponse => ({
  id:               crypto.randomUUID(),
  trainerId:        'trainer-1',
  name:             'Test Client',
  email:            null,
  phone:            null,
  photoUrl:         null,
  dateOfBirth:      null,
  goals:            null,
  notes:            null,
  active:           true,
  primaryFocus:     'resistance',
  secondaryFocus:   null,
  progressionState: 'programming',
  startDate:        '2024-01-01',
  caloricGoal:      null,
  nutritionNotes:   null,
  isSelf:           false,
  lastActiveAt:     new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt:        '2024-01-01T00:00:00Z',
  updatedAt:        '2024-01-01T00:00:00Z',
  ...overrides,
})

const selfClient = makeClient({
  isSelf:           true,
  name:             'Alex Trainer',
  primaryFocus:     'mixed',
  progressionState: 'programming',
  lastActiveAt:     new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
})

const atRiskClient1 = makeClient({
  name:        'Sam Rivera',
  lastActiveAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
})

const atRiskClient2 = makeClient({
  name:        'Morgan Lee',
  lastActiveAt: null,
})

const allClients: ClientResponse[] = [
  makeClient({ name: 'Jordan Smith', progressionState: 'programming', lastActiveAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }),
  makeClient({ name: 'Taylor Jones', progressionState: 'assessment',  lastActiveAt: null }),
  makeClient({ name: 'Casey Brown', progressionState: 'programming', lastActiveAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() }),
  atRiskClient1,
  atRiskClient2,
  makeClient({ name: 'Riley Davis', progressionState: 'maintenance', lastActiveAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() }),
]

const activeGoal: ClientGoalResponse = {
  id:               'goal-1',
  clientId:         selfClient.id,
  goal:             'Complete a sub-40 minute 10K run',
  progressionState: 'programming',
  setAt:            '2024-10-01T00:00:00Z',
  achievedAt:       null,
  createdAt:        '2024-10-01T00:00:00Z',
}

// ── Decorator ─────────────────────────────────────────────────────────────────

const withRouter = (Story: React.ComponentType) => (
  <MemoryRouter>
    <div className="max-w-sm p-4">
      <Story />
    </div>
  </MemoryRouter>
)

// ============================================================
// AtRiskWidget
// ============================================================

export default {
  title: 'Dashboard / Widgets',
} satisfies Meta

// ── AtRiskWidget ──────────────────────────────────────────────────────────────

export const AtRisk_Default: StoryObj = {
  name: 'AtRiskWidget / Default (amber)',
  decorators: [withRouter],
  render: () => (
    <AtRiskWidget
      clients={allClients}
      colorScheme="amber"
      tone="clinical"
      onDismiss={() => {}}
    />
  ),
}

export const AtRisk_Red: StoryObj = {
  name: 'AtRiskWidget / Red — Urgent tone',
  decorators: [withRouter],
  render: () => (
    <AtRiskWidget
      clients={allClients}
      colorScheme="red"
      tone="firm"
      onDismiss={() => {}}
    />
  ),
}

export const AtRisk_Motivating: StoryObj = {
  name: 'AtRiskWidget / Blue — Motivating tone',
  decorators: [withRouter],
  render: () => (
    <AtRiskWidget
      clients={allClients}
      colorScheme="blue"
      tone="motivating"
      onDismiss={() => {}}
    />
  ),
}

export const AtRisk_Green: StoryObj = {
  name: 'AtRiskWidget / Green — Calm tone',
  decorators: [withRouter],
  render: () => (
    <AtRiskWidget
      clients={allClients}
      colorScheme="green"
      tone="motivating"
      onDismiss={() => {}}
    />
  ),
}

export const AtRisk_OneClient: StoryObj = {
  name: 'AtRiskWidget / Single client',
  decorators: [withRouter],
  render: () => (
    <AtRiskWidget
      clients={[atRiskClient1]}
      onDismiss={() => {}}
    />
  ),
}

export const AtRisk_Empty: StoryObj = {
  name: 'AtRiskWidget / No at-risk clients (renders null)',
  decorators: [withRouter],
  render: () => (
    <div>
      <p className="text-xs text-gray-500 mb-2">Widget renders nothing when no clients are at risk:</p>
      <AtRiskWidget
        clients={allClients.filter((c) => c.lastActiveAt && (Date.now() - new Date(c.lastActiveAt).getTime()) < 14 * 24 * 60 * 60 * 1000)}
        onDismiss={() => {}}
      />
      <p className="text-xs text-gray-600 mt-2">(empty — widget correctly hidden)</p>
    </div>
  ),
}

// ── SelfTrainingWidget ────────────────────────────────────────────────────────

export const SelfTraining_Default: StoryObj = {
  name: 'SelfTrainingWidget / Default CTA',
  decorators: [withRouter],
  render: () => (
    <SelfTrainingWidget
      selfClient={selfClient}
      activeGoal={activeGoal}
      ctaLabel="Start Training"
    />
  ),
}

export const SelfTraining_JustDoIt: StoryObj = {
  name: 'SelfTrainingWidget / "Just Do It" CTA',
  decorators: [withRouter],
  render: () => (
    <SelfTrainingWidget
      selfClient={selfClient}
      activeGoal={activeGoal}
      ctaLabel="Just Do It"
    />
  ),
}

export const SelfTraining_NoGoal: StoryObj = {
  name: "SelfTrainingWidget / No active goal",
  decorators: [withRouter],
  render: () => (
    <SelfTrainingWidget
      selfClient={selfClient}
      activeGoal={null}
      ctaLabel="Let's Go"
    />
  ),
}

export const SelfTraining_AllCTAs: StoryObj = {
  name: 'SelfTrainingWidget / All CTA labels',
  decorators: [
    (Story: React.ComponentType) => (
      <MemoryRouter>
        <div className="max-w-sm space-y-3 p-4">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  render: () => (
    <>
      {['Start Training', 'Just Do It', "Let's Go", 'Train Now', 'Get After It'].map((label) => (
        <SelfTrainingWidget
          key={label}
          selfClient={{ ...selfClient, id: label }}
          activeGoal={null}
          ctaLabel={label}
        />
      ))}
    </>
  ),
}

// ── ActiveClientsWidget ───────────────────────────────────────────────────────

export const ActiveClients_Default: StoryObj = {
  name: 'ActiveClientsWidget / 6 clients',
  decorators: [withRouter],
  render: () => <ActiveClientsWidget clients={allClients} />,
}

export const ActiveClients_Empty: StoryObj = {
  name: 'ActiveClientsWidget / No clients',
  decorators: [withRouter],
  render: () => <ActiveClientsWidget clients={[]} />,
}

export const ActiveClients_OneEach: StoryObj = {
  name: 'ActiveClientsWidget / One per state',
  decorators: [withRouter],
  render: () => (
    <ActiveClientsWidget clients={[
      makeClient({ progressionState: 'assessment' }),
      makeClient({ progressionState: 'programming' }),
      makeClient({ progressionState: 'maintenance' }),
    ]} />
  ),
}

// ── GoalsWidget ───────────────────────────────────────────────────────────────

export const Goals_WithAchievements: StoryObj = {
  name: 'GoalsWidget / 5 active, 2 achieved this month',
  render: () => <div className="max-w-sm p-4"><GoalsWidget activeGoalCount={5} achievedThisMonth={2} /></div>,
}

export const Goals_Empty: StoryObj = {
  name: 'GoalsWidget / No goals',
  render: () => <div className="max-w-sm p-4"><GoalsWidget activeGoalCount={0} achievedThisMonth={0} /></div>,
}

// ── RecentSessionsWidget ──────────────────────────────────────────────────────

export const RecentSessions: StoryObj = {
  name: 'RecentSessionsWidget / Phase 5 placeholder',
  render: () => <div className="max-w-sm p-4"><RecentSessionsWidget /></div>,
}

// ── Full dashboard stack ──────────────────────────────────────────────────────

export const FullStack_Trainer: StoryObj = {
  name: 'Dashboard / Full trainer stack',
  decorators: [
    (Story: React.ComponentType) => (
      <MemoryRouter>
        <div className="max-w-sm space-y-4 p-4">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  render: () => (
    <>
      <AtRiskWidget clients={allClients} onDismiss={() => {}} />
      <SelfTrainingWidget selfClient={selfClient} activeGoal={activeGoal} ctaLabel="Start Training" />
      <ActiveClientsWidget clients={allClients} />
      <GoalsWidget activeGoalCount={5} achievedThisMonth={2} />
      <RecentSessionsWidget />
    </>
  ),
}

export const FullStack_Athlete: StoryObj = {
  name: 'Dashboard / Full athlete stack',
  decorators: [
    (Story: React.ComponentType) => (
      <MemoryRouter>
        <div className="max-w-sm space-y-4 p-4">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  render: () => (
    <>
      <SelfTrainingWidget selfClient={selfClient} activeGoal={activeGoal} ctaLabel="Just Do It" />
      <GoalsWidget activeGoalCount={3} achievedThisMonth={1} />
      <RecentSessionsWidget />
    </>
  ),
}
