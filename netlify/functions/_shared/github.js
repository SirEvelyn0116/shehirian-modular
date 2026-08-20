// GitHub REST (Contents API) client, used only by the approve action's
// commit step. Everywhere else in this codebase reads all-recipes.json via
// the raw.githubusercontent.com CDN (recipes-list.js, recipe-detail.js,
// recipes-preview.js) — fine for read-only display, but the approve flow
// needs the file's blob SHA to commit a change, and CDN reads can lag
// behind HEAD, which would risk the conflict-check comparing against a
// stale value. The Contents API GET below is the one authoritative read
// this whole module relies on: same request serves both the conflict-check
// content and the blob SHA the commit needs.
const https = require('https');

function githubRequest(method, apiPath, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const options = {
      method,
      hostname: 'api.github.com',
      path: apiPath,
      headers: {
        Authorization: `token ${token}`,
        // Required by GitHub's API — requests with no User-Agent are
        // rejected outright, unlike the raw.githubusercontent.com fetches
        // elsewhere in this codebase.
        'User-Agent': 'shehirian-modular-recipe-admin',
        Accept: 'application/vnd.github+json',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let parsed;
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch (e) {
          return reject(new Error(`GitHub API returned a non-JSON response (status ${res.statusCode}): ${raw.slice(0, 200)}`));
        }
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(parsed);
        reject(new Error(`GitHub API ${method} ${apiPath} failed (${res.statusCode}): ${parsed.message || raw}`));
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Reads a file's current content AND blob SHA in one call — the SHA is
// what the commit below needs to prove it's not overwriting a change it
// hasn't seen (GitHub rejects a PUT whose `sha` doesn't match current HEAD).
async function getFile({ repo, branch, path, token }) {
  const result = await githubRequest('GET', `/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`, token);
  const content = Buffer.from(result.content, 'base64').toString('utf8');
  return { sha: result.sha, content, json: JSON.parse(content) };
}

// Commits new file content in ONE commit — the point of no return in the
// approve flow. Returns the resulting commit SHA, which becomes
// edit_log.commit_sha: the idempotency key the rest of the flow hangs off.
async function putFile({ repo, branch, path, token, content, sha, message }) {
  const result = await githubRequest('PUT', `/repos/${repo}/contents/${encodeURIComponent(path)}`, token, {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    sha,
    branch,
  });
  return { commitSha: result.commit.sha };
}

// The branch's current HEAD commit SHA. Used only for the narrow crash-
// recovery case in recipes-approve.js: an edit whose value is already
// correct in the file (so this call won't commit anything for it) but was
// never logged, because an earlier invocation crashed after committing but
// before finishing its own bookkeeping. There's no way to know exactly
// which past commit introduced that value without walking history, and
// edit_log.commit_sha is NOT NULL — the branch's current HEAD is the
// closest honest answer ("this is the commit under which this content is
// known to be correct"), not a guess.
async function getBranchHeadSha({ repo, branch, token }) {
  const result = await githubRequest('GET', `/repos/${repo}/commits/${encodeURIComponent(branch)}`, token);
  return result.sha;
}

// Test-infrastructure helper only (used by the Phase 5 scratch-branch
// integration test, never by the production approve handler) — creates a
// branch from another branch's current tip if it doesn't already exist.
async function ensureBranchExists({ repo, branch, fromBranch, token }) {
  try {
    await githubRequest('GET', `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, token);
    return { created: false };
  } catch (e) {
    if (!/\(404\)/.test(e.message)) throw e;
  }
  const base = await githubRequest('GET', `/repos/${repo}/git/ref/heads/${encodeURIComponent(fromBranch)}`, token);
  await githubRequest('POST', `/repos/${repo}/git/refs`, token, {
    ref: `refs/heads/${branch}`,
    sha: base.object.sha,
  });
  return { created: true };
}

module.exports = { getFile, putFile, getBranchHeadSha, ensureBranchExists };
