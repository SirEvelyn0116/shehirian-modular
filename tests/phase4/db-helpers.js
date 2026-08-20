// Shared DB seed/cleanup for Phase 4 Playwright tests. Uses its own,
// distinct editor_email — separate from the auth-stub's own
// local-dev@example.com (scripts/stub-identity.js) — so automated test
// artifacts are never mixed with, or cleaned up by, manual dev-testing
// cleanup (npm run db:clean-test-edits targets local-dev@example.com only,
// and this file's cleanupTestEdits() is scoped independently).
const { neon } = require('@neondatabase/serverless');

const TEST_EMAIL = 'playwright-test@example.com';

function sql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set — run tests via `npm run test:phase4`, not `npx playwright test` directly.');
  }
  return neon(process.env.DATABASE_URL);
}

async function seedEdit({ recipeSlug, lang = 'ar', fieldPath, oldValue = 'old value', newValue = 'new value' }) {
  const db = sql();
  const [row] = await db`
    insert into edits (recipe_slug, lang, field_path, old_value, new_value, editor_email, status)
    values (${recipeSlug}, ${lang}, ${fieldPath}, ${oldValue}, ${newValue}, ${TEST_EMAIL}, 'pending')
    on conflict (recipe_slug, lang, field_path)
    do update set new_value = excluded.new_value, editor_email = excluded.editor_email, status = 'pending'
    returning *
  `;
  return row;
}

async function getEdit(id) {
  const db = sql();
  const [row] = await db`select * from edits where id = ${id}`;
  return row;
}

async function cleanupTestEdits() {
  const db = sql();
  await db`delete from edits where editor_email = ${TEST_EMAIL}`;
}

module.exports = { seedEdit, getEdit, cleanupTestEdits, TEST_EMAIL };
