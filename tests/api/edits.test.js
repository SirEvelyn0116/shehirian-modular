// Translator side: saving, re-saving, listing and withdrawing edits.
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { useApiServer } = require('./helpers');

const ctx = useApiServer();

const save = (body, as = 'translator') => ctx.request('POST', '/api/edits', { as, body });

describe('POST /api/edits', () => {
  test('stores a pending edit attributed to the signed-in translator', async () => {
    const res = await save({
      recipeSlug: 'fixture-lentil-soup',
      lang: 'ar',
      fieldPath: 'ingredients[1]',
      refValue: '2 cups test water',
      oldValue: 'كوبان ماء',
      newValue: 'كوبان من الماء',
      editorEmail: 'someone-else@example.test', // must be ignored
    });
    assert.equal(res.status, 200, res.text);
    const rows = await ctx.rows('edits');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'pending');
    assert.equal(rows[0].field_path, 'ingredients[1]');
    assert.equal(rows[0].new_value, 'كوبان من الماء');
    assert.equal(rows[0].old_value, 'كوبان ماء');
    assert.equal(rows[0].editor_email, 'translator@example.test');
  });

  test('saving the same field again updates the one row instead of adding another', async () => {
    const base = { recipeSlug: 'fixture-lentil-soup', lang: 'fr', fieldPath: 'title' };
    await save({ ...base, newValue: 'Premier essai' });
    await save({ ...base, newValue: 'Deuxième essai' }, 'translator2');
    const rows = await ctx.rows('edits');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].new_value, 'Deuxième essai');
    assert.equal(rows[0].editor_email, 'translator2@example.test');
  });

  test('re-saving a rejected field makes it pending again and clears the rejection reason', async () => {
    const edit = await ctx.seedEdit({ status: 'rejected' });
    await ctx.sql`update edits set reject_reason = 'Too literal', resolved_by = 'approver@example.test' where id = ${edit.id}`;
    const res = await save({
      recipeSlug: edit.recipe_slug,
      lang: edit.lang,
      fieldPath: edit.field_path,
      newValue: 'Mieux',
    });
    assert.equal(res.status, 200);
    const [row] = await ctx.sql`select * from edits where id = ${edit.id}`;
    assert.equal(row.status, 'pending');
    assert.equal(row.reject_reason, null);
    assert.equal(row.resolved_by, null);
    assert.equal(row.new_value, 'Mieux');
  });

  for (const [name, body, message] of [
    [
      'English is not an editable target',
      { recipeSlug: 'fixture-pilaf', lang: 'en', fieldPath: 'title', newValue: 'x' },
      /lang must be one of/,
    ],
    [
      'an unknown language',
      { recipeSlug: 'fixture-pilaf', lang: 'de', fieldPath: 'title', newValue: 'x' },
      /lang must be one of/,
    ],
    ['a missing field path', { recipeSlug: 'fixture-pilaf', lang: 'fr', newValue: 'x' }, /required/],
    ['a non-string value', { recipeSlug: 'fixture-pilaf', lang: 'fr', fieldPath: 'title', newValue: 42 }, /required/],
  ]) {
    test(`rejects ${name} with 400`, async () => {
      const res = await save(body);
      assert.equal(res.status, 400);
      assert.match(res.json.error, message);
      assert.equal((await ctx.rows('edits')).length, 0);
    });
  }

  test('rejects a body that is not JSON with 400', async () => {
    const res = await ctx.request('POST', '/api/edits', { as: 'translator', body: '{not json' });
    assert.equal(res.status, 400);
  });
});

describe('GET /api/edits/mine', () => {
  test("returns my pending edits and everyone's rejections, but not other translators' pending edits or publish requests", async () => {
    const mine = await ctx.seedEdit({ fieldPath: 'title' });
    await ctx.seedEdit({ fieldPath: 'description', editor: 'translator2@example.test' });
    const rejected = await ctx.seedEdit({
      fieldPath: 'recipeYield',
      editor: 'translator2@example.test',
      status: 'rejected',
    });
    await ctx.seedEdit({
      lang: 'ar',
      fieldPath: 'published',
      oldValue: 'false',
      newValue: 'true',
      editor: 'approver@example.test',
    });
    await ctx.seedEdit({ fieldPath: 'recipeCuisine', status: 'approved' });

    const res = await ctx.request('GET', '/api/edits/mine', { as: 'translator' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.map((e) => e.id).sort(), [mine.id, rejected.id].sort());
  });
});

describe('DELETE /api/edits/:id', () => {
  test('withdraws my own pending edit', async () => {
    const edit = await ctx.seedEdit();
    const res = await ctx.request('DELETE', `/api/edits/${edit.id}`, { as: 'translator' });
    assert.equal(res.status, 200);
    assert.equal(res.json.id, edit.id);
    assert.equal((await ctx.rows('edits')).length, 0);
  });

  test("cannot delete another translator's edit", async () => {
    const edit = await ctx.seedEdit({ editor: 'translator2@example.test' });
    const res = await ctx.request('DELETE', `/api/edits/${edit.id}`, { as: 'translator' });
    assert.equal(res.status, 404);
    assert.equal((await ctx.rows('edits')).length, 1);
  });

  test('cannot delete an edit that has already been approved', async () => {
    const edit = await ctx.seedEdit({ status: 'approved' });
    const res = await ctx.request('DELETE', `/api/edits/${edit.id}`, { as: 'translator' });
    assert.equal(res.status, 404);
    const [row] = await ctx.sql`select status from edits where id = ${edit.id}`;
    assert.equal(row.status, 'approved');
  });
});
