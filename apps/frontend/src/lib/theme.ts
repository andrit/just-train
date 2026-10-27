// ------------------------------------------------------------
// lib/theme.ts — light/dark theme control.
//
// Three modes: 'system' (follow the OS), 'light', 'dark'. The choice persists in
// localStorage and is applied by stamping (or clearing) data-theme on <html>:
//   'light' / 'dark' → data-theme="light" / "dark"  (an explicit choice wins)
//   'system'         → no attribute → the CSS prefers-color-scheme media query decides
// An inline script in index.html applies the stored choice before first paint (no
// flash); this module keeps it in sync and drives the Preferences toggle.
// ------------------------------------------------------------

import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'system' | 'light' | 'dark'

const KEY = 'theme'

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY)
    if (t === 'light' || t === 'dark' || t === 'system') return t
  } catch { /* storage blocked */ }
  return 'system'
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

export function setTheme(theme: Theme): void {
  try { localStorage.setItem(KEY, theme) } catch { /* storage blocked */ }
  applyTheme(theme)
  // Notify same-tab subscribers (storage events only fire cross-tab).
  window.dispatchEvent(new Event('themechange'))
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('themechange', cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener('themechange', cb)
    window.removeEventListener('storage', cb)
  }
}

/** [theme, setTheme] — re-renders on our own setTheme and on cross-tab changes. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, getTheme, (): Theme => 'system')
  const set = useCallback((t: Theme) => setTheme(t), [])
  return [theme, set]
}
