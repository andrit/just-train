// ------------------------------------------------------------
// apps/frontend/eslint.config.js
//
// ESLint 9 flat config for the React/Vite frontend.
// Extends shared base + adds React and hooks rules.
// ------------------------------------------------------------

import { base }          from '@trainer-app/eslint-config'
import reactPlugin       from 'eslint-plugin-react'
import hooksPlugin       from 'eslint-plugin-react-hooks'
import tseslint          from 'typescript-eslint'

export default tseslint.config(
  // Shared base (TypeScript rules)
  ...base,

  {
    files: ['**/*.tsx', '**/*.ts'],

    plugins: {
      'react':       reactPlugin,
      'react-hooks': hooksPlugin,
    },

    settings: {
      react: { version: 'detect' },
    },

    rules: {
      // ── React hooks — these catch real bugs ───────────────────────────
      'react-hooks/rules-of-hooks':  'error',
      'react-hooks/exhaustive-deps': 'warn',

      // ── React ─────────────────────────────────────────────────────────
      // JSX without React import is fine in React 17+
      'react/react-in-jsx-scope':    'off',
      'react/prop-types':            'off',  // we use TypeScript instead

      // Self-closing JSX elements
      'react/self-closing-comp': ['warn', {
        component: true,
        html:      true,
      }],

      // No array index keys — warn, not error (sometimes unavoidable)
      'react/no-array-index-key': 'warn',
    },
  },

  {
    // Stories and test files — relax some rules
    files: ['**/*.stories.tsx', '**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console':                         'off',
    },
  },

  {
    // Config files at root
    files: ['*.config.js', '*.config.ts', 'tailwind.config.*'],
    rules: {
      'no-console': 'off',
    },
  },

  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.storybook/**',
      'storybook-static/**',
    ],
  }
)
