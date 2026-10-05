// UI strings: every label the site uses must exist in ui-strings.json in all
// four languages (otherwise the site silently shows English or the raw key
// name), and the Sheet sync must fill gaps from the committed copy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { fillMissingStrings, LANGS } = require('../../scripts/ui-strings-fill');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const uiStrings = JSON.parse(read('ui-strings.json'));

// Keys the site asks for, read from the code that asks for them:
//  - generate-index.js: every t('literal') call, plus the language-switcher
//    entries ({ nameKey: 'lang_name_xx' }), whose keys reach t() via a variable;
//  - the admin preview's LABEL_KEYS list (RecipePagePreview.jsx).
function usedKeys() {
  const gen = read('generate-index.js');
  const keys = new Set();
  for (const m of gen.matchAll(/\bt\(\s*['"`]([A-Za-z0-9_]+)['"`]/g)) keys.add(m[1]);
  for (const m of gen.matchAll(/nameKey:\s*['"]([A-Za-z0-9_]+)['"]/g)) keys.add(m[1]);
  const preview = read('recipes-app/src/RecipePagePreview.jsx');
  const list = preview.match(/const LABEL_KEYS = \[([\s\S]*?)\];/);
  assert.ok(list, 'LABEL_KEYS not found in RecipePagePreview.jsx');
  for (const m of list[1].matchAll(/['"]([A-Za-z0-9_]+)['"]/g)) keys.add(m[1]);
  return [...keys].sort();
}

test('generate-index.js only passes a variable to t() for the language names', () => {
  // If a new t(someVariable) call appears, the key list above can no longer
  // see every key in use. Extend usedKeys() for it, then update this list.
  const dynamic = [...read('generate-index.js').matchAll(/(?<!function )\bt\(\s*([A-Za-z_$][\w$.]*)\s*[,)]/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(dynamic)], ['nameKey']);
});

test('every UI string the site uses exists in ui-strings.json in all four languages', () => {
  const keys = usedKeys();
  assert.ok(keys.length > 30, `found only ${keys.length} keys in use`);
  const problems = [];
  for (const key of keys) {
    if (!uiStrings[key]) {
      problems.push(`${key}: no entry`);
      continue;
    }
    for (const lang of LANGS) {
      const v = uiStrings[key][lang];
      if (typeof v !== 'string' || !v.trim()) problems.push(`${key}: ${lang} blank`);
    }
  }
  assert.deepEqual(problems, []);
});

test('Sheet fill: a row deleted from the Sheet is taken from the backup', () => {
  const backup = { btn_more: { en: 'More', fr: 'Plus', ar: 'المزيد', hy: 'Ավելին' } };
  const { merged, filled } = fillMissingStrings({}, backup);
  assert.deepEqual(merged.btn_more, backup.btn_more);
  assert.equal(filled.length, 4);
});

test('Sheet fill: only the blank cell is filled; edited cells from the Sheet are kept', () => {
  const backup = { title: { en: 'Recipes', fr: 'Recettes', ar: 'وصفات', hy: 'Բաղադրատոմսեր' } };
  const sheet = { title: { en: 'Our Recipes', fr: 'Nos recettes', ar: '  ', hy: 'Մեր բաղադրատոմսերը' } };
  const { merged, filled, unfillable } = fillMissingStrings(sheet, backup);
  assert.deepEqual(merged.title, { en: 'Our Recipes', fr: 'Nos recettes', ar: 'وصفات', hy: 'Մեր բաղադրատոմսերը' });
  assert.deepEqual(filled, [{ key: 'title', lang: 'ar' }]);
  assert.deepEqual(unfillable, []);
});

test('Sheet fill: a new key added in the Sheet is kept; its blank cells are reported, not invented', () => {
  const sheet = { new_label: { en: 'New', fr: 'Nouveau', ar: '', hy: '' } };
  const { merged, filled, unfillable } = fillMissingStrings(sheet, {});
  assert.deepEqual(merged.new_label, { en: 'New', fr: 'Nouveau', ar: '', hy: '' });
  assert.deepEqual(filled, []);
  assert.deepEqual(unfillable, [
    { key: 'new_label', lang: 'ar' },
    { key: 'new_label', lang: 'hy' },
  ]);
});

test('Sheet fill: a complete Sheet passes through unchanged', () => {
  const { merged, filled, unfillable } = fillMissingStrings(uiStrings, uiStrings);
  assert.deepEqual(merged, uiStrings);
  assert.deepEqual([filled, unfillable], [[], []]);
});
