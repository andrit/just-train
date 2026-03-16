import type { Meta, StoryObj } from '@storybook/react'
import { useState }            from 'react'
import { expect, userEvent, within } from '@storybook/test'
import { ConfirmDialog }       from '@/components/ui/ConfirmDialog'
import { Button }              from '@/components/ui/Button'

const meta = {
  title:     'UI / ConfirmDialog',
  component: ConfirmDialog,
  tags:      ['autodocs'],
  parameters: {
    backgrounds: { default: 'brand-primary' },
  },
} satisfies Meta<typeof ConfirmDialog>

export default meta
type Story = StoryObj<typeof meta>

// ── Controlled wrapper ────────────────────────────────────────────────────────

function ConfirmDemo(props: {
  title:        string
  message:      string
  confirmLabel?: string
  danger?:      boolean
  simulateLoading?: boolean
}): React.JSX.Element {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<'idle' | 'confirmed' | 'cancelled'>('idle')

  const handleConfirm = (): void => {
    if (props.simulateLoading) {
      setLoading(true)
      setTimeout(() => {
        setLoading(false)
        setOpen(false)
        setResult('confirmed')
      }, 1500)
    } else {
      setOpen(false)
      setResult('confirmed')
    }
  }

  return (
    <div className="p-6 space-y-4">
      <Button
        variant={props.danger ? 'danger' : 'primary'}
        onClick={() => { setOpen(true); setResult('idle') }}
      >
        {props.danger ? 'Delete…' : 'Proceed…'}
      </Button>

      {result !== 'idle' && (
        <p className="text-sm text-gray-400">
          Result: <span className="text-gray-200 font-medium">{result}</span>
        </p>
      )}

      <ConfirmDialog
        open={open}
        title={props.title}
        message={props.message}
        confirmLabel={props.confirmLabel}
        danger={props.danger}
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={() => { setOpen(false); setResult('cancelled') }}
      />
    </div>
  )
}

// ── Stories ───────────────────────────────────────────────────────────────────

export const Neutral: Story = {
  args: {} as any,
  render: () => (
    <ConfirmDemo
      title="Apply Template?"
      message="This will replace the current session structure with the selected template."
      confirmLabel="Apply"
    />
  ),
}

export const Danger: Story = {
  args: {} as any,
  render: () => (
    <ConfirmDemo
      title="Delete Exercise?"
      message={`"Romanian Deadlift" will be permanently removed from your library. Sessions using it will retain a reference but the exercise data will be gone.`}
      confirmLabel="Delete"
      danger
    />
  ),
}

export const WithLoadingState: Story = {
  args: {} as any,
  render: () => (
    <ConfirmDemo
      title="Delete Client?"
      message="All sessions and notes for this client will be permanently deleted."
      confirmLabel="Delete"
      danger
      simulateLoading
    />
  ),
}

/** Play function: open → confirm path */
export const InteractionConfirm: Story = {
  args: {} as any,
  render: () => (
    <ConfirmDemo
      title="Confirm Action"
      message="This will take effect immediately."
      confirmLabel="Confirm"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: /proceed/i }))

    const dialog = canvas.getByRole('dialog')
    expect(dialog).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: /confirm/i }))
    expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
    expect(canvas.getByText(/confirmed/i)).toBeInTheDocument()
  },
}

/** Play function: open → cancel path */
export const InteractionCancel: Story = {
  args: {} as any,
  render: () => (
    <ConfirmDemo
      title="Confirm Action"
      message="This will take effect immediately."
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: /proceed/i }))
    await userEvent.click(canvas.getByRole('button', { name: /cancel/i }))

    expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
    expect(canvas.getByText(/cancelled/i)).toBeInTheDocument()
  },
}
