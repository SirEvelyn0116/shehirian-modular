// Checkbox safety — the core non-destructive guarantee of the approval
// view. Prioritized per the Phase 4 polish request: these protect the
// promise that an approver can never, even accidentally, remove a
// translator's work from this screen.
//
// Requires approver access — run against `dev:auth-stub` (default, both
// roles) or `dev:auth-stub:approver`.
//
// IMPORTANT — scope: exercises the STUBBED identity (scripts/stub-
// identity.js), not real Netlify Identity JWT validation. See
// role-routing.spec.js's header for the full caveat; same applies here.

const { test, expect } = require('@playwright/test');
const { seedEdit, getEdit, cleanupTestEdits } = require('./db-helpers.js');

test.describe('Checkbox safety', () => {
  let seededEdit;

  test.beforeEach(async () => {
    seededEdit = await seedEdit({
      recipeSlug: 'royal-soup',
      fieldPath: 'title',
      oldValue: 'حساء ملكي',
      newValue: 'حساء ملكي PLAYWRIGHT-TEST',
    });
  });

  test.afterEach(async () => {
    await cleanupTestEdits();
  });

  async function gotoReview(page) {
    await page.goto('/admin/');
    // Dual-role stub needs an explicit click into Review; approver-only
    // stub lands there directly — handle both without knowing which is running.
    const reviewTab = page.locator('.view-tab:has-text("Review")');
    if (await reviewTab.count() > 0) {
      await reviewTab.click();
    }
    await page.waitForSelector('.recipe-approval-view', { timeout: 10000 });
  }

  test('checkbox is checked by default', async ({ page }) => {
    await gotoReview(page);
    const checkbox = page.locator('.recipe-approval-view input[type="checkbox"]').first();
    await expect(checkbox).toBeChecked();
  });

  test('unchecking decrements the selected count but leaves the edit visible', async ({ page }) => {
    await gotoReview(page);
    const approveBtn = page.locator('.recipe-approval-approve-btn');
    await expect(approveBtn).toContainText('(1 selected)');

    await page.locator('.recipe-approval-view input[type="checkbox"]').first().click();
    await expect(approveBtn).toContainText('(0 selected)');

    // Still rendered in the diff table — unchecking only removed it from
    // the local batch selection, nothing more.
    await expect(page.locator('.recipe-approval-view table')).toContainText('PLAYWRIGHT-TEST');
  });

  test('unchecking then reloading leaves the edit still pending in the database', async ({ page }) => {
    await gotoReview(page);
    await page.locator('.recipe-approval-view input[type="checkbox"]').first().click();
    await expect(page.locator('.recipe-approval-approve-btn')).toContainText('(0 selected)');

    await page.reload();
    // Dual-role stub resets to Translate on reload — navigate back to Review.
    const reviewTab = page.locator('.view-tab:has-text("Review")');
    if (await reviewTab.count() > 0) {
      await reviewTab.click();
    }
    await page.waitForSelector('.recipe-approval-view', { timeout: 10000 });

    // The edit is still there to select (checkbox defaults to checked
    // again — local selection state, not a persisted preference) AND is
    // still 'pending' in the real database. This is the actual proof:
    // unchecking never reached the API at all.
    await expect(page.locator('.recipe-approval-view table')).toContainText('PLAYWRIGHT-TEST');
    await expect(page.locator('.recipe-approval-view input[type="checkbox"]').first()).toBeChecked();

    const dbRow = await getEdit(seededEdit.id);
    expect(dbRow).toBeTruthy();
    expect(dbRow.status).toBe('pending');
  });

  test('no approver-side delete/reject/discard control exists in the DOM', async ({ page }) => {
    await gotoReview(page);
    const destructiveControls = page.locator(
      '.recipe-approval-view button:has-text("Delete"), ' +
      '.recipe-approval-view button:has-text("Reject"), ' +
      '.recipe-approval-view button:has-text("Discard"), ' +
      '.recipe-approval-view [class*="delete"], ' +
      '.recipe-approval-view [class*="reject"], ' +
      '.recipe-approval-view [class*="discard"]'
    );
    await expect(destructiveControls).toHaveCount(0);
  });
});
