import { build } from 'esbuild'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sharedSrc  = resolve(__dirname, '../../packages/shared/src/index.ts')

await build({
  entryPoints: [resolve(__dirname, 'src/index.ts')],
  bundle:      true,
  platform:    'node',
  target:      'node20',
  format:      'cjs',
  outfile:     resolve(__dirname, 'dist/index.js'),
  sourcemap:   true,

  plugins: [
    {
      // Explicitly resolve @trainer-app/shared to TypeScript source before
      // esbuild touches node_modules. Without this, esbuild follows the
      // workspace symlink → src/index.ts and then leaves it as a runtime
      // require, causing ERR_MODULE_NOT_FOUND at startup.
      name: 'resolve-workspace-shared',
      setup(build) {
        build.onResolve({ filter: /^@trainer-app\/shared$/ }, () => ({
          path: sharedSrc,
        }))
      },
    },
  ],

  external: [
    'argon2',
    'pg', 'pg-native',
    'drizzle-orm',
    'bullmq', 'ioredis',
    'cloudinary', 'resend',
    'zod',
    'fastify-type-provider-zod',
    'fastify',
    '@fastify/cookie', '@fastify/cors', '@fastify/helmet',
    '@fastify/multipart', '@fastify/rate-limit',
    '@fastify/swagger', '@fastify/swagger-ui',
    'jsonwebtoken',
    'pino', 'pino-pretty',
  ],

  logLevel: 'info',
})

console.log('✅ Build complete → dist/index.js')
