import type { Meta, StoryObj } from '@storybook/react'
import { TextArea }            from '@/components/ui/TextArea'

const meta = {
  title:     'UI / TextArea',
  component: TextArea,
  tags:      ['autodocs'],
  args: {
    label:       'Form Instructions',
    placeholder: 'Step-by-step cues for proper form…',
    rows:        4,
  },
  argTypes: {
    error:    { control: 'text' },
    hint:     { control: 'text' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    rows:     { control: { type: 'number', min: 2, max: 12 } },
  },
} satisfies Meta<typeof TextArea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithValue: Story = {
  args: {
    defaultValue:
      '1. Set up with bar at mid-chest height.\n2. Grip just outside shoulder width.\n3. Unrack, step back, feet shoulder-width.',
  },
}

export const WithHint: Story = {
  args: {
    hint: 'These notes are visible to you during sessions',
  },
}

export const WithError: Story = {
  args: {
    error: 'Instructions must be under 5,000 characters',
    defaultValue: 'Way too long text that has exceeded the limit...',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: 'This field is read-only in this context.',
  },
}
