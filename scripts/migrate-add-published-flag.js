// One-time migration — adds the per-language `published` flag to every
// recipe in sections/recipes/all-recipes.json. Idempotent: a recipe that
// already has a `published` object is left untouched, so this is safe to
// re-run (e.g. after a merge conflict) without clobbering flags someone has
// already flipped.
//
// Default is all-false for every language: nothing has been verified yet,
// so nothing should show real content until an approver deliberately
// publishes it (build spec: "published flag" feature).
//
// Run: node scripts/migrate-add-published-flag.js
const fs = require('fs');
const path = require('path');

const LANGS = ['en', 'fr', 'ar', 'hy'];
const masterPath = path.join(__dirname, '..', 'sections', 'recipes', 'all-recipes.json');

const raw = fs.readFileSync(masterPath, 'utf8');
const master = JSON.parse(raw);

let added = 0;
let alreadyPresent = 0;

master.recipes.forEach((recipe) => {
  if (recipe.published && typeof recipe.published === 'object') {
    alreadyPresent++;
    return;
  }
  recipe.published = LANGS.reduce((acc, lang) => {
    acc[lang] = false;
    return acc;
  }, {});
  added++;
});

// Same serialization the approve pipeline uses when it commits this file
// (2-space indent, no trailing newline) — keeps this migration's diff
// confined to the field actually being added, and matches the file's
// existing committed bytes. The file is CRLF on disk (confirmed via a raw
// byte read), unlike the approve pipeline's LF output — JSON.stringify only
// emits \n, so it's converted here to avoid rewriting every line's ending.
const serialized = JSON.stringify(master, null, 2).replace(/\n/g, '\r\n');
fs.writeFileSync(masterPath, serialized, 'utf8');

console.log(`✓ Migration complete: ${added} recipe(s) updated, ${alreadyPresent} already had 'published'.`);
console.log(`  Total recipes: ${master.recipes.length}`);
