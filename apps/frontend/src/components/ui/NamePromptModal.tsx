// ------------------------------------------------------------
// components/ui/NamePromptModal.tsx
//
// Small modal that asks for a name before saving an asset.
// Used by "Save as template" and "Save plan" flows.
// ------------------------------------------------------------

import { useState, useEffect, useRef } from 'react'
import { cn }                           from '@/lib/cn'
import { Spinner }                      from '@/components/ui/Spinner'

interface NamePromptModalProps {
  open:         boolean
  title:        string           // e.g. "Name this template"
  placeholder:  string           // e.g. "e.g. Push Day A, Full Body…"
  initialValue?: string          // pre-fill if there's already a partial name
  confirmLabel: string           // e.g. "Save template"
  saving?:      boolean
  onConfirm:    (name: string) => void
  onCancel:     () => void
}

export function NamePromptModal({
  open, title, placeholder, initialValue = '', confirmLabel, saving = false,
  onConfirm, onCancel,
}: NamePromptModalProps): React.JSX.Element {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset and focus when opened
  useEffect(() => {
    if (open) {
      setValue(initialValue)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, initialValue])

  if (!open) return <></>

  const handleConfirm = (): void => {
    const name = value.trim() || 'Untitled'
    onConfirm(name)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleConfirm()
    if (e.key === 'Escape') onCancel()
  }

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm bg-brand-secondary rounded-2xl border border-surface-border shadow-2xl p-5">
        <p className="text-sm font-medium text-gray-200 mb-3">{title}</p>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-brand-primary border border-surface-border rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-highlight/50 mb-4"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-surface-border text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors',
              'bg-brand-highlight text-white',
              saving && 'opacity-60',
            )}
          >
            {saving ? <Spinner size="sm" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
