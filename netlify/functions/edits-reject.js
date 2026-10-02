const { requireRole } = require('./_shared/requireRole');
const { getSql } = require('./_shared/db');

// Approver rejects one or more pending edits (translations or queued
// publish requests). Nothing is committed or deployed — the rows just
// leave the pending queue with status 'rejected', and each rejection is
// recorded in edit_log (action 'rejected', commit_sha null) so the history
// shows who turned down what.
//
// A rejected edit isn't gone for good: if the translator saves that field
// again, edit-create.js's upsert resets the row to 'pending' and it comes
// back to the Review page as a fresh submission.
//
// Status flip and log rows go in one transaction, same as the approve
// action's steps 4+5, so a rejection can't land without its audit row.
exports.handler = async (event, context) => {
  const gate = requireRole('approver', context);
  if (!gate.ok) {
    return { statusCode: gate.status, body: JSON.stringify({ error: gate.error }) };
  }

  if (event.httpMethod && event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'POST only.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
  }

  const { editIds } = body;
  if (!Array.isArray(editIds) || editIds.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'editIds must be a non-empty array.' }) };
  }

  const approverEmail = gate.user.email;

  try {
    const sql = getSql();
    // Only still-pending rows. Anything already resolved (approved or
    // rejected by a concurrent request) is silently skipped, and the
    // response reports what was actually rejected.
    const selected = await sql`select * from edits where id = any(${editIds}) and status = 'pending'`;
    if (selected.length === 0) {
      return json(200, { rejected: [], totalRequested: editIds.length, totalRejected: 0 });
    }

    const ids = selected.map((e) => e.id);
    await sql.transaction([
      sql`update edits set status = 'rejected', resolved_at = now(), resolved_by = ${approverEmail} where id = any(${ids}) and status = 'pending'`,
      ...selected.map((edit) => sql`
        insert into edit_log (recipe_slug, lang, field_path, old_value, new_value, action, editor_email, resolved_by, commit_sha)
        values (${edit.recipe_slug}, ${edit.lang}, ${edit.field_path}, ${edit.old_value}, ${edit.new_value}, 'rejected', ${edit.editor_email}, ${approverEmail}, null)
      `),
    ]);

    return json(200, {
      rejected: selected.map((e) => ({ id: e.id, recipeSlug: e.recipe_slug, lang: e.lang, fieldPath: e.field_path })),
      totalRequested: editIds.length,
      totalRejected: selected.length,
    });
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

function json(statusCode, payload) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
}
