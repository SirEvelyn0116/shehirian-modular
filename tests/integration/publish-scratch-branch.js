// Integration test for the QUEUED publish flow (2026-10): a pill click
// stages a request (recipes-publish.js, no commit), and the request goes
// live only through recipes-approve.js. Real handlers, real GitHub commit,
// real database — but pointed at test/phase5-scratch instead of
// translation-pipeline via GITHUB_BRANCH. Netlify only builds
// translation-pipeline (netlify.toml [build]), so nothing here deploys.
//
// GITHUB_BRANCH must be overridden BEFORE requiring the handlers — each
// reads it once, at require time, into a top-level const.
//
// Run via `npm run test:publish:integration` (wraps `netlify dev:exec` for
// GITHUB_TOKEN and DATABASE_URL).
process.env.GITHUB_BRANCH = 'test/phase5-scratch';
// The approve step would otherwise fire the production build hook (a harmless
// but pointless rebuild of unchanged content). Removed before require, too.
delete process.env.NETLIFY_BUILD_HOOK_ID;

const assert = require('node:assert/strict');
const { getSql } = require('../../netlify/functions/_shared/db');
const { getFile, ensureBranchExists } = require('../../netlify/functions/_shared/github');
const recipesPublish = require('../../netlify/functions/recipes-publish');
const recipesApprove = require('../../netlify/functions/recipes-approve');
const editsReject = require('../../netlify/functions/edits-reject');

const GITHUB_REPO = process.env.GITHUB_REPO || 'SirEvelyn0116/shehirian-modular';
const PRODUCTION_BRANCH = 'translation-pipeline';
const SCRATCH_BRANCH = process.env.GITHUB_BRANCH;
const RECIPES_PATH = process.env.GITHUB_RECIPES_PATH || 'sections/recipes/all-recipes.json';
const TOKEN = process.env.GITHUB_TOKEN;

const TEST_RECIPE_SLUG = 'royal-soup';
const TEST_LANG = 'en'; // publish requests, unlike translations, also cover English

const fakeApprover = { clientContext: { user: { email: 'publish-integration-test@example.com', app_metadata: { roles: ['approver'] } } } };
const fakeTranslator = { clientContext: { user: { email: 'publish-integration-translator@example.com', app_metadata: { roles: ['translator'] } } } };

function check(label, condition) {
  assert.ok(condition, label);
  console.log(`  ✓ ${label}`);
}
const post = (fn, body, ctx = fakeApprover) => fn.handler({ httpMethod: 'POST', body: JSON.stringify(body) }, ctx);
const read = (branch) => getFile({ repo: GITHUB_REPO, branch, path: RECIPES_PATH, token: TOKEN });

