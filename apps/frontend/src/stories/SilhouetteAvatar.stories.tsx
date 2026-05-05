import type { Meta, StoryObj } from '@storybook/react'
import { SilhouetteAvatar }    from '@/components/clients/SilhouetteAvatar'

const meta = {
  title:     'Clients / SilhouetteAvatar',
  component: SilhouetteAvatar,
  tags:      ['autodocs'],
  args: {
    name:     'Jordan Smith',
    photoUrl: null,
    size:     'md',
  },
  argTypes: {
    size: {
      control:     'select',
      options:     ['sm', 'md', 'lg', 'xl'],
      description: 'Controls width, height, and icon scale',
    },
    photoUrl: {
      control:     'text',
      description: 'When set, renders the image. When null, renders the silhouette.',
    },
  },
} satisfies Meta<typeof SilhouetteAvatar>

export default meta
type Story = StoryObj<typeof meta>

// ── Placeholder (no photo) ────────────────────────────────────────────────────

export const Default: Story = {}

export const Small: Story  = { args: { size: 'sm' } }
export const Medium: Story = { args: { size: 'md' } }
export const Large: Story  = { args: { size: 'lg' } }
export const XLarge: Story = { args: { size: 'xl' } }

// ── With photo ────────────────────────────────────────────────────────────────

export const WithPhoto: Story = {
  args: {
    photoUrl: 'https://i.pravatar.cc/150?img=11',
  },
}

export const WithPhotoLarge: Story = {
  args: {
    size:     'lg',
    photoUrl: 'https://i.pravatar.cc/150?img=12',
  },
}

// ── All sizes side by side ────────────────────────────────────────────────────

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-end gap-4 p-4">
      <SilhouetteAvatar name="A" size="sm" />
      <SilhouetteAvatar name="A" size="md" />
      <SilhouetteAvatar name="A" size="lg" />
      <SilhouetteAvatar name="A" size="xl" />
    </div>
  ),
}

// ── Self-client badge overlay (as used in dashboard) ─────────────────────────

export const WithMeBadge: Story = {
  render: () => (
    <div className="p-4 flex gap-6 items-end">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <div key={size} className="relative">
          <SilhouetteAvatar name="Me" size={size} />
          <span className="absolute -bottom-1 -right-1 bg-command-blue text-white text-[9px] font-bold px-1 py-0.5 rounded uppercase leading-none">
            Me
          </span>
        </div>
      ))}
    </div>
  ),
}
