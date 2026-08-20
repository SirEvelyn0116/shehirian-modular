// LOCAL DEV ONLY — never deployed. This file lives outside netlify/functions/
// (the only directory Netlify's build actually bundles, per netlify.toml's
// [functions].directory) and isn't referenced by [build].command anywhere,
// so there is no path — none — by which this code, or the auth stub it
// injects, can end up running on a real deploy. See LOCAL_DEV.md for the
// full explanation of what this does and does not verify.
//
// What this does: serves dist/ statically and routes /api/* into the REAL
// Netlify Function handlers (unmodified, same files that deploy) with a
// hand-built, hardcoded translator+approver identity — because there is no
// real Netlify Identity backend to validate a JWT against locally. Also
// injects a small stub script into admin/index.html (in memory, per
// request — never touches the file on disk) so the browser side doesn't
// need manual console surgery either.
//
// Route table below must be kept in sync with netlify.toml's [[redirects]]
// by hand — there's no shared source between them.
//
// Run via `npm run dev:auth-stub` (wraps `netlify dev:exec`, which injects
// DATABASE_URL and friends from the linked Netlify site — this script does
// not read .env itself and will not have DATABASE_URL without it).

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.resolve(__dirname, '..');
const distDir = path.join(ROOT, 'dist');
const PORT = 8888;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Run this via `npm run dev:auth-stub`, not `node scripts/dev-server.js` directly.');
  process.exit(1);
}

// Safe-by-default local commit target for the Phase 5 approve action. Only
// applies here, in this LOCAL-DEV-ONLY, never-deployed process — NOT inside
// recipes-approve.js itself, and deliberately so: that module's own
// `process.env.GITHUB_BRANCH || 'translation-pipeline'` fallback is
// untouched, because THAT is the line that also runs in production, and
// production must keep defaulting to the real branch with no scratch
// fallback anywhere it could reach. This just pre-sets the env var, in this
// process only, before recipes-approve.js is require()'d below and reads it
// into its own top-level const — so by the time that read happens, "unset"
// has already become "test/phase5-scratch" *for this dev server*, and nowhere
// else. An explicit GITHUB_BRANCH (set before running this script) is left
// alone and wins, exactly like the DATABASE_URL/GITHUB_TOKEN vars above —
// this only fills in the gap when nothing was set at all.
if (!process.env.GITHUB_BRANCH) {
  process.env.GITHUB_BRANCH = 'test/phase5-scratch';
}

const recipesList = require(path.join(ROOT, 'netlify/functions/recipes-list.js'));
const recipeDetail = require(path.join(ROOT, 'netlify/functions/recipe-detail.js'));
const recipesPreview = require(path.join(ROOT, 'netlify/functions/recipes-preview.js'));
const editCreate = require(path.join(ROOT, 'netlify/functions/edit-create.js'));
const editsMine = require(path.join(ROOT, 'netlify/functions/edits-mine.js'));
const editDelete = require(path.join(ROOT, 'netlify/functions/edit-delete.js'));
const recipesApprove = require(path.join(ROOT, 'netlify/functions/recipes-approve.js'));

// The stub identity. requireRole() reads context.clientContext.user exactly
// like it would from a real validated JWT's claims — this is a fake claims
// object, not a fake requireRole. The role-check logic itself is untouched
// and does run for real against this object (see LOCAL_DEV.md for what
// that does and doesn't prove). Defined in stub-identity.js, not here, so
// db/clean-test-edits.js can import the same email without importing this
// whole server (which would start listening as a side effect).
const { STUB_USER } = require('./stub-identity.js');
const fakeCtx = { clientContext: { user: STUB_USER } };

