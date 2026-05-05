// ------------------------------------------------------------
// components/session/InlineCameraSheet.tsx (v2.12.0)
//
// Bottom sheet with a live camera viewfinder. Captures photos
// or short video clips (≤30s) without leaving the app.
//
// FLOW:
//   1. Open sheet → request getUserMedia (rear camera default)
//   2. Photo: tap capture → canvas.toBlob → preview → confirm → upload
//   3. Video: tap record → MediaRecorder → timer to 30s → stop → preview → confirm → upload
//   4. Camera flip: toggle facingMode between environment/user
//
// FALLBACK:
//   If getUserMedia is unavailable (older browsers, denied perms),
//   renders a <input type="file" capture> instead. Same result,
//   less seamless.
// ------------------------------------------------------------

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn }           from '@/lib/cn'
import { interactions } from '@/lib/interactions'
import { BottomSheet }  from '@/components/ui/BottomSheet'
import { Spinner }      from '@/components/ui/Spinner'

// ── Constants ───────────────────────────────────────────────────────────────

const MAX_VIDEO_SECONDS = 30

// ── Types ─────────────────────────────────────────────────────────────────────

interface InlineCameraSheetProps {
  open:    boolean
  onClose: () => void
  /** Called with the captured file and optional duration */
  onCapture: (file: Blob, durationSeconds?: number) => void
  /** Allow video recording (default true) */
  allowVideo?: boolean
}

type CameraState = 'loading' | 'ready' | 'recording' | 'preview' | 'fallback'

// ── Component ─────────────────────────────────────────────────────────────────

