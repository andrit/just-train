// ------------------------------------------------------------
// hooks/useRestTimer.ts — Rest timer state (v1.5.0)
//
// Counts down from a given duration.
// Fires 'rest_tick' each second and 'rest_complete' at zero.
// The timer persists across navigation within the live session
// because it lives in a context above the workout blocks.
//
// USAGE:
//   const timer = useRestTimer()
//   timer.start(90)       // start 90s countdown
//   timer.skip()          // dismiss without waiting
//   timer.remaining       // seconds left
//   timer.isRunning       // boolean
// ------------------------------------------------------------

import { useState, useEffect, useRef, useCallback } from 'react'
import { useUXEvent } from '@/hooks/useUXEvent'

interface RestTimer {
  isRunning:  boolean
  remaining:  number     // seconds left
  total:      number     // total duration this run
  start:      (seconds: number) => void
  skip:        () => void
  progressPct: number    // 0–100, for the ring/bar
}

export function useRestTimer(): RestTimer {
  const [remaining, setRemaining] = useState(0)
  const [total,     setTotal]     = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { fire }    = useUXEvent()

  const clear = useCallback((): void => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const start = useCallback((seconds: number): void => {
    clear()
    setTotal(seconds)
    setRemaining(seconds)

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clear()
          fire('rest_complete')
          // Haptic pulse at zero
          if ('vibrate' in navigator) navigator.vibrate([100, 50, 100])
          return 0
        }
        fire('rest_tick')
        // Single short vibration each tick on mobile
        if ('vibrate' in navigator && prev % 30 === 0) navigator.vibrate(20)
        return prev - 1
      })
    }, 1000)
  }, [clear, fire])

  const skip = useCallback((): void => {
    clear()
    setRemaining(0)
    setTotal(0)
  }, [clear])

  // Clean up on unmount
  useEffect(() => () => clear(), [clear])

  return {
    isRunning:   remaining > 0,
    remaining,
    total,
    start,
    skip,
    progressPct: total > 0 ? ((total - remaining) / total) * 100 : 0,
  }
}
