// Single source of truth for the local auth-stub's fake identity. Imported
// by both scripts/dev-server.js (writes edits as this user) and
// db/clean-test-edits.js (deletes only rows belonging to this user) — kept
// as a separate, side-effect-free module (no server, no env var checks) so
// requiring it for the email alone can't accidentally start anything.
//
// STUB_ROLE controls which role(s) the stub presents — 'translator' |
// 'approver' | 'both' (default). Set via npm run dev:auth-stub:translator /
// :approver, or STUB_ROLE directly. This matters beyond convenience: a real
// approver-only account (no translator role) is blocked from GET
// /api/recipes and /api/recipes/:slug by requireRole, so testing "approver"
// as its own role in isolation — not just as an extra role tacked onto a
// translator — is the only way to see what that account actually
// experiences (RecipesApp.jsx routes it straight to Review, skipping the
// translate flow that would otherwise 403).
const ROLE_SETS = {
  translator: ['translator'],
  approver: ['approver'],
  both: ['translator', 'approver'],
};
const roleKey = process.env.STUB_ROLE || 'both';

const STUB_USER = {
  email: 'local-dev@example.com',
  app_metadata: { roles: ROLE_SETS[roleKey] || ROLE_SETS.both },
};

module.exports = { STUB_USER };
