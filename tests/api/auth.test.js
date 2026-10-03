// Role checks for every recipe-admin endpoint. Each case is a separate
// request through the netlify.toml route table, and every refused write is
// followed by a check that nothing was written to the database or GitHub.
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { useApiServer } = require('./helpers');

const ctx = useApiServer();

const VALID_EDIT = { recipeSlug: 'fixture-lentil-soup', lang: 'fr', fieldPath: 'title', newValue: 'X' };

// [method, path, body-or-fn, roles allowed]
const ENDPOINTS = [
  ['GET', '/api/recipes', undefined, ['translator', 'approver', 'both']],
  ['GET', '/api/recipes/fixture-lentil-soup', undefined, ['translator', 'both']],
  ['GET', '/api/edits/mine', undefined, ['translator', 'both']],
  ['POST', '/api/edits', VALID_EDIT, ['translator', 'both']],
  ['DELETE', '/api/edits/__EDIT_ID__', undefined, ['translator', 'both']],
  ['GET', '/api/recipes/preview', undefined, ['approver', 'both']],
  ['POST', '/api/recipes/approve', { editIds: ['__EDIT_ID__'], confirmed: true }, ['approver', 'both']],
  ['POST', '/api/recipes/reject', { editIds: ['__EDIT_ID__'] }, ['approver', 'both']],
  ['POST', '/api/recipes/publish', { recipeSlug: 'fixture-pilaf', lang: 'fr', published: true }, ['approver', 'both']],
  ['GET', '/api/ops/clover-sales', undefined, ['approver', 'both']],
];

const CALLERS = [
  [null, 401],
  ['noRoles', 403],
  ['translator', null],
  ['approver', null],
];

async function snapshot() {
  const edits = await ctx.sql`select id, status, new_value from edits order by id`;
  const log = await ctx.sql`select id from edit_log`;
  return { edits, log: log.length, commits: ctx.services.state.commits.length, hooks: ctx.services.state.buildHooks };
}

describe('role checks', () => {
  for (const [method, rawPath, rawBody, allowed] of ENDPOINTS) {
    for (const [caller, expectStatus] of CALLERS) {
      const denied = caller === null || !allowed.includes(caller);
      if (!denied) continue;
      const expected = expectStatus || 403;
      test(`${method} ${rawPath.replace('__EDIT_ID__', ':id')} as ${caller || 'anonymous'} -> ${expected}, nothing written`, async () => {
        // The edit the translator owns, so DELETE/approve/reject have a real target.
        const edit = await ctx.seedEdit();
        const path = rawPath.replace('__EDIT_ID__', edit.id);
        const body = rawBody && JSON.parse(JSON.stringify(rawBody).replace('__EDIT_ID__', edit.id));
        const before = await snapshot();

        const res = await ctx.request(method, path, { as: caller, body });

        assert.equal(res.status, expected, res.text);
        assert.ok(res.json && typeof res.json.error === 'string', 'error message in body');
        assert.deepEqual(await snapshot(), before, 'database and GitHub unchanged');
      });
    }
  }

  test('a translator cannot approve: the edit stays pending, no commit, no deploy', async () => {
    const edit = await ctx.seedEdit();
    const res = await ctx.request('POST', '/api/recipes/approve', {
      as: 'translator',
      body: { editIds: [edit.id], confirmed: true },
    });
    assert.equal(res.status, 403);
    const [row] = await ctx.sql`select status from edits where id = ${edit.id}`;
    assert.equal(row.status, 'pending');
    assert.equal(ctx.services.state.commits.length, 0);
    assert.equal(ctx.services.state.buildHooks, 0);
  });

  test('a translator cannot queue a publish request', async () => {
    const res = await ctx.request('POST', '/api/recipes/publish', {
      as: 'translator',
      body: { recipeSlug: 'fixture-pilaf', lang: 'fr', published: true },
    });
    assert.equal(res.status, 403);
    assert.equal((await ctx.rows('edits')).length, 0);
  });

  test('an approver-only account cannot submit or delete translations', async () => {
    const create = await ctx.request('POST', '/api/edits', { as: 'approver', body: VALID_EDIT });
    assert.equal(create.status, 403);
    const edit = await ctx.seedEdit();
    const del = await ctx.request('DELETE', `/api/edits/${edit.id}`, { as: 'approver' });
    assert.equal(del.status, 403);
    assert.equal((await ctx.rows('edits')).length, 1);
  });

  test('an unknown bearer token is treated as anonymous', async () => {
    const res = await fetch(`${ctx.app.baseUrl}/api/recipes`, { headers: { Authorization: 'Bearer forged' } });
    assert.equal(res.status, 401);
  });

  test('an account with both roles can use both sides', async () => {
    const created = await ctx.request('POST', '/api/edits', { as: 'both', body: VALID_EDIT });
    assert.equal(created.status, 200);
    const preview = await ctx.request('GET', '/api/recipes/preview', { as: 'both' });
    assert.equal(preview.status, 200);
    assert.equal(preview.json.totalChanges, 1);
  });
});
