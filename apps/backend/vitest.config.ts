// ------------------------------------------------------------
// vitest.config.ts — Vitest configuration for the backend
//
// Why Vitest over Jest?
//   - Native TypeScript support — no ts-jest or babel needed
//   - Same config model as Vite (used by the frontend)
//   - Fast parallel test execution
//   - Built-in vi.mock, vi.fn, vi.spyOn — Jest-compatible API
//
// setupFiles runs BEFORE any test file imports modules.
// This is critical — JWT_SECRET must be in process.env before
// auth.service.ts is first imported (it calls requireEnv at module level).
// ------------------------------------------------------------

import { defineConfig } from 'vitest/config'
import path             from 'path'

export default defineConfig({
  test: {
    // Run each test file in isolation — prevents state leaking between files
    environment: 'node',

    // Executed before any test module is loaded — sets env vars
    setupFiles: ['./src/__tests__/setup.ts'],

    // Test file patterns
    include: ['src/__tests__/**/*.test.ts'],

    // Show individual test names in output
    reporter: 'verbose',

    // Timeout per test — argon2 hashing can take ~100ms
    testTimeout: 10_000,

    // Coverage config (run with: pnpm test:coverage)
    coverage: {
      provider: 'v8',
      include:  ['src/**/*.ts'],
      exclude:  ['src/__tests__/**', 'src/db/schema/**', 'src/index.ts'],
      reporter: ['text', 'lcov'],
    },
  },

  resolve: {
    alias: {
      // Matches the tsconfig path alias used in source files
      '@': path.resolve(__dirname, './src'),
    },
  },
})
