// ------------------------------------------------------------
// components/exercises/MediaUploader.tsx
//
// Media gallery for an exercise detail drawer.
// Upload, set primary thumbnail, and delete media items.
// ------------------------------------------------------------

import { useRef, useState }                                  from 'react'
import { cn }                                               from '@/lib/cn'
import { useUploadMedia, useDeleteMedia, useSetPrimaryMedia } from '@/lib/queries/exercises'
import { ConfirmDialog }  from '@/components/ui/ConfirmDialog'
import { Spinner }        from '@/components/ui/Spinner'
import { getThumbnailUrl } from './utils'
import type { ExerciseMediaResponse } from '@trainer-app/shared'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MediaUploaderProps {
  exerciseId: string
  media:      ExerciseMediaResponse[]
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MediaUploader({
  exerciseId,
  media,
}: MediaUploaderProps): React.JSX.Element {
  const fileInputRef               = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging]         = useState(false)
  const [deleteTarget, setDeleteTarget]     = useState<ExerciseMediaResponse | null>(null)
  const [uploadError, setUploadError]       = useState<string | null>(null)

  const uploadMutation     = useUploadMedia()
  const deleteMutation     = useDeleteMedia()
  const setPrimaryMutation = useSetPrimaryMedia()

  // ── Upload ────────────────────────────────────────────────────────────────

  const handleFiles = (files: FileList | null): void => {
    const file = files?.[0]
    if (file == null) return

    setUploadError(null)
    uploadMutation.mutate(
      { exerciseId, file, isPrimary: media.length === 0 },
      { onError: (err) => setUploadError(err.message) },
    )
    if (fileInputRef.current != null) fileInputRef.current.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setIsDragging(true)
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteConfirm = (): void => {
    if (deleteTarget == null) return
    deleteMutation.mutate(
      { exerciseId, mediaId: deleteTarget.id },
      { onSettled: () => setDeleteTarget(null) },
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <h4 className="field-label">Media</h4>

      {uploadError != null && (
        <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-sm text-red-400">
          {uploadError}
        </div>
      )}

      {/* Media grid */}
      {media.length > 0 && (
        <div className="grid grid-cols-3 gap-2" role="list" aria-label="Exercise media">
          {media.map((item) => (
            <div
              key={item.id}
              role="listitem"
              className="relative group aspect-square rounded-lg overflow-hidden border border-surface-border bg-brand-primary"
            >
              {item.mediaType === 'image' ? (
                <img
                  src={getThumbnailUrl(item.cloudinaryUrl)}
                  alt="Exercise media"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-brand-accent" aria-hidden>
                  <span className="text-3xl">▶️</span>
                </div>
              )}

              {item.isPrimary && (
                <div
                  className="absolute top-1 left-1 bg-amber-500 rounded-full w-5 h-5 flex items-center justify-center"
                  title="Primary thumbnail"
                  aria-label="Primary thumbnail"
                >
                  <span className="text-xs" aria-hidden>★</span>
                </div>
              )}

              {/* Hover actions */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!item.isPrimary && (
                  <button
                    type="button"
                    onClick={() => setPrimaryMutation.mutate({ exerciseId, mediaId: item.id })}
                    disabled={setPrimaryMutation.isPending}
                    aria-label="Set as primary thumbnail"
                    className="text-xs bg-amber-500/80 hover:bg-amber-500 text-black rounded px-2 py-1 font-medium transition-colors"
                  >
                    {setPrimaryMutation.isPending ? <Spinner size="sm" aria-hidden /> : '★'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDeleteTarget(item)}
                  aria-label="Delete media"
                  className="text-xs bg-red-600/80 hover:bg-red-600 text-white rounded px-2 py-1 font-medium transition-colors"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload media — click or drag a file here"
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
        className={cn(
          'rounded-xl border-2 border-dashed p-6 text-center cursor-pointer',
          'transition-colors duration-150',
          isDragging
            ? 'border-command-blue bg-command-blue/5'
            : 'border-surface-border hover:border-gray-500 hover:bg-surface-raised',
        )}
      >
        {uploadMutation.isPending ? (
          <div className="flex flex-col items-center gap-2">
            <Spinner size="md" className="text-command-blue" />
            <p className="text-sm text-gray-400">Uploading…</p>
          </div>
        ) : (
          <>
            <p className="text-2xl mb-2 opacity-40" aria-hidden>📎</p>
            <p className="text-sm text-gray-400">
              Drop a file or{' '}
              <span className="text-command-blue">click to upload</span>
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Images (JPEG, PNG, WebP — 10 MB) · Videos (MP4, WebM — 100 MB)
            </p>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
        className="sr-only"
        aria-hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        title="Delete media?"
        message="This removes the file from Cloudinary permanently and cannot be undone."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
