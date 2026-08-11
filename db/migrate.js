// One-off / re-runnable schema apply. Requires DATABASE_URL in the
// environment — run via `netlify dev:exec node db/migrate.js` locally, or
// `node db/migrate.js` anywhere DATABASE_URL is already set.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in the environment.');
  }
  const sql = neon(process.env.DATABASE_URL);
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = schema
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);

  // Each statement is idempotent (IF NOT EXISTS) — run sequentially rather
  // than in one transaction, so a partial re-run is always safe to retry.
  for (const stmt of statements) {
    await sql.query(stmt);
    console.log('  ✓', stmt.split('\n')[0].slice(0, 60));
  }
  console.log('✅ Schema applied.');
}

main().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
