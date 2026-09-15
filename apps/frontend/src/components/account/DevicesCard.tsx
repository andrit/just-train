// ------------------------------------------------------------
// components/account/DevicesCard.tsx
//
// Preferences → Account → Devices. Every device with a live session, newest
// activity first; the one you're on is marked. "Sign out" on another device
// revokes just that device. "Sign out everywhere" ends every session
// including this one — so it goes through the shared sign-out sequence and
// lands on /login rather than leaving a half-dead page.
// ------------------------------------------------------------

import { useState }                     from 'react'
import { cn }                           from '@/lib/cn'
import { describeUserAgent }            from '@/lib/userAgent'
import { useDevices, useRevokeDevice }  from '@/lib/queries/account'
import { useSignOut }                   from '@/hooks/useSignOut'
import { Button }                       from '@/components/ui/Button'
import { Spinner }                      from '@/components/ui/Spinner'
import { toast }                        from '@/store/toastStore'

function formatLastActive(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1)   return 'just now'
  if (minutes < 60)  return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)    return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

export function DevicesCard(): React.JSX.Element {
  const { data: devices, isLoading, isError } = useDevices()
  const revoke  = useRevokeDevice()
  const signOut = useSignOut()
  const [confirmAll, setConfirmAll] = useState(false)

  const handleRevoke = async (deviceId: string, current: boolean): Promise<void> => {
    if (current) { await signOut(); return }          // signing out your own device = logout
    try {
      await revoke.mutateAsync(deviceId)
      toast.success('Device signed out')
    } catch {
      toast.error('Could not sign out that device')
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-200 mb-1">Devices</p>
        <p className="text-xs text-gray-500">Where you're signed in. Sign out anything you don't recognise.</p>
      </div>

      {isLoading && <p className="text-xs text-gray-600 flex items-center gap-1"><Spinner size="sm" /> Loading…</p>}
      {isError   && <p className="text-sm text-red-400">Couldn't load devices.</p>}

      {devices && (
        <ul className="divide-y divide-surface-border">
          {devices.map((d) => (
            <li key={d.deviceId} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-gray-200 truncate">
                  {describeUserAgent(d.deviceName)}
                  {d.current && <span className="ml-2 text-[10px] uppercase tracking-wider text-command-blue">this device</span>}
                </p>
                <p className="text-xs text-gray-500">Active {formatLastActive(d.lastActiveAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRevoke(d.deviceId, d.current)}
                disabled={revoke.isPending}
                className={cn('shrink-0 text-xs px-2.5 py-1.5 rounded-lg border border-surface-border text-gray-400',
                  'hover:text-red-400 hover:border-red-500/40 transition-colors')}
              >
                Sign out
              </button>
            </li>
          ))}
        </ul>
      )}

      {confirmAll ? (
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-400 flex-1">Every device, including this one, will need to sign in again.</p>
          <Button variant="secondary" size="sm" onClick={() => setConfirmAll(false)}>Keep</Button>
          <Button variant="danger" size="sm" onClick={() => signOut({ everywhere: true })}>Sign out everywhere</Button>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setConfirmAll(true)}>Sign out everywhere</Button>
      )}
    </div>
  )
}
