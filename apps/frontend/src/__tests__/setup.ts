import '@testing-library/jest-dom'
import { cleanup }              from '@testing-library/react'
import { afterEach, afterAll, beforeAll } from 'vitest'
import { server }               from './mocks/server'

// jsdom does not implement matchMedia. Use a plain function (not vi.fn()) so
// clearMocks between tests does not reset it back to undefined.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string): MediaQueryList => ({
    matches:             false,
    media:               query,
    onchange:            null,
    addListener:         () => {},
    removeListener:      () => {},
    addEventListener:    () => {},
    removeEventListener: () => {},
    dispatchEvent:       () => false,
  } as unknown as MediaQueryList),
})

// Start MSW before all tests; reset handlers after each; stop after all.
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
  localStorage.clear()
})
afterAll(() => server.close())
