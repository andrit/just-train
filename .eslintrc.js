// ------------------------------------------------------------
// Root ESLint configuration — applies to the entire monorepo.
// Individual packages can extend or override specific rules
// by adding their own .eslintrc files.
// ------------------------------------------------------------
module.exports = {
  root: true,

  parser: '@typescript-eslint/parser',

  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },

  plugins: ['@typescript-eslint'],

  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],

  rules: {
    // Warn on console.log to keep production code clean.
    // console.error and console.warn are still allowed.
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // Enforce explicit return types on functions — helps readability
    // and catches mismatched return shapes early
    '@typescript-eslint/explicit-function-return-type': 'off', // off at root, on in backend

    // Disallow 'any' type — use 'unknown' instead and narrow it
    '@typescript-eslint/no-explicit-any': 'warn',

    // Unused variables are almost always bugs
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },

  // Don't lint build artifacts or dependency folders
  ignorePatterns: ['dist/', 'node_modules/', '.turbo/'],
}