async function main() {
  if (!TOKEN) throw new Error('GITHUB_TOKEN is not set — run via `npm run test:publish:integration`.');
  console.log(`Target branch: ${SCRATCH_BRANCH} (production ${PRODUCTION_BRANCH} is never touched)`);

  const beforeProd = await read(PRODUCTION_BRANCH);
  const branchResult = await ensureBranchExists({ repo: GITHUB_REPO, branch: SCRATCH_BRANCH, fromBranch: PRODUCTION_BRANCH, token: TOKEN });
  console.log(branchResult.created ? `Created ${SCRATCH_BRANCH}.` : `Reusing ${SCRATCH_BRANCH}.`);

  check('translator role is rejected (403)', (await post(recipesPublish, { recipeSlug: TEST_RECIPE_SLUG, lang: TEST_LANG, published: true }, fakeTranslator)).statusCode === 403);
  check('unsupported lang is rejected (400)', (await post(recipesPublish, { recipeSlug: TEST_RECIPE_SLUG, lang: 'de', published: true })).statusCode === 400);
  check('non-boolean published is rejected (400)', (await post(recipesPublish, { recipeSlug: TEST_RECIPE_SLUG, lang: TEST_LANG, published: 'true' })).statusCode === 400);

  const before = await read(SCRATCH_BRANCH);
  const recipe = before.json.recipes.find((r) => r.slug === TEST_RECIPE_SLUG);
  if (!recipe) throw new Error(`Fixture recipe '${TEST_RECIPE_SLUG}' not found on ${SCRATCH_BRANCH}.`);
  const startValue = !!(recipe.published && recipe.published[TEST_LANG] === true);
  const targetValue = !startValue;
  console.log(`${TEST_RECIPE_SLUG}.published.${TEST_LANG}: currently ${startValue}, will queue ${targetValue}`);

  const sql = getSql();
  const cleanup = () => sql`delete from edits where editor_email = ${fakeApprover.clientContext.user.email}`;
  await cleanup();

  try {
    // --- Queue: no commit, one pending row ---
    const q = JSON.parse((await post(recipesPublish, { recipeSlug: TEST_RECIPE_SLUG, lang: TEST_LANG, published: targetValue })).body);
    check('click queues a request (queued: true)', q.queued === true && typeof q.editId === 'string');
    check('response still reports the live value', q.published === startValue && q.pendingPublish === targetValue);
    check('queueing commits nothing (blob sha unchanged)', (await read(SCRATCH_BRANCH)).sha === before.sha);
    const [row] = await sql`select * from edits where id = ${q.editId}`;
    check('pending row has field_path published and stringified values', row.status === 'pending' && row.field_path === 'published' && row.old_value === String(startValue) && row.new_value === String(targetValue));

    // --- Withdraw: clicking back to the live value deletes the request ---
    const w = JSON.parse((await post(recipesPublish, { recipeSlug: TEST_RECIPE_SLUG, lang: TEST_LANG, published: startValue })).body);
    check('clicking back withdraws the request', w.queued === false && w.cancelled === true);
    check('no pending row left', (await sql`select 1 from edits where id = ${q.editId}`).length === 0);

    // --- Reject: queued request leaves the queue, nothing committed ---
    const q2 = JSON.parse((await post(recipesPublish, { recipeSlug: TEST_RECIPE_SLUG, lang: TEST_LANG, published: targetValue })).body);
    check('non-string reason is rejected (400)', (await post(editsReject, { editIds: [q2.editId], reason: 42 })).statusCode === 400);
    const rej = JSON.parse((await post(editsReject, { editIds: [q2.editId], reason: '  integration test reason  ' })).body);
    check('reject resolves the request', rej.totalRejected === 1);
    const [rejRow] = await sql`select status, reject_reason from edits where id = ${q2.editId}`;
    check("row status is 'rejected'", rejRow.status === 'rejected');
    check('reason is stored, trimmed', rejRow.reject_reason === 'integration test reason');
    const [rejLog] = await sql`select note, commit_sha from edit_log where action = 'rejected' and resolved_by = ${fakeApprover.clientContext.user.email} order by created_at desc limit 1`;
    check('edit_log carries the reason as its note, with no commit', rejLog && rejLog.note === 'integration test reason' && rejLog.commit_sha === null);
    check('rejecting commits nothing', (await read(SCRATCH_BRANCH)).sha === before.sha);

    // --- Approve: re-queue (resets the rejected row to pending), then ship ---
    const q3 = JSON.parse((await post(recipesPublish, { recipeSlug: TEST_RECIPE_SLUG, lang: TEST_LANG, published: targetValue })).body);
    check('re-queueing a rejected request reuses the row as pending', q3.editId === q2.editId);
    const [requeued] = await sql`select status, reject_reason from edits where id = ${q3.editId}`;
    check('re-queueing clears the old reason', requeued.status === 'pending' && requeued.reject_reason === null);
    const ap = JSON.parse((await post(recipesApprove, { editIds: [q3.editId], confirmed: true })).body);
    check('approve commits', ap.committed === true && typeof ap.commitSha === 'string');
    const after = await read(SCRATCH_BRANCH);
    const updated = after.json.recipes.find((r) => r.slug === TEST_RECIPE_SLUG);
    check('flag is now a real boolean with the new value', updated.published[TEST_LANG] === targetValue);
    check('every other field untouched', JSON.stringify({ ...updated, published: null }) === JSON.stringify({ ...recipe, published: null }));
    const [log] = await sql`select * from edit_log where commit_sha = ${ap.commitSha} and field_path = 'published'`;
    check("edit_log row has action 'published'", log && log.action === 'published');

    // --- Revert the same way, leaving the scratch branch as found ---
    const q4 = JSON.parse((await post(recipesPublish, { recipeSlug: TEST_RECIPE_SLUG, lang: TEST_LANG, published: startValue })).body);
    const ap2 = JSON.parse((await post(recipesApprove, { editIds: [q4.editId], confirmed: true })).body);
    check('revert approve commits', ap2.committed === true);
    const reverted = (await read(SCRATCH_BRANCH)).json.recipes.find((r) => r.slug === TEST_RECIPE_SLUG);
    check('scratch branch back to the original value', reverted.published[TEST_LANG] === startValue);

    check(`${PRODUCTION_BRANCH} is UNCHANGED`, (await read(PRODUCTION_BRANCH)).sha === beforeProd.sha);
    console.log('\n✅ All queued-publish integration checks passed.');
  } finally {
    await cleanup();
    await sql`delete from edit_log where resolved_by = ${fakeApprover.clientContext.user.email}`;
    console.log('Cleaned up test rows.');
  }
}

main().catch((err) => {
  console.error('\n❌ Integration test failed:', err.message);
  process.exitCode = 1;
});
