import { useState, useEffect } from 'react'
import { hasPWAInstallPrompt, showPWAInstallPrompt } from '@/lib/pwaInstall'

export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(hasPWAInstallPrompt)

  useEffect(() => {
    const onPrompt = () => setCanInstall(true)
    const onInstalled = () => setCanInstall(false)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  return { canInstall, showInstallPrompt: showPWAInstallPrompt }
}
