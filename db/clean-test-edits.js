// Deletes ONLY the local auth-stub's own test rows from `edits`. Run via
// `npm run db:clean-test-edits` after a local dev:auth-stub session.
//
// Scope safety: the target email is imported from scripts/stub-identity.js
// — the same module dev-server.js uses to write those rows in the first
// place — rather than duplicated here, so this can never drift out of sync
// with what the stub actually writes. It's checked non-empty before the
// query is even built, so there is no code path here that can produce an
// unscoped DELETE. Every matching row is printed before it's deleted.
//
// Table scope: `edits` only, deliberately never `edit_log`. edit_log is
// designed to be append-only (build spec §5) — a cleanup script deleting
// from it would undercut that guarantee even for test data. It's also a
// non-issue today: edit_log is only written at approval time (Phase 5),
// which doesn't exist yet, so Phase 3 stub-testing never writes to it at
// all. If Phase 5 testing later does write edit_log rows via the stub,
// cleaning those up needs its own deliberate decision then, not something
// silently bundled into this script now.
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const { STUB_USER } = require('../scripts/stub-identity.js');

const STUB_EDITOR_EMAIL = STUB_USER.email;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Run this via `npm run db:clean-test-edits` (netlify dev:exec), not node directly.');
  }
  if (!STUB_EDITOR_EMAIL || typeof STUB_EDITOR_EMAIL !== 'string' || !STUB_EDITOR_EMAIL.trim()) {
    throw new Error('Refusing to run: STUB_EDITOR_EMAIL is empty or invalid — this would risk an unscoped delete.');
  }

  const sql = neon(process.env.DATABASE_URL);

  const matches = await sql`
    select id, recipe_slug, lang, field_path, status
    from edits
    where editor_email = ${STUB_EDITOR_EMAIL}
    order by updated_at desc
  `;

  console.log(`Found ${matches.length} row(s) in edits for editor_email = '${STUB_EDITOR_EMAIL}':`);
  matches.forEach(r => console.log(`  - ${r.recipe_slug} / ${r.lang} / ${r.field_path}  [${r.status}]  (${r.id})`));

  if (matches.length === 0) {
    console.log('Nothing to clean up.');
    return;
  }

  const deleted = await sql`
    delete from edits where editor_email = ${STUB_EDITOR_EMAIL} returning id
  `;

  console.log(`✅ Deleted ${deleted.length} row(s) for '${STUB_EDITOR_EMAIL}'.`);
  console.log('edit_log untouched — append-only by design, and not written during Phase 3 testing anyway.');
}

main().catch(err => {
  console.error('❌ Cleanup failed:', err.message);
  process.exit(1);
});
