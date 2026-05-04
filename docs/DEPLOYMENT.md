# Deployment Guide

TrainerApp deploys as two separate services:
- **Backend + Database** → Railway
- **Frontend** → Vercel

Both auto-deploy from GitHub on every push to `main`.

---

## Prerequisites

- GitHub repo with the monorepo pushed
- [Railway account](https://railway.app) (free tier gives $5/month credit)
- [Vercel account](https://vercel.com) (free tier is sufficient)
- [Cloudinary account](https://cloudinary.com) (free tier — exercise media uploads)

---

## Step 1 — Railway (Backend + Database)

### 1a. Create the project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Select **Deploy from GitHub repo** → authorise Railway → select your repo
3. Railway will detect the monorepo. When prompted for the root directory, leave it as `/` — the `railway.json` at the repo root handles the build command.

### 1b. Add PostgreSQL

1. In your Railway project → **New** → **Database** → **Add PostgreSQL**
2. Railway automatically injects `DATABASE_URL` into all services in the same project — you don't need to set it manually.

### 1c. Set environment variables

In the Railway backend service → **Variables** tab, add:

```
NODE_ENV              = production
PORT                  = 3001
CORS_ORIGIN           = https://your-app.vercel.app   ← update after Vercel step
VERCEL_PROJECT_SLUG   = your-vercel-project-name      ← e.g. just-train-frontend
JWT_SECRET            = <generate below>
JWT_ACCESS_TTL        = 15m
JWT_REFRESH_TTL_MS    = 604800000
COOKIE_SECRET         = <generate below>
CLOUDINARY_CLOUD_NAME = <from Cloudinary dashboard>
CLOUDINARY_API_KEY    = <from Cloudinary dashboard>
CLOUDINARY_API_SECRET = <from Cloudinary dashboard>
```

`CORS_ORIGIN` is the exact Vercel production URL (no trailing slash).
`VERCEL_PROJECT_SLUG` is the project name portion of your Vercel URL — e.g. if your URL is
`https://just-train-frontend.vercel.app`, the slug is `just-train-frontend`. This lets Railway
accept CORS requests from Vercel preview/branch deploy URLs automatically.

**Generate secrets:**
```bash
# JWT_SECRET (64 bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# COOKIE_SECRET (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Optional (for scheduled email reports):
```
RESEND_API_KEY        = re_...
REPORT_FROM_EMAIL     = reports@yourdomain.com
UPSTASH_REDIS_URL     = rediss://...
```

### 1d. Run the database migration

After the first deploy succeeds, open the Railway shell for the backend service and run:
```bash
pnpm --filter backend db:push
```

Or use the Railway CLI:
```bash
railway run pnpm --filter backend db:push
```

### 1e. Note your Railway URL

From the Railway service → **Settings** → **Domains** → copy the generated URL.
It will look like: `https://trainerapp-production.up.railway.app`

---

## Step 2 — Vercel (Frontend)

### 2a. Import the project

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → **Import Git Repository**
2. Select your GitHub repo
3. Vercel will detect `vercel.json` at the root — no manual framework configuration needed

### 2b. Set environment variables

In Vercel → **Project Settings** → **Environment Variables**, add:

```
RAILWAY_BACKEND_URL = your-app-production.up.railway.app
```
Use the hostname only from Step 1e — **no `https://`, no trailing slash**.
For example: `just-train-production.up.railway.app`

This variable powers the rewrite rule in `vercel.json` that proxies all `/api/*`
requests through Vercel to Railway. Routing through the proxy means:
- No CORS — browser sees requests as same-origin (both on `your-app.vercel.app`)
- Refresh token cookie works on page reload (same origin, no cross-site restrictions)

**Do NOT set `VITE_API_URL` in Vercel.** Leaving it unset causes the frontend to
default to `/api/v1`, which the Vercel proxy rewrites to your Railway backend.
Setting `VITE_API_URL` to the Railway URL directly bypasses the proxy, breaks
refresh token cookies, and causes CORS errors.

### 2c. Deploy

Click **Deploy**. Vercel will run `pnpm --filter frontend build` and host the output.

### 2d. Note your Vercel URL

It will look like: `https://trainerapp.vercel.app`

---

## Step 3 — Wire them together

### Update CORS on Railway

Go back to Railway → backend service → **Variables** → update `CORS_ORIGIN` to your
exact Vercel production URL (no trailing slash):
```
CORS_ORIGIN = https://your-app.vercel.app
```

The `CORS_ORIGIN` setting is used for local development and as a fallback.
In production, API requests from the frontend travel through the Vercel proxy
(same origin) so CORS is not triggered — but the env var must still be set
correctly for the Railway CORS config to initialise properly.

Redeploy the backend after updating the variable.

---

## Step 4 — Verify

1. Open your Vercel URL in a browser
2. Register a new account — this seeds the exercise library and default templates
3. Check Railway logs to confirm the backend is healthy
4. Open on your phone → tap the share button → **Add to Home Screen** for the PWA install

---

## Custom domain (optional)

- **Vercel**: Project Settings → Domains → Add your domain → update DNS
- **Railway**: Service Settings → Domains → Add custom domain → update DNS
- Update `CORS_ORIGIN` on Railway to use the custom domain instead of the Vercel URL

---

## Troubleshooting

**Login works but I get logged out immediately**
→ Check that `CORS_ORIGIN` on Railway matches your exact Vercel URL (no trailing slash)
→ Confirm `NODE_ENV=production` is set — this enables `secure` + `sameSite=none` on the cookie

**Database errors on first deploy**
→ Run `railway run pnpm --filter backend db:push` to apply the schema

**Build fails on Railway**
→ Check that `pnpm-lock.yaml` is committed to the repo
→ Railway uses `--frozen-lockfile` — the lockfile must be up to date

**CORS error in browser console**
→ `VITE_API_URL` is set in Vercel — remove it. The frontend must use the Vercel proxy.
→ `RAILWAY_BACKEND_URL` is not set in Vercel — add it (hostname only, no https://).
→ `CORS_ORIGIN` is missing or wrong on Railway — set it to your exact Vercel URL.
→ After any env var change, redeploy both services.

---

## Local dev after this change

The shared package now needs to be compiled before the backend can start in production mode. For local dev, `tsx` reads TypeScript directly so it still works. But if you ever run `node dist/index.js` locally:

```bash
pnpm --filter @trainer-app/shared build
pnpm --filter backend build
pnpm --filter backend start
```

The `pnpm dev` command (uses `tsx`) is unaffected.
