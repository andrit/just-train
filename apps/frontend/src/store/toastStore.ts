// ------------------------------------------------------------
// store/toastStore.ts
//
// Lightweight toast notification state.
// Toasts auto-dismiss after a configurable duration.
// At most 3 toasts shown at once — oldest dismissed first.
// ------------------------------------------------------------

import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'info'

export interface Toast {
  id:       string
  message:  string
  variant:  ToastVariant
}

interface ToastStore {
  toasts:     Toast[]
  show:       (message: string, variant?: ToastVariant, duration?: number) => void
  dismiss:    (id: string) => void
  dismissAll: () => void
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  show: (message, variant = 'success', duration = 3000) => {
    const id = crypto.randomUUID()
    const toast: Toast = { id, message, variant }

    set((s) => ({
      // Cap at 3 — remove oldest if needed
      toasts: [...s.toasts.slice(-2), toast],
    }))

    if (duration > 0) {
      setTimeout(() => get().dismiss(id), duration)
    }
  },

  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  dismissAll: () => set({ toasts: [] }),
}))

// Convenience helper — usable outside React
export const toast = {
  success: (msg: string) => useToastStore.getState().show(msg, 'success'),
  error:   (msg: string) => useToastStore.getState().show(msg, 'error'),
  info:    (msg: string) => useToastStore.getState().show(msg, 'info'),
}
