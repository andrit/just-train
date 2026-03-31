// ------------------------------------------------------------
// build.mjs — Production build script for the backend
//
// Uses esbuild to bundle src/index.ts into a single dist/index.js.
// The @trainer-app/shared workspace package is inlined (bundled)
// so Node.js never tries to resolve its TypeScript source at runtime.
//
// Native modules (argon2, pg, bullmq, ioredis, cloudinary) are
// marked external — esbuild leaves them as require() calls and
// they are resolved from node_modules at runtime as normal.
// ------------------------------------------------------------

import { build } from 'esbuild'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

await build({
  entryPoints: [resolve(__dirname, 'src/index.ts')],
  bundle:      true,
  platform:    'node',
  target:      'node20',
  format:      'cjs',         // CommonJS — matches tsconfig "module": "CommonJS"
  outfile:     resolve(__dirname, 'dist/index.js'),
  sourcemap:   true,

  // Path alias — mirrors tsconfig paths
  alias: {
    '@trainer-app/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
  },

  // Native modules and large packages that should not be bundled.
  // They are resolved from node_modules at runtime.
  external: [
    // Native addons
    'argon2',
    // Database
    'pg',
    'pg-native',
    // Queue / Redis
    'bullmq',
    'ioredis',
    // Media
    'cloudinary',
    // Email
    'resend',
    // Swagger UI — serves static assets from its own node_modules dir;
    // must stay external so its __dirname resolves correctly at runtime.
    // Only loaded in development via dynamic import anyway.
    '@fastify/swagger-ui',
    // Swagger UI — not used in production, references static files
    '@fastify/swagger-ui',
    // Node built-ins (esbuild handles these automatically with platform:node
    // but listing explicitly for clarity)
    'crypto',
    'fs',
    'path',
    'os',
    'stream',
    'events',
    'util',
    'http',
    'https',
    'net',
    'tls',
    'child_process',
    'worker_threads',
    'url',
    'querystring',
    'zlib',
    'buffer',
  ],

  // Suppress warnings about dynamic require (Drizzle uses them internally)
  logLevel: 'info',
})

console.log('✅ Build complete → dist/index.js')
