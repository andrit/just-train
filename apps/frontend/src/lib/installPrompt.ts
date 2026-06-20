// Captures beforeinstallprompt as early as possible via module-level side effect.
// This module must be imported (directly or transitively) before the event fires.
// Custom DOM events bridge the module state to React hook subscribers.
//
// Reference: UF-S-03, TF-12, P3/P4/P5 in user-flow.md
// Policy: prompt fires once, after first SessionCompleted, non-recurring.

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

export const FIRST_SESSION_KEY  = 'trainer-app-first-session-completed'
const        PROMPT_SEEN_KEY    = 'trainer-app-install-prompt-seen'

let deferred: BeforeInstallPromptEvent | null = null

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    window.dispatchEvent(new CustomEvent('pwa:installable'))
  })

  window.addEventListener('appinstalled', () => {
    deferred = null
    window.dispatchEvent(new CustomEvent('pwa:installed'))
  })
}

export function canShowNativePrompt(): boolean {
  return deferred !== null
}

export function isStandaloneInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return (
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

export function isIOSInstallable(): boolean {
  if (typeof window === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !isStandaloneInstalled()
}

export function isPromptSeen(): boolean {
  return typeof window !== 'undefined' && localStorage.getItem(PROMPT_SEEN_KEY) === 'true'
}

export function markPromptSeen(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PROMPT_SEEN_KEY, 'true')
  window.dispatchEvent(new CustomEvent('pwa:prompt-seen'))
}

export function isFirstSessionCompleted(): boolean {
  return typeof window !== 'undefined' && localStorage.getItem(FIRST_SESSION_KEY) === 'true'
}

// Called from PostSessionWrapUp on the first ever session completion.
export function markFirstSessionCompleted(): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(FIRST_SESSION_KEY)) return
  localStorage.setItem(FIRST_SESSION_KEY, 'true')
  window.dispatchEvent(new CustomEvent('pwa:first-session'))
}

// Triggers the native browser install prompt. Returns true if accepted.
export async function triggerNativePrompt(): Promise<boolean> {
  if (!deferred) return false
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  window.dispatchEvent(new CustomEvent('pwa:installed'))
  return outcome === 'accepted'
}