const DEV_AUTH_STUB_SCRIPT = `
<script>
console.warn('%c⚠️ LOCAL DEV AUTH STUB ACTIVE — served by scripts/dev-server.js, not the real site. Netlify Identity is stubbed as ${STUB_USER.email}; the JWT is never validated. See LOCAL_DEV.md.', 'font-weight:bold;color:#b91c1c;background:#fef2f2;padding:2px 6px;');
window.netlifyIdentity.currentUser = () => ({
  email: '${STUB_USER.email}',
  jwt: () => Promise.resolve('local-dev-fake-token'),
  app_metadata: ${JSON.stringify(STUB_USER.app_metadata)},
});
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('translator-ui').style.display = 'block';
  document.getElementById('tab-recipes').classList.remove('hidden');
  switchView('recipes');

  // Mirrors admin.js's netlifyIdentity.on('login', ...) role-badge logic —
  // duplicated, not shared, because this whole block only exists to bypass
  // that real event (there's no real login to fire it locally). Same
  // duplication the DOM-reveal lines above already accepted; keep both in
  // sync by hand if admin.js's role-badge logic changes.
  const badge = document.getElementById('dashboard-role-badge');
  const roles = ${JSON.stringify(STUB_USER.app_metadata.roles)};
  const isTranslator = roles.includes('translator');
  const isApprover = roles.includes('approver');
  if (isTranslator && isApprover) {
    badge.textContent = ' — Translator & Approver view';
    badge.className = 'role-badge role-badge-both';
  } else if (isApprover) {
    badge.textContent = ' — Approver view';
    badge.className = 'role-badge role-badge-approver';
  } else if (isTranslator) {
    badge.textContent = ' — Translator view';
    badge.className = 'role-badge role-badge-translator';
  }
});
</script>`;

const mime = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
};

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
  });
}

function sendJson(res, result) {
  res.writeHead(result.statusCode, { 'Content-Type': 'application/json' });
  res.end(result.body);
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  // --- API routes: real handlers, real DB, stubbed identity ---
  if (parsed.pathname === '/api/recipes' && req.method === 'GET') {
    return sendJson(res, await recipesList.handler({}, fakeCtx));
  }
  if (parsed.pathname === '/api/edits/mine' && req.method === 'GET') {
    return sendJson(res, await editsMine.handler({}, fakeCtx));
  }
  if (parsed.pathname === '/api/edits' && req.method === 'POST') {
    const body = await readBody(req);
    return sendJson(res, await editCreate.handler({ body }, fakeCtx));
  }
  if (/^\/api\/edits\/[^/]+$/.test(parsed.pathname) && req.method === 'DELETE') {
    return sendJson(res, await editDelete.handler({ path: parsed.pathname }, fakeCtx));
  }
  if (parsed.pathname === '/api/recipes/preview' && req.method === 'GET') {
    return sendJson(res, await recipesPreview.handler({}, fakeCtx));
  }
  if (parsed.pathname === '/api/recipes/approve' && req.method === 'POST') {
    const body = await readBody(req);
    return sendJson(res, await recipesApprove.handler({ body, httpMethod: 'POST' }, fakeCtx));
  }
  if (/^\/api\/recipes\/[^/]+$/.test(parsed.pathname) && req.method === 'GET') {
    return sendJson(res, await recipeDetail.handler({ path: parsed.pathname }, fakeCtx));
  }

  // --- Static files, with the auth stub injected into admin/index.html only ---
  let filePath = path.join(distDir, decodeURIComponent(parsed.pathname));
  if (parsed.pathname.endsWith('/')) filePath = path.join(filePath, 'index.html');
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, parsed.pathname, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not found: ' + parsed.pathname);
  }

  if (filePath === path.join(distDir, 'admin', 'index.html')) {
    const html = fs.readFileSync(filePath, 'utf8').replace('</body>', DEV_AUTH_STUB_SCRIPT + '</body>');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(html);
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`\n⚠️  LOCAL AUTH STUB DEV SERVER — not netlify dev, not deployable.`);
  console.log(`   Stub identity: ${STUB_USER.email}  roles: [${STUB_USER.app_metadata.roles.join(', ')}]`);
  const isProdBranch = process.env.GITHUB_BRANCH === 'translation-pipeline';
  console.log(`   Approve action commit target: ${process.env.GITHUB_BRANCH}${isProdBranch ? '  ⚠️  PRODUCTION — set explicitly, not the default' : '  (scratch — safe default)'}`);
  console.log(`   Open: http://localhost:${PORT}/admin/\n`);
});
