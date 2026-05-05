// ------------------------------------------------------------
// components/progress-photos/ProgressPhotoTimeline.tsx (v2.12.0)
//
// Chronological progress photo grid on the client profile.
// Shows the most recent photo set with a "Compare" button
// that opens the PhotoComparisonSlider.
//
// Data: uses useProgressPhotos(clientId) which returns photos
// grouped by snapshot date.
// ------------------------------------------------------------

import { useState }          from 'react'
import { cn }                from '@/lib/cn'
import { interactions }      from '@/lib/interactions'
import { useProgressPhotos } from '@/lib/queries/snapshot-media'
import { Spinner }           from '@/components/ui/Spinner'
import { PhotoComparisonSlider } from './PhotoComparisonSlider'
import { ProgressPhotoModal }    from './ProgressPhotoModal'
import type { ProgressPhotoGroupResponse, SnapshotMediaResponse } from '@trainer-app/shared'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProgressPhotoTimelineProps {
  clientId: string
  optedOut: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProgressPhotoTimeline({
  clientId,
  optedOut,
}: ProgressPhotoTimelineProps): React.JSX.Element | null {
  const { data: groups, isLoading } = useProgressPhotos(clientId)
  const [comparing, setComparing]   = useState(false)
  const [viewPhoto, setViewPhoto]   = useState<SnapshotMediaResponse | null>(null)

  // Don't render anything if opted out
  if (optedOut) return null

  if (isLoading) {
    return (
      <section>
        <h3 className="section-label">Progress Photos</h3>
        <div className="flex justify-center py-6">
          <Spinner size="sm" className="text-gray-500" />
        </div>
      </section>
    )
  }

  // No photos yet
  if (!groups || groups.length === 0) return null

  const latest = groups[0] as ProgressPhotoGroupResponse
  const hasMultipleSnapshots = groups.length >= 2

  return (
    <>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="section-label mb-0">Progress Photos</h3>
          {hasMultipleSnapshots && (
            <button
              type="button"
              onClick={() => setComparing(true)}
              className={cn(
                'text-xs text-command-blue hover:text-command-blue/80',
                interactions.button.base,
              )}
            >
              Compare
            </button>
          )}
        </div>

        {/* Latest snapshot photos */}
        <div className="space-y-1">
          <p className="text-xs text-gray-600">
            {new Date(latest.capturedAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {latest.photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setViewPhoto(photo)}
                className={cn(
                  'aspect-[3/4] rounded-lg overflow-hidden border border-surface-border',
                  'hover:border-command-blue/30 transition-colors',
                  interactions.button.base,
                )}
              >
                <img
                  src={photo.cloudinaryUrl}
                  alt={`${photo.pose.replace('_', ' ')} progress photo`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Older snapshot thumbnails */}
        {groups.length > 1 && (
          <details className="group">
            <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400 list-none flex items-center gap-1 py-1">
              <svg className="w-3 h-3 transition-transform group-open:rotate-90" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {groups.length - 1} earlier {groups.length === 2 ? 'snapshot' : 'snapshots'}
            </summary>
            <div className="mt-2 space-y-3 pl-2 border-l border-surface-border">
              {groups.slice(1).map((group) => (
                <div key={group.snapshotId}>
                  <p className="text-xs text-gray-600 mb-1">
                    {new Date(group.capturedAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                  <div className="grid grid-cols-4 gap-1">
                    {group.photos.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setViewPhoto(photo)}
                        className="aspect-[3/4] rounded overflow-hidden border border-surface-border/50"
                      >
                        <img
                          src={photo.cloudinaryUrl}
                          alt={`${photo.pose.replace('_', ' ')} progress photo`}
                          className="w-full h-full object-cover opacity-80"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      {/* Comparison slider */}
      {comparing && hasMultipleSnapshots && (
        <PhotoComparisonSlider
          groups={groups}
          onClose={() => setComparing(false)}
        />
      )}

      {/* Full-screen photo viewer */}
      {viewPhoto && (
        <ProgressPhotoModal
          photo={viewPhoto}
          allPhotos={groups.flatMap((g) => g.photos)}
          onClose={() => setViewPhoto(null)}
        />
      )}
    </>
  )
}
