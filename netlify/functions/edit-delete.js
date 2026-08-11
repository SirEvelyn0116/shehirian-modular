const { requireRole } = require('./_shared/requireRole');
const { getSql } = require('./_shared/db');

exports.handler = async (event, context) => {
  const gate = requireRole('translator', context);
  if (!gate.ok) {
    return { statusCode: gate.status, body: JSON.stringify({ error: gate.error }) };
  }

  // Read the id from the path, not a query param — the redirect's named-
  // placeholder-into-query-string form doesn't survive to production (see
  // recipe-detail.js for the full story).
  const id = decodeURIComponent((event.path || '').split('/').filter(Boolean).pop() || '');
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing id.' }) };
  }

  try {
    const sql = getSql();
    // Only the caller's own PENDING edit can be discarded — scoping the
    // delete by editor_email rather than checking-then-deleting avoids a
    // race, and doubles as the ownership check. Approved edits are a shipped
    // audit record, not something to discard; this is "retract before
    // approval," per the spec.
    const [deleted] = await sql`
      delete from edits
      where id = ${id} and editor_email = ${gate.user.email} and status = 'pending'
      returning id
    `;

    if (!deleted) {
      return { statusCode: 404, body: JSON.stringify({ error: `No pending edit '${id}' found for this account.` }) };
    }

    return { statusCode: 200, body: JSON.stringify({ id: deleted.id }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
