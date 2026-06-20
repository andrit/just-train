import { useState, useEffect, useCallback } from 'react'
import {
  canShowNativePrompt,
  isStandaloneInstalled,
  isIOSInstallable,
  isPromptSeen,
  markPromptSeen,
  triggerNativePrompt,
} from '@/lib/installPrompt'

export interface InstallPromptState {
  showPassiveIcon: boolean           // show icon in nav (installable + not yet installed)
  isIOS:           boolean           // iOS share-sheet path
  bannerOpen:      boolean           // instruction / contextual-nudge banner is visible
  promptInstall:   () => Promise<void>  // passive icon tap: native prompt or open banner (iOS)
  closeBanner:     () => void           // banner dismiss — marks prompt as seen
}

export function useInstallPrompt(): InstallPromptState {
  const [canInstall, setCanInstall] = useState(canShowNativePrompt)
  const [installed,  setInstalled]  = useState(isStandaloneInstalled)
  const [bannerOpen, setBannerOpen] = useState(false)

  useEffect(() => {
    const onInstallable  = (): void => setCanInstall(true)
    const onInstalled    = (): void => { setInstalled(true); setCanInstall(false) }
    const onFirstSession = (): void => {
      if (!isPromptSeen() && !isStandaloneInstalled()) {
        setBannerOpen(true)
      }
    }
    const onShowBanner   = (): void => setBannerOpen(true)

    window.addEventListener('pwa:installable',   onInstallable)
    window.addEventListener('pwa:installed',     onInstalled)
    window.addEventListener('pwa:first-session', onFirstSession)
    window.addEventListener('pwa:show-banner',   onShowBanner)

    return () => {
      window.removeEventListener('pwa:installable',   onInstallable)
      window.removeEventListener('pwa:installed',     onInstalled)
      window.removeEventListener('pwa:first-session', onFirstSession)
      window.removeEventListener('pwa:show-banner',   onShowBanner)
    }
  }, [])

  // Passive icon tap:
  // - Chrome/Edge: show native browser dialog, then close banner
  // - iOS / no native prompt: open the instruction card
  const promptInstall = useCallback(async (): Promise<void> => {
    if (canShowNativePrompt()) {
      await triggerNativePrompt()
      markPromptSeen()
      setBannerOpen(false)
    } else {
      setBannerOpen(true)
    }
  }, [])

  const closeBanner = useCallback((): void => {
    markPromptSeen()
    setBannerOpen(false)
  }, [])

  const isIOS = isIOSInstallable()

  return {
    showPassiveIcon: (canInstall || isIOS) && !installed,
    isIOS,
    bannerOpen,
    promptInstall,
    closeBanner,
  }
}
