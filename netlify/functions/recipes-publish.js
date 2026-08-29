const { requireRole } = require('./_shared/requireRole');
const { getSql } = require('./_shared/db');
const { getFile, putFile } = require('./_shared/github');
const { fireBuildHook } = require('./_shared/buildHook');

// Same config-driven commit target as recipes-approve.js — same env vars,
// same fallback defaults, same reasoning (build spec §6: GITHUB_BRANCH must
// stay overridable so local/dev testing points at a scratch branch instead
// of committing to production). Re-declared here rather than imported from
// recipes-approve.js: these are independent top-level `const`s bound at
// each module's own load time, and importing a whole other function module
// just to reach its constants would be a stranger coupling than repeating
// four lines that must already stay byte-identical across every recipe
// function that commits (see recipes-approve.js, recipe-detail.js, etc.).
const GITHUB_REPO = process.env.GITHUB_REPO || 'SirEvelyn0116/shehirian-modular';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'translation-pipeline';
const GITHUB_RECIPES_PATH = process.env.GITHUB_RECIPES_PATH || 'sections/recipes/all-recipes.json';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const NETLIFY_BUILD_HOOK_ID = process.env.NETLIFY_BUILD_HOOK_ID;

const LANGS = ['en', 'fr', 'ar', 'hy'];

// The publish toggle (build spec: "published flag" feature, stage 3) —
// "a special edit to the `published` field, committed and deployed like an
// approval." Reuses the exact same GitHub-commit primitives
// recipes-approve.js uses (_shared/github.js's getFile/putFile: Contents API
// read-modify-write keyed to the file's blob SHA) rather than a parallel
// commit mechanism. That SHA-keyed PUT is also where the concurrency safety
// comes from: GitHub rejects a PUT whose `sha` no longer matches the
// branch's current HEAD, so a publish toggle racing another publish toggle
// (or a translator batch landing via recipes-approve.js) can't silently
// clobber the other's commit — the loser gets a 409 back (see the catch
// block below) and the caller can just retry against the now-current file.
//
// Unlike a translation edit, a publish flip has no staging step — there's
// nothing to batch-review before it takes effect, so there's no
// `edits`-table row and no `old_value`-at-staging-time to conflict-check
// against the way recipes-approve.js does. Idempotency here is simpler and
// direct instead: this handler always re-reads the CURRENT live value
// first, and if it already equals the requested value, it's a no-op — no
// commit, no build-hook fire, no audit row. That's what makes a duplicate
// or retried request (double-click, network retry) safe, and what makes
// publish -> unpublish -> publish three clean single-field commits with
// nothing left in between that could corrupt the file.
exports.handler = async (event, context) => {
  const gate = requireRole('approver', context);
  if (!gate.ok) {
    return { statusCode: gate.status, body: JSON.stringify({ error: gate.error }) };
  }

  if (event.httpMethod && event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'POST only.' }) };
  }

  if (!GITHUB_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GITHUB_TOKEN is not configured.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
  }

  const { recipeSlug, lang, published } = body;
  if (!recipeSlug || typeof recipeSlug !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'recipeSlug is required.' }) };
  }
  if (!LANGS.includes(lang)) {
    return { statusCode: 400, body: JSON.stringify({ error: `lang must be one of: ${LANGS.join(', ')}.` }) };
  }
  if (typeof published !== 'boolean') {
    return { statusCode: 400, body: JSON.stringify({ error: 'published must be a boolean.' }) };
  }

  const approverEmail = gate.user.email;

  try {
    // Contents API, not the raw.githubusercontent.com CDN the read-only
    // recipe functions use — same reasoning as recipes-approve.js: this
    // write needs the file's current blob SHA, and a CDN read can lag
    // behind HEAD.
    const file = await getFile({ repo: GITHUB_REPO, branch: GITHUB_BRANCH, path: GITHUB_RECIPES_PATH, token: GITHUB_TOKEN });
    const recipe = (file.json.recipes || []).find((r) => r.slug === recipeSlug);
    if (!recipe) {
      return { statusCode: 404, body: JSON.stringify({ error: `Recipe '${recipeSlug}' not found.` }) };
    }

    const currentValue = !!(recipe.published && recipe.published[lang] === true);
    if (currentValue === published) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ committed: false, commitSha: null, recipeSlug, lang, published: currentValue }),
      };
    }

    // Apply to a clone — never mutate the object just read from the file,
    // same discipline approveLogic.js's applyEditsToJson follows.
    const updatedJson = JSON.parse(JSON.stringify(file.json));
    const updatedRecipe = updatedJson.recipes.find((r) => r.slug === recipeSlug);
    if (!updatedRecipe.published) updatedRecipe.published = {};
    updatedRecipe.published[lang] = published;

    // 2-space indent, no trailing newline — matches all-recipes.json's
    // actual committed bytes, same as recipes-approve.js's commit.
    const newContent = JSON.stringify(updatedJson, null, 2);
    const message = `i18n: ${published ? 'publish' : 'unpublish'} ${recipeSlug} [${lang}]`;
    const commitResult = await putFile({
      repo: GITHUB_REPO, branch: GITHUB_BRANCH, path: GITHUB_RECIPES_PATH,
      token: GITHUB_TOKEN, content: newContent, sha: file.sha, message,
    });

    // Best-effort audit row. edit_log's `action` column has "room for future
    // action types" (db/schema.sql) — this is exactly that, one row per
    // publish flip keyed to the commit that shipped it, same shape
    // recipes-approve.js writes for a shipped translation. Not wrapped in
    // that action's transactional status-flip+log bundle: there's no
    // `edits` row here whose status needs flipping, so a failure writing
    // this row after a successful commit just means a missing audit entry,
    // not an inconsistent pending queue — swallowed rather than surfaced as
    // an error, since the commit and deploy already succeeded and the
    // caller's response should say so.
    try {
      const sql = getSql();
      await sql`
        insert into edit_log (recipe_slug, lang, field_path, old_value, new_value, action, editor_email, resolved_by, commit_sha)
        values (${recipeSlug}, ${lang}, 'published', ${String(currentValue)}, ${String(published)}, 'published', ${approverEmail}, ${approverEmail}, ${commitResult.commitSha})
      `;
    } catch (logErr) {
      console.warn('recipes-publish: commit succeeded but edit_log insert failed:', logErr.message);
    }

    if (NETLIFY_BUILD_HOOK_ID) {
      await fireBuildHook(NETLIFY_BUILD_HOOK_ID);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ committed: true, commitSha: commitResult.commitSha, recipeSlug, lang, published }),
    };
  } catch (err) {
    // A stale blob SHA (someone else committed to this file between our GET
    // and PUT — a concurrent publish toggle or approve batch) surfaces from
    // githubRequest as a "(409)" in the error message — GitHub's documented
    // response when a Contents API PUT's `sha` doesn't match current HEAD.
    // Distinguished here so the client can tell "transient, just retry"
    // apart from a real failure, same convention _shared/github.js's
    // ensureBranchExists already uses for its own 404 case.
    if (/\(409\)/.test(err.message)) {
      return { statusCode: 409, body: JSON.stringify({ error: 'The recipe file changed since this request started (a concurrent edit landed) — please retry.' }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
