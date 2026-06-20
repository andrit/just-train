// InstallPromptBanner — one-time PWA install nudge (UF-S-03 / P3)
//
// Fires after the user's first completed session. Non-blocking: slides up from
// the bottom, dismissible, never shown again once dismissed or accepted.
//
// Chrome/Android: triggers the native beforeinstallprompt dialog.
// iOS Safari: shows share-sheet instructions (no programmatic prompt on iOS).

import { cn } from '@/lib/cn'

interface InstallPromptBannerProps {
  isIOS:     boolean
  onInstall: () => Promise<void>
  onDismiss: () => void
}

export function InstallPromptBanner({
  isIOS, onInstall, onDismiss,
}: InstallPromptBannerProps): React.JSX.Element {
  return (
    <div
      role="dialog"
      aria-label="Install TrainerApp to your home screen"
      className={cn(
        'fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80',
        'z-[55] bg-brand-accent border border-command-blue/30 rounded-2xl shadow-xl p-4',
        'animate-slide-up',
      )}
    >
      <div className="flex items-start gap-3">

        {/* Icon */}
        <div
          aria-hidden
          className="shrink-0 w-10 h-10 rounded-xl bg-command-blue/15 border border-command-blue/20 flex items-center justify-center"
        >
          <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5 text-command-blue">
            <path d="M10 3v10M6 9l4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 15h14"              stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-snug">
            Train anywhere, even without signal
          </p>
          {isIOS ? (
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              Tap the{' '}
              <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5 inline-block text-command-blue mx-0.5" aria-label="Share" role="img">
                <path d="M10 3v10M6 7l4-4 4 4M4 15h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>{' '}
              Share button then{' '}
              <strong className="text-white font-medium">Add to Home Screen</strong>
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-1">
              Install for instant access — no App Store needed
            </p>
          )}
        </div>

        {/* Dismiss */}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue"
        >
          ×
        </button>
      </div>

      {!isIOS && (
        <button
          type="button"
          onClick={() => void onInstall()}
          className={cn(
            'mt-3 w-full rounded-lg bg-command-blue text-white text-sm font-semibold py-2',
            'hover:bg-command-blue/90 active:scale-[0.98] transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue focus-visible:ring-offset-2 focus-visible:ring-offset-brand-accent',
          )}
        >
          Add to Home Screen
        </button>
      )}
    </div>
  )
}
