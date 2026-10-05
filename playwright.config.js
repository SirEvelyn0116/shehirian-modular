// Browser tests: the admin tool (React bundle from recipes-app) and the
// public site, both served from the built dist/ by tests/support/ui-server.js,
// which also runs the real Netlify Function handlers against a local
// Postgres. Run `npm run build` first. See TESTING.md.
const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.UI_TEST_PORT || 4173);

module.exports = defineConfig({
  testDir: './tests/ui',
  // One shared database: run tests one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // No retries: a test that only passes on a second try is reported as a
  // failure, not hidden.
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node tests/support/ui-server.js',
    url: `http://127.0.0.1:${PORT}/__test/health`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    timeout: 30_000,
  },
});
