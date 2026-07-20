#!/usr/bin/env node
// ------------------------------------------------------------
// scripts/validate-manifest.mjs
//
// Validates the built PWA manifest has the fields required for installability.
// Replaces Lighthouse's `installable-manifest` audit, which was removed in
// Lighthouse 12 (bundled by @lhci/cli@0.14.x). Run after `vite build` — the
// manifest is emitted to apps/frontend/dist/.
//
// Exit 1 (with a list of failures) if the manifest isn't installable; exit 0
// otherwise, printing recommended-field warnings. cwd-independent: the dist dir
// is resolved relative to this script.
// ------------------------------------------------------------

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const distDir   = resolve(scriptDir, '..', 'dist')

function findManifest() {
  for (const name of ['manifest.webmanifest', 'manifest.json']) {
    const p = join(distDir, name)
    if (existsSync(p)) return p
  }
  if (existsSync(distDir)) {
    const hit = readdirSync(distDir).find((f) => f.endsWith('.webmanifest'))
    if (hit) return join(distDir, hit)
  }
  return null
}

const manifestPath = findManifest()
if (!manifestPath) {
  console.error(`✘ No manifest found in ${distDir}. Did the build run (pnpm build)?`)
  process.exit(1)
}

let manifest
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
} catch (e) {
  console.error(`✘ Manifest is not valid JSON (${manifestPath}): ${e.message}`)
  process.exit(1)
}

const errors = []
const warnings = []

// --- required for installability ---
if (!manifest.name && !manifest.short_name) errors.push('missing "name" or "short_name"')
if (!manifest.start_url) errors.push('missing "start_url"')

const INSTALLABLE_DISPLAY = ['standalone', 'fullscreen', 'minimal-ui']
if (!INSTALLABLE_DISPLAY.includes(manifest.display)) {
  errors.push(`"display" must be one of ${INSTALLABLE_DISPLAY.join('/')}, got "${manifest.display ?? '(none)'}"`)
}

const icons = Array.isArray(manifest.icons) ? manifest.icons : []
const maxDim = (icon) => {
  const sizes = String(icon.sizes ?? '')
  if (sizes.includes('any')) return Infinity   // scalable (SVG)
  return sizes.split(/\s+/).reduce((m, s) => {
    const w = Number(s.split('x')[0])
    return Number.isFinite(w) ? Math.max(m, w) : m
  }, 0)
}
const dims = icons.map(maxDim)
if (icons.length === 0) errors.push('no "icons" defined')
else {
  if (!dims.some((d) => d >= 192)) errors.push('no icon >= 192px')
  if (!dims.some((d) => d >= 512)) errors.push('no icon >= 512px')
}

// --- recommended (warn only) ---
if (!manifest.theme_color) warnings.push('no "theme_color" (recommended)')
if (!manifest.background_color) warnings.push('no "background_color" (recommended)')
if (!icons.some((i) => String(i.purpose ?? '').includes('maskable'))) {
  warnings.push('no maskable icon (recommended for a clean install icon)')
}

console.log(`Manifest: ${manifestPath}`)
for (const w of warnings) console.warn(`  ⚠ ${w}`)

if (errors.length) {
  console.error('✘ Manifest failed installability checks:')
  for (const e of errors) console.error(`    - ${e}`)
  process.exit(1)
}

console.log('✓ Manifest OK — installable (name/short_name, start_url, display, icons ≥192 & ≥512)')
