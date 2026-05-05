// ------------------------------------------------------------
// components/reports/ReportPreviewModal.tsx (v1.7.0)
//
// Report preview and send modal.
//
// RENDERING APPROACH:
//   - Report HTML is fetched once on modal open (no re-fetches)
//   - Rendered directly via dangerouslySetInnerHTML — no iframe,
//     no separate browsing context, no TanStack Query complexity
//   - Report HTML uses inline styles only so it renders safely
//     inside the app without style bleed
//   - Trainer note is shown live below the preview as a separate
//     React section — updates instantly without touching the query
//
// TRAINER NOTE:
//   - Passed to the POST /report endpoint at send time only
//   - Pulsing amber border until first focus
// ------------------------------------------------------------

import { useState, useEffect, useCallback, useMemo } from 'react'
import DOMPurify                from 'dompurify'
import { cn }                from '@/lib/cn'
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

export function ReportPreviewModal({
  open, clientId, clientName, onClose, onSent,
}: ReportPreviewModalProps): React.JSX.Element {
  const [note,        setNote]       = useState('')
  const [noteFocused, setNoteFocused] = useState(false)
  const [sendError,   setSendError]  = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState(false)

  // Single fetch on open — no re-fetches, no debounce needed
  const { data: preview, isLoading } = useReportPreview(open ? clientId : null)

  // Sanitize once when HTML arrives — never render unsanitized content
  const safeHtml = useMemo(
    () => preview?.html ? DOMPurify.sanitize(preview.html, { USE_PROFILES: { html: true } }) : null,
    [preview?.html],
  )

  const sendReport = useSendReport()

  // Reset on open
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
    <Modal open={open} onClose={onClose} title={`Report — ${clientName}`} size="lg">
      <div className="flex flex-col gap-4">

        {/* Period + destination */}
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

        {/* Trainer note — live, no refetch */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            Add a personal note{' '}
            <span className="text-gray-600">(optional — appears in the report)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onFocus={() => setNoteFocused(true)}
            placeholder="e.g. Great work this month — that consistency in week 3 really showed. What felt hardest for you?"
            rows={3}
            className={cn(
              'w-full field resize-none text-sm transition-colors duration-300',
              !noteFocused && 'animate-pulse-border-amber',
            )}
          />
        </div>

        {/* Report preview — rendered directly, no iframe */}
        <div
          className="rounded-xl border border-surface-border bg-white overflow-y-auto"
          style={{ maxHeight: 420 }}
        >
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Spinner size="md" className="text-command-blue" />
            </div>
          )}

          {safeHtml && (
            /* Report uses inline styles only — safe after DOMPurify sanitization */
            <div
              dangerouslySetInnerHTML={{ __html: safeHtml }}
              className="report-preview-content"
            />
          )}

          {/* Live trainer note preview — appended below report content */}
          {note.trim() && safeHtml && (
            <div style={{
              background: '#fffbeb',
              borderTop: '1px solid #f3f4f6',
              borderLeft: '4px solid #f59e0b',
              padding: '20px 28px',
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#d97706' }}>
                A Note From Your Trainer
              </p>
              <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {note}
              </p>
            </div>
          )}
        </div>

        {/* Warnings */}
        {preview && !preview.clientEmail && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
            This client has no email address on record. Add one to their profile before sending.
          </div>
        )}
        {preview && preview.sessionCount === 0 && (
          <div className="rounded-lg bg-surface border border-surface-border px-4 py-3 text-sm text-gray-400">
            No sessions found in {preview.periodLabel}. The report cannot be sent.
          </div>
        )}
        {sendError && (
          <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {sendError}
          </div>
        )}
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
            {sendSuccess ? 'Sent!' : 'Send Report'}
          </Button>
        </div>

      </div>
    </Modal>
  )
}
