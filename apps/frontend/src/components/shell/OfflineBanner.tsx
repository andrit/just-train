// ------------------------------------------------------------
// components/shell/OfflineBanner.tsx (v2.4.0)
//
// Shown at the top of the app when offline or syncing.
//
// STATES:
//   offline + no pending  — "You're offline — session data is saved locally"
//   offline + pending     — "You're offline — X writes queued"
//   syncing               — "Syncing X writes…"
//   error (pending > 0)   — "X writes failed to sync — tap to retry"
//   online + idle         — hidden
// ------------------------------------------------------------

import { cn }              from '@/lib/cn'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSyncStatus }   from '@/hooks/useSyncStatus'

export function OfflineBanner(): React.JSX.Element | null {
  const isOnline          = useOnlineStatus()
  const { pending, status, flush } = useSyncStatus()

  // Nothing to show
  if (isOnline && status === 'idle' && pending === 0) return null

  const isSyncing = status === 'syncing'
  const hasError  = status === 'error' && pending > 0
  const isOffline = !isOnline

  let message: string
  let bgClass: string
  let clickable = false

  if (isSyncing) {
    message  = `Syncing ${pending} write${pending !== 1 ? 's' : ''}…`
    bgClass  = 'bg-brand-highlight/10 border-brand-highlight/30 text-brand-highlight'
  } else if (hasError) {
    message  = `${pending} write${pending !== 1 ? 's' : ''} failed to sync — tap to retry`
    bgClass  = 'bg-red-500/10 border-red-500/30 text-red-400'
    clickable = true
  } else if (isOffline && pending > 0) {
    message  = `Offline — ${pending} write${pending !== 1 ? 's' : ''} queued`
    bgClass  = 'bg-amber-500/10 border-amber-500/30 text-amber-400'
  } else {
    message  = 'You\'re offline — session data is saved locally'
    bgClass  = 'bg-amber-500/10 border-amber-500/30 text-amber-400'
  }

  return (
    <div
      role={clickable ? 'button' : 'status'}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? flush : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter') flush() } : undefined}
      className={cn(
        'w-full px-4 py-2 text-center text-xs font-medium border-b',
        'transition-all duration-300',
        bgClass,
        clickable && 'cursor-pointer hover:opacity-80',
      )}
      aria-live="polite"
    >
      <span className="flex items-center justify-center gap-2">
        {isSyncing && (
          <svg className="w-3 h-3 animate-spin" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="20" strokeDashoffset="8" strokeLinecap="round" />
          </svg>
        )}
        {isOffline && !isSyncing && (
          <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3">
            <path d="M2 2l12 12M9.5 4.5A6 6 0 0114 8m-2.5 2.5A3 3 0 018 7M6 11l2 2 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {message}
      </span>
    </div>
  )
}
