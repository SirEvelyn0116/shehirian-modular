// Reuses trigger-sync.js's POST-to-NETLIFY_BUILD_HOOK_ID pattern exactly —
// same endpoint, same fire-and-forget shape. Extracted here (originally
// lived only in recipes-approve.js) so recipes-publish.js can fire the same
// rebuild the same way instead of a second copy of this code — both are
// "commit to the repo, then rebuild" actions and should stay identical.
const https = require('https');

function fireBuildHook(buildHookId) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      hostname: 'api.netlify.com',
      path: `/build_hooks/${buildHookId}`,
      headers: { 'Content-Type': 'application/json', 'Content-Length': 2 },
    };
    const req = https.request(options, () => resolve());
    req.on('error', reject);
    req.write('{}');
    req.end();
  });
}

module.exports = { fireBuildHook };
