const { requireRole } = require('./_shared/requireRole');
const { getSql } = require('./_shared/db');

exports.handler = async (event, context) => {
  const gate = requireRole('translator', context);
  if (!gate.ok) {
    return { statusCode: gate.status, body: JSON.stringify({ error: gate.error }) };
  }

  try {
    const sql = getSql();
    const rows = await sql`
      select * from edits
      where field_path <> 'published'  -- queued publish requests aren't translator edits
        and (
          (editor_email = ${gate.user.email} and status = 'pending')
          -- Rejections are shown to every translator, not just the author:
          -- the point is that nobody resubmits the same thing. A rejected
          -- row lasts only until someone saves that field again.
          or status = 'rejected'
        )
      order by updated_at desc
    `;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rows),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
