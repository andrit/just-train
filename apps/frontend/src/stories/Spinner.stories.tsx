import type { Meta, StoryObj } from '@storybook/react'
import { Spinner }             from '@/components/ui/Spinner'

const meta = {
  title:     'UI / Spinner',
  component: Spinner,
  tags:      ['autodocs'],
  args: {
    size:  'md',
    label: 'Loading',
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof Spinner>

export default meta
type Story = StoryObj<typeof meta>

export const Small: Story  = { args: { size: 'sm' } }
export const Medium: Story = { args: { size: 'md' } }
export const Large: Story  = { args: { size: 'lg' } }

export const InheritedColour: Story = {
  render: () => (
    <div className="flex gap-6 items-center p-4">
      <span className="text-brand-highlight"><Spinner size="md" /></span>
      <span className="text-green-400"><Spinner size="md" /></span>
      <span className="text-amber-400"><Spinner size="md" /></span>
      <span className="text-gray-400"><Spinner size="md" /></span>
    </div>
  ),
}

export const AllSizes: Story = {
  render: () => (
    <div className="flex gap-6 items-center p-4">
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
    </div>
  ),
}
