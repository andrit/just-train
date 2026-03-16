import type { Meta, StoryObj } from '@storybook/react'
import { Select }              from '@/components/ui/Select'
import type { SelectOption }   from '@/components/ui/Select'

// ── Shared option sets (mirrors app enums) ────────────────────────────────────

const workoutTypeOptions: SelectOption[] = [
  { value: 'cardio',       label: 'Cardio' },
  { value: 'stretching',   label: 'Stretching' },
  { value: 'calisthenics', label: 'Calisthenics' },
  { value: 'resistance',   label: 'Resistance' },
  { value: 'cooldown',     label: 'Cooldown' },
]

const difficultyOptions: SelectOption[] = [
  { value: 'beginner',     label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced',     label: 'Advanced' },
]

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta = {
  title:     'UI / Select',
  component: Select,
  tags:      ['autodocs'],
  args: {
    label:   'Workout Type',
    options: workoutTypeOptions,
  },
  argTypes: {
    error:    { control: 'text' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
  },
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithPlaceholder: Story = {
  args: { placeholder: 'Select a type…' },
}

export const WithError: Story = {
  args: {
    error:       'Workout type is required',
    placeholder: 'Select a type…',
    value:       '',
  },
}

export const Disabled: Story = {
  args: { disabled: true, value: 'resistance' },
}

export const DifficultySelect: Story = {
  args: {
    label:   'Difficulty',
    options: difficultyOptions,
    value:   'intermediate',
  },
}

/** Realistic pair as used in ExerciseForm. */
export const FormPair: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-3 p-4 max-w-md">
      <Select
        label="Workout Type"
        options={workoutTypeOptions}
        defaultValue="resistance"
      />
      <Select
        label="Difficulty"
        options={difficultyOptions}
        defaultValue="intermediate"
      />
    </div>
  ),
}
