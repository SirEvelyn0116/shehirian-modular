// A stand-in for @neondatabase/serverless's `neon()` client, backed by a
// real Postgres via node-postgres. The functions only use two parts of the
// Neon API, and both are reproduced here:
//
//   sql`select ... ${value}`   tagged template, resolves to an array of rows.
//                              Like Neon, the query runs when awaited, not
//                              when the template is evaluated.
//   sql.transaction([q1, q2])  runs un-awaited queries in one transaction.
//
// Interpolated values become $1, $2 ... parameters (never string-spliced),
// which is also what Neon does.
const { Pool } = require('pg');

function createSql(connectionString) {
  const pool = new Pool({ connectionString, max: 4 });

  function sql(strings, ...values) {
    let text = strings[0];
    values.forEach((_, i) => {
      text += `$${i + 1}${strings[i + 1]}`;
    });
    let promise = null;
    const run = () => {
      if (!promise) promise = pool.query(text, values).then((r) => r.rows);
      return promise;
    };
    return {
      text,
      values,
      then: (onFulfilled, onRejected) => run().then(onFulfilled, onRejected),
      catch: (onRejected) => run().catch(onRejected),
    };
  }

  sql.transaction = async (queries) => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const results = [];
      for (const q of queries) {
        results.push((await client.query(q.text, q.values)).rows);
      }
      await client.query('commit');
      return results;
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  };

  sql.query = (text, params) => pool.query(text, params).then((r) => r.rows);
  sql.end = () => pool.end();

  return sql;
}

module.exports = { createSql };
