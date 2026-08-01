const https = require('https');
const { requireRole } = require('./_shared/requireRole');

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
    // TEMP DEBUG — remove once redirect ordering is confirmed on the real deploy.
    return { statusCode: gate.status, body: JSON.stringify({ error: gate.error, debugFn: 'recipe-detail', debugPath: event.path }) };
  }

  // Read the slug from the path rather than a query param: the redirect's
  // named-placeholder-into-query-string form (?slug=:slug) matches locally
  // under netlify dev, but the real edge never substitutes it, leaving
  // queryStringParameters empty in production.
  const slug = decodeURIComponent((event.path || '').split('/').filter(Boolean).pop() || '');
  if (!slug) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing slug.' }) };
  }

  try {
    const master = await fetchAllRecipes();
    const recipe = (master.recipes || []).find(r => r.slug === slug);
    if (!recipe) {
      return { statusCode: 404, body: JSON.stringify({ error: `Recipe '${slug}' not found.` }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recipe),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
