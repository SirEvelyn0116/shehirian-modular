const { requireRole } = require('./_shared/requireRole');
const { getSql } = require('./_shared/db');
const { getFile } = require('./_shared/github');
const { PUBLISHED } = require('./_shared/fieldPath');

// Same config-driven read target as recipes-approve.js — same env vars,
// same fallback defaults (build spec §6: GITHUB_BRANCH must stay
// overridable so local/dev testing points at a scratch branch).
const GITHUB_REPO = process.env.GITHUB_REPO || 'SirEvelyn0116/shehirian-modular';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'translation-pipeline';
const GITHUB_RECIPES_PATH = process.env.GITHUB_RECIPES_PATH || 'sections/recipes/all-recipes.json';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const LANGS = ['en', 'fr', 'ar', 'hy'];

// Publish / unpublish REQUEST — queues the change, never commits.
//
// History: this used to commit and redeploy on every click (one commit per
// pill). That was too easy to set off by accident, so since 2026-10 a click
// only stages a row in `edits` (field_path 'published', value 'true' /
// 'false'). The request then shows up on the Review page next to pending
// translations, and goes live only when an approver approves it there —
// through recipes-approve.js, in the same single commit + deploy as
// everything else in that batch. One pipeline, one conflict guard, one
// audit trail.
//
// Toggling the pill back to the live value cancels the queued request
// (deletes the pending row) rather than queueing a no-op.
//
// old_value is the live value at click time, so the approve step's
// conflict guard catches the case where the flag was changed some other
// way in between, exactly as it does for translations.
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
    // Contents API rather than the raw CDN: the live value recorded here
    // becomes the conflict guard's old_value, so it must be current HEAD.
    const file = await getFile({ repo: GITHUB_REPO, branch: GITHUB_BRANCH, path: GITHUB_RECIPES_PATH, token: GITHUB_TOKEN });
    const recipe = (file.json.recipes || []).find((r) => r.slug === recipeSlug);
    if (!recipe) {
      return { statusCode: 404, body: JSON.stringify({ error: `Recipe '${recipeSlug}' not found.` }) };
    }

    const liveValue = !!(recipe.published && recipe.published[lang] === true);
    const sql = getSql();

    if (liveValue === published) {
      // Back to what's live: withdraw any queued request for this pill.
      const deleted = await sql`
        delete from edits
        where recipe_slug = ${recipeSlug} and lang = ${lang} and field_path = ${PUBLISHED} and status = 'pending'
        returning id
      `;
      return json(200, { queued: false, cancelled: deleted.length > 0, recipeSlug, lang, published: liveValue, pendingPublish: null });
    }

    // Upsert — same unique key and reset-to-pending behavior as
    // edit-create.js, so re-queueing after a conflict/rejection just works.
    const [edit] = await sql`
      insert into edits (recipe_slug, lang, field_path, ref_value, old_value, new_value, editor_email, status, updated_at, resolved_at, resolved_by)
      values (${recipeSlug}, ${lang}, ${PUBLISHED}, null, ${String(liveValue)}, ${String(published)}, ${approverEmail}, 'pending', now(), null, null)
      on conflict (recipe_slug, lang, field_path)
      do update set
        ref_value = null,
        old_value = excluded.old_value,
        new_value = excluded.new_value,
        editor_email = excluded.editor_email,
        status = 'pending',
        updated_at = now(),
        resolved_at = null,
        resolved_by = null,
        reject_reason = null
      returning id
    `;

    return json(200, { queued: true, editId: edit.id, recipeSlug, lang, published: liveValue, pendingPublish: published });
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

function json(statusCode, payload) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
}
