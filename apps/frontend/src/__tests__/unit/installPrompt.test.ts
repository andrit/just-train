import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  isFirstSessionCompleted,
  markFirstSessionCompleted,
  isPromptSeen,
  markPromptSeen,
  canShowNativePrompt,
  isIOSInstallable,
  isStandaloneInstalled,
  triggerNativePrompt,
} from '@/lib/installPrompt'

// After each test: reset the deferred capture by simulating 'appinstalled',
// and restore any UA overrides. localStorage is cleared in setup.ts.
afterEach(() => {
  window.dispatchEvent(new Event('appinstalled'))
  vi.unstubAllGlobals()
})

// Helper: fire a beforeinstallprompt event with a mock prompt() method.
function fireInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted'): void {
  const evt = new Event('beforeinstallprompt')
  Object.assign(evt, {
    preventDefault: vi.fn(),
    platforms:      ['web'],
    userChoice:     Promise.resolve({ outcome, platform: 'web' }),
    prompt:         vi.fn().mockResolvedValue(undefined),
  })
  window.dispatchEvent(evt)
}

// ── isFirstSessionCompleted / markFirstSessionCompleted ───────────────────────

describe('isFirstSessionCompleted', () => {
  it('returns false when no session has been completed', () => {
    expect(isFirstSessionCompleted()).toBe(false)
  })

  it('returns true after markFirstSessionCompleted is called', () => {
    markFirstSessionCompleted()
    expect(isFirstSessionCompleted()).toBe(true)
  })
})

describe('markFirstSessionCompleted', () => {
  it('dispatches pwa:first-session on the first call', () => {
    const spy = vi.fn()
    window.addEventListener('pwa:first-session', spy)
    markFirstSessionCompleted()
    expect(spy).toHaveBeenCalledTimes(1)
    window.removeEventListener('pwa:first-session', spy)
  })

  it('does not dispatch pwa:first-session on subsequent calls', () => {
    markFirstSessionCompleted()
    const spy = vi.fn()
    window.addEventListener('pwa:first-session', spy)
    markFirstSessionCompleted()
    expect(spy).not.toHaveBeenCalled()
    window.removeEventListener('pwa:first-session', spy)
  })
})

// ── isPromptSeen / markPromptSeen ─────────────────────────────────────────────

describe('isPromptSeen', () => {
  it('returns false initially', () => {
    expect(isPromptSeen()).toBe(false)
  })

  it('returns true after markPromptSeen', () => {
    markPromptSeen()
    expect(isPromptSeen()).toBe(true)
  })
})

describe('markPromptSeen', () => {
  it('dispatches pwa:prompt-seen', () => {
    const spy = vi.fn()
    window.addEventListener('pwa:prompt-seen', spy)
    markPromptSeen()
    expect(spy).toHaveBeenCalledTimes(1)
    window.removeEventListener('pwa:prompt-seen', spy)
  })
})

// ── beforeinstallprompt capture ───────────────────────────────────────────────

describe('canShowNativePrompt', () => {
  it('returns false before any beforeinstallprompt event', () => {
    expect(canShowNativePrompt()).toBe(false)
  })

  it('returns true after beforeinstallprompt fires', () => {
    fireInstallPrompt()
    expect(canShowNativePrompt()).toBe(true)
  })

  it('dispatches pwa:installable when beforeinstallprompt fires', () => {
    const spy = vi.fn()
    window.addEventListener('pwa:installable', spy)
    fireInstallPrompt()
    expect(spy).toHaveBeenCalledTimes(1)
    window.removeEventListener('pwa:installable', spy)
  })

  it('returns false again after appinstalled fires', () => {
    fireInstallPrompt()
    expect(canShowNativePrompt()).toBe(true)
    window.dispatchEvent(new Event('appinstalled'))
    expect(canShowNativePrompt()).toBe(false)
  })
})

// ── triggerNativePrompt ───────────────────────────────────────────────────────

describe('triggerNativePrompt', () => {
  it('returns false when no deferred event is captured', async () => {
    expect(await triggerNativePrompt()).toBe(false)
  })

  it('returns true when the user accepts the prompt', async () => {
    fireInstallPrompt('accepted')
    expect(await triggerNativePrompt()).toBe(true)
  })

  it('returns false when the user dismisses the prompt', async () => {
    fireInstallPrompt('dismissed')
    expect(await triggerNativePrompt()).toBe(false)
  })

  it('clears the deferred reference after triggering', async () => {
    fireInstallPrompt()
    await triggerNativePrompt()
    expect(canShowNativePrompt()).toBe(false)
  })
})

// ── isStandaloneInstalled ─────────────────────────────────────────────────────

describe('isStandaloneInstalled', () => {
  it('returns false in jsdom (no standalone mode)', () => {
    expect(isStandaloneInstalled()).toBe(false)
  })
})

// ── isIOSInstallable ──────────────────────────────────────────────────────────

describe('isIOSInstallable', () => {
  it('returns false for a non-iOS user agent', () => {
    expect(isIOSInstallable()).toBe(false)
  })

  it('returns true for an iPhone user agent when not in standalone mode', () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    })
    expect(isIOSInstallable()).toBe(true)
  })
})
