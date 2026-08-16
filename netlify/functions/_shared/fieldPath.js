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

// Write side, added for Phase 5's approve action. Mutates `recipe` in
// place — callers that need immutability (approveLogic.js's
// applyEditsToJson) deep-clone first, same pattern as the frontend's
// applyCurrentEdits in fieldUtils.js.
function setFieldValue(recipe, fieldPath, lang, value) {
  const { key, index } = parseFieldPath(fieldPath);
  if (!recipe[key]) recipe[key] = {};
  if (index !== null) {
    if (!recipe[key][lang]) recipe[key][lang] = [];
    recipe[key][lang][index] = value;
  } else {
    recipe[key][lang] = value;
  }
}

module.exports = { parseFieldPath, getFieldValue, setFieldValue };
