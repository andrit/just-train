// ------------------------------------------------------------
// components/shell/OfflineFallback.tsx
//
// Full-page blocked state for pages whose entire purpose requires
// a network connection (e.g. starting a new session).
//
// Usage: render this instead of the page content when `!isOnline`.
// Pages that partially work offline (templates list, exercises) should
// use inline disabled states on write actions instead.
// ------------------------------------------------------------

import { cn } from '@/lib/cn'

interface OfflineFallbackProps {
  title?:      string
  message?:    string
  stillWorks?: string[]
  onBack?:     () => void
  backLabel?:  string
  className?:  string
}

export function OfflineFallback({
  title      = "You're offline",
  message    = 'This action requires a connection.',
  stillWorks,
  onBack,
  backLabel  = 'Go back',
  className,
}: OfflineFallbackProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-col items-center justify-center min-h-[60vh] p-6 text-center', className)}>

      {/* WiFi-slash icon */}
      <span className="mb-5 opacity-25" aria-hidden>
        <svg viewBox="0 0 48 48" fill="none" className="w-16 h-16 text-gray-300">
          <path d="M6 6l36 36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M24 38h.02" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M16.5 31.5A10.5 10.5 0 0124 29c2.2 0 4.25.68 5.96 1.83" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M9 24a20.97 20.97 0 0110.5-5.58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M38.5 24A20.97 20.97 0 0024 18c-1.5 0-2.97.15-4.38.44" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 3" />
          <path d="M3 17A30.94 30.94 0 0124 10c7.28 0 13.97 2.52 19.17 6.7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 3" />
        </svg>
      </span>

      <h2 className="font-display text-2xl uppercase tracking-wide text-white mb-2">
        {title}
      </h2>

      <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-6">
        {message}
      </p>

      {stillWorks && stillWorks.length > 0 && (
        <div className="mb-6 text-left w-full max-w-xs">
          <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">
            Still available
          </p>
          <ul className="space-y-1.5">
            {stillWorks.map((item) => (
              <li key={item} className="flex items-center gap-2 text-xs text-gray-400">
                <span className="w-1 h-1 rounded-full bg-signal-yellow shrink-0" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {onBack != null && (
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-command-blue hover:text-command-blue/80 transition-colors"
        >
          {backLabel}
        </button>
      )}
    </div>
  )
}
