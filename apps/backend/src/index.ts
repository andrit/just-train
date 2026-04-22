import { routeLog } from './lib/logger'
// ------------------------------------------------------------
// index.ts — Fastify server entry point
//
// PLUGIN REGISTRATION ORDER (order matters in Fastify):
//   1. Security: helmet, cors
//   2. Cookies: @fastify/cookie — needed before auth routes parse cookies
//   3. Rate limiting: @fastify/rate-limit — must be before routes
//   4. Swagger: registered before routes so it captures all schemas
//   5. Routes: auth first, then protected resource routes
//
// PHASE 2 ADDITIONS:
//   - @fastify/cookie: parses httpOnly refresh token cookie
//   - @fastify/rate-limit: global limit + tighter limit on /auth/login
//   - authRoutes: /register, /login, /refresh, /logout, /me
//   - JWT Bearer auth documented in Swagger (bearerAuth security scheme)
//   - Swagger description updated to reflect auth requirements
//
// Swagger UI:     http://localhost:3001/documentation
// OpenAPI JSON:   http://localhost:3001/documentation/json
// Health check:   http://localhost:3001/health
// ------------------------------------------------------------

import Fastify       from 'fastify'
import cors          from '@fastify/cors'
import helmet        from '@fastify/helmet'
import cookie        from '@fastify/cookie'
import multipart     from '@fastify/multipart'
import rateLimit     from '@fastify/rate-limit'
import swagger       from '@fastify/swagger'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { z }          from 'zod'
import * as dotenv   from 'dotenv'

dotenv.config()

import { authRoutes }            from './routes/auth'
import { clientRoutes }          from './routes/clients'
import { clientGoalRoutes }      from './routes/client-goals'
import { clientSnapshotRoutes }  from './routes/client-snapshots'
import { exerciseRoutes }        from './routes/exercises'
import { mediaRoutes }           from './routes/media'
import { sessionRoutes }         from './routes/sessions'
import { templateRoutes }        from './routes/templates'
import { kpiRoutes }             from './routes/kpis'
import { reportRoutes }          from './routes/reports'
import { snapshotMediaRoutes }   from './routes/snapshot-media'
import { sessionExerciseMediaRoutes } from './routes/session-exercise-media'
import { challengeRoutes }           from './routes/challenges'
import { configureCloudinary }   from './services/cloudinary.service'
import { startScheduler }        from './queues/scheduler'
import { startReportWorker, startAlertWorker } from './queues/workers'
import { closeRedisConnection }  from './queues/connection'

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
})

// ------------------------------------------------------------
// ZodTypeProvider
// Wires Zod into Fastify's validation + serialization pipeline.
// validatorCompiler:  validates incoming requests with Zod
// serializerCompiler: serializes outgoing responses through Zod
//                     (strips fields not in the schema — passwordHash never leaks)
// ------------------------------------------------------------
app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

// ------------------------------------------------------------
// CORS
// credentials: true required for httpOnly cookie on refresh endpoint
//
// Three layers of origin matching (checked in order):
//   1. Exact match against CORS_ORIGIN (comma-separated)
//   2. Vercel preview deploys: any *.vercel.app subdomain containing
//      the VERCEL_PROJECT_SLUG (e.g. "just-train-frontend")
//   3. localhost on any port (dev only, when NODE_ENV !== 'production')
// ------------------------------------------------------------
const corsExactOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)

const vercelSlug = process.env.VERCEL_PROJECT_SLUG ?? ''
const isDev      = process.env.NODE_ENV !== 'production'

function isAllowedOrigin(origin: string): boolean {
  // 1. Exact match (production domain, custom domains)
  if (corsExactOrigins.includes(origin)) return true

  // 2. Vercel preview/branch deploys — match project slug inside *.vercel.app
  //    e.g. https://just-train-frontend-abc123-team.vercel.app
  if (vercelSlug && origin.endsWith('.vercel.app')) {
    try {
      const hostname = new URL(origin).hostname
      if (hostname.includes(vercelSlug)) return true
    } catch { /* malformed URL — reject */ }
  }

  // 3. Dev: allow localhost on any port
  if (isDev) {
    try {
      const url = new URL(origin)
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true
    } catch { /* malformed URL — reject */ }
  }

  return false
}

