import type { Meta, StoryObj } from '@storybook/react'
import { useState }            from 'react'
import { expect, userEvent, within } from '@storybook/test'
import { Drawer }              from '@/components/ui/Drawer'
import { Button }              from '@/components/ui/Button'
import { Badge }               from '@/components/ui/Badge'

const meta = {
  title:     'UI / Drawer',
  component: Drawer,
  tags:      ['autodocs'],
  parameters: {
    backgrounds: { default: 'brand-primary' },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Drawer>

export default meta
type Story = StoryObj<typeof meta>

// ── Controlled wrapper ────────────────────────────────────────────────────────

function DrawerDemo({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div className="p-6 min-h-screen bg-brand-primary">
      <Button onClick={() => setOpen(true)}>Open Drawer</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={title}>
        {children}
      </Drawer>
    </div>
  )
}

// ── Stories ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {},
  render: () => (
    <DrawerDemo title="Exercise Detail">
      <p className="text-gray-400 text-sm">Drawer content goes here.</p>
    </DrawerDemo>
  ),
}

/** Mimics the real ExerciseDetail drawer. */
export const ExerciseDetailContent: Story = {
  args: {},
  render: () => (
    <DrawerDemo title="Exercise Detail">
      <div className="space-y-6">
        {/* Header badges */}
        <div className="flex gap-2">
          <Badge variant="danger">Resistance</Badge>
          <Badge variant="warning">Draft</Badge>
        </div>

        {/* Name */}
        <h1 className="font-display text-2xl text-gray-100">
          Romanian Deadlift
        </h1>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Body Part',  value: 'Back' },
            { label: 'Equipment',  value: 'Barbell' },
            { label: 'Difficulty', value: 'Intermediate' },
            { label: 'Added',      value: 'Jan 15, 2025' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-brand-primary rounded-lg px-3 py-2.5">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">
                {label}
              </div>
              <div className="text-sm text-gray-200 capitalize">{value}</div>
            </div>
          ))}
        </div>

        {/* Description */}
        <section>
          <h3 className="field-label mb-2">Description</h3>
          <p className="text-sm text-gray-300 leading-relaxed">
            A hip-hinge movement targeting the posterior chain. Keeps the bar
            close to the body through the full range of motion.
          </p>
        </section>

        {/* Actions */}
        <div className="pt-4 border-t border-surface-border flex gap-2">
          <Button variant="secondary" className="flex-1">Edit</Button>
          <Button variant="danger" className="flex-1">Delete</Button>
        </div>
      </div>
    </DrawerDemo>
  ),
}

export const InteractionTest: Story = {
  args: {},
  render: () => (
    <DrawerDemo title="Test Drawer">
      <p data-testid="drawer-content" className="text-gray-400 text-sm">
        Drawer is open.
      </p>
    </DrawerDemo>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: /open drawer/i }))

    const dialog = canvas.getByRole('dialog')
    expect(dialog).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: /close panel/i }))
    expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
  },
}
