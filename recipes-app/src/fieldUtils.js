// fieldPath grammar (build spec §1): scalar fields are bare names; array
// items are 'key[index]'. These helpers are the frontend's read side of
// that grammar — the backend parses the same paths at approval time.
const SCALAR_FIELDS = ['title', 'description', 'recipeCategory', 'recipeCuisine', 'recipeYield'];
const ARRAY_FIELDS = ['ingredients', 'instructions'];

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

// All editable fieldPaths for a recipe, array length taken from the target
// language (ar) — that's what's actually rendered/edited. v1 scope: existing
// items only, no add/remove/reorder (build spec's scope boundary).
function buildEditableFieldPaths(recipe) {
  const paths = [...SCALAR_FIELDS];
  ARRAY_FIELDS.forEach(key => {
    const items = (recipe[key] && recipe[key].ar) || [];
    items.forEach((_, i) => paths.push(`${key}[${i}]`));
  });
  return paths;
}

// Returns a clone of `recipe` with `lang`'s values overridden by any
// *pending* (saved) field states — not dirty/unsaved ones. Preview shows
// what's actually staged to ship, not speculative in-progress keystrokes.
function applyPendingEdits(recipe, fieldStates, lang) {
  const clone = JSON.parse(JSON.stringify(recipe));
  Object.entries(fieldStates).forEach(([fieldPath, state]) => {
    if (state.status !== 'pending') return;
    const { key, index } = parseFieldPath(fieldPath);
    if (!clone[key]) return;
    if (index !== null) {
      if (!clone[key][lang]) clone[key][lang] = [];
      clone[key][lang][index] = state.value;
    } else {
      clone[key][lang] = state.value;
    }
  });
  return clone;
}

export { parseFieldPath, getFieldValue, buildEditableFieldPaths, applyPendingEdits };
