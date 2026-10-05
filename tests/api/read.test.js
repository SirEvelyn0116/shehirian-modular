// Read endpoints: the recipe list, the recipe editor's detail fetch and the
// approver's review (preview) payload.
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { useApiServer } = require('./helpers');

const ctx = useApiServer();

describe('GET /api/recipes', () => {
  test('lists every recipe with per-language publish status and pending/rejected counts', async () => {
    await ctx.seedEdit({ slug: 'fixture-lentil-soup', fieldPath: 'title' });
    await ctx.seedEdit({ slug: 'fixture-lentil-soup', fieldPath: 'description' });
    await ctx.seedEdit({ slug: 'fixture-lentil-soup', fieldPath: 'recipeYield', status: 'rejected' });
    await ctx.seedEdit({
      slug: 'fixture-pilaf',
      lang: 'fr',
      fieldPath: 'published',
      oldValue: 'false',
      newValue: 'true',
    });

    const res = await ctx.request('GET', '/api/recipes', { as: 'translator' });
    assert.equal(res.status, 200);
    const bySlug = Object.fromEntries(res.json.map((r) => [r.slug, r]));
    assert.deepEqual(Object.keys(bySlug).sort(), ['fixture-lentil-soup', 'fixture-pilaf']);

    const soup = bySlug['fixture-lentil-soup'];
    assert.equal(soup.title, 'Fixture Lentil Soup');
    assert.equal(soup.pendingCount, 2);
    assert.equal(soup.rejectedCount, 1);
    assert.deepEqual(soup.published, { en: true, fr: true, ar: false, hy: false });

    const pilaf = bySlug['fixture-pilaf'];
    assert.equal(pilaf.pendingCount, 0, 'a publish request is not a translation edit');
    assert.deepEqual(pilaf.pendingPublish, { fr: true });
  });

  test('a recipe with no published object reads as unpublished everywhere', async () => {
    const data = ctx.services.currentRecipes();
    delete data.recipes[1].published;
    ctx.services.setRecipes(data);
    const res = await ctx.request('GET', '/api/recipes', { as: 'approver' });
    const pilaf = res.json.find((r) => r.slug === 'fixture-pilaf');
    assert.deepEqual(pilaf.published, { en: false, fr: false, ar: false, hy: false });
  });
});

describe('GET /api/recipes/:slug', () => {
  test('returns the full recipe from the committed JSON', async () => {
    const res = await ctx.request('GET', '/api/recipes/fixture-pilaf', { as: 'translator' });
    assert.equal(res.status, 200);
    assert.equal(res.json.slug, 'fixture-pilaf');
    assert.deepEqual(res.json.ingredients.ar, ['كوب حبوب']);
  });

  test('404s for an unknown recipe', async () => {
    const res = await ctx.request('GET', '/api/recipes/no-such-recipe', { as: 'translator' });
    assert.equal(res.status, 404);
  });
});

describe('GET /api/recipes/preview', () => {
  test('groups pending edits by recipe and shows the live value as "old", not the stored snapshot', async () => {
    await ctx.seedEdit({
      slug: 'fixture-lentil-soup',
      lang: 'fr',
      fieldPath: 'title',
      oldValue: 'stale snapshot',
      newValue: 'Soupe corrigée',
    });
    await ctx.seedEdit({
      slug: 'fixture-lentil-soup',
      lang: 'ar',
      fieldPath: 'instructions[0]',
      newValue: 'اغسل العدس جيداً.',
    });
    await ctx.seedEdit({
      slug: 'fixture-pilaf',
      lang: 'hy',
      fieldPath: 'published',
      oldValue: 'false',
      newValue: 'true',
    });
    await ctx.seedEdit({ slug: 'fixture-pilaf', lang: 'fr', fieldPath: 'description', status: 'approved' });

    const res = await ctx.request('GET', '/api/recipes/preview', { as: 'approver' });
    assert.equal(res.status, 200);
    assert.equal(res.json.totalChanges, 3);
    assert.equal(res.json.publishRequests, 1);
    assert.deepEqual(res.json.changesByLang, { en: 0, fr: 1, ar: 1, hy: 1 });
    assert.deepEqual(
      res.json.recipes.map((g) => g.slug),
      ['fixture-lentil-soup', 'fixture-pilaf'],
    );

    const soupEdits = res.json.recipes[0].edits;
    const title = soupEdits.find((e) => e.fieldPath === 'title');
    assert.equal(title.oldValue, 'Soupe test aux lentilles');
    assert.equal(title.newValue, 'Soupe corrigée');
    const step = soupEdits.find((e) => e.fieldPath === 'instructions[0]');
    assert.equal(step.oldValue, 'اغسل العدس.');

    const publish = res.json.recipes[1].edits[0];
    assert.equal(publish.fieldPath, 'published');
    assert.equal(publish.oldValue, 'false');
  });

  test('skips edits whose recipe no longer exists', async () => {
    await ctx.seedEdit({ slug: 'fixture-pilaf', fieldPath: 'title' });
    await ctx.sql`insert into edits (recipe_slug, lang, field_path, new_value, editor_email) values ('deleted-recipe', 'fr', 'title', 'x', 'translator@example.test')`;
    const res = await ctx.request('GET', '/api/recipes/preview', { as: 'approver' });
    assert.equal(res.json.totalChanges, 1);
    assert.deepEqual(
      res.json.recipes.map((g) => g.slug),
      ['fixture-pilaf'],
    );
  });
});
