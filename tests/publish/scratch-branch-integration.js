// Integration test for the REAL commit path behind the published-flag
// admin toggle — real recipes-publish.js handler, real GitHub commit — but
// pointed at test/phase5-scratch instead of translation-pipeline via
// GITHUB_BRANCH. Same safety reasoning as
// tests/phase5/scratch-branch-integration.js (which this file deliberately
// mirrors): Netlify only builds translation-pipeline (netlify.toml
// [build]), so a commit to any other branch triggers no deploy regardless
// of whether the build hook also fires.
//
// GITHUB_BRANCH must be overridden BEFORE requiring recipes-publish.js —
// that module reads process.env.GITHUB_BRANCH once, at require time, into
// a top-level const, same pattern every other recipe function in this repo
// uses.
//
// Run via `npm run test:publish:integration` (wraps `netlify dev:exec` for
// GITHUB_TOKEN — this script does not read .env itself). Uses DATABASE_URL
// only to verify/clean up the best-effort edit_log audit row; the publish
// action itself has no `edits`-table staging step to seed or clean.
process.env.GITHUB_BRANCH = 'test/phase5-scratch';

const assert = require('node:assert/strict');
const { getSql } = require('../../netlify/functions/_shared/db');
const { getFile, ensureBranchExists } = require('../../netlify/functions/_shared/github');
const recipesPublish = require('../../netlify/functions/recipes-publish');

const GITHUB_REPO = process.env.GITHUB_REPO || 'SirEvelyn0116/shehirian-modular';
const PRODUCTION_BRANCH = 'translation-pipeline';
const SCRATCH_BRANCH = process.env.GITHUB_BRANCH; // 'test/phase5-scratch', set above
const RECIPES_PATH = process.env.GITHUB_RECIPES_PATH || 'sections/recipes/all-recipes.json';

const TEST_RECIPE_SLUG = 'royal-soup';
// 'en' deliberately -- unlike translation edits (fr/ar/hy only, see
// edit-create.js's TARGET_LANGS), the publish toggle must also support
// English, since an English recipe can be unpublished too. Exercising 'en'
// here is what actually proves that grammar difference, not just asserts it.
const TEST_LANG = 'en';

const fakeApprover = {
  clientContext: {
    user: {
      email: 'publish-integration-test@example.com',
      app_metadata: { roles: ['approver'] },
    },
  },
};
const fakeTranslator = {
  clientContext: {
    user: {
      email: 'publish-integration-translator@example.com',
      app_metadata: { roles: ['translator'] },
    },
  },
};

function check(label, condition) {
  assert.ok(condition, label);
  console.log(`  ✓ ${label}`);
}

