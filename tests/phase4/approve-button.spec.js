// Approve button is inert — Phase 4 scope boundary. No commit, no deploy,
// no DB change should be possible from this screen; Phase 5 wires the
// real action.
//
// Requires approver access — run against `dev:auth-stub` (default) or
// `dev:auth-stub:approver`. See role-routing.spec.js's header for the
// stubbed-identity scope caveat.

const { test, expect } = require('@playwright/test');
const { seedEdit, getEdit, cleanupTestEdits } = require('./db-helpers.js');

test.describe('Approve & Deploy button', () => {
  let seededEdit;

  test.beforeEach(async () => {
    seededEdit = await seedEdit({ recipeSlug: 'royal-soup', fieldPath: 'title', newValue: 'INERT-BUTTON-TEST' });
  });

  test.afterEach(async () => {
    await cleanupTestEdits();
  });

  test('is disabled, and forcing a click causes no database change', async ({ page }) => {
    await page.goto('/admin/');
    const reviewTab = page.locator('.view-tab:has-text("Review")');
    if (await reviewTab.count() > 0) {
      await reviewTab.click();
    }
    await page.waitForSelector('.recipe-approval-view', { timeout: 10000 });

    const approveBtn = page.locator('.recipe-approval-approve-btn');
    await expect(approveBtn).toBeDisabled();
    await expect(approveBtn).toHaveAttribute('title', /Phase 5/);

    // Belt and suspenders on top of toBeDisabled(): force a click through
    // the disabled state and confirm it genuinely does nothing.
    await approveBtn.click({ force: true }).catch(() => {});

    const dbRow = await getEdit(seededEdit.id);
    expect(dbRow.status).toBe('pending');
  });
});
