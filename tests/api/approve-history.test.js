// Approving a value that already appears in the audit log's history must
// still commit it. Regression tests for a bug where the approve action's
// "already shipped?" check matched any past edit_log row with the same
// recipe/lang/field/value -- including rejections (which have no commit) and
// older approvals -- and so marked the edit approved without committing it.
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { useApiServer } = require('./helpers');

const ctx = useApiServer();

const approveAll = async () => {
  const pending = await ctx.sql`select id from edits where status = 'pending'`;
  return ctx.request('POST', '/api/recipes/approve', {
    as: 'approver',
    body: { editIds: pending.map((e) => e.id), confirmed: true },
  });
};
const committedRecipe = (slug) => JSON.parse(ctx.services.state.content).recipes.find((r) => r.slug === slug);
const saveTitle = (value) =>
  ctx.request('POST', '/api/edits', {
    as: 'translator',
    body: {
      recipeSlug: 'fixture-pilaf',
      lang: 'fr',
      fieldPath: 'title',
      oldValue: committedRecipe('fixture-pilaf').title.fr,
      newValue: value,
    },
  });

describe('approving a value with history in the audit log', () => {
  test('a rejected translation, resubmitted unchanged and approved, is committed', async () => {
    await saveTitle('Pilaf aux vermicelles');
    const [edit] = await ctx.sql`select id from edits`;
    const rej = await ctx.request('POST', '/api/recipes/reject', { as: 'approver', body: { editIds: [edit.id] } });
    assert.equal(rej.json.totalRejected, 1);

    await saveTitle('Pilaf aux vermicelles');
    const res = await approveAll();

    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.committed, true, JSON.stringify(res.json));
    assert.equal(ctx.services.state.commits.length, 1);
    assert.equal(committedRecipe('fixture-pilaf').title.fr, 'Pilaf aux vermicelles');
    assert.equal(ctx.services.state.buildHooks, 1);
  });

  test('a rejected publish request, queued again and approved, is committed', async () => {
    const queue = () =>
      ctx.request('POST', '/api/recipes/publish', {
        as: 'approver',
        body: { recipeSlug: 'fixture-pilaf', lang: 'fr', published: true },
      });
    await queue();
    const [edit] = await ctx.sql`select id from edits`;
    await ctx.request('POST', '/api/recipes/reject', {
      as: 'approver',
      body: { editIds: [edit.id], reason: 'not yet' },
    });

    await queue();
    const res = await approveAll();

    assert.equal(res.json.committed, true, JSON.stringify(res.json));
    assert.equal(committedRecipe('fixture-pilaf').published.fr, true);
  });

  test('publish, unpublish, publish again: every approval is committed', async () => {
    for (const published of [true, false, true]) {
      await ctx.request('POST', '/api/recipes/publish', {
        as: 'approver',
        body: { recipeSlug: 'fixture-pilaf', lang: 'fr', published },
      });
      const res = await approveAll();
      assert.equal(res.json.committed, true, `published=${published}: ${JSON.stringify(res.json)}`);
      assert.equal(committedRecipe('fixture-pilaf').published.fr, published);
    }
    assert.equal(ctx.services.state.commits.length, 3);
  });

  test('changing a field back to an earlier approved value is committed', async () => {
    const original = committedRecipe('fixture-pilaf').title.fr;
    for (const value of ['Version B', original, 'Version B']) {
      await saveTitle(value);
      const res = await approveAll();
      assert.equal(res.json.committed, true, `${value}: ${JSON.stringify(res.json)}`);
      assert.equal(committedRecipe('fixture-pilaf').title.fr, value);
    }
    assert.equal(ctx.services.state.commits.length, 3);
  });

  test('still no second commit when this exact save was already committed and logged (crash recovery)', async () => {
    const edit = await ctx.seedEdit({ newValue: 'Déjà livré' });
    // Simulate an earlier approve call that committed and logged this save,
    // then crashed before flipping the edit's status.
    const data = ctx.services.currentRecipes();
    data.recipes[0].title.fr = 'Déjà livré';
    ctx.services.setRecipes(data);
    await ctx.sql`
      insert into edit_log (recipe_slug, lang, field_path, old_value, new_value, action, editor_email, resolved_by, commit_sha)
      values (${edit.recipe_slug}, ${edit.lang}, ${edit.field_path}, ${edit.old_value}, ${edit.new_value}, 'approved',
              ${edit.editor_email}, 'approver@example.test', 'earlier-commit-sha')`;

    const res = await approveAll();

    assert.equal(res.json.committed, false);
    assert.equal(ctx.services.state.commits.length, 0);
    const [row] = await ctx.sql`select status from edits where id = ${edit.id}`;
    assert.equal(row.status, 'approved');
    const logs = await ctx.rows('edit_log');
    assert.equal(logs.length, 1, 'no duplicate audit row');
  });
});
