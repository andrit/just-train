// ------------------------------------------------------------
// lib/swErrorRelay.ts — service-worker errors → Sentry
//
// The service worker has no DOM and no Sentry SDK; its `error` and
// `unhandledrejection` events would otherwise vanish. sw.ts posts them to
// every open window as SW_ERROR messages; this relay turns each into a Sentry
// event tagged source:service-worker so SW failures (bad precache, a
// throwing route handler, a broken sync relay) show up next to app errors.
//
// Pure message → event mapping is exported for tests; the listener is a thin
// wrapper. Inert when Sentry is not initialised (no DSN).
// ------------------------------------------------------------

import * as Sentry from '@sentry/react'

export interface SwErrorMessage {
  type:     'SW_ERROR'
  kind:     'error' | 'unhandledrejection'
  message:  string
  stack?:   string
  filename?: string
  lineno?:  number
}

export function isSwErrorMessage(data: unknown): data is SwErrorMessage {
  return typeof data === 'object' && data !== null
    && (data as { type?: unknown }).type === 'SW_ERROR'
    && typeof (data as { message?: unknown }).message === 'string'
}

/** Rebuild an Error whose stack is the worker's, so grouping is by SW frame. */
export function swErrorToError(msg: SwErrorMessage): Error {
  const err = new Error(msg.message)
  err.name = msg.kind === 'unhandledrejection' ? 'ServiceWorkerRejection' : 'ServiceWorkerError'
  if (msg.stack) err.stack = msg.stack
  return err
}

export function reportSwError(msg: SwErrorMessage): void {
  Sentry.captureException(swErrorToError(msg), {
    tags:  { source: 'service-worker' },
    extra: { filename: msg.filename, lineno: msg.lineno },
  })
}

export function installSwErrorRelay(): void {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    if (isSwErrorMessage(event.data)) reportSwError(event.data)
  })
}
