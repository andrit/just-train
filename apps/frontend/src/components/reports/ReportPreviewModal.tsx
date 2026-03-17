// ------------------------------------------------------------
// components/reports/ReportPreviewModal.tsx (v1.7.0)
//
// Opens when the trainer clicks "Send Report" on a client profile.
// Shows a live HTML preview of the report, a blurb textarea with
// a pulsing amber outline (stops on first focus), and a Send button.
//
// The preview re-fetches any time the trainer note changes (debounced).
// ------------------------------------------------------------

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn }                from '@/lib/cn'
import { interactions }      from '@/lib/interactions'
import { useReportPreview, useSendReport } from '@/lib/queries/clients'
import { Spinner }           from '@/components/ui/Spinner'
import { Button }            from '@/components/ui/Button'
import { Modal }             from '@/components/ui/Modal'

interface ReportPreviewModalProps {
  open:       boolean
  clientId:   string
  clientName: string
  onClose:    () => void
  onSent:     (periodLabel: string) => void
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function ReportPreviewModal({
  open, clientId, clientName, onClose, onSent,
}: ReportPreviewModalProps): React.JSX.Element {
  const [note,         setNote]         = useState('')
  const [noteFocused,  setNoteFocused]  = useState(false)
  const [sendError,    setSendError]    = useState<string | null>(null)
  const [sendSuccess,  setSendSuccess]  = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const debouncedNote = useDebounce(note, 600)

  const { data: preview, isLoading: previewLoading } = useReportPreview(
    open ? clientId : null,
    debouncedNote,
  )

  const sendReport = useSendReport()

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setNote('')
      setNoteFocused(false)
      setSendError(null)
      setSendSuccess(false)
    }
  }, [open])

  const handleSend = useCallback((): void => {
    setSendError(null)
    sendReport.mutate(
      { clientId, trainerNote: note.trim() || undefined },
      {
        onSuccess: (result) => {
          setSendSuccess(true)
          setTimeout(() => {
            onSent(result.periodLabel)
            onClose()
          }, 1500)
        },
        onError: (err) => {
          const msg = err.message
          if (msg.includes('CLIENT_NO_EMAIL')) {
            setSendError('This client has no email address on record. Edit their profile to add one.')
          } else if (msg.includes('NO_SESSIONS_IN_PERIOD')) {
            setSendError('No sessions found in this period. The report cannot be sent.')
          } else {
            setSendError('Failed to send. Please try again.')
          }
        },
      }
    )
  }, [clientId, note, sendReport, onSent, onClose])

  const canSend = (preview?.sessionCount ?? 0) > 0 && !!preview?.clientEmail

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Report — ${clientName}`}
      size="lg"
    >
      <div className="flex flex-col gap-4">

        {/* Period label */}
        {preview && (
          <p className="text-xs text-gray-500">
            Covering: <span className="text-gray-300">{preview.periodLabel}</span>
            {' · '}
            <span className="text-gray-300">{preview.sessionCount} sessions</span>
            {preview.clientEmail && (
              <> · Sending to <span className="text-gray-300">{preview.clientEmail}</span></>
            )}
          </p>
        )}

        {/* Trainer note — pulsing border until focused */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            Add a personal note{' '}
            <span className="text-gray-600">(optional — appears in the report)</span>
          </label>
          <textarea
            ref={textareaRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onFocus={() => setNoteFocused(true)}
            placeholder="e.g. Great work this month — that consistency in week 3 really showed. What felt hardest for you?"
            rows={3}
            className={cn(
              'w-full field resize-none text-sm transition-all duration-300',
              !noteFocused && 'animate-pulse-border-amber',
              noteFocused && 'border-surface-border',
            )}
          />
        </div>

        {/* HTML preview */}
        <div className="relative rounded-xl overflow-hidden border border-surface-border bg-white" style={{ height: 420 }}>
          {previewLoading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
              <Spinner size="md" className="text-brand-highlight" />
            </div>
          )}
          {preview?.html && (
            <iframe
              srcDoc={preview.html}
              title="Report preview"
              className="w-full h-full border-0"
              sandbox="allow-same-origin"
            />
          )}
          {!previewLoading && !preview?.html && (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Preview will appear here
            </div>
          )}
        </div>

        {/* No email warning */}
        {preview && !preview.clientEmail && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
            This client has no email address on record. Add one to their profile before sending.
          </div>
        )}

        {/* No sessions warning */}
        {preview && preview.sessionCount === 0 && (
          <div className="rounded-lg bg-surface border border-surface-border px-4 py-3 text-sm text-gray-400">
            No sessions found in {preview.periodLabel}. The report cannot be sent.
          </div>
        )}

        {/* Send error */}
        {sendError && (
          <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {sendError}
          </div>
        )}

        {/* Success */}
        {sendSuccess && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
            Report sent successfully.
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={!canSend || sendReport.isPending || sendSuccess}
            loading={sendReport.isPending}
            className="flex-1"
          >
            {sendSuccess ? 'Sent!' : `Send Report`}
          </Button>
        </div>

      </div>
    </Modal>
  )
}
