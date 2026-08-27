const https = require('https');
const { requireAnyRole } = require('./_shared/requireRole');
const { getSql } = require('./_shared/db');

const LANGS = ['en', 'fr', 'ar', 'hy'];

const GITHUB_REPO = process.env.GITHUB_REPO || 'SirEvelyn0116/shehirian-modular';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'translation-pipeline';

// Source of truth is the committed JSON, not the deployed site — read it
// straight from GitHub raw so translators always see the latest commit.
function fetchAllRecipes() {
  return new Promise((resolve, reject) => {
    const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/sections/recipes/all-recipes.json?t=${Date.now()}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Could not parse all-recipes.json')); }
      });
    }).on('error', reject);
  });
}

exports.handler = async (event, context) => {
  // Shared by both roles: translators use this list to pick a recipe to
  // edit, approvers use it (stage 3's admin publish list) to see and toggle
  // publish status per language. GET /api/recipes/:slug (recipe-detail.js —
  // the full replica editor) stays translator-only; the list itself doesn't
  // expose anything an approver-only account shouldn't see.
  const gate = requireAnyRole(['translator', 'approver'], context);
  if (!gate.ok) {
    return { statusCode: gate.status, body: JSON.stringify({ error: gate.error }) };
  }

  try {
    const sql = getSql();
    const [master, pendingCounts] = await Promise.all([
      fetchAllRecipes(),
      sql`select recipe_slug, count(*)::int as count from edits where status = 'pending' group by recipe_slug`,
    ]);

    // pendingCount reflects durable, saved (pending) edits only — grouped
    // straight from the edits table. Deliberately does NOT reflect dirty
    // (unsaved, in-memory) editor state: dirty edits live only in a given
    // browser tab's React state and are intentionally lost on navigating
    // away (build spec §7's confirmed v1 design) — there is nothing in the
    // database for a list view, here or anywhere else, to show for them.
    const pendingBySlug = {};
    pendingCounts.forEach(row => { pendingBySlug[row.recipe_slug] = row.count; });

    const list = (master.recipes || []).map(r => ({
      slug: r.slug,
      title: r.title && r.title.en,
      categoryId: r.categoryId,
      pendingCount: pendingBySlug[r.slug] || 0,
      // Per-language publish status for the admin list's status pills
      // (stage 3). Same default-false-on-missing-data reasoning as
      // generate-index.js's isRecipePublished: a recipe with no `published`
      // object yet (pre-migration data) reads as all-unpublished, not as a
      // crash.
      published: LANGS.reduce((acc, lang) => {
        acc[lang] = !!(r.published && r.published[lang] === true);
        return acc;
      }, {}),
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(list),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
