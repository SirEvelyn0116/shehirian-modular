// fieldPath grammar (build spec §1): scalar fields are bare names; array
// items are 'key[index]'. Mirrors recipes-app/src/fieldUtils.js's frontend
// version — same grammar, read side, backend copy since functions and the
// React app don't share a module boundary.
function parseFieldPath(fieldPath) {
  const m = fieldPath.match(/^(\w+)\[(\d+)\]$/);
  if (m) return { key: m[1], index: Number(m[2]) };
  return { key: fieldPath, index: null };
}

function getFieldValue(recipe, fieldPath, lang) {
  const { key, index } = parseFieldPath(fieldPath);
  const field = recipe[key];
  if (!field) return '';
  if (index !== null) return (field[lang] && field[lang][index]) ?? '';
  return field[lang] ?? '';
}

module.exports = { parseFieldPath, getFieldValue };
