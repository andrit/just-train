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
        'categories:pwa':             ['warn',  { minScore: 0.9 }],
        // Hard-block on manifest being present — catches SW config regressions
        'installable-manifest':       ['error', { minScore: 1 }],
      },
    },
    upload: {
      // Uploads report to temporary public storage — link logged in CI output.
      // Switch to Lighthouse CI server or LHCI_GITHUB_APP_TOKEN for PR comments.
      target: 'temporary-public-storage',
    },
  },
}
