const https = require('https');
const { requireRole } = require('./_shared/requireRole');
const { getSql } = require('./_shared/db');
const { getFieldValue } = require('./_shared/fieldPath');

const GITHUB_REPO = process.env.GITHUB_REPO || 'SirEvelyn0116/shehirian-modular';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'translation-pipeline';
const TARGET_LANGS = ['fr', 'ar', 'hy'];

// Source of truth is the committed JSON, not the deployed site — same
// reasoning as recipes-list.js / recipe-detail.js.
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
  const gate = requireRole('approver', context);
  if (!gate.ok) {
    return { statusCode: gate.status, body: JSON.stringify({ error: gate.error }) };
  }

  try {
    const sql = getSql();
    const [master, pending] = await Promise.all([
      fetchAllRecipes(),
      sql`select * from edits where status = 'pending' order by updated_at asc`,
    ]);

    const recipesBySlug = {};
    (master.recipes || []).forEach(r => { recipesBySlug[r.slug] = r; });

    // Grouped by recipe, not a flat key/value list — Phase 4 spec.
    // "Old" is the CURRENT live value (read fresh from all-recipes.json just
    // now), not the edit's stored old_value snapshot — that snapshot is for
    // the Phase 5 conflict guard, not for display here. Conflict detection
    // itself is deferred to Phase 5 entirely; this is a plain live-vs-
    // proposed diff, same vocabulary as ui-strings' fetch-preview.
    const groups = {};
    const changesByLang = { fr: 0, ar: 0, hy: 0 };
    let totalChanges = 0;

    pending.forEach(edit => {
      const recipe = recipesBySlug[edit.recipe_slug];
      if (!recipe) return; // recipe removed/renamed since the edit was staged — skip defensively

      if (!groups[edit.recipe_slug]) {
        groups[edit.recipe_slug] = {
          slug: edit.recipe_slug,
          title: (recipe.title && recipe.title.en) || edit.recipe_slug,
          edits: [],
        };
      }

      groups[edit.recipe_slug].edits.push({
        id: edit.id,
        lang: edit.lang,
        fieldPath: edit.field_path,
        oldValue: getFieldValue(recipe, edit.field_path, edit.lang),
        newValue: edit.new_value,
        editorEmail: edit.editor_email,
        updatedAt: edit.updated_at,
      });

      totalChanges++;
      if (TARGET_LANGS.includes(edit.lang)) changesByLang[edit.lang]++;
    });

    const recipes = Object.values(groups).sort((a, b) => a.title.localeCompare(b.title));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalChanges, changesByLang, recipes }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
