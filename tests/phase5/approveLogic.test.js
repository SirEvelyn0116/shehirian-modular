// Unit tests for the pure Phase 5 approve logic — no real GitHub, no real
// database, no Netlify Functions runtime. Fixture `all-recipes.json` +
// fixture edit rows in, plain data out. This is where the approve action's
// correctness risk actually lives (the conflict guard, the JSON transform,
// the idempotency check), so it's covered offline rather than only via the
// scratch-branch integration test.
//
// Run via `node --test tests/phase5/` (Node's built-in test runner — no
// extra dependency needed for pure-function tests like these).
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyEdits,
  applyEditsToJson,
  filterAlreadyLogged,
} = require('../../netlify/functions/_shared/approveLogic');

function fixtureRecipes() {
  return {
    recipes: [
      {
        slug: 'royal-soup',
        title: { en: 'Royal Soup', ar: 'حساء ملكي', fr: 'Soupe Royale' },
        ingredients: { en: ['broth', 'rice'], ar: ['مرق', 'أرز'], fr: ['bouillon', 'riz'] },
      },
      {
        slug: 'shirag',
        title: { en: 'Shirag', ar: 'شيراج', fr: 'Shirag' },
        ingredients: { en: ['flour'], ar: ['طحين'], fr: ['farine'] },
      },
    ],
  };
}

function edit(overrides) {
  return {
    id: 'edit-1',
    recipe_slug: 'royal-soup',
    lang: 'ar',
    field_path: 'title',
    old_value: 'حساء ملكي',
    new_value: 'حساء ملكي جديد',
    editor_email: 'translator@example.com',
    status: 'pending',
    ...overrides,
  };
}

// --- classifyEdits: the conflict-guard comparison ---

test('classifyEdits: clean edit (live value still matches old_value) goes to toApply', () => {
  const { toApply, conflicts, alreadyAppliedInFile } = classifyEdits(fixtureRecipes(), [edit()]);
  assert.equal(toApply.length, 1);
  assert.equal(conflicts.length, 0);
  assert.equal(alreadyAppliedInFile.length, 0);
  assert.equal(toApply[0].id, 'edit-1');
});

test('classifyEdits: stale edit (live value moved to a third value) is a conflict', () => {
  const recipes = fixtureRecipes();
  recipes.recipes[0].title.ar = 'قيمة مختلفة تمامًا'; // someone else changed it since staging
  const { toApply, conflicts } = classifyEdits(recipes, [edit()]);
  assert.equal(toApply.length, 0);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].reason, 'stale');
  assert.equal(conflicts[0].currentValue, 'قيمة مختلفة تمامًا');
});

test('classifyEdits: live value already equal to new_value is alreadyAppliedInFile, not a conflict', () => {
  const recipes = fixtureRecipes();
  recipes.recipes[0].title.ar = 'حساء ملكي جديد'; // matches edit's new_value exactly
  const { toApply, conflicts, alreadyAppliedInFile } = classifyEdits(recipes, [edit()]);
  assert.equal(toApply.length, 0);
  assert.equal(conflicts.length, 0);
  assert.equal(alreadyAppliedInFile.length, 1);
});

test('classifyEdits: edit for a recipe that no longer exists is a conflict', () => {
  const { conflicts } = classifyEdits(fixtureRecipes(), [edit({ recipe_slug: 'deleted-recipe' })]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].reason, 'recipe-not-found');
});

test('classifyEdits: array field (ingredients[n]) is classified the same way as scalar fields', () => {
  const clean = edit({ id: 'e2', field_path: 'ingredients[1]', old_value: 'أرز', new_value: 'أرز بسمتي' });
  const { toApply } = classifyEdits(fixtureRecipes(), [clean]);
  assert.equal(toApply.length, 1);
});

test('classifyEdits: a mixed batch partitions each edit independently', () => {
  const recipes = fixtureRecipes();
  recipes.recipes[1].title.ar = 'قيمة أخرى'; // will conflict for the shirag edit below
  const edits = [
    edit({ id: 'clean' }),
    edit({ id: 'conflict', recipe_slug: 'shirag', old_value: 'شيراج', new_value: 'شيراج جديد' }),
  ];
  const { toApply, conflicts } = classifyEdits(recipes, edits);
  assert.deepEqual(toApply.map((e) => e.id), ['clean']);
  assert.deepEqual(conflicts.map((e) => e.id), ['conflict']);
});

