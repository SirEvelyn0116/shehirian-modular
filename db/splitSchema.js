// Splits schema.sql into individual statements: drops whole-line `--`
// comments, then splits on ';'. Kept in its own side-effect-free module so
// db/migrate.js and the test suite (tests/support/db.js) apply the schema
// with exactly the same logic. A ';' inside an end-of-line comment breaks
// this split — see the note at the top of schema.sql.
function splitSchema(schema) {
  return schema
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = { splitSchema };
