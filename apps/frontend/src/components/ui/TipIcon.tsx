// ------------------------------------------------------------
// components/ui/TipIcon.tsx (v1.6.0)
//
// Reusable tip indicator — flexed bicep with a ! badge.
// Used inline next to guidance nudges.
//
// SIZE: sm=16px  md=20px(default)  lg=28px
// ------------------------------------------------------------

import { cn } from '@/lib/cn'

interface TipIconProps {
  size?:      'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-7 h-7' }
const BADGE_MAP = { sm: 'w-2.5 h-2.5 text-[7px]', md: 'w-3 h-3 text-[8px]', lg: 'w-4 h-4 text-[10px]' }

export function TipIcon({ size = 'md', className }: TipIconProps): React.JSX.Element {
  return (
    <span className={cn('relative inline-flex shrink-0', SIZE_MAP[size], className)} aria-hidden>
      <svg viewBox="0 0 20 20" fill="none" className="w-full h-full text-brand-highlight">
        <path d="M3 13c0-3 2-6 5-7l3-1c2-.5 4 .5 4.5 2s-.5 3.5-2.5 4L11 12"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 12c-1 1.5-1 3 .5 4s3 .5 4-1l1-2"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 8.5c.5-1.5 2-2.5 3.5-2"
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span className={cn(
        'absolute -top-0.5 -right-0.5 flex items-center justify-center',
        'rounded-full bg-brand-highlight text-white font-bold leading-none',
        BADGE_MAP[size],
      )}>!</span>
    </span>
  )
}
