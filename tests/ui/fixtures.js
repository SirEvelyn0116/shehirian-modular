// Playwright fixtures for the admin and public-site tests.
//  - Every test starts from an empty database and the fixture recipes.
//  - Requests to any host other than the local test server are blocked,
//    except the Netlify Identity widget, which is replaced by a fake.
//  - Browser console errors and uncaught page errors fail the test.
const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');
const { createSql } = require('../support/pg-sql');
const { testDatabaseUrl } = require('../support/db');

const FAKE_WIDGET = fs.readFileSync(path.join(__dirname, '..', 'support', 'fake-identity-widget.js'), 'utf8');

const USERS = {
  translator: { email: 'translator@example.test', roles: ['translator'], token: 'token-translator' },
  approver: { email: 'approver@example.test', roles: ['approver'], token: 'token-approver' },
  both: { email: 'both@example.test', roles: ['translator', 'approver'], token: 'token-both' },
};

let sharedSql = null;
function db() {
  if (!sharedSql) sharedSql = createSql(testDatabaseUrl());
  return sharedSql;
}

const test = base.test.extend({
  // Playwright requires an object pattern here even when no fixtures are used.
  // eslint-disable-next-line no-empty-pattern
  db: async ({}, use) => {
    await use(db());
  },

  github: async ({ request }, use) => {
    await use({ state: async () => (await request.get('/__test/github')).json() });
  },

  page: async ({ page, request, baseURL }, use) => {
    await request.post('/__test/reset');
    const origin = new URL(baseURL).origin;
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(origin)) return route.continue();
      if (url.startsWith('https://identity.netlify.com/')) {
        return route.fulfill({ contentType: 'application/javascript', body: FAKE_WIDGET });
      }
      return route.abort('blockedbyclient');
    });
    const errors = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      // Blocked third-party requests (fonts, etc.) are expected here.
      if (/ERR_BLOCKED_BY_CLIENT|net::ERR_FAILED/.test(text)) return;
      // The ops banner's Clover endpoint is deliberately unconfigured (503).
      if (/503/.test(text) && /Failed to load resource/.test(text)) return;
      errors.push(`console: ${text}`);
    });
    await use(page);
    base.expect(errors, 'browser console errors').toEqual([]);
  },

  // Opens the admin dashboard signed in as the given role and switches to
  // the Recipes view.
  openAdminAs: async ({ page }, use) => {
    await use(async (role) => {
      await page.addInitScript((identity) => {
        // Runs in the browser.
        globalThis.__TEST_IDENTITY__ = identity;
      }, USERS[role]);
      await page.goto('/admin/');
      await page.locator('#tab-recipes').click();
      return page;
    });
  },
});

// Inserts a pending edit as if a translator had saved it.
async function seedEdit(
  sql,
  {
    slug = 'fixture-lentil-soup',
    lang = 'fr',
    fieldPath = 'title',
    oldValue,
    newValue,
    editor = USERS.translator.email,
  },
) {
  const [row] = await sql`
    insert into edits (recipe_slug, lang, field_path, old_value, new_value, editor_email)
    values (${slug}, ${lang}, ${fieldPath}, ${oldValue}, ${newValue}, ${editor})
    returning *`;
  return row;
}

module.exports = { test, expect: base.expect, seedEdit, USERS };
