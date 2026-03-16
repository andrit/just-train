import type { Meta, StoryObj } from '@storybook/react'
import { AddClientCard }       from '@/components/clients/AddClientCard'

const meta = {
  title:     'Clients / AddClientCard',
  component: AddClientCard,
  tags:      ['autodocs'],
  args: {
    onClick: () => {},
  },
  argTypes: {
    onClick: { action: 'clicked' },
  },
  decorators: [
    (Story: React.ComponentType) => (
      <div className="max-w-sm p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AddClientCard>

export default meta
type Story = StoryObj<typeof meta>

// ── Default — shows pulsing + badge ──────────────────────────────────────────

export const Default: Story = {}

// ── In context with a real client card above it ───────────────────────────────
// Shows how the card looks at the top of a client list

export const InList: Story = {
  render: () => {
    const { MemoryRouter } = require('react-router-dom')
    const { ClientCard }   = require('@/components/clients/ClientCard')
    const client = {
      id: '1', trainerId: '2', name: 'Jordan Smith', email: null, phone: null,
      photoUrl: null, dateOfBirth: null, goals: null, notes: null, active: true,
      primaryFocus: 'resistance', secondaryFocus: null, progressionState: 'programming',
      startDate: null, caloricGoal: null, nutritionNotes: null, isSelf: false,
      lastActiveAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
    }
    return (
      <MemoryRouter>
        <div className="max-w-sm space-y-3 p-4">
          <AddClientCard onClick={() => {}} />
          <ClientCard client={client} />
        </div>
      </MemoryRouter>
    )
  },
}