// --- applyEditsToJson: the apply-to-JSON transform ---

test('applyEditsToJson: writes a scalar field at the right recipe/lang', () => {
  const result = applyEditsToJson(fixtureRecipes(), [edit()]);
  assert.equal(result.recipes[0].title.ar, 'حساء ملكي جديد');
});

test('applyEditsToJson: writes an array-indexed field without disturbing other indices', () => {
  const e = edit({ field_path: 'ingredients[1]', new_value: 'أرز بسمتي' });
  const result = applyEditsToJson(fixtureRecipes(), [e]);
  assert.equal(result.recipes[0].ingredients.ar[1], 'أرز بسمتي');
  assert.equal(result.recipes[0].ingredients.ar[0], 'مرق'); // untouched
});

test('applyEditsToJson: applies multiple edits across multiple recipes in one call', () => {
  const edits = [
    edit({ id: 'e1' }),
    edit({ id: 'e2', recipe_slug: 'shirag', old_value: 'شيراج', new_value: 'شيراج محدث' }),
  ];
  const result = applyEditsToJson(fixtureRecipes(), edits);
  assert.equal(result.recipes[0].title.ar, 'حساء ملكي جديد');
  assert.equal(result.recipes[1].title.ar, 'شيراج محدث');
});

test('applyEditsToJson: does not mutate the input object', () => {
  const original = fixtureRecipes();
  const originalArTitle = original.recipes[0].title.ar;
  applyEditsToJson(original, [edit()]);
  assert.equal(original.recipes[0].title.ar, originalArTitle);
});

test('applyEditsToJson: an edit whose recipe is missing is silently skipped (classifyEdits should have already excluded it)', () => {
  const result = applyEditsToJson(fixtureRecipes(), [edit({ recipe_slug: 'nonexistent' })]);
  assert.equal(result.recipes.length, 2); // unchanged, no throw
});

// --- filterAlreadyLogged: the idempotency check ---

test('filterAlreadyLogged: an edit with a matching edit_log row (same content) is alreadyLogged', () => {
  const logRow = { recipe_slug: 'royal-soup', lang: 'ar', field_path: 'title', new_value: 'حساء ملكي جديد', commit_sha: 'abc123' };
  const { needsLogging, alreadyLogged } = filterAlreadyLogged([edit()], [logRow]);
  assert.equal(needsLogging.length, 0);
  assert.equal(alreadyLogged.length, 1);
  assert.equal(alreadyLogged[0].commitSha, 'abc123');
});

test('filterAlreadyLogged: an edit with no matching row needs logging', () => {
  const { needsLogging, alreadyLogged } = filterAlreadyLogged([edit()], []);
  assert.equal(needsLogging.length, 1);
  assert.equal(alreadyLogged.length, 0);
});

test('filterAlreadyLogged: a same-field row with a DIFFERENT new_value does not count as a match', () => {
  // Same recipe/lang/field as `edit()`, but a different new_value — this
  // must be treated as a distinct edit (e.g. the translator re-edited the
  // field again after an earlier version was already shipped), not as
  // proof this specific edit was already applied.
  const logRow = { recipe_slug: 'royal-soup', lang: 'ar', field_path: 'title', new_value: 'قيمة قديمة مختلفة', commit_sha: 'abc123' };
  const { needsLogging, alreadyLogged } = filterAlreadyLogged([edit()], [logRow]);
  assert.equal(needsLogging.length, 1);
  assert.equal(alreadyLogged.length, 0);
});

test('filterAlreadyLogged: matches independently per edit in a mixed batch', () => {
  const edits = [
    edit({ id: 'logged' }),
    edit({ id: 'not-logged', field_path: 'ingredients[0]', old_value: 'مرق', new_value: 'مرق دجاج' }),
  ];
  const logRows = [
    { recipe_slug: 'royal-soup', lang: 'ar', field_path: 'title', new_value: 'حساء ملكي جديد', commit_sha: 'sha1' },
  ];
  const { needsLogging, alreadyLogged } = filterAlreadyLogged(edits, logRows);
  assert.deepEqual(needsLogging.map((e) => e.id), ['not-logged']);
  assert.deepEqual(alreadyLogged.map((e) => e.id), ['logged']);
});
