# User Task: Production Lighthouse Audit

**When to do this:** After the Phase 7 code changes are committed and deployed to a preview/staging URL — or locally using `vite build` + `vite preview`. Do NOT run against the dev server (`localhost:5173`). Dev mode serves unoptimised, unbundled files and Chrome extensions pollute the unused-JS numbers, making scores meaningless.

**Why this matters:** The previous report (Performance: 53, Accessibility: 82) was captured in dev mode with a Chrome extension injecting ~2 MB of extra JavaScript. The real production scores will be significantly better. This audit tells you where you actually stand and what still needs fixing before launch.

---

## Step 1 — Build for production

In your terminal, from the `apps/frontend` directory:

```bash
pnpm build
pnpm preview
```

This starts a local production server at `http://localhost:4173`. Keep it running.

---

## Step 2 — Open Chrome in incognito

**Critical:** Run the audit in an incognito window with all extensions disabled. Extensions (especially productivity tools, password managers, and ad blockers) inject JavaScript that inflates your bundle size numbers and tanks performance scores.

- `Cmd + Shift + N` to open incognito
- Navigate to `http://localhost:4173`
- Log in and navigate to the dashboard so the app is in an authenticated state

---

## Step 3 — Run Lighthouse

1. Open Chrome DevTools (`Cmd + Option + I`)
2. Click the **Lighthouse** tab
3. Set:
   - **Mode:** Navigation
   - **Device:** Mobile
   - **Categories:** Performance, Accessibility, Best Practices, SEO, PWA
4. Click **Analyze page load**

---

## Step 4 — Run a second report on a key inner page

The first report captures the login/dashboard entry point. Run a second report on a page that matters for performance:

- Navigate to `/my-training` (athlete profile — loads KPI hero, multiple tabs)
- Run Lighthouse again with the same settings

---

## Step 5 — What to look for

### Target scores (SDLC Phase 7 advance criteria)
| Category | Target |
|----------|--------|
| Performance | ≥ 90 |
| Accessibility | ≥ 90 |
| PWA | All green |

### Key metrics to check
| Metric | Target | Notes |
|--------|--------|-------|
| LCP | < 2.5s | Largest Contentful Paint — the main hero element |
| CLS | < 0.1 | Cumulative Layout Shift — already 0.002 in dev, should stay |
| INP | < 200ms | Interaction to Next Paint — replaces FID |
| TBT | < 200ms | Total Blocking Time — was 170ms in dev, should be lower in prod |

### PWA checks — should all be green in production
- Installable: manifest valid, icons present, HTTPS (localhost counts)
- Service worker registered and active
- Splash screen configured
- Themed address bar

### Accessibility — known gap still to watch
All 5 a11y failures from the dev report have been fixed in code. Verify they don't reappear. The score should be ≥ 90.

---

## Step 6 — If performance is still below 90

Paste the JSON report into the project (replace `lighthouse-reports/lighthouse-localhost-report.json`) and tell Claude. The most likely remaining culprits on a production build:

1. **Large dependency chunks** — if any vendor chunk is > 300 KB uncompressed, it may need further splitting or a lighter alternative
2. **Unoptimised images** — if Cloudinary images are used in the initial render (avatar, exercise photos), they need `loading="lazy"` and correct `width`/`height` attributes to avoid LCP and CLS issues
3. **Render-blocking resources** — any synchronous scripts or stylesheets in `<head>` that delay first paint
4. **Time to First Byte** — if TTFB is high even on localhost preview, the backend may be slow to respond on cold start

---

## Step 7 — Save the report

After running, save the JSON:

1. In the Lighthouse panel, click the download icon (↓) next to the report title
2. Save as `lighthouse-production-report.json`
3. Drop it into `/workspace/lighthouse-reports/`

This gives a production baseline to compare against after future changes.
