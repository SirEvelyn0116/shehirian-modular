// Translator editing screen: edit a field, preview it, save it.
const { test, expect, seedEdit } = require('./fixtures');

async function openRecipe(page, title) {
  await page.getByRole('button', { name: 'Expand all' }).click();
  await page.locator('button.recipe-picker-item', { hasText: title }).click();
  await expect(page.locator('.recipe-replica-columns')).toBeVisible();
}

// The editable (right-hand) column.
const editable = (page) => page.locator('.recipe-replica-column-wrap .recipe-replica-column');

test('editing a field and saving stores a pending edit for the selected language', async ({ openAdminAs, db }) => {
  const page = await openAdminAs('translator');
  await openRecipe(page, 'Fixture Lentil Soup');

  // Arabic is the default target language.
  await expect(page.locator('.recipe-replica-lang-tabs .view-tab.active')).toHaveText('Arabic');
  const firstIngredient = editable(page).locator('.recipe-replica-section li .editable-field').first();
  await expect(firstIngredient).toHaveText('كوب عدس');
  await firstIngredient.click();
  await page.locator('.editable-field-input').fill('كوب من العدس الأحمر');
  await page.keyboard.press('Enter');
  await expect(editable(page).locator('.editable-field-dirty')).toHaveCount(1);

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.pending-count-badge')).toHaveText('1 pending edit');
  await expect(editable(page).locator('.editable-field-pending')).toHaveText('كوب من العدس الأحمر');

  const rows = await db`select * from edits`;
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    recipe_slug: 'fixture-lentil-soup',
    lang: 'ar',
    field_path: 'ingredients[0]',
    old_value: 'كوب عدس',
    ref_value: '1 cup test lentils',
    new_value: 'كوب من العدس الأحمر',
    editor_email: 'translator@example.test',
    status: 'pending',
  });
});

test('the Arabic column is right-to-left and the others left-to-right', async ({ openAdminAs }) => {
  const page = await openAdminAs('translator');
  await openRecipe(page, 'Fixture Lentil Soup');
  await expect(editable(page)).toHaveAttribute('dir', 'rtl');
  await page.locator('.recipe-replica-lang-tabs .view-tab', { hasText: 'French' }).click();
  await expect(editable(page)).toHaveAttribute('dir', 'ltr');
  await expect(editable(page).locator('.recipe-replica-title .editable-field')).toHaveText('Soupe test aux lentilles');
});

test('Escape cancels an edit without marking it unsaved', async ({ openAdminAs, db }) => {
  const page = await openAdminAs('translator');
  await openRecipe(page, 'Fixture Pilaf');
  await editable(page).locator('.recipe-replica-title .editable-field').click();
  await page.locator('.editable-field-input').fill('غير محفوظ');
  await page.keyboard.press('Escape');
  await expect(editable(page).locator('.recipe-replica-title .editable-field')).toHaveText('برغل تجريبي');
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(await db`select * from edits`).toHaveLength(0);
});

test('Preview renders the unsaved change in the recipe page layout', async ({ openAdminAs, db }) => {
  const page = await openAdminAs('translator');
  await openRecipe(page, 'Fixture Pilaf');
  await page.locator('.recipe-replica-lang-tabs .view-tab', { hasText: 'French' }).click();
  await editable(page).locator('.recipe-replica-title .editable-field').click();
  await page.locator('.editable-field-input').fill('Pilaf du jour');
  await page.keyboard.press('Enter');

  await page.locator('.recipe-replica-modes .view-tab', { hasText: 'Preview' }).click();
  const frame = page.frameLocator('.recipe-replica-preview iframe');
  await expect(frame.locator('h1')).toHaveText('Pilaf du jour');
  await expect(frame.locator('html')).toHaveAttribute('lang', 'fr');
  expect(await db`select * from edits`, 'preview does not save').toHaveLength(0);
});

test("an approver's rejection is shown under the field with the reason and the rejected wording", async ({
  openAdminAs,
  db,
}) => {
  const edit = await seedEdit(db, {
    lang: 'ar',
    fieldPath: 'title',
    oldValue: 'شوربة عدس تجريبية',
    newValue: 'صيغة مرفوضة',
  });
  await db`update edits set status = 'rejected', reject_reason = 'Use the family wording', resolved_by = 'approver@example.test' where id = ${edit.id}`;

  const page = await openAdminAs('translator');
  await page.getByRole('button', { name: 'Expand all' }).click();
  await expect(
    page.locator('.recipe-picker-row', { hasText: 'Fixture Lentil Soup' }).locator('.recipe-picker-rejected-badge'),
  ).toHaveText('1 rejected');

  await page.locator('button.recipe-picker-item', { hasText: 'Fixture Lentil Soup' }).click();
  const note = editable(page).locator('.editable-field-rejection');
  await expect(note).toContainText('Rejected by approver@example.test:');
  await expect(note).toContainText('Use the family wording');
  await expect(note).toContainText('صيغة مرفوضة');
  await expect(page.locator('.rejected-count-badge')).toHaveText('1 rejected');
  // The field itself still shows the live value.
  await expect(editable(page).locator('.recipe-replica-title .editable-field')).toHaveText('شوربة عدس تجريبية');
});
