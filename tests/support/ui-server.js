// Server for the Playwright suite (started by playwright.config.js). Serves
// the built dist/ and the real functions, exactly like tests/support/server.js,
// plus /__test/* control endpoints the browser tests use to reset state and
// read what the fake GitHub received. Never deployed: tests/ is not part of
// the Netlify build or the functions bundle.
const path = require('path');
const { openTestDb, resetData, testDatabaseUrl } = require('./db');
const { createTestServer } = require('./server');
const fixture = require('../fixtures/all-recipes.json');

const PORT = Number(process.env.UI_TEST_PORT || 4173);
const DIST = path.resolve(__dirname, '..', '..', 'dist');
const freshFixture = () => JSON.parse(JSON.stringify(fixture));

async function main() {
  const sql = await openTestDb();

  const control = async (url, req, res, { services }) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === '/__test/health') return send(200, { ok: true });
    if (url.pathname === '/__test/reset' && req.method === 'POST') {
      await resetData(sql);
      services.reset(freshFixture());
      return send(200, { ok: true });
    }
    if (url.pathname === '/__test/github') {
      const { commits, buildHooks, headSha } = services.state;
      return send(200, { commits, buildHooks, headSha });
    }
    return send(404, { error: 'unknown control endpoint' });
  };

  const app = await createTestServer({
    sql,
    databaseUrl: testDatabaseUrl(),
    recipes: freshFixture(),
    distDir: DIST,
    control,
    port: PORT,
  });
  console.log(`UI test server on ${app.baseUrl}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
