const { requireRole } = require('./_shared/requireRole');
const { getSql } = require('./_shared/db');

const TARGET_LANGS = ['fr', 'ar', 'hy'];

exports.handler = async (event, context) => {
  const gate = requireRole('translator', context);
  if (!gate.ok) {
    return { statusCode: gate.status, body: JSON.stringify({ error: gate.error }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
  }

  const { recipeSlug, lang, fieldPath, refValue, oldValue, newValue } = body;

  if (!recipeSlug || !fieldPath || typeof newValue !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'recipeSlug, fieldPath, and newValue are required.' }) };
  }
  if (!TARGET_LANGS.includes(lang)) {
    return { statusCode: 400, body: JSON.stringify({ error: `lang must be one of: ${TARGET_LANGS.join(', ')}.` }) };
  }

  const editorEmail = gate.user.email;

  try {
    const sql = getSql();
    // Upsert on (recipe_slug, lang, field_path) — re-editing the same field
    // replaces the pending value rather than creating duplicates, and always
    // resets status to 'pending' since it's a fresh, unresolved edit.
    const [edit] = await sql`
      insert into edits (recipe_slug, lang, field_path, ref_value, old_value, new_value, editor_email, status, updated_at, resolved_at, resolved_by)
      values (${recipeSlug}, ${lang}, ${fieldPath}, ${refValue ?? null}, ${oldValue ?? null}, ${newValue}, ${editorEmail}, 'pending', now(), null, null)
      on conflict (recipe_slug, lang, field_path)
      do update set
        ref_value = excluded.ref_value,
        old_value = excluded.old_value,
        new_value = excluded.new_value,
        editor_email = excluded.editor_email,
        status = 'pending',
        updated_at = now(),
        resolved_at = null,
        resolved_by = null
      returning *
    `;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edit),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
