// netlify.toml route table and schema file: static checks that need no server.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadRedirects, resolve } = require('../support/routes');
const { splitSchema } = require('../../db/splitSchema');

const ROOT = path.resolve(__dirname, '..', '..');
const FUNCTIONS = fs
  .readdirSync(path.join(ROOT, 'netlify', 'functions'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => path.basename(f, '.js'));

const redirects = loadRedirects();

test('every function a redirect points at exists in netlify/functions', () => {
  for (const r of redirects) {
    const m = r.to.match(/^\/\.netlify\/functions\/(.+)$/);
    if (m) assert.ok(FUNCTIONS.includes(m[1]), `${r.from} -> missing function ${m[1]}`);
  }
});

// Exact paths must be listed before the wildcard rules that would otherwise
// swallow them (a mistake this file's comments record happening before).
for (const [requestPath, fn] of [
  ['/api/recipes', 'recipes-list'],
  ['/api/recipes/preview', 'recipes-preview'],
  ['/api/recipes/approve', 'recipes-approve'],
  ['/api/recipes/publish', 'recipes-publish'],
  ['/api/recipes/reject', 'edits-reject'],
  ['/api/recipes/some-recipe-slug', 'recipe-detail'],
  ['/api/edits', 'edit-create'],
  ['/api/edits/mine', 'edits-mine'],
  ['/api/edits/5f0c', 'edit-delete'],
  ['/api/ops/clover-sales', 'clover-sales'],
]) {
  test(`${requestPath} is routed to ${fn}`, () => {
    assert.deepEqual(resolve(redirects, requestPath), { type: 'function', name: fn });
  });
}

test('old certification URLs redirect permanently to the language home page', () => {
  assert.deepEqual(resolve(redirects, '/fr/certifications/brc.html'), {
    type: 'redirect',
    status: 301,
    location: '/fr/index.html',
  });
});

test('schema.sql splits into complete statements (no ";" inside a comment)', () => {
  const statements = splitSchema(fs.readFileSync(path.join(ROOT, 'db', 'schema.sql'), 'utf8'));
  assert.ok(statements.length >= 8);
  for (const s of statements) {
    assert.match(s, /^(create|alter)\s/i, `statement does not start with create/alter: ${s.slice(0, 60)}`);
    const opens = (s.match(/\(/g) || []).length;
    const closes = (s.match(/\)/g) || []).length;
    assert.equal(opens, closes, `unbalanced parentheses in: ${s.slice(0, 60)}`);
  }
});
