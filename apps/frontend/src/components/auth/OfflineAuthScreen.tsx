// Full-screen holding screen shown when the app opens offline and the
// silent refresh cannot be attempted (offline-contract.md — Auth section).
// Retries happen automatically on window.online; manual retry is also offered.

interface OfflineAuthScreenProps {
  onRetry: () => void
}

export function OfflineAuthScreen({ onRetry }: OfflineAuthScreenProps): React.JSX.Element {
  return (
    <div className="min-h-screen bg-brand-primary flex flex-col items-center justify-center px-6 gap-6">

      {/* Logo */}
      <h1 className="font-display text-3xl tracking-wider uppercase">
        <span className="text-white">Trainer</span>
        <span className="text-command-blue">App</span>
      </h1>

      {/* Icon */}
      <div
        aria-hidden
        className="w-16 h-16 rounded-2xl bg-surface-raised border border-surface-border flex items-center justify-center"
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-gray-500">
          <path
            d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.8M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01"
            stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Message */}
      <div className="text-center space-y-2">
        <p className="text-white text-lg font-semibold">You're offline</p>
        <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
          Please reconnect to log in. Your session will resume automatically when you're back online.
        </p>
      </div>

      {/* Manual retry */}
      <button
        type="button"
        onClick={onRetry}
        className="px-6 py-2.5 rounded-xl border border-surface-border text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue"
      >
        Try again
      </button>
    </div>
  )
}
