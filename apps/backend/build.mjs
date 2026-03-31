// ------------------------------------------------------------
// build.mjs — Production build script for the backend
//
// Uses esbuild to bundle src/index.ts into a single dist/index.js.
// The @trainer-app/shared workspace package is inlined (bundled)
// so Node.js never tries to resolve its TypeScript source at runtime.
//
// Key principle: packages that use class instances or plugin systems
// MUST be external so all code shares the same instance from node_modules.
// Bundling them creates duplicate instances that fail identity checks
// (e.g. schema.safeParse is not a function, hook not registered, etc.)
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
  format:      'cjs',
  outfile:     resolve(__dirname, 'dist/index.js'),
  sourcemap:   true,

  // Resolve @trainer-app/shared to TypeScript source — esbuild handles
  // the directory imports that plain node cannot resolve at runtime.
  alias: {
    '@trainer-app/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
  },

  // External packages — resolved from node_modules at runtime.
  // Rule: anything that uses class identity checks, plugin systems,
  // or serves static assets must be external to avoid duplicate instances.
  external: [
    // Native addons
    'argon2',

    // Database
    'pg',
    'pg-native',
    'drizzle-orm',

    // Queue / Redis
    'bullmq',
    'ioredis',

    // Media / email
    'cloudinary',
    'resend',

    // Zod — must be external so fastify-type-provider-zod and app schemas
    // share the exact same Zod instance. Bundling separately causes
    // "schema.safeParse is not a function" at serialization time.
    'zod',
    'fastify-type-provider-zod',

    // Fastify core and all plugins — must share one instance so hooks,
    // decorators, and the plugin system work correctly.
    'fastify',
    '@fastify/cookie',
    '@fastify/cors',
    '@fastify/helmet',
    '@fastify/multipart',
    '@fastify/rate-limit',
    '@fastify/swagger',
    '@fastify/swagger-ui',

    // JWT / crypto
    'jsonwebtoken',

    // Logging
    'pino',
    'pino-pretty',
  ],

  logLevel: 'info',
})

console.log('✅ Build complete → dist/index.js')
