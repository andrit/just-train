import type { Meta, StoryObj } from '@storybook/react'
import { useState }            from 'react'
import { expect, userEvent, within } from '@storybook/test'
import { Modal }               from '@/components/ui/Modal'
import { Button }              from '@/components/ui/Button'
import { Input }               from '@/components/ui/Input'
import { Select }              from '@/components/ui/Select'

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta = {
  title:     'UI / Modal',
  component: Modal,
  tags:      ['autodocs'],
  parameters: {
    // Render against the darkest background so the backdrop shows
    backgrounds: { default: 'brand-primary' },
  },
} satisfies Meta<typeof Modal>

export default meta
type Story = StoryObj<typeof meta>

// ── Controlled wrapper ────────────────────────────────────────────────────────

function ModalDemo({
  title,
  size,
  children,
  dismissOnBackdrop,
}: {
  title?: string
  size?:  'sm' | 'md' | 'lg'
  children: React.ReactNode
  dismissOnBackdrop?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>Open Modal</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        size={size}
        dismissOnBackdrop={dismissOnBackdrop}
      >
        {children}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setOpen(false)}>Confirm</Button>
        </div>
      </Modal>
    </div>
  )
}

// ── Stories ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {} as any,
  render: () => (
    <ModalDemo title="Create Exercise">
      <p className="text-gray-400 text-sm">Modal content goes here.</p>
    </ModalDemo>
  ),
}

export const Small: Story = {
  args: {} as any,
  render: () => (
    <ModalDemo title="Confirm Action" size="sm">
      <p className="text-gray-400 text-sm text-center">
        Are you sure you want to do this?
      </p>
    </ModalDemo>
  ),
}

export const Large: Story = {
  args: {} as any,
  render: () => (
    <ModalDemo title="Exercise Details" size="lg">
      <p className="text-gray-400 text-sm">
        Larger modals are used for content-heavy forms or detail views.
      </p>
    </ModalDemo>
  ),
}

/** Realistic exercise creation form inside a modal. */
export const ExerciseForm: Story = {
  args: {} as any,
  render: () => (
    <ModalDemo title="New Exercise" size="md">
      <div className="space-y-4">
        <Input label="Exercise Name" placeholder="e.g. Romanian Deadlift" required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Workout Type"
            options={[
              { value: 'resistance', label: 'Resistance' },
              { value: 'cardio',     label: 'Cardio' },
            ]}
            defaultValue="resistance"
          />
          <Select
            label="Difficulty"
            options={[
              { value: 'beginner',     label: 'Beginner' },
              { value: 'intermediate', label: 'Intermediate' },
              { value: 'advanced',     label: 'Advanced' },
            ]}
            defaultValue="intermediate"
          />
        </div>
      </div>
    </ModalDemo>
  ),
}

/** Play function tests that the modal opens and closes correctly. */
export const InteractionTest: Story = {
  args: {} as any,
  render: () => (
    <ModalDemo title="Interaction Test">
      <p className="text-gray-400 text-sm" data-testid="modal-content">
        Modal is open.
      </p>
    </ModalDemo>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Open
    await userEvent.click(canvas.getByRole('button', { name: /open modal/i }))

    // Check dialog is present
    const dialog = canvas.getByRole('dialog')
    expect(dialog).toBeInTheDocument()

    // Close via button
    await userEvent.click(canvas.getByRole('button', { name: /close dialog/i }))
    expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
  },
}
