// Publish requests (queued, never committed directly) and rejections.
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { useApiServer } = require('./helpers');

const ctx = useApiServer();

const publish = (body, as = 'approver') => ctx.request('POST', '/api/recipes/publish', { as, body });
const reject = (body, as = 'approver') => ctx.request('POST', '/api/recipes/reject', { as, body });

describe('POST /api/recipes/publish', () => {
  test('queues a publish request without committing or deploying anything', async () => {
    const res = await publish({ recipeSlug: 'fixture-pilaf', lang: 'fr', published: true });

    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.queued, true);
    assert.equal(res.json.published, false, 'live value unchanged');
    assert.equal(res.json.pendingPublish, true);
    const [row] = await ctx.rows('edits');
    assert.equal(row.field_path, 'published');
    assert.equal(row.old_value, 'false');
    assert.equal(row.new_value, 'true');
    assert.equal(row.status, 'pending');
    assert.equal(row.editor_email, 'approver@example.test');
    assert.equal(ctx.services.state.commits.length, 0);
    assert.equal(ctx.services.state.buildHooks, 0);
  });

  test('setting the pill back to its live value withdraws the queued request', async () => {
    await publish({ recipeSlug: 'fixture-pilaf', lang: 'fr', published: true });
    const res = await publish({ recipeSlug: 'fixture-pilaf', lang: 'fr', published: false });
    assert.equal(res.json.queued, false);
    assert.equal(res.json.cancelled, true);
    assert.equal((await ctx.rows('edits')).length, 0);
  });

  test('can queue an unpublish of a live language', async () => {
    const res = await publish({ recipeSlug: 'fixture-lentil-soup', lang: 'en', published: false });
    assert.equal(res.json.queued, true);
    const [row] = await ctx.rows('edits');
    assert.deepEqual([row.lang, row.old_value, row.new_value], ['en', 'true', 'false']);
  });

  for (const [name, body, status] of [
    ['an unknown recipe', { recipeSlug: 'nope', lang: 'fr', published: true }, 404],
    ['an unknown language', { recipeSlug: 'fixture-pilaf', lang: 'xx', published: true }, 400],
    ['a non-boolean flag', { recipeSlug: 'fixture-pilaf', lang: 'fr', published: 'yes' }, 400],
    ['a missing slug', { lang: 'fr', published: true }, 400],
  ]) {
    test(`rejects ${name} with ${status}`, async () => {
      const res = await publish(body);
      assert.equal(res.status, status);
      assert.equal((await ctx.rows('edits')).length, 0);
    });
  }
});

describe('POST /api/recipes/reject', () => {
  test('marks the edits rejected with the reason and logs it, without touching GitHub', async () => {
    const a = await ctx.seedEdit({ fieldPath: 'title' });
    const b = await ctx.seedEdit({ fieldPath: 'description' });

    const res = await reject({ editIds: [a.id, b.id], reason: '  Use the family spelling  ' });

    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.totalRejected, 2);
    const rows = await ctx.sql`select status, reject_reason, resolved_by from edits`;
    assert.ok(rows.every((r) => r.status === 'rejected'));
    assert.ok(
      rows.every((r) => r.reject_reason === 'Use the family spelling'),
      'reason is trimmed',
    );
    assert.ok(rows.every((r) => r.resolved_by === 'approver@example.test'));
    const log = await ctx.rows('edit_log');
    assert.equal(log.length, 2);
    assert.ok(
      log.every((l) => l.action === 'rejected' && l.commit_sha === null && l.note === 'Use the family spelling'),
    );
    assert.equal(ctx.services.state.commits.length, 0);
    assert.equal(ctx.services.state.buildHooks, 0);
  });

  test('a rejected edit is kept, not deleted, and the translator can see it', async () => {
    const edit = await ctx.seedEdit();
    await reject({ editIds: [edit.id] });
    const mine = await ctx.request('GET', '/api/edits/mine', { as: 'translator' });
    assert.equal(mine.json.length, 1);
    assert.equal(mine.json[0].id, edit.id);
    assert.equal(mine.json[0].status, 'rejected');
    assert.equal(mine.json[0].reject_reason, null, 'reason is optional');
  });

  test('skips edits that are no longer pending', async () => {
    const approved = await ctx.seedEdit({ status: 'approved' });
    const res = await reject({ editIds: [approved.id] });
    assert.equal(res.json.totalRejected, 0);
    const [row] = await ctx.sql`select status from edits where id = ${approved.id}`;
    assert.equal(row.status, 'approved');
  });

  test('caps the reason at 500 characters', async () => {
    const edit = await ctx.seedEdit();
    await reject({ editIds: [edit.id], reason: 'x'.repeat(800) });
    const [row] = await ctx.sql`select reject_reason from edits where id = ${edit.id}`;
    assert.equal(row.reject_reason.length, 500);
  });

  for (const [name, body] of [
    ['a non-string reason', { editIds: ['00000000-0000-0000-0000-000000000000'], reason: 7 }],
    ['an empty id list', { editIds: [] }],
  ]) {
    test(`rejects ${name} with 400`, async () => {
      const res = await reject(body);
      assert.equal(res.status, 400);
    });
  }
});
