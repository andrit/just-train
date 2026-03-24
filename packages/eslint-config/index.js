// ------------------------------------------------------------
// packages/eslint-config/index.js
//
// Shared ESLint 9 flat config base for TrainerApp monorepo.
// Used by apps/frontend and apps/backend.
//
// PHILOSOPHY:
//   - TypeScript-aware: catch real bugs, not style opinions
//   - @typescript-eslint/no-explicit-any → warn (we have legit uses)
//   - Unused vars → error with _ prefix escape hatch
//   - No console.log in committed code → warn
//   - Pedantic rules (explicit return types, etc.) deliberately off
// ------------------------------------------------------------

import tseslint from 'typescript-eslint'

export const base = tseslint.config(
  {
    // Apply to all TypeScript files
    files: ['**/*.ts', '**/*.tsx'],

    extends: [
      ...tseslint.configs.recommended,
    ],

    rules: {
      // ── TypeScript ───────────────────────────────────────────────────────
      // Warn on any — not error, we have some legitimate uses
      '@typescript-eslint/no-explicit-any':    'warn',

      // Unused vars: error, but _ prefix is the escape hatch
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern:   '^_',
        varsIgnorePattern:   '^_',
        caughtErrorsIgnorePattern: '^_',
      }],

      // Allow empty catch blocks with a comment
      '@typescript-eslint/no-empty-function':  'off',

      // Allow non-null assertions — we use them deliberately with guards
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Don't require explicit return types — TypeScript infers them well
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // Allow require() in config files
      '@typescript-eslint/no-require-imports': 'off',

      // ── General ──────────────────────────────────────────────────────────
      // No console.log in committed code — use proper logging
      'no-console': ['warn', { allow: ['warn', 'error', 'debug', 'info'] }],

      // No debugger statements
      'no-debugger': 'error',

      // Consistent === over ==
      'eqeqeq': ['error', 'always', { null: 'ignore' }],

      // No var — use let/const
      'no-var': 'error',

      // Prefer const
      'prefer-const': 'error',
    },
  },

  {
    // Ignore patterns — applied globally
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/*.tsbuildinfo',
    ],
  }
)
