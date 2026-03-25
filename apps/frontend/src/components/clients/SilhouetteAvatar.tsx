// ------------------------------------------------------------
// components/clients/SilhouetteAvatar.tsx
//
// Displays a client's photo or a silhouette placeholder.
// Used in client cards and the profile header.
// ------------------------------------------------------------

import { cn } from '@/lib/cn'
// import { getInitials } from './utils' // removed — unused

interface SilhouetteAvatarProps {
  name:      string
  photoUrl?: string | null
  size?:     'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_CLASSES = {
  sm:  'w-9 h-9',
  md:  'w-12 h-12',
  lg:  'w-16 h-16',
  xl:  'w-24 h-24',
}

const ICON_SIZE_CLASSES = {
  sm:  'w-5 h-5',
  md:  'w-7 h-7',
  lg:  'w-9 h-9',
  xl:  'w-14 h-14',
}

const TEXT_SIZE_CLASSES = {
  sm:  'text-xs',
  md:  'text-sm',
  lg:  'text-base',
  xl:  'text-2xl',
}

export function SilhouetteAvatar({
  name, photoUrl, size = 'md', className,
}: SilhouetteAvatarProps): React.JSX.Element {
  const sizeClass     = SIZE_CLASSES[size]
  const iconSizeClass = ICON_SIZE_CLASSES[size]
  const _textSizeClass = TEXT_SIZE_CLASSES[size]

  if (photoUrl) {
    return (
      <div className={cn('rounded-full overflow-hidden shrink-0 bg-brand-accent', sizeClass, className)}>
        <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-full overflow-hidden shrink-0 bg-brand-accent border border-surface-border',
        'flex items-end justify-center',
        sizeClass,
        className,
      )}
      aria-label={`${name} avatar`}
    >
      <SilhouetteSVG className={cn(iconSizeClass, 'text-gray-500 mb-0.5')} />
    </div>
  )
}

// ── Silhouette SVG ─────────────────────────────────────────────────────────

function SilhouetteSVG({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 28"
      fill="currentColor"
      aria-hidden
    >
      {/* Head */}
      <circle cx="12" cy="7" r="5" />
      {/* Shoulders / body silhouette */}
      <path d="M2 28 C2 20 5 16 12 16 C19 16 22 20 22 28 Z" />
    </svg>
  )
}