async function main() {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is not set — run via `npm run test:publish:integration`, not `node` directly.');
  }

  console.log(`Target branch for this run: ${SCRATCH_BRANCH} (production is ${PRODUCTION_BRANCH} — this test never touches it)`);

  // --- Safety check 0: capture production's current state BEFORE doing
  // anything, so we can prove afterward it never moved. ---
  const beforeProd = await getFile({ repo: GITHUB_REPO, branch: PRODUCTION_BRANCH, path: RECIPES_PATH, token: process.env.GITHUB_TOKEN });
  console.log(`${PRODUCTION_BRANCH} blob sha before test: ${beforeProd.sha}`);

  // --- Setup: ensure the scratch branch exists (same helper/branch phase5's test uses) ---
  const branchResult = await ensureBranchExists({ repo: GITHUB_REPO, branch: SCRATCH_BRANCH, fromBranch: PRODUCTION_BRANCH, token: process.env.GITHUB_TOKEN });
  console.log(branchResult.created ? `Created ${SCRATCH_BRANCH} off ${PRODUCTION_BRANCH}.` : `${SCRATCH_BRANCH} already exists — reusing it.`);

  // --- Role gate: a translator identity must be rejected, no network/commit side effects ---
  const roleGateRes = await recipesPublish.handler(
    { httpMethod: 'POST', body: JSON.stringify({ recipeSlug: TEST_RECIPE_SLUG, lang: TEST_LANG, published: true }) },
    fakeTranslator,
  );
  check('translator role is rejected (403), not just left unauthenticated', roleGateRes.statusCode === 403);

  // --- Validation: bad lang / bad type must 400 before any GitHub call ---
  const badLangRes = await recipesPublish.handler(
    { httpMethod: 'POST', body: JSON.stringify({ recipeSlug: TEST_RECIPE_SLUG, lang: 'de', published: true }) },
    fakeApprover,
  );
  check('an unsupported lang is rejected (400)', badLangRes.statusCode === 400);

  const badTypeRes = await recipesPublish.handler(
    { httpMethod: 'POST', body: JSON.stringify({ recipeSlug: TEST_RECIPE_SLUG, lang: TEST_LANG, published: 'true' }) },
    fakeApprover,
  );
  check('a non-boolean published value is rejected (400)', badTypeRes.statusCode === 400);

  // Read the CURRENT value on the scratch branch (not assumed), so this
  // test is safely re-runnable regardless of what an earlier run left the
  // flag set to.
  const before = await getFile({ repo: GITHUB_REPO, branch: SCRATCH_BRANCH, path: RECIPES_PATH, token: process.env.GITHUB_TOKEN });
  const recipe = before.json.recipes.find((r) => r.slug === TEST_RECIPE_SLUG);
  if (!recipe) throw new Error(`Fixture recipe '${TEST_RECIPE_SLUG}' not found on ${SCRATCH_BRANCH} — has all-recipes.json's shape changed?`);
  const startValue = !!(recipe.published && recipe.published[TEST_LANG] === true);
  const targetValue = !startValue;
  console.log(`${TEST_RECIPE_SLUG}.published.${TEST_LANG} on ${SCRATCH_BRANCH}: currently ${startValue}, toggling to ${targetValue}`);

  const sql = getSql();

  try {
    // --- No-op idempotency check FIRST: requesting the value already in
    // effect must not commit. ---
    const noopRes = await recipesPublish.handler(
      { httpMethod: 'POST', body: JSON.stringify({ recipeSlug: TEST_RECIPE_SLUG, lang: TEST_LANG, published: startValue }) },
      fakeApprover,
    );
    const noopBody = JSON.parse(noopRes.body);
    check('requesting the already-current value is a no-op (committed: false)', noopBody.committed === false && noopBody.commitSha === null);
    const afterNoop = await getFile({ repo: GITHUB_REPO, branch: SCRATCH_BRANCH, path: RECIPES_PATH, token: process.env.GITHUB_TOKEN });
    check('no-op request wrote nothing (blob sha unchanged)', afterNoop.sha === before.sha);

    // --- The real toggle ---
    const toggleRes = await recipesPublish.handler(
      { httpMethod: 'POST', body: JSON.stringify({ recipeSlug: TEST_RECIPE_SLUG, lang: TEST_LANG, published: targetValue }) },
      fakeApprover,
    );
    const toggleBody = JSON.parse(toggleRes.body);
    console.log('publish response:', JSON.stringify(toggleBody, null, 2));

    check('toggle returns 200', toggleRes.statusCode === 200);
    check('toggle reports committed: true', toggleBody.committed === true);
    check('toggle returns a commit sha', typeof toggleBody.commitSha === 'string' && toggleBody.commitSha.length === 40);
    check('toggle response reflects the requested value', toggleBody.published === targetValue);

    // --- Verify the commit actually landed on the scratch branch with the right content ---
    const afterToggle = await getFile({ repo: GITHUB_REPO, branch: SCRATCH_BRANCH, path: RECIPES_PATH, token: process.env.GITHUB_TOKEN });
    const updatedRecipe = afterToggle.json.recipes.find((r) => r.slug === TEST_RECIPE_SLUG);
    check('scratch branch content now has the new published value', updatedRecipe.published[TEST_LANG] === targetValue);
    check('scratch branch blob sha changed', afterToggle.sha !== before.sha);
    // Only the one field changed -- same "confined diff" property the
    // approve pipeline's commit has, just checked from the other direction
    // here (recipe count + every other field on this recipe untouched).
    check('every other field on the recipe is untouched', JSON.stringify({ ...updatedRecipe, published: null }) === JSON.stringify({ ...recipe, published: null }));

    // --- THE critical safety check: production was never touched ---
    const afterProd = await getFile({ repo: GITHUB_REPO, branch: PRODUCTION_BRANCH, path: RECIPES_PATH, token: process.env.GITHUB_TOKEN });
    check(`${PRODUCTION_BRANCH} blob sha is UNCHANGED (still ${afterProd.sha})`, afterProd.sha === beforeProd.sha);

    // --- Audit row: best-effort edit_log insert (action='published') ---
    const [logRow] = await sql`select * from edit_log where recipe_slug = ${TEST_RECIPE_SLUG} and lang = ${TEST_LANG} and field_path = 'published' and commit_sha = ${toggleBody.commitSha}`;
    check('edit_log row was written for the publish flip', !!logRow);
    check("edit_log.action is 'published'", logRow.action === 'published');
    check('edit_log records the approver as both editor_email and resolved_by (no separate translator for this action)', logRow.editor_email === fakeApprover.clientContext.user.email && logRow.resolved_by === fakeApprover.clientContext.user.email);
    check('edit_log old/new values are the stringified booleans', logRow.old_value === String(startValue) && logRow.new_value === String(targetValue));

    // --- Idempotency: re-requesting the SAME (now-current) value must not make a second commit ---
    const secondCall = await recipesPublish.handler(
      { httpMethod: 'POST', body: JSON.stringify({ recipeSlug: TEST_RECIPE_SLUG, lang: TEST_LANG, published: targetValue }) },
      fakeApprover,
    );
    const secondBody = JSON.parse(secondCall.body);
    check('re-requesting the same value is a no-op (no second commit)', secondBody.committed === false && secondBody.commitSha === null);
    const afterSecond = await getFile({ repo: GITHUB_REPO, branch: SCRATCH_BRANCH, path: RECIPES_PATH, token: process.env.GITHUB_TOKEN });
    check('blob sha unchanged after the redundant call', afterSecond.sha === afterToggle.sha);

    // --- Toggle back to the original value -- proves publish -> unpublish
    // -> publish (or the reverse) round-trips cleanly with no corruption,
    // and leaves the scratch branch as it found it for this field. ---
    const revertRes = await recipesPublish.handler(
      { httpMethod: 'POST', body: JSON.stringify({ recipeSlug: TEST_RECIPE_SLUG, lang: TEST_LANG, published: startValue }) },
      fakeApprover,
    );
    const revertBody = JSON.parse(revertRes.body);
    check('reverting to the original value commits again', revertBody.committed === true && typeof revertBody.commitSha === 'string');
    const afterRevert = await getFile({ repo: GITHUB_REPO, branch: SCRATCH_BRANCH, path: RECIPES_PATH, token: process.env.GITHUB_TOKEN });
    const revertedRecipe = afterRevert.json.recipes.find((r) => r.slug === TEST_RECIPE_SLUG);
    check('scratch branch is back to the original published value', revertedRecipe.published[TEST_LANG] === startValue);
    check('the rest of the recipe is still untouched after the round trip', JSON.stringify({ ...revertedRecipe, published: null }) === JSON.stringify({ ...recipe, published: null }));

    const afterProdFinal = await getFile({ repo: GITHUB_REPO, branch: PRODUCTION_BRANCH, path: RECIPES_PATH, token: process.env.GITHUB_TOKEN });
    check(`${PRODUCTION_BRANCH} blob sha is STILL unchanged after the full round trip (still ${afterProdFinal.sha})`, afterProdFinal.sha === beforeProd.sha);

    console.log('\n✅ All publish scratch-branch integration checks passed.');
    console.log(`   Toggle commit:  https://github.com/${GITHUB_REPO}/commit/${toggleBody.commitSha}`);
    console.log(`   Revert commit:  https://github.com/${GITHUB_REPO}/commit/${revertBody.commitSha}`);
  } finally {
    await sql`delete from edit_log where editor_email = ${fakeApprover.clientContext.user.email}`;
    console.log('Cleaned up test edit_log rows.');
  }
}

main().catch((err) => {
  console.error('\n❌ Integration test failed:', err.message);
  process.exitCode = 1;
});