app.register(cors, {
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Swagger)
    if (!origin) return cb(null, true)
    if (isAllowedOrigin(origin)) return cb(null, true)
    cb(new Error(`Origin ${origin} not allowed by CORS`), false)
  },
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,  // Required — allows browser to send/receive the httpOnly cookie
})

// ------------------------------------------------------------
// HELMET — secure HTTP response headers
// CSP relaxed to allow Swagger UI to load its own assets.
// ------------------------------------------------------------
app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc:     ["'self'", 'data:', 'https:'],
    },
  },
})

// ------------------------------------------------------------
// MULTIPART — for exercise media uploads (Phase 3)
// Limits are per-file; cloudinary.service.ts enforces them too.
// ------------------------------------------------------------
app.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB absolute ceiling
    files:    1,                  // One file per request
  },
})

// ------------------------------------------------------------
// COOKIES — must be registered before auth routes
// Used to parse the httpOnly refresh token cookie.
// The cookie secret adds HMAC signing for tamper detection
// (the token itself is still verified via argon2 in the DB).
// ------------------------------------------------------------
app.register(cookie, {
  secret: process.env.COOKIE_SECRET ?? 'change-this-cookie-secret-in-production',
})

// ------------------------------------------------------------
// RATE LIMITING
//
// Global limit: 100 requests per minute per IP (generous for a PWA).
// The /auth/login route applies a tighter per-route limit:
//   max: 10 per 15 minutes (configured in routes/auth.ts via config.rateLimit).
//
// keyGenerator: uses X-Forwarded-For when behind a reverse proxy
// (Railway injects this automatically in production).
// ------------------------------------------------------------
app.register(rateLimit, {
  global:       true,
  max:          100,
  timeWindow:   '1 minute',
  keyGenerator: (req) =>
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    ?? req.ip
    ?? 'unknown',
  errorResponseBuilder: () => ({
    error: 'Too many requests — please slow down',
    code:  'RATE_LIMIT_EXCEEDED',
  }),
})

// ------------------------------------------------------------
// SWAGGER — OpenAPI 3.0 spec generation
//
// bearerAuth security scheme is defined here and referenced
// via security: [{ bearerAuth: [] }] in every protected route schema.
// This makes the Swagger UI show an "Authorize" button.
// ------------------------------------------------------------
app.register(swagger, {
  openapi: {
    openapi: '3.0.0',
    info: {
      title:       'Trainer App API',
      description: `
## Trainer App — REST API

This API powers the Trainer App PWA. It manages:
- **Clients** — the trainer's roster of people being trained
- **Exercise Library** — reusable exercises by body part and workout type
- **Sessions** — training events with workout blocks and recorded sets
- **Templates** — reusable session blueprints

### Authentication (Phase 2)
All resource endpoints require a JWT Bearer token.

**Login flow:**
1. \`POST /api/v1/auth/login\` → returns \`accessToken\` (JSON) + sets httpOnly cookie
2. Attach token: \`Authorization: Bearer <accessToken>\`
3. When token expires (15 min), \`POST /api/v1/auth/refresh\` → new token silently issued

**Authorize** using the 🔒 button above before trying protected endpoints.

### Workout Hierarchy
\`Session → Workouts → Exercises → Sets\`

### Default Workout Order
Cardio → Stretching → Calisthenics/Resistance → Cooldown *(editable per session)*
      `,
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        // bearerAuth referenced in all protected route schemas
        // as: security: [{ bearerAuth: [] }]
        bearerAuth: {
          type:         'http',
          scheme:       'bearer',
          bearerFormat: 'JWT',
          description:  'JWT access token from POST /auth/login or /auth/refresh. Expires in 15 minutes.',
        },
      },
    },
    tags: [
      { name: 'Auth',              description: 'Register, login, token refresh, logout, onboarding, profile update' },
      { name: 'Clients',           description: "Manage the trainer's client roster — includes self-client for train-yourself mode" },
      { name: 'Client Goals',      description: 'Timestamped goal history per client — powers the progress narrative in reports' },
      { name: 'Client Snapshots',  description: 'Time-series baseline measurements — body comp, circumference, functional, subjective scores' },
      { name: 'Exercises',         description: 'Exercise library — browse, create, and enrich exercises' },
      { name: 'Sessions',          description: 'Training sessions — plan or build live. Contains workout blocks and recorded sets.' },
      { name: 'Templates',         description: 'Reusable workout blueprints — build once, apply to any client session' },
      { name: 'Health',            description: 'Server health check' },
    ],
  },
})

