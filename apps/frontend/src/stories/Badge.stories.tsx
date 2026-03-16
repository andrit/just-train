import type { Meta, StoryObj } from '@storybook/react'
import { Badge }               from '@/components/ui/Badge'

const meta = {
  title:     'UI / Badge',
  component: Badge,
  tags:      ['autodocs'],
  args: {
    children: 'Resistance',
    variant:  'default',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'success', 'warning', 'danger', 'info'],
      description: 'Semantic colour variant',
    },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Success: Story = {
  args: { variant: 'success', children: 'Completed' },
}

export const Warning: Story = {
  args: { variant: 'warning', children: 'Draft' },
}

export const Danger: Story = {
  args: { variant: 'danger', children: 'Cancelled' },
}

export const Info: Story = {
  args: { variant: 'info', children: 'Cardio' },
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 p-4">
      <Badge variant="default">Default</Badge>
      <Badge variant="success">Completed</Badge>
      <Badge variant="warning">Draft</Badge>
      <Badge variant="danger">Overdue</Badge>
      <Badge variant="info">Cardio</Badge>
    </div>
  ),
}

/** Badges are inline — they can sit inside text naturally. */
export const InlineWithText: Story = {
  render: () => (
    <p className="text-gray-200 p-4">
      Romanian Deadlift <Badge variant="warning">Draft</Badge> is a{' '}
      <Badge variant="info">Resistance</Badge> exercise targeting{' '}
      <Badge variant="default">Back</Badge>
    </p>
  ),
}
