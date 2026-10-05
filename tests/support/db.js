// Test database setup. Applies db/schema.sql with the same statement splitter
// db/migrate.js uses, so a schema change that breaks the migration also
// breaks every API and UI test.
const fs = require('fs');
const path = require('path');
const { splitSchema } = require('../../db/splitSchema');
const { createSql } = require('./pg-sql');

const ROOT = path.resolve(__dirname, '..', '..');

function testDatabaseUrl() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Point it at a throwaway local Postgres, e.g. ' +
        'postgres://postgres:postgres@127.0.0.1:5432/shehirian_test (see TESTING.md).',
    );
  }
  // The tests truncate tables. Refuse anything that looks like a hosted
  // database, so a copied production URL can never be wiped by a test run.
  const host = new URL(url).hostname;
  if (!['127.0.0.1', 'localhost', '::1', 'postgres'].includes(host)) {
    throw new Error(`TEST_DATABASE_URL must point at a local database, not ${host}.`);
  }
  return url;
}

async function applySchema(sql) {
  const schema = fs.readFileSync(path.join(ROOT, 'db', 'schema.sql'), 'utf8');
  for (const stmt of splitSchema(schema)) {
    await sql.query(stmt);
  }
}

async function resetData(sql) {
  await sql.query('truncate edits, edit_log');
}

async function openTestDb() {
  const sql = createSql(testDatabaseUrl());
  await applySchema(sql);
  return sql;
}

module.exports = { openTestDb, applySchema, resetData, testDatabaseUrl };
