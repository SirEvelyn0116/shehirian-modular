const { defineConfig, devices } = require('@playwright/test');

// Separate config from the root playwright.config.js (which targets the
// deployed public multilingual site). This one targets the local
// dev:auth-stub server and shares a live external resource — the real
// Neon database — across tests, so it runs serially, not fullyParallel,
// to avoid one test's seed/cleanup racing another's.
//
// Run via `npm run test:phase4` (wraps `netlify dev:exec`, which injects
// DATABASE_URL — the DB-seeding helpers need it directly, not through the
// app). The target `dev:auth-stub*` server must already be running
// separately — this config does not start one. See TESTING.md.
module.exports = defineConfig({
  testDir: '.',
  timeout: 30 * 1000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8888',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
