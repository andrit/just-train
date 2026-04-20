// ------------------------------------------------------------
// components/progress-photos/SnapshotPhotoCapture.tsx (v2.12.0)
//
// Photo capture section for the snapshot form. Renders a camera
// button per pose (front, side L, side R, back). Tapping opens
// the device camera. Uploaded photos show as thumbnails with
// retake/delete actions. When photoSharingPreference is
// 'share_selected', each thumbnail gets a shareable toggle.
//
// USAGE:
//   <SnapshotPhotoCapture
//     snapshotId={snapshot.id}
//     clientId={client.id}
//     optedOut={client.progressPhotosOptedOut}
//   />
// ------------------------------------------------------------

import { useRef, useState }    from 'react'
import { cn }                  from '@/lib/cn'
import { interactions }        from '@/lib/interactions'
import { usePreferences }      from '@/hooks/usePreferences'
import { Spinner }             from '@/components/ui/Spinner'
import {
  useUploadSnapshotMedia,
  useDeleteSnapshotMedia,
  useUpdateSnapshotMedia,
} from '@/lib/queries/snapshot-media'
import type { SnapshotMediaResponse } from '@trainer-app/shared'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SnapshotPhotoCaptureProps {
  snapshotId: string
  clientId:   string
  optedOut:   boolean
  /** Existing photos for this snapshot — passed from parent to avoid redundant fetch */
  photos?:    SnapshotMediaResponse[]
  /** athlete mode uses front camera by default */
  isSelfTracking?: boolean
}

const POSES = [
  { id: 'front',      label: 'Front',   icon: '🧍' },
  { id: 'side_left',  label: 'Side L',  icon: '🧍' },
  { id: 'side_right', label: 'Side R',  icon: '🧍' },
  { id: 'back',       label: 'Back',    icon: '🧍' },
] as const

type PoseId = typeof POSES[number]['id']

// ── Component ─────────────────────────────────────────────────────────────────

export function SnapshotPhotoCapture({
  snapshotId,
  clientId,
  optedOut,
  photos = [],
  isSelfTracking = false,
}: SnapshotPhotoCaptureProps): React.JSX.Element | null {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activePose, setActivePose]     = useState<PoseId | null>(null)
  const [uploadError, setUploadError]   = useState<string | null>(null)

  const { photoSharingPreference } = usePreferences()
  const uploadMutation = useUploadSnapshotMedia()
  const deleteMutation = useDeleteSnapshotMedia()
  const updateMutation = useUpdateSnapshotMedia()

  // Group photos by pose for display
  const photoByPose = new Map<string, SnapshotMediaResponse>()
  for (const p of photos) {
    photoByPose.set(p.pose, p)
  }

  if (optedOut) {
    return (
      <div className="card p-4 text-center">
        <p className="text-sm text-gray-500">Photos disabled at client&apos;s request</p>
        <p className="text-xs text-gray-600 mt-1">Toggle in client settings to enable</p>
      </div>
    )
  }

  const handleCapture = (pose: PoseId): void => {
    setActivePose(pose)
    setUploadError(null)
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file || !activePose) return

    // Validate client-side before upload
    if (!file.type.startsWith('image/')) {
      setUploadError('Progress photos must be images.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image too large (max 10 MB).')
      return
    }

    uploadMutation.mutate(
      { snapshotId, clientId, file, pose: activePose },
      {
        onError: (err) => setUploadError(err.message),
        onSettled: () => {
          setActivePose(null)
          if (fileInputRef.current) fileInputRef.current.value = ''
        },
      },
    )
  }

  const handleDelete = (photo: SnapshotMediaResponse): void => {
    deleteMutation.mutate({ mediaId: photo.id, clientId })
  }

  const handleShareToggle = (photo: SnapshotMediaResponse): void => {
    updateMutation.mutate({
      mediaId:  photo.id,
      clientId,
      body:     { shareable: !photo.shareable },
    })
  }

  const showShareToggle = photoSharingPreference === 'share_selected'

  return (
    <section className="space-y-3">
      <h4 className="section-label">Progress Photos</h4>

      {uploadError && (
        <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
          {uploadError}
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {POSES.map((pose) => {
          const existing = photoByPose.get(pose.id)
          const isUploading = uploadMutation.isPending && activePose === pose.id

          if (existing) {
            // Show thumbnail with actions
            return (
              <div key={pose.id} className="relative group">
                <div className="aspect-[3/4] rounded-lg overflow-hidden border border-surface-border bg-brand-primary">
                  <img
                    src={existing.cloudinaryUrl}
                    alt={`${pose.label} progress photo`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Pose label */}
                <p className="text-[10px] text-gray-500 text-center mt-1 uppercase tracking-wider">
                  {pose.label}
                </p>

                {/* Share badge */}
                {showShareToggle && (
                  <button
                    type="button"
                    onClick={() => handleShareToggle(existing)}
                    disabled={updateMutation.isPending}
                    aria-label={existing.shareable ? 'Remove from shareable' : 'Mark as shareable'}
                    className={cn(
                      'absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px]',
                      'transition-all duration-150',
                      existing.shareable
                        ? 'bg-emerald-500 text-white'
                        : 'bg-black/50 text-gray-400 hover:text-white',
                    )}
                  >
                    {existing.shareable ? '👁' : '👁‍🗨'}
                  </button>
                )}

                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleCapture(pose.id)}
                    aria-label="Retake photo"
                    className="text-xs bg-white/20 hover:bg-white/30 text-white rounded px-2 py-1 transition-colors"
                  >
                    ↻
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(existing)}
                    disabled={deleteMutation.isPending}
                    aria-label="Delete photo"
                    className="text-xs bg-red-600/60 hover:bg-red-600 text-white rounded px-2 py-1 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          }

          // Empty pose — camera button
          return (
            <div key={pose.id}>
              <button
                type="button"
                onClick={() => handleCapture(pose.id)}
                disabled={isUploading}
                aria-label={`Capture ${pose.label} photo`}
                className={cn(
                  'aspect-[3/4] w-full rounded-lg border-2 border-dashed border-surface-border',
                  'flex flex-col items-center justify-center gap-1',
                  'hover:border-brand-highlight/30 hover:bg-surface',
                  'transition-colors duration-150',
                  interactions.button.base,
                )}
              >
                {isUploading ? (
                  <Spinner size="sm" className="text-brand-highlight" />
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-gray-600" aria-hidden>
                      <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M8 6V5a1 1 0 011-1h6a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    <span className="text-[10px] text-gray-600 uppercase tracking-wider">{pose.label}</span>
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {photoSharingPreference === 'share_all' && photos.length > 0 && (
        <p className="text-xs text-gray-600">All photos are shareable (change in Preferences → Privacy)</p>
      )}

      {/* Hidden file input — uses device camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture={isSelfTracking ? 'user' : 'environment'}
        className="sr-only"
        aria-hidden
        onChange={handleFileChange}
      />
    </section>
  )
}