// ------------------------------------------------------------
// SWAGGER UI — interactive docs at /documentation
// Only enabled in development — not exposed in production.
// persistAuthorization keeps the bearer token across page reloads
// ------------------------------------------------------------
// Swagger UI registered inside start() for dev only — see below

// ------------------------------------------------------------
// ROUTES
// Auth routes are public (no preHandler needed) — they create the tokens.
// All other routes use app.addHook('preHandler', authenticate) internally.
// ------------------------------------------------------------
app.register(authRoutes,           { prefix: '/api/v1' })
app.register(clientRoutes,         { prefix: '/api/v1' })
app.register(clientGoalRoutes,     { prefix: '/api/v1' })
app.register(clientSnapshotRoutes, { prefix: '/api/v1' })
app.register(exerciseRoutes,       { prefix: '/api/v1' })
app.register(mediaRoutes,          { prefix: '/api/v1' })
app.register(sessionRoutes,        { prefix: '/api/v1' })
app.register(kpiRoutes,            { prefix: '/api/v1' })
app.register(reportRoutes,         { prefix: '/api/v1' })
app.register(templateRoutes,       { prefix: '/api/v1' })
app.register(snapshotMediaRoutes,  { prefix: '/api/v1' })
app.register(sessionExerciseMediaRoutes, { prefix: '/api/v1' })
app.register(challengeRoutes,          { prefix: '/api/v1' })

// ------------------------------------------------------------
// HEALTH CHECK — public, no auth required
// Used by Railway health checks and uptime monitors.
// ------------------------------------------------------------
app.get('/health', {
  schema: {
    tags: ['Health'],
    summary: 'Server health check',
    description: 'Returns 200 OK when the server is running. No auth required.',
    response: {
      200: z.object({
        status:    z.string(),
        timestamp: z.string(),
      }),
    },
  },
}, async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

// ------------------------------------------------------------
// START
// ------------------------------------------------------------
const start = async (): Promise<void> => {
  const port = parseInt(process.env.PORT ?? '3001', 10)
  // Always bind to 0.0.0.0 in production so Railway's healthcheck can reach it.
  // Fall back to localhost only when explicitly in development.
  const host = process.env.NODE_ENV === 'development' ? 'localhost' : '0.0.0.0'

  // Swagger UI — dev only, loaded dynamically so the module never loads in production.
  // This prevents @fastify/swagger-ui from registering static file handlers that
  // reference paths (logo.svg) which don't exist in the production bundle.
  if (process.env.NODE_ENV !== 'production') {
    const { default: swaggerUi } = await import('@fastify/swagger-ui')
    await app.register(swaggerUi, {
      routePrefix: '/documentation',
      uiConfig: {
        docExpansion:           'list',
        displayRequestDuration: true,
        persistAuthorization:   true,
        filter:                 true,
      },
      staticCSP: true,
    })
  }

  try {
    // Configure Cloudinary — will throw if env vars are missing in production
    // In development, a warning is logged if not configured (media upload will fail)
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      configureCloudinary()
    } else if (process.env.NODE_ENV === 'production') {
      throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.')
    } else {
      console.warn('⚠️  Cloudinary not configured — media uploads will fail. Set CLOUDINARY_* in .env')
    }

    await app.listen({ port, host })
    ;routeLog(app).info(`Server:       http://${host}:${port}`)
    ;routeLog(app).info(`API Docs:     http://${host}:${port}/documentation`)
    ;routeLog(app).info(`Health:       http://${host}:${port}/health`)

    // ── Job queue — only start if Redis is configured ──────────────────────
    if (process.env.UPSTASH_REDIS_URL) {
      const reportWorker = startReportWorker()
      const alertWorker  = startAlertWorker()
      await startScheduler()
      ;routeLog(app).info('Queue:        BullMQ workers + scheduler started')

      // Graceful shutdown — drain workers before exit
      const shutdown = async (): Promise<void> => {
        await reportWorker.close()
        await alertWorker.close()
        await closeRedisConnection()
        await app.close()
        process.exit(0)
      }
      process.once('SIGTERM', shutdown)
      process.once('SIGINT',  shutdown)
    } else {
      ;routeLog(app).warn('Queue:        UPSTASH_REDIS_URL not set — job queue disabled')
    }
  } catch (error) {
    ;routeLog(app).error(error)
    process.exit(1)
  }
}

start()
