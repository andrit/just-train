// ------------------------------------------------------------
// components/ui/ToastContainer.tsx
//
// Renders active toasts at the bottom of the screen.
// Mount once inside Layout — above the bottom nav.
// ------------------------------------------------------------

import { useToastStore } from '@/store/toastStore'
import { cn }            from '@/lib/cn'

export function ToastContainer(): React.JSX.Element {
  const toasts  = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return <></>

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={cn(
            'pointer-events-auto',
            'flex items-center gap-2.5 px-4 py-3 rounded-2xl',
            'text-sm font-medium shadow-lg',
            'animate-slide-up',
            t.variant === 'success' && 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300',
            t.variant === 'error'   && 'bg-red-500/20    border border-red-500/40    text-red-300',
            t.variant === 'info'    && 'bg-brand-highlight/15 border border-brand-highlight/30 text-brand-highlight',
          )}
        >
          {t.variant === 'success' && (
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 shrink-0">
              <path d="M3 8l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {t.variant === 'error' && (
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 shrink-0">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
          {t.variant === 'info' && (
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 shrink-0">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 7v5M8 5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
          {t.message}
        </button>
      ))}
    </div>
  )
}
