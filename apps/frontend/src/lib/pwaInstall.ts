// Captures the browser's beforeinstallprompt event so it can be triggered
// at the right moment (after first SessionCompleted — Phase 3).
// Must be called before React mounts so the event is never missed.

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let _deferred: BeforeInstallPromptEvent | null = null

export function capturePWAInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    _deferred = e as BeforeInstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    _deferred = null
  })
}

export function hasPWAInstallPrompt(): boolean {
  return _deferred !== null
}

export async function showPWAInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!_deferred) return 'unavailable'
  await _deferred.prompt()
  const { outcome } = await _deferred.userChoice
  _deferred = null
  return outcome
}
