import { cn } from '@/lib/cn'

export interface ErrorStateProps {
  title?:     string
  message?:   string
  onRetry?:   () => void
  className?: string
}

export function ErrorState({
  title   = 'Something went wrong',
  message = 'Check your connection and try again.',
  onRetry,
  className,
}: ErrorStateProps): React.JSX.Element {
  return (
    <section
      aria-label={title}
      className={cn(
        'flex flex-col items-center justify-center',
        'py-16 px-6 text-center',
        className,
      )}
    >
      <span className="block text-5xl mb-4 opacity-30 select-none" aria-hidden>⚠</span>

      <h3 className="font-display text-lg text-gray-300 mb-2">{title}</h3>

      <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-6">{message}</p>

      {onRetry != null && (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm text-command-blue hover:text-command-blue/80 transition-colors"
        >
          Try again
        </button>
      )}
    </section>
  )
}
