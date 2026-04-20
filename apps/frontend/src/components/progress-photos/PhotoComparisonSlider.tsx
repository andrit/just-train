// ------------------------------------------------------------
// components/progress-photos/PhotoComparisonSlider.tsx (v2.12.0)
//
// Before/after comparison view with a draggable vertical divider.
// Users select two snapshot dates and a pose to compare.
// The divider reveals the "after" photo on the right as it moves.
//
// Opens as a full-screen overlay — this is the highest-value UI
// in the progress photos feature.
// ------------------------------------------------------------

import { useState, useRef, useCallback, useEffect } from 'react'
import { cn }           from '@/lib/cn'
import { interactions } from '@/lib/interactions'
import type { ProgressPhotoGroupResponse } from '@trainer-app/shared'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PhotoComparisonSliderProps {
  groups:  ProgressPhotoGroupResponse[]
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PhotoComparisonSlider({
  groups,
  onClose,
}: PhotoComparisonSliderProps): React.JSX.Element {
  // Default: compare most recent (after) vs oldest (before)
  const [beforeIdx, setBeforeIdx] = useState(groups.length - 1)
  const [afterIdx, setAfterIdx]   = useState(0)
  const [poseFilter, setPoseFilter] = useState('front')
  const [sliderPos, setSliderPos]   = useState(50) // percentage

  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging   = useRef(false)

  const beforeGroup = groups[beforeIdx]
  const afterGroup  = groups[afterIdx]

  // Find matching pose photos
  const beforePhoto = beforeGroup?.photos.find((p) => p.pose === poseFilter)
  const afterPhoto  = afterGroup?.photos.find((p) => p.pose === poseFilter)

  // Available poses across both groups
  const availablePoses = Array.from(new Set([
    ...(beforeGroup?.photos.map((p) => p.pose) ?? []),
    ...(afterGroup?.photos.map((p) => p.pose) ?? []),
  ]))

  const formatDate = (iso: string): string =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })

  // ── Drag handling ─────────────────────────────────────────────────────────

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    setSliderPos(Math.max(5, Math.min(95, pct)))
  }, [])

  const handlePointerDown = useCallback(() => {
    isDragging.current = true
  }, [])

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent): void => {
      if (isDragging.current) handleMove(e.clientX)
    }
    const handlePointerUp = (): void => {
      isDragging.current = false
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }
  }, [handleMove])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 border-b border-surface-border shrink-0">
        <h2 className="font-display text-lg uppercase tracking-wide text-white">Compare</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close comparison"
          className={cn('text-gray-400 hover:text-white p-1', interactions.button.base)}
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-5 h-5">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Date selectors */}
      <div className="flex items-center gap-4 px-4 py-2 bg-black/60 shrink-0">
        <div className="flex-1">
          <label className="text-[10px] text-gray-600 uppercase tracking-wider block mb-0.5">Before</label>
          <select
            value={beforeIdx}
            onChange={(e) => setBeforeIdx(Number(e.target.value))}
            className="w-full bg-surface border border-surface-border rounded px-2 py-1 text-sm text-gray-300"
          >
            {groups.map((g, i) => (
              <option key={g.snapshotId} value={i}>{formatDate(g.capturedAt)}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-gray-600 uppercase tracking-wider block mb-0.5">After</label>
          <select
            value={afterIdx}
            onChange={(e) => setAfterIdx(Number(e.target.value))}
            className="w-full bg-surface border border-surface-border rounded px-2 py-1 text-sm text-gray-300"
          >
            {groups.map((g, i) => (
              <option key={g.snapshotId} value={i}>{formatDate(g.capturedAt)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Pose chips */}
      <div className="flex gap-1.5 px-4 py-2 bg-black/40 overflow-x-auto shrink-0">
        {availablePoses.map((pose) => (
          <button
            key={pose}
            type="button"
            onClick={() => setPoseFilter(pose)}
            className={cn(
              'px-3 py-1 rounded-full text-xs capitalize whitespace-nowrap transition-colors',
              poseFilter === pose
                ? 'bg-brand-highlight text-white'
                : 'bg-surface border border-surface-border text-gray-400 hover:text-gray-200',
            )}
          >
            {pose.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Comparison area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden select-none touch-none">
        {beforePhoto && afterPhoto ? (
          <>
            {/* Before (full background) */}
            <img
              src={beforePhoto.cloudinaryUrl}
              alt="Before"
              className="absolute inset-0 w-full h-full object-contain"
              draggable={false}
            />

            {/* After (clipped by slider) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
            >
              <img
                src={afterPhoto.cloudinaryUrl}
                alt="After"
                className="absolute inset-0 w-full h-full object-contain"
                draggable={false}
              />
            </div>

            {/* Slider line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/80 cursor-col-resize z-10"
              style={{ left: `${sliderPos}%` }}
              onPointerDown={handlePointerDown}
            >
              {/* Drag handle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center">
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-black" aria-hidden>
                  <path d="M4 8h8M6 5l-3 3 3 3M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Labels */}
            <div className="absolute bottom-4 left-4 bg-black/60 rounded px-2 py-1 text-xs text-white">
              Before · {formatDate(beforeGroup?.capturedAt ?? '')}
            </div>
            <div className="absolute bottom-4 right-4 bg-black/60 rounded px-2 py-1 text-xs text-white">
              After · {formatDate(afterGroup?.capturedAt ?? '')}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            <p>No &quot;{poseFilter.replace('_', ' ')}&quot; photo in both selected snapshots</p>
          </div>
        )}
      </div>
    </div>
  )
}