export function InlineCameraSheet({
  open,
  onClose,
  onCapture,
  allowVideo = true,
}: InlineCameraSheetProps): React.JSX.Element {
  const videoRef     = useRef<HTMLVideoElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const recorderRef  = useRef<MediaRecorder | null>(null)
  const streamRef    = useRef<MediaStream | null>(null)
  const chunksRef    = useRef<Blob[]>([])
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [state, setState]         = useState<CameraState>('loading')
  const [facing, setFacing]       = useState<'environment' | 'user'>('environment')
  const [recordTime, setRecordTime] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [previewDuration, setPreviewDuration] = useState<number | undefined>(undefined)
  const [isVideo, setIsVideo]     = useState(false)

  // ── Start camera ────────────────────────────────────────────────────────

  const startCamera = useCallback(async (facingMode: 'environment' | 'user') => {
    // Clean up existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setState('ready')
    } catch {
      // getUserMedia not supported or permission denied — use fallback
      setState('fallback')
    }
  }, [])

  useEffect(() => {
    if (open) {
      // Check for getUserMedia support
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('fallback')
        return
      }
      startCamera(facing)
    }

    return () => {
      // Cleanup on close
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop()
      }
      if (timerRef.current) clearInterval(timerRef.current)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only on open/facing
  }, [open, facing])

  // ── Capture photo ─────────────────────────────────────────────────────────

  const capturePhoto = (): void => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      setPreviewBlob(blob)
      setPreviewUrl(URL.createObjectURL(blob))
      setPreviewDuration(undefined)
      setIsVideo(false)
      setState('preview')
    }, 'image/jpeg', 0.9)
  }

  // ── Record video ──────────────────────────────────────────────────────────

  const startRecording = (): void => {
    if (!streamRef.current) return

    chunksRef.current = []
    setRecordTime(0)

    // Prefer webm, fall back to mp4
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4'

    const recorder = new MediaRecorder(streamRef.current, { mimeType })
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      setPreviewBlob(blob)
      setPreviewUrl(URL.createObjectURL(blob))
      setPreviewDuration(recordTime)
      setIsVideo(true)
      setState('preview')
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    recorder.start(100) // collect data every 100ms
    setState('recording')

    // Timer — auto-stop at 30s
    let elapsed = 0
    timerRef.current = setInterval(() => {
      elapsed += 1
      setRecordTime(elapsed)
      if (elapsed >= MAX_VIDEO_SECONDS) {
        recorder.stop()
      }
    }, 1000)
  }

  const stopRecording = (): void => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }

  // ── Camera flip ───────────────────────────────────────────────────────────

  const flipCamera = (): void => {
    setFacing((f) => f === 'environment' ? 'user' : 'environment')
  }

  // ── Confirm / retake ──────────────────────────────────────────────────────

  const confirmCapture = (): void => {
    if (!previewBlob) return
    onCapture(previewBlob, previewDuration)
    resetAndClose()
  }

  const retake = (): void => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewBlob(null)
    setPreviewDuration(undefined)
    setState('ready')
    // Re-attach stream
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }

  const resetAndClose = (): void => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewBlob(null)
    setPreviewDuration(undefined)
    setRecordTime(0)
    setState('loading')
    onClose()
  }

  // ── Fallback file input handler ───────────────────────────────────────────

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return
    onCapture(file)
    resetAndClose()
  }

  // ── Format timer ──────────────────────────────────────────────────────────

  const formatTime = (s: number): string => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <BottomSheet open={open} onClose={resetAndClose} title="Capture" maxHeight="90vh">
      <div className="px-4 pb-6">

        {/* Fallback mode */}
        {state === 'fallback' && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400 mb-4">
              Camera access unavailable. Use your device camera instead.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'px-6 py-3 rounded-xl bg-command-blue text-white font-medium',
                interactions.button.base,
                interactions.button.press,
              )}
            >
              Open Camera
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className="sr-only"
              aria-hidden
              onChange={handleFileInput}
            />
          </div>
        )}

        {/* Loading */}
        {state === 'loading' && open && (
          <div className="flex justify-center py-12">
            <Spinner size="md" className="text-command-blue" />
          </div>
        )}

        {/* Live viewfinder */}
        {(state === 'ready' || state === 'recording') && (
          <div className="space-y-4">
            {/* Video preview */}
            <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Recording indicator */}
              {state === 'recording' && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-mono text-sm text-white">{formatTime(recordTime)}</span>
                  <span className="text-xs text-gray-400">/ {formatTime(MAX_VIDEO_SECONDS)}</span>
                </div>
              )}

              {/* Camera flip */}
              {state === 'ready' && (
                <button
                  type="button"
                  onClick={flipCamera}
                  aria-label="Flip camera"
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                >
                  <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden>
                    <path d="M3 10a7 7 0 0112.9-3.7M17 10a7 7 0 01-12.9 3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M16.5 3v3.5H13M3.5 17v-3.5H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-6">
              {/* Photo capture */}
              <button
                type="button"
                onClick={capturePhoto}
                disabled={state === 'recording'}
                aria-label="Take photo"
                className={cn(
                  'w-16 h-16 rounded-full border-4 border-white flex items-center justify-center',
                  'transition-all duration-150',
                  state === 'recording' ? 'opacity-30' : 'hover:scale-105 active:scale-95',
                )}
              >
                <div className="w-12 h-12 rounded-full bg-white" />
              </button>

              {/* Video record/stop */}
              {allowVideo && (
                <button
                  type="button"
                  onClick={state === 'recording' ? stopRecording : startRecording}
                  aria-label={state === 'recording' ? 'Stop recording' : 'Start recording'}
                  className={cn(
                    'w-16 h-16 rounded-full border-4 flex items-center justify-center',
                    'transition-all duration-150 hover:scale-105 active:scale-95',
                    state === 'recording'
                      ? 'border-red-500'
                      : 'border-red-400',
                  )}
                >
                  {state === 'recording' ? (
                    <div className="w-6 h-6 rounded bg-red-500" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-red-500" />
                  )}
                </button>
              )}
            </div>

            <p className="text-xs text-gray-600 text-center">
              {allowVideo
                ? 'White = photo · Red = video (30s max)'
                : 'Tap to capture photo'}
            </p>
          </div>
        )}

        {/* Preview */}
        {state === 'preview' && previewUrl && (
          <div className="space-y-4">
            <div className="rounded-xl overflow-hidden bg-black aspect-[4/3]">
              {isVideo ? (
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Captured"
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            {previewDuration != null && (
              <p className="text-xs text-gray-500 text-center font-mono">
                {formatTime(previewDuration)}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={retake}
                className={cn(
                  'flex-1 py-3 rounded-xl border border-surface-border text-gray-300',
                  'hover:bg-surface transition-colors',
                  interactions.button.base,
                )}
              >
                Retake
              </button>
              <button
                type="button"
                onClick={confirmCapture}
                className={cn(
                  'flex-1 py-3 rounded-xl bg-command-blue text-white font-medium',
                  'hover:bg-command-blue/90 transition-colors',
                  interactions.button.base,
                  interactions.button.press,
                )}
              >
                Use {isVideo ? 'Video' : 'Photo'}
              </button>
            </div>
          </div>
        )}

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} className="sr-only" aria-hidden />
      </div>
    </BottomSheet>
  )
}
