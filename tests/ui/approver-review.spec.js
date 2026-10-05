// Approver Review screen: approve (commit + deploy), select, cancel, reject,
// and queued publish requests.
const { test, expect, seedEdit } = require('./fixtures');

async function openReview(page) {
  await page.locator('.recipes-mode-tabs .view-tab', { hasText: 'Review' }).click();
  await expect(page.locator('.recipe-approval-view')).toBeVisible();
}

async function seedTwo(db) {
  const title = await seedEdit(db, {
    lang: 'fr',
    fieldPath: 'title',
    oldValue: 'Soupe test aux lentilles',
    newValue: 'Soupe aux lentilles',
  });
  const step = await seedEdit(db, {
    lang: 'ar',
    fieldPath: 'instructions[0]',
    oldValue: 'اغسل العدس.',
    newValue: 'اغسل العدس جيداً.',
  });
  return { title, step };
}

test('with nothing pending, Review says so and offers no actions', async ({ openAdminAs }) => {
  const page = await openAdminAs('approver');
  await openReview(page);
  await expect(page.locator('.chip-none')).toContainText('Nothing to approve right now');
  await expect(page.locator('.recipe-approval-approve-btn')).toHaveCount(0);
});

test('Review lists each pending edit with the live value and the proposed value', async ({ openAdminAs, db }) => {
  await seedTwo(db);
  const page = await openAdminAs('approver');
  await openReview(page);
  await expect(page.locator('.chip-total')).toContainText('2 changes');
  const rows = page.locator('.recipe-approval-view tbody tr');
  await expect(rows).toHaveCount(2);
  const titleRow = rows.filter({ hasText: 'title' });
  await expect(titleRow.locator('.val-old')).toHaveText('Soupe test aux lentilles');
  await expect(titleRow.locator('.val-new')).toHaveText('Soupe aux lentilles');
  await expect(titleRow.locator('.recipe-approval-editor')).toHaveText('translator@example.test');
  await expect(rows.filter({ hasText: 'instructions[0]' }).locator('td[dir="rtl"]')).toHaveCount(2);
});

