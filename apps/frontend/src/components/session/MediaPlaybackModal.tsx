// ------------------------------------------------------------
// components/session/MediaPlaybackModal.tsx (v2.12.0)
//
// Full-screen viewer for form check clips and photos.
// Video plays via native <video> element (Cloudinary transcodes).
// Left/right arrows to navigate between media items.
// ------------------------------------------------------------

import { useState, useEffect, useCallback } from 'react'
import { cn }           from '@/lib/cn'
import { interactions } from '@/lib/interactions'
import type { SessionExerciseMediaResponse } from '@trainer-app/shared'

interface MediaPlaybackModalProps {
  media:    SessionExerciseMediaResponse[]
  startIdx: number
  onClose:  () => void
}

export function MediaPlaybackModal({
  media,
  startIdx,
  onClose,
}: MediaPlaybackModalProps): React.JSX.Element {
  const [index, setIndex] = useState(startIdx)

  const current = media[index]
  const hasPrev = index > 0
  const hasNext = index < media.length - 1

  const goPrev = useCallback(() => { if (hasPrev) setIndex((i) => i - 1) }, [hasPrev])
  const goNext = useCallback(() => { if (hasNext) setIndex((i) => i + 1) }, [hasNext])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape')     onClose()
      if (e.key === 'ArrowLeft')  goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, goPrev, goNext])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!current) return <></>

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div>
          <p className="text-sm text-white font-medium">
            {current.mediaType === 'video' ? 'Video Clip' : 'Photo'}
          </p>
          {current.durationSeconds != null && (
            <p className="text-xs text-gray-500">{current.durationSeconds}s</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={cn('text-gray-400 hover:text-white p-1', interactions.button.base)}
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-5 h-5">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center relative px-4">
        {current.mediaType === 'video' ? (
          <video
            key={current.id}
            src={current.cloudinaryUrl}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full rounded"
          />
        ) : (
          <img
            src={current.cloudinaryUrl}
            alt={current.caption ?? 'Form check photo'}
            className="max-w-full max-h-full object-contain rounded"
          />
        )}

        {/* Nav arrows */}
        {hasPrev && (
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={goNext}
            aria-label="Next"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Caption + counter */}
      <div className="px-4 py-3 shrink-0">
        {current.caption && (
          <p className="text-sm text-gray-300 mb-1">{current.caption}</p>
        )}
        <p className="text-xs text-gray-600 text-center">
          {index + 1} / {media.length}
        </p>
      </div>
    </div>
  )
}
