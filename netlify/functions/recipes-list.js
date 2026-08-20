const https = require('https');
const { requireRole } = require('./_shared/requireRole');
const { getSql } = require('./_shared/db');

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
  const gate = requireRole('translator', context);
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
