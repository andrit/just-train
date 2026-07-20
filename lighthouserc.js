// Lighthouse CI config — used by the lhci step in .github/workflows/ci.yml
// Audits the production build served locally. Not a real-user test but catches
// regressions in performance, accessibility, and PWA manifest before merge.

module.exports = {
  ci: {
    collect: {
      // Build must already exist at apps/frontend/dist before this runs.
      // The CI workflow builds before this step.
      startServerCommand: 'npx serve apps/frontend/dist -p 4173 --single',
      startServerReadyPattern: 'Accepting connections',
      url: ['http://localhost:4173'],
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        'categories:performance':     ['warn',  { minScore: 0.9 }],
        'categories:accessibility':   ['error', { minScore: 0.9 }],
        'categories:best-practices':  ['warn',  { minScore: 0.9 }],
        'categories:seo':             ['warn',  { minScore: 0.9 }],
        // NOTE: the PWA category and its audits (categories:pwa,
        // installable-manifest, service-worker, etc.) were REMOVED in
        // Lighthouse 12 (bundled by @lhci/cli@0.14.x). Asserting on them errors
        // with "not a known audit". PWA/installability is no longer covered by
        // Lighthouse — if we want to guard the manifest/SW again, do it with a
        // dedicated check (e.g. a manifest-field validation script), not LHCI.
      },
    },
    upload: {
      // Uploads report to temporary public storage — link logged in CI output.
      // Switch to Lighthouse CI server or LHCI_GITHUB_APP_TOKEN for PR comments.
      target: 'temporary-public-storage',
    },
  },
}
