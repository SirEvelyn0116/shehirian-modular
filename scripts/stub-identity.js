// Single source of truth for the local auth-stub's fake identity. Imported
// by both scripts/dev-server.js (writes edits as this user) and
// db/clean-test-edits.js (deletes only rows belonging to this user) — kept
// as a separate, side-effect-free module (no server, no env var checks) so
// requiring it for the email alone can't accidentally start anything.
const STUB_USER = {
  email: 'local-dev@example.com',
  app_metadata: { roles: ['translator', 'approver'] },
};

module.exports = { STUB_USER };
