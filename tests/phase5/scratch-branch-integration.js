// Integration test for the REAL commit path — real recipes-approve.js
// handler, real database, real GitHub commit — but pointed at
// test/phase5-scratch instead of translation-pipeline via GITHUB_BRANCH.
// Netlify only builds translation-pipeline (netlify.toml [build]), so a
// commit to any other branch triggers no deploy regardless of whether the
// build hook also fires — that's what makes this safe to run for real.
//
// GITHUB_BRANCH must be overridden BEFORE requiring recipes-approve.js —
// that module reads process.env.GITHUB_BRANCH once, at require time, into
// a top-level const, same pattern every other recipe function in this repo
// uses. Setting it here, first thing, is what actually redirects the
// commit away from production; everything else in this file just proves
// that redirection worked.
//
// Run via `npm run test:phase5:integration` (wraps `netlify dev:exec` for
// DATABASE_URL and GITHUB_TOKEN — this script does not read .env itself).
// Does NOT run as part of `npm run test:phase4` or any Playwright suite —
// deliberately separate, since it makes a real GitHub commit.
process.env.GITHUB_BRANCH = 'test/phase5-scratch';

const assert = require('node:assert/strict');
const { getSql } = require('../../netlify/functions/_shared/db');
const { getFile, ensureBranchExists } = require('../../netlify/functions/_shared/github');
const recipesApprove = require('../../netlify/functions/recipes-approve');

const GITHUB_REPO = process.env.GITHUB_REPO || 'SirEvelyn0116/shehirian-modular';
const PRODUCTION_BRANCH = 'translation-pipeline';
const SCRATCH_BRANCH = process.env.GITHUB_BRANCH; // 'test/phase5-scratch', set above
const RECIPES_PATH = process.env.GITHUB_RECIPES_PATH || 'sections/recipes/all-recipes.json';

const TEST_EMAIL = 'phase5-integration-test@example.com';
const TEST_RECIPE_SLUG = 'royal-soup';
const TEST_LANG = 'hy'; // Armenian — arbitrary choice, just needs to exist in the schema
const TEST_FIELD_PATH = 'title';

const fakeApprover = {
  clientContext: {
    user: {
      email: 'phase5-integration-approver@example.com',
      app_metadata: { roles: ['approver'] },
    },
  },
};

