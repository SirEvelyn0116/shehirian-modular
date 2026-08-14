// Empty state. Precondition: this test assumes the `edits` table has zero
// pending rows overall, not just zero belonging to this test's own email —
// the empty-state message only renders when the real total is zero. Fine
// for a local dev database with no concurrent unrelated work in flight;
// not a safe assumption for a shared/CI database with real data in it.
//
// Requires approver access — run against `dev:auth-stub` (default) or
// `dev:auth-stub:approver`. See role-routing.spec.js's header for the
// stubbed-identity scope caveat.

const { test, expect } = require('@playwright/test');
const { cleanupTestEdits } = require('./db-helpers.js');

test.describe('Empty state', () => {
  test.beforeEach(async () => {
    await cleanupTestEdits(); // remove this suite's own leftovers, if any
  });

  test('renders the friendly message when there is nothing pending', async ({ page }) => {
    await page.goto('/admin/');
    const reviewTab = page.locator('.view-tab:has-text("Review")');
    if (await reviewTab.count() > 0) {
      await reviewTab.click();
    }
    await page.waitForSelector('.recipe-approval-view', { timeout: 10000 });

    await expect(page.locator('.chip-none')).toContainText('Nothing to approve right now');
  });
});
