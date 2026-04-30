// ------------------------------------------------------------
// vite.config.ts — Vite build configuration with PWA support
//
// The VitePWA plugin handles all progressive web app requirements:
//   - Generates a manifest.json with app metadata and icons
//   - Creates a service worker that caches assets for offline use
//   - Enables "Add to Home Screen" prompts on iOS and Android
//   - Handles background sync when connectivity returns
// ------------------------------------------------------------

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      // 'autoUpdate' — the service worker updates silently in the background.
      // The user gets the latest version on their next page load without
      // any prompts or interruption.
      registerType: 'autoUpdate',

      // Include these file patterns in the service worker's precache.
      // Everything in the precache is available offline immediately.
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.png'],

      // Web App Manifest — defines how the app appears when installed
      // on a home screen (name, icon, colors, display mode).
      manifest: {
        name: 'Trainer App',
        short_name: 'Trainer',
        description: 'Professional fitness trainer — workout tracking and client management',

        // The URL opened when the user taps the home screen icon
        start_url: '/',

        // 'standalone' makes the app look like a native app:
        // no browser address bar, no navigation buttons
        display: 'standalone',

        // Theme color — affects the status bar on mobile
        theme_color: '#1a1a2e',

        // Background color shown while the app is loading
        background_color: '#1a1a2e',

        // Icons — multiple sizes are required for different devices.
        // Place these PNG files in public/icons/
        // Minimum required: 192x192 and 512x512
        icons: [
          {
            src: '/icons/icon-72x72.png',
            sizes: '72x72',
            type: 'image/png',
          },
          {
            src: '/icons/icon-96x96.png',
            sizes: '96x96',
            type: 'image/png',
          },
          {
            src: '/icons/icon-128x128.png',
            sizes: '128x128',
            type: 'image/png',
          },
          {
            src: '/icons/icon-144x144.png',
            sizes: '144x144',
            type: 'image/png',
          },
          {
            src: '/icons/icon-152x152.png',
            sizes: '152x152',
            type: 'image/png',
          },
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            // 'any maskable' — allows the OS to apply its own icon shape
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },

      // Workbox service worker configuration
      workbox: {
        // Cache these file patterns when the service worker installs
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        // Runtime caching strategies for different types of requests:
        //
        // Only cache reference data that is safe to serve offline:
        //   - exercises: exercise library (changes rarely, no PII)
        //   - body-parts: static taxonomy (never changes)
        //   - templates: workout blueprints (no PII)
        //
        // Explicitly NOT cached (sensitive or auth-bearing):
        //   - /auth/* — tokens and session data
        //   - /clients/* — PII (client roster, health data)
        //   - /sessions/* — training records
        //   - /snapshots/* — body measurements
        //   - /kpis/* — computed from health data
        //   - /reports/* — client-facing documents
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\/(exercises|body-parts|templates)(\?|\/|$)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-reference-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
          {
            // Cloudinary media — CacheFirst strategy:
            // Serve from cache first (images don't change), update in background
            urlPattern: /^https:\/\/res\.cloudinary\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cloudinary-media',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],

  resolve: {
    alias: {
      // '@/' maps to 'src/' for clean imports:
      // import { Button } from '@/components/Button'
      '@': path.resolve(__dirname, './src'),

      // Allow importing the shared package without worrying about paths
      '@trainer-app/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },

  server: {
    port: 5173,

    // Proxy API requests to the Fastify backend in development.
    // This avoids CORS issues during local development.
    // '/api/v1/clients' → 'http://localhost:3001/api/v1/clients'
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
