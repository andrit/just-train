import type { Meta, StoryObj } from '@storybook/react'
import { Button }              from '@/components/ui/Button'

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta = {
  title:     'UI / Button',
  component: Button,
  tags:      ['autodocs'],
  args: {
    children: 'Button',
    variant:  'primary',
    size:     'md',
    loading:  false,
    disabled: false,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
      description: 'Visual style',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    loading: {
      control: 'boolean',
      description: 'Replaces icon with a spinner and disables the button',
    },
    disabled: { control: 'boolean' },
    onClick:  { action: 'clicked' },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

// ── Variants ──────────────────────────────────────────────────────────────────

export const Primary: Story = {}

export const Secondary: Story = {
  args: { variant: 'secondary' },
}

export const Ghost: Story = {
  args: { variant: 'ghost' },
}

export const Danger: Story = {
  args: { variant: 'danger', children: 'Delete Exercise' },
}

// ── Sizes ─────────────────────────────────────────────────────────────────────

export const Small: Story = {
  args: { size: 'sm', children: 'Small' },
}

export const Medium: Story = {
  args: { size: 'md', children: 'Medium' },
}

export const Large: Story = {
  args: { size: 'lg', children: 'Large' },
}

// ── States ────────────────────────────────────────────────────────────────────

export const Loading: Story = {
  args: { loading: true, children: 'Saving…' },
}

export const Disabled: Story = {
  args: { disabled: true },
}

export const WithIcon: Story = {
  args: {
    icon:     <span>+</span>,
    children: 'New Exercise',
  },
}

export const IconOnly: Story = {
  args: {
    icon:         <span>🗑</span>,
    children:     undefined,
    variant:      'ghost',
    'aria-label': 'Delete',
  },
}

// ── All variants at once ──────────────────────────────────────────────────────

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 p-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button loading>Loading</Button>
      <Button disabled>Disabled</Button>
      <Button icon={<span>+</span>}>With Icon</Button>
    </div>
  ),
}

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-3 p-4">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
}
