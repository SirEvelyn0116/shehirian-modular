// Test server: the real Netlify Function handlers from netlify/functions/,
// routed through netlify.toml's redirect rules, backed by a real Postgres
// and the faked external services in fake-github.js. Optionally serves a
// built dist/ for the browser tests.
//
// What is real: every handler file, the role checks inside them, the SQL
// they run (against Postgres 16 with db/schema.sql applied), the GitHub and
// build-hook client code, and the route table.
// What is not: Netlify Identity. Netlify validates the JWT and puts the
// user's claims on context.clientContext.user; here a bearer token is looked
// up in IDENTITIES below instead. No JWT is issued or checked.
const fs = require('fs');
const http = require('http');
const path = require('path');
const { loadRedirects, resolve } = require('./routes');
const { createFakeServices } = require('./fake-github');

const ROOT = path.resolve(__dirname, '..', '..');
const FUNCTIONS_DIR = path.join(ROOT, 'netlify', 'functions');

const TEST_ENV = {
  GITHUB_TOKEN: 'test-github-token-not-real',
  GITHUB_BRANCH: 'ci-test-branch',
  NETLIFY_BUILD_HOOK_ID: 'test-build-hook',
};

const IDENTITIES = {
  'token-translator': { email: 'translator@example.test', app_metadata: { roles: ['translator'] } },
  'token-translator-2': { email: 'translator2@example.test', app_metadata: { roles: ['translator'] } },
  'token-approver': { email: 'approver@example.test', app_metadata: { roles: ['approver'] } },
  'token-both': { email: 'both@example.test', app_metadata: { roles: ['translator', 'approver'] } },
  'token-no-roles': { email: 'visitor@example.test', app_metadata: { roles: [] } },
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function configureEnv(databaseUrl) {
  Object.assign(process.env, TEST_ENV, { DATABASE_URL: databaseUrl });
  // Clover stays unconfigured so the ops endpoint answers 503 instead of
  // calling out.
  delete process.env.CLOVER_API_TOKEN;
  delete process.env.CLOVER_MERCHANT_ID;
  delete process.env.GITHUB_REPO;
}

// Must run after configureEnv(): the handlers read env vars at load time.
// db.js's getSql is replaced before any handler is required, because the
// handlers destructure it at load time.
function loadFunctions(sql) {
  const dbModule = require(path.join(FUNCTIONS_DIR, '_shared', 'db.js'));
  dbModule.getSql = () => sql;
  const functions = {};
  for (const file of fs.readdirSync(FUNCTIONS_DIR)) {
    if (!file.endsWith('.js')) continue;
    functions[path.basename(file, '.js')] = require(path.join(FUNCTIONS_DIR, file));
  }
  return functions;
}

function readBody(req) {
  return new Promise((resolveBody) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolveBody(data));
  });
}

function identityFor(req) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer (.+)$/);
  return m ? IDENTITIES[m[1]] || null : null;
}

function serveStatic(distDir, pathname, res) {
  let filePath = path.join(distDir, decodeURIComponent(pathname));
  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    return res.end();
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end(`Not found: ${pathname}`);
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

async function createTestServer({ sql, databaseUrl, recipes, distDir = null, control = null, port = 0 }) {
  configureEnv(databaseUrl);
  const services = createFakeServices({
    branch: TEST_ENV.GITHUB_BRANCH,
    token: TEST_ENV.GITHUB_TOKEN,
    buildHookId: TEST_ENV.NETLIFY_BUILD_HOOK_ID,
  });
  services.install();
  services.reset(recipes);
  const functions = loadFunctions(sql);
  const redirects = loadRedirects();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://test.local');
    try {
      if (control && url.pathname.startsWith('/__test/')) {
        return await control(url, req, res, { services, readBody });
      }
      const route = resolve(redirects, url.pathname);
      if (route && route.type === 'redirect') {
        res.writeHead(route.status, { Location: route.location });
        return res.end();
      }
      if (route && route.type === 'function') {
        const fn = functions[route.name];
        if (!fn) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: `No function ${route.name}` }));
        }
        const body = await readBody(req);
        const user = identityFor(req);
        const event = {
          path: url.pathname,
          httpMethod: req.method,
          headers: req.headers,
          queryStringParameters: Object.fromEntries(url.searchParams),
          body: body || null,
        };
        const context = { clientContext: user ? { user } : {} };
        const result = await fn.handler(event, context);
        res.writeHead(result.statusCode, { 'Content-Type': 'application/json', ...(result.headers || {}) });
        return res.end(result.body || '');
      }
      if (distDir) return serveStatic(distDir, url.pathname, res);
      res.writeHead(404);
      return res.end();
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Test server error: ${err.stack}`);
    }
  });

  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    services,
    server,
    close: () => new Promise((r) => server.close(r)),
  };
}

module.exports = { createTestServer, IDENTITIES, TEST_ENV };