test('approving commits every selected edit in one commit and triggers one deploy', async ({
  openAdminAs,
  db,
  github,
}) => {
  await seedTwo(db);
  const page = await openAdminAs('approver');
  await openReview(page);

  await page.getByRole('button', { name: /Approve & Deploy \(2 selected\)/ }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Confirm publish' });
  await expect(confirm).toContainText('publish 2 changes to the live site');
  await confirm.getByRole('button', { name: 'Yes, publish' }).click();

  await expect(page.locator('.recipe-approve-status')).toContainText('Committed');
  const gh = await github.state();
  expect(gh.commits).toHaveLength(1);
  expect(gh.buildHooks).toBe(1);
  const soup = JSON.parse(gh.commits[0].content).recipes.find((r) => r.slug === 'fixture-lentil-soup');
  expect(soup.title.fr).toBe('Soupe aux lentilles');
  expect(soup.instructions.ar[0]).toBe('اغسل العدس جيداً.');
  await expect(page.locator('.recipe-approve-status')).toContainText(gh.headSha.slice(0, 7));

  const statuses = await db`select status from edits`;
  expect(statuses.map((s) => s.status)).toEqual(['approved', 'approved']);
  await expect(page.locator('.chip-none')).toBeVisible();
});

test('an unticked edit is left out of the commit and stays pending', async ({ openAdminAs, db, github }) => {
  const { title, step } = await seedTwo(db);
  const page = await openAdminAs('approver');
  await openReview(page);

  await page.getByRole('checkbox', { name: 'Include fixture-lentil-soup ar instructions[0] in this batch' }).uncheck();
  await page.getByRole('button', { name: /Approve & Deploy \(1 selected\)/ }).click();
  await page
    .getByRole('alertdialog', { name: 'Confirm publish' })
    .getByRole('button', { name: 'Yes, publish' })
    .click();
  await expect(page.locator('.recipe-approve-status')).toContainText('Committed');

  const soup = JSON.parse((await github.state()).commits[0].content).recipes.find(
    (r) => r.slug === 'fixture-lentil-soup',
  );
  expect(soup.title.fr).toBe('Soupe aux lentilles');
  expect(soup.instructions.ar[0]).toBe('اغسل العدس.');
  const [t] = await db`select status from edits where id = ${title.id}`;
  const [s] = await db`select status from edits where id = ${step.id}`;
  expect([t.status, s.status]).toEqual(['approved', 'pending']);
  await expect(page.locator('.recipe-approval-view tbody tr')).toHaveCount(1);
});

test('cancelling at the confirm step commits nothing', async ({ openAdminAs, db, github }) => {
  await seedTwo(db);
  const page = await openAdminAs('approver');
  await openReview(page);
  await page.getByRole('button', { name: /Approve & Deploy/ }).click();
  await page.getByRole('alertdialog', { name: 'Confirm publish' }).getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect((await github.state()).commits).toHaveLength(0);
  const statuses = await db`select status from edits`;
  expect(statuses.every((s) => s.status === 'pending')).toBe(true);
});

test('the confirm step reports edits that conflict with a newer live value', async ({ openAdminAs, db }) => {
  await seedEdit(db, { lang: 'fr', fieldPath: 'title', oldValue: 'an older live value', newValue: 'Ma version' });
  const page = await openAdminAs('approver');
  await openReview(page);
  await page.getByRole('button', { name: /Approve & Deploy/ }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Confirm publish' });
  await expect(confirm).toContainText('1 conflicting edit will be skipped');
  await expect(confirm.getByRole('button', { name: 'Yes, publish' })).toBeDisabled();
});

test('rejecting with a reason removes the edit from Review without committing', async ({ openAdminAs, db, github }) => {
  const { title } = await seedTwo(db);
  const page = await openAdminAs('approver');
  await openReview(page);

  await page.getByRole('checkbox', { name: 'Reject fixture-lentil-soup fr title' }).check();
  await expect(page.getByRole('button', { name: /Approve & Deploy \(1 selected\)/ })).toBeVisible();
  await page.getByRole('button', { name: /Reject \(1 selected\)/ }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Confirm reject' });
  await confirm.getByRole('textbox').fill('Keep the family spelling');
  await confirm.getByRole('button', { name: 'Yes, reject' }).click();

  await expect(page.locator('.recipe-approve-result')).toContainText('Rejected 1 change');
  await expect(page.locator('.recipe-approval-view tbody tr')).toHaveCount(1);
  const [row] = await db`select status, reject_reason from edits where id = ${title.id}`;
  expect(row).toEqual({ status: 'rejected', reject_reason: 'Keep the family spelling' });
  expect((await github.state()).commits).toHaveLength(0);
});

test('a publish pill queues a request for Review instead of publishing, and a second click withdraws it', async ({
  openAdminAs,
  db,
  github,
}) => {
  const page = await openAdminAs('approver');
  await page.getByRole('button', { name: 'Expand all' }).click();
  const pilaf = page.locator('.recipe-picker-row', { hasText: 'Fixture Pilaf' });
  await pilaf.getByRole('button', { name: 'fr', exact: true }).click();

  await expect(pilaf.locator('.publish-pill-queued')).toHaveText('→fr');
  const [row] = await db`select field_path, old_value, new_value, status from edits`;
  expect(row).toEqual({ field_path: 'published', old_value: 'false', new_value: 'true', status: 'pending' });
  expect((await github.state()).commits).toHaveLength(0);

  await openReview(page);
  const reviewRow = page.locator('.recipe-approval-view tbody tr');
  await expect(reviewRow.locator('.key-cell')).toHaveText('Visibility');
  await expect(reviewRow.locator('.val-new')).toHaveText('Published');

  await page.locator('.recipes-mode-tabs .view-tab', { hasText: 'Publish' }).click();
  await page.locator('.recipe-picker-row', { hasText: 'Fixture Pilaf' }).getByRole('button', { name: '→fr' }).click();
  await expect(
    page.locator('.recipe-picker-row', { hasText: 'Fixture Pilaf' }).locator('.publish-pill-queued'),
  ).toHaveCount(0);
  expect(await db`select * from edits`).toHaveLength(0);
});
