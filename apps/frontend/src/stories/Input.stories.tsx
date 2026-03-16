import type { Meta, StoryObj } from '@storybook/react'
import { Input }               from '@/components/ui/Input'

const meta = {
  title:     'UI / Input',
  component: Input,
  tags:      ['autodocs'],
  args: {
    label:       'Exercise Name',
    placeholder: 'e.g. Barbell Back Squat',
  },
  argTypes: {
    error:    { control: 'text' },
    hint:     { control: 'text' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithValue: Story = {
  args: { defaultValue: 'Romanian Deadlift' },
}

export const WithHint: Story = {
  args: { hint: 'Use the full anatomical name where possible' },
}

export const WithError: Story = {
  args: {
    error:        'Name is required',
    defaultValue: '',
  },
}

export const Required: Story = {
  args: { required: true },
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Barbell Back Squat' },
}

export const NumberInput: Story = {
  args: {
    label:       'Target Reps',
    type:        'number',
    placeholder: '0',
    min:         0,
    max:         999,
  },
}

export const SearchInput: Story = {
  args: {
    type:        'search',
    placeholder: 'Search exercises…',
  },
}

/** Form group — a realistic grouping of fields as used in ExerciseForm. */
export const FormGroup: Story = {
  render: () => (
    <div className="space-y-4 p-4 max-w-md">
      <Input label="Exercise Name" placeholder="e.g. Barbell Back Squat" required />
      <Input label="Description" placeholder="Brief overview…" />
      <Input
        label="Video URL"
        type="url"
        placeholder="https://youtube.com/watch?v=…"
        hint="Paste a YouTube or Vimeo link"
      />
    </div>
  ),
}
