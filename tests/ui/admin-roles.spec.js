// What each role sees in the Recipes admin.
const { test, expect } = require('./fixtures');

test('translator: recipe list with editing guidance, read-only publish pills, no Review tab', async ({
  openAdminAs,
}) => {
  const page = await openAdminAs('translator');
  await expect(page.locator('#dashboard-role-badge')).toHaveText(' — Translator view');
  await expect(page.locator('.recipe-list-total')).toContainText('2 recipes');
  await expect(page.locator('.recipes-workflow-steps')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Expand all' }).click();
  await expect(page.locator('button.recipe-picker-item')).toHaveCount(2);
  await expect(page.locator('button.publish-pill')).toHaveCount(0);
  await expect(page.locator('span.publish-pill')).toHaveCount(8);
});

test('approver: Publish and Review tabs, clickable pills, recipes not openable for editing', async ({
  openAdminAs,
}) => {
  const page = await openAdminAs('approver');
  await expect(page.locator('#dashboard-role-badge')).toHaveText(' — Approver view');
  await expect(page.locator('.recipes-mode-tabs .view-tab')).toHaveText(['Publish', 'Review']);
  await expect(page.locator('.recipes-workflow-steps')).toHaveCount(0);
  await page.getByRole('button', { name: 'Expand all' }).click();
  await expect(page.locator('button.publish-pill')).toHaveCount(8);
  await expect(page.locator('button.recipe-picker-item')).toHaveCount(0);
  await expect(page.locator('.recipe-picker-item-static')).toHaveCount(2);
});

test('translator and approver: Translate and Review tabs', async ({ openAdminAs }) => {
  const page = await openAdminAs('both');
  await expect(page.locator('#dashboard-role-badge')).toHaveText(' — Translator & Approver view');
  await expect(page.locator('.recipes-mode-tabs .view-tab')).toHaveText(['Translate', 'Review']);
});

test('the list shows publish status per language from the recipe data', async ({ openAdminAs }) => {
  const page = await openAdminAs('translator');
  await page.getByRole('button', { name: 'Expand all' }).click();
  const soup = page.locator('.recipe-picker-row', { hasText: 'Fixture Lentil Soup' });
  await expect(soup.locator('.publish-pill-on')).toHaveText(['en', 'fr']);
  await expect(soup.locator('.publish-pill-off')).toHaveText(['ar', 'hy']);
});
