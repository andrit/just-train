// ------------------------------------------------------------
// components/session/FormCheckBadge.tsx (v2.12.0)
//
// Small indicator showing the number of form check clips/photos
// attached to a session exercise. Shown next to the exercise
// name in the live session and history views.
// ------------------------------------------------------------

import { cn } from '@/lib/cn'

interface FormCheckBadgeProps {
  count: number
  className?: string
}

export function FormCheckBadge({ count, className }: FormCheckBadgeProps): React.JSX.Element | null {
  if (count === 0) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full',
        'text-[10px] font-medium bg-brand-accent/50 border border-surface-border text-gray-400',
        className,
      )}
      title={`${count} form check ${count === 1 ? 'clip' : 'clips'}`}
    >
      <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5" aria-hidden>
        <rect x="1" y="3" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1" />
        <circle cx="6" cy="6.5" r="2" stroke="currentColor" strokeWidth="1" />
        <path d="M4 3V2.5A.5.5 0 014.5 2h3a.5.5 0 01.5.5V3" stroke="currentColor" strokeWidth="1" />
      </svg>
      {count}
    </span>
  )
}
