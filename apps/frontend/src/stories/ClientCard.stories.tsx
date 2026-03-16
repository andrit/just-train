import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter }        from 'react-router-dom'
import { ClientCard }          from '@/components/clients/ClientCard'
import type { ClientResponse } from '@trainer-app/shared'

// ── Base client fixture ───────────────────────────────────────────────────────

const base: ClientResponse = {
  id:               '11111111-1111-1111-1111-111111111111',
  trainerId:        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name:             'Jordan Smith',
  email:            'jordan@example.com',
  phone:            null,
  photoUrl:         null,
  dateOfBirth:      null,
  goals:            null,
  notes:            null,
  active:           true,
  primaryFocus:     'resistance',
  secondaryFocus:   null,
  progressionState: 'programming',
  startDate:        '2024-09-01',
  caloricGoal:      null,
  nutritionNotes:   null,
  isSelf:           false,
  lastActiveAt:     new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
  createdAt:        '2024-09-01T00:00:00Z',
  updatedAt:        '2024-09-01T00:00:00Z',
}

const meta = {
  title:     'Clients / ClientCard',
  component: ClientCard,
  tags:      ['autodocs'],
  decorators: [
    (Story: React.ComponentType) => (
      <MemoryRouter>
        <div className="max-w-sm p-4">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  args: { client: base },
} satisfies Meta<typeof ClientCard>

export default meta
type Story = StoryObj<typeof meta>

// ── States ────────────────────────────────────────────────────────────────────

export const Default: Story = {}

export const Assessment: Story = {
  args: {
    client: { ...base, progressionState: 'assessment', primaryFocus: 'cardio', lastActiveAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
  },
}

export const Maintenance: Story = {
  args: {
    client: { ...base, progressionState: 'maintenance', primaryFocus: 'mixed' },
  },
}

export const AtRisk: Story = {
  name: 'At Risk (14+ days inactive)',
  args: {
    client: {
      ...base,
      lastActiveAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
}

export const NoActivityYet: Story = {
  name: 'No Activity Yet',
  args: {
    client: { ...base, lastActiveAt: null },
  },
}

export const NoFocus: Story = {
  name: 'No Focus Set',
  args: {
    client: { ...base, primaryFocus: null },
  },
}

export const WithPhoto: Story = {
  args: {
    client: { ...base, photoUrl: 'https://i.pravatar.cc/150?img=33' },
  },
}

export const CardioFocus: Story = {
  args: {
    client: { ...base, primaryFocus: 'cardio', name: 'Sam Rivera' },
  },
}

export const CalisthenicsFocus: Story = {
  args: {
    client: { ...base, primaryFocus: 'calisthenics', name: 'Alex Chen' },
  },
}

// ── All states at once ────────────────────────────────────────────────────────

export const AllStates: Story = {
  render: () => (
    <MemoryRouter>
      <div className="max-w-sm space-y-3 p-4">
        <ClientCard client={{ ...base, name: 'Programming — Normal', progressionState: 'programming' }} />
        <ClientCard client={{ ...base, name: 'Assessment — New Client', progressionState: 'assessment', lastActiveAt: null }} />
        <ClientCard client={{ ...base, name: 'At Risk — 18 days', lastActiveAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString() }} />
        <ClientCard client={{ ...base, name: 'Maintenance — Sustaining', progressionState: 'maintenance', primaryFocus: 'mixed' }} />
      </div>
    </MemoryRouter>
  ),
}