function check(label, condition) {
  assert.ok(condition, label);
  console.log(`  ✓ ${label}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set — run via `npm run test:phase5:integration`, not `node` directly.');
  }
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is not set — run via `npm run test:phase5:integration`, not `node` directly.');
  }

  const sql = getSql();

  console.log(`Target branch for this run: ${SCRATCH_BRANCH} (production is ${PRODUCTION_BRANCH} — this test never touches it)`);

  // --- Safety check 0: capture production's current state BEFORE doing
  // anything, so we can prove afterward it never moved. ---
  const beforeProd = await getFile({ repo: GITHUB_REPO, branch: PRODUCTION_BRANCH, path: RECIPES_PATH, token: process.env.GITHUB_TOKEN });
  console.log(`${PRODUCTION_BRANCH} blob sha before test: ${beforeProd.sha}`);

  // --- Setup: ensure the scratch branch exists ---
  const branchResult = await ensureBranchExists({ repo: GITHUB_REPO, branch: SCRATCH_BRANCH, fromBranch: PRODUCTION_BRANCH, token: process.env.GITHUB_TOKEN });
  console.log(branchResult.created ? `Created ${SCRATCH_BRANCH} off ${PRODUCTION_BRANCH}.` : `${SCRATCH_BRANCH} already exists — reusing it.`);

  // --- Clean up any leftover test rows from a previous run first ---
  await sql`delete from edits where editor_email = ${TEST_EMAIL}`;

  // Read the CURRENT value on the scratch branch (not assumed) so this
  // test is safely re-runnable — each run stages an edit whose old_value
  // matches whatever the scratch branch actually has right now, and a
  // fresh, uniquely-timestamped new_value, so classifyEdits always sees a
  // clean (non-conflicting) edit regardless of what earlier runs left
  // behind.
  const before = await getFile({ repo: GITHUB_REPO, branch: SCRATCH_BRANCH, path: RECIPES_PATH, token: process.env.GITHUB_TOKEN });
  const recipe = before.json.recipes.find((r) => r.slug === TEST_RECIPE_SLUG);
  if (!recipe) throw new Error(`Fixture recipe '${TEST_RECIPE_SLUG}' not found on ${SCRATCH_BRANCH} — has all-recipes.json's shape changed?`);
  const currentValue = recipe.title[TEST_LANG];
  const newValue = `[PHASE5-INTEGRATION-TEST ${new Date().toISOString()}]`;

  const [seeded] = await sql`
    insert into edits (recipe_slug, lang, field_path, old_value, new_value, editor_email, status)
    values (${TEST_RECIPE_SLUG}, ${TEST_LANG}, ${TEST_FIELD_PATH}, ${currentValue}, ${newValue}, ${TEST_EMAIL}, 'pending')
    returning *
  `;
  console.log(`Seeded pending edit ${seeded.id}: ${TEST_RECIPE_SLUG}/${TEST_LANG}/${TEST_FIELD_PATH} "${currentValue}" -> "${newValue}"`);

  try {
    // --- Dry run first — proves the confirm-gate path works before the real call ---
    const dryRunRes = await recipesApprove.handler(
      { httpMethod: 'POST', body: JSON.stringify({ editIds: [seeded.id], dryRun: true }) },
      fakeApprover,
    );
    const dryRunBody = JSON.parse(dryRunRes.body);
    check('dry run returns 200', dryRunRes.statusCode === 200);
    check('dry run reports committed: false', dryRunBody.committed === false);
    check('dry run reports the edit as applyable, no conflicts', dryRunBody.totalApplied === 1 && dryRunBody.totalConflicts === 0);

    const afterDryRun = await getFile({ repo: GITHUB_REPO, branch: SCRATCH_BRANCH, path: RECIPES_PATH, token: process.env.GITHUB_TOKEN });
    check('dry run wrote nothing to the scratch branch (blob sha unchanged)', afterDryRun.sha === before.sha);

    // --- The real call ---
    const approveRes = await recipesApprove.handler(
      { httpMethod: 'POST', body: JSON.stringify({ editIds: [seeded.id], confirmed: true }) },
      fakeApprover,
    );
    const approveBody = JSON.parse(approveRes.body);
    console.log('approve response:', JSON.stringify(approveBody, null, 2));

    check('approve returns 200', approveRes.statusCode === 200);
    check('approve reports committed: true', approveBody.committed === true);
    check('approve returns a commit sha', typeof approveBody.commitSha === 'string' && approveBody.commitSha.length === 40);
    check('approve reports exactly our one edit applied, no conflicts', approveBody.totalApplied === 1 && approveBody.totalConflicts === 0);

    // --- Verify the commit actually landed on the scratch branch with the right content ---
    const afterApprove = await getFile({ repo: GITHUB_REPO, branch: SCRATCH_BRANCH, path: RECIPES_PATH, token: process.env.GITHUB_TOKEN });
    const updatedRecipe = afterApprove.json.recipes.find((r) => r.slug === TEST_RECIPE_SLUG);
    check('scratch branch content now has the new value', updatedRecipe.title[TEST_LANG] === newValue);
    check('scratch branch blob sha changed', afterApprove.sha !== before.sha);

    // --- THE critical safety check: production was never touched ---
    const afterProd = await getFile({ repo: GITHUB_REPO, branch: PRODUCTION_BRANCH, path: RECIPES_PATH, token: process.env.GITHUB_TOKEN });
    check(`${PRODUCTION_BRANCH} blob sha is UNCHANGED (still ${afterProd.sha})`, afterProd.sha === beforeProd.sha);
    check(`${PRODUCTION_BRANCH} content does not contain the test value`, JSON.stringify(afterProd.json) !== JSON.stringify(afterApprove.json));

    // --- Verify DB bookkeeping: status flip + edit_log, keyed by the real commit sha ---
    const [dbEdit] = await sql`select * from edits where id = ${seeded.id}`;
    check('edits row flipped to approved', dbEdit.status === 'approved');
    check('edits row records the approver', dbEdit.resolved_by === fakeApprover.clientContext.user.email);

    const [logRow] = await sql`select * from edit_log where recipe_slug = ${TEST_RECIPE_SLUG} and lang = ${TEST_LANG} and field_path = ${TEST_FIELD_PATH} and new_value = ${newValue}`;
    check('edit_log row was written', !!logRow);
    check('edit_log.commit_sha matches the commit the approve call reported', logRow.commit_sha === approveBody.commitSha);
    check('edit_log records the original translator (editor_email), not the approver', logRow.editor_email === TEST_EMAIL);
    check('edit_log records the approver as resolved_by', logRow.resolved_by === fakeApprover.clientContext.user.email);

    // --- Idempotency: re-running the same call must not make a second commit ---
    const secondCall = await recipesApprove.handler(
      { httpMethod: 'POST', body: JSON.stringify({ editIds: [seeded.id], confirmed: true }) },
      fakeApprover,
    );
    const secondBody = JSON.parse(secondCall.body);
    check('re-submitting the same (now-approved) edit id applies nothing (already resolved, dropped from the batch)', secondBody.totalApplied === 0 && secondBody.totalRequested === 1);
    check('re-submitting does not create a second commit', secondBody.committed === false);

    // --- The deeper case: simulates the actual crash-recovery scenario
    // the ordering comment in recipes-approve.js describes — an edits row
    // whose target field is ALREADY correct in the file and ALREADY has an
    // edit_log row (both from the successful approve above), but whose own
    // status got reset back to 'pending' (as if the crash happened right
    // after the commit but before step 4 flipped it). This has to reuse
    // the SAME row via UPDATE, not a fresh INSERT — edits has a unique
    // constraint on (recipe_slug, lang, field_path), so a second 'pending'
    // row for the same field while the first is still there isn't even a
    // state the schema allows; going back to 'pending' on the same row is
    // the actual reachable crash state. This proves the edit_log-based
    // idempotency guard (not just "already resolved") is what's actually
    // preventing a second commit when this happens. ---
    await sql`update edits set status = 'pending', resolved_at = null, resolved_by = null where id = ${seeded.id}`;
    const replayRes = await recipesApprove.handler(
      { httpMethod: 'POST', body: JSON.stringify({ editIds: [seeded.id], confirmed: true }) },
      fakeApprover,
    );
    const replayBody = JSON.parse(replayRes.body);
    check('crash-recovery replay: edit is recognized as already-applied and completed (not conflicted)', replayBody.totalApplied === 1 && replayBody.totalConflicts === 0);
    check('crash-recovery replay: no new commit is made (content was already correct)', replayBody.committed === false && replayBody.commitSha === null);

    const [replayDbEdit] = await sql`select * from edits where id = ${seeded.id}`;
    check('crash-recovery replay: the row is flipped back to approved', replayDbEdit.status === 'approved');

    const replayLogRows = await sql`select * from edit_log where recipe_slug = ${TEST_RECIPE_SLUG} and lang = ${TEST_LANG} and field_path = ${TEST_FIELD_PATH} and new_value = ${newValue}`;
    check('crash-recovery replay: no duplicate edit_log row was written for the same content', replayLogRows.length === 1);

    const afterReplay = await getFile({ repo: GITHUB_REPO, branch: SCRATCH_BRANCH, path: RECIPES_PATH, token: process.env.GITHUB_TOKEN });
    check('crash-recovery replay: scratch branch blob sha unchanged (still no second commit)', afterReplay.sha === afterApprove.sha);

    console.log('\n✅ All scratch-branch integration checks passed.');
    console.log(`   Commit: https://github.com/${GITHUB_REPO}/commit/${approveBody.commitSha}`);
  } finally {
    await sql`delete from edits where editor_email = ${TEST_EMAIL}`;
    await sql`delete from edit_log where editor_email = ${TEST_EMAIL}`;
    console.log('Cleaned up test rows from edits and edit_log.');
  }
}

main().catch((err) => {
  console.error('\n❌ Integration test failed:', err.message);
  process.exitCode = 1;
});
