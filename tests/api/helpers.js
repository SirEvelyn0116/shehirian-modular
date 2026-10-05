// Shared setup for the API suites: one test server per file, a clean
// database and a fresh copy of the fixture recipes before every test.
const { before, after, beforeEach } = require('node:test');
const { openTestDb, resetData, testDatabaseUrl } = require('../support/db');
const { createTestServer } = require('../support/server');
const fixture = require('../fixtures/all-recipes.json');
const { getFieldValue } = require('../../netlify/functions/_shared/fieldPath');

const TOKENS = {
  translator: 'token-translator',
  translator2: 'token-translator-2',
  approver: 'token-approver',
  both: 'token-both',
  noRoles: 'token-no-roles',
};

function freshFixture() {
  return JSON.parse(JSON.stringify(fixture));
}

function useApiServer() {
  const ctx = {};

  before(async () => {
    ctx.sql = await openTestDb();
    ctx.app = await createTestServer({ sql: ctx.sql, databaseUrl: testDatabaseUrl(), recipes: freshFixture() });
    ctx.services = ctx.app.services;
  });

  beforeEach(async () => {
    await resetData(ctx.sql);
    ctx.services.reset(freshFixture());
  });

  after(async () => {
    await ctx.app.close();
    await ctx.sql.end();
  });

  // as: a key of TOKENS, or null for an anonymous request.
  ctx.request = async (method, path, { as = null, body } = {}) => {
    const headers = {};
    if (as) headers.Authorization = `Bearer ${TOKENS[as]}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(ctx.app.baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      redirect: 'manual',
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, json, text, headers: res.headers };
  };

  // Inserts a pending edit directly, as if a translator had saved it.
  ctx.seedEdit = async ({
    slug = 'fixture-lentil-soup',
    lang = 'fr',
    fieldPath = 'title',
    oldValue,
    newValue = 'Nouveau titre',
    editor = 'translator@example.test',
    status = 'pending',
  } = {}) => {
    const recipe = fixture.recipes.find((r) => r.slug === slug);
    // Default old_value = the field's live value, as the editor would record it.
    const live = oldValue !== undefined ? oldValue : recipe ? getFieldValue(recipe, fieldPath, lang) : null;
    const [row] = await ctx.sql`
      insert into edits (recipe_slug, lang, field_path, ref_value, old_value, new_value, editor_email, status)
      values (${slug}, ${lang}, ${fieldPath}, null, ${live}, ${newValue}, ${editor}, ${status})
      returning *`;
    return row;
  };

  ctx.rows = (table) => ctx.sql.query(`select * from ${table} order by created_at`);

  return ctx;
}

module.exports = { useApiServer, TOKENS, fixture };
