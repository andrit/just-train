// ------------------------------------------------------------
// apps/backend/eslint.config.js
//
// ESLint 9 flat config for the Fastify backend.
// Extends shared base. No React rules here.
// ------------------------------------------------------------

import { base }   from '@trainer-app/eslint-config'
import tseslint   from 'typescript-eslint'

export default tseslint.config(
  // Shared base (TypeScript rules)
  ...base,

  {
    files: ['**/*.ts'],

    rules: {
      // Backend uses console.error/warn/info in production via pino —
      // relax the console rule since pino wraps it
      'no-console': 'off',

      // Process.env access is fine in Node
      'no-process-env': 'off',
    },
  },

  {
    // Test files — relax rules
    files: ['**/__tests__/**', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  {
    // Seed files and scripts — more permissive
    files: ['src/db/seeds/**', 'scripts/**'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'drizzle/**',
    ],
  }
)
