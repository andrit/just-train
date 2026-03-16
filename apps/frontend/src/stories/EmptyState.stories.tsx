import type { Meta, StoryObj } from '@storybook/react'
import { EmptyState }          from '@/components/ui/EmptyState'
import { Button }              from '@/components/ui/Button'

const meta = {
  title:     'UI / EmptyState',
  component: EmptyState,
  tags:      ['autodocs'],
  args: {
    icon:    '📋',
    title:   'No exercises yet',
    message: 'Add your first exercise to get started.',
  },
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithAction: Story = {
  args: {
    action: <Button icon={<span>+</span>}>Create First Exercise</Button>,
  },
}

export const NoMessage: Story = {
  args: {
    message: undefined,
  },
}

/** Shown when filters return zero results. */
export const NoResults: Story = {
  args: {
    icon:    '🔍',
    title:   'No exercises match',
    message: 'Try adjusting your filters or search term.',
    action:  <Button variant="ghost" size="sm">Clear filters</Button>,
  },
}

/** Shown for an empty client list. */
export const NoClients: Story = {
  args: {
    icon:    '👥',
    title:   'No clients yet',
    message: 'Add your first client to start tracking their progress.',
    action:  <Button icon={<span>+</span>}>Add Client</Button>,
  },
}
