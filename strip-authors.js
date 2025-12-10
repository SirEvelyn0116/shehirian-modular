// One-time script to remove all "author" fields from sections/recipes/all-recipes.json
const fs = require('fs');
const path = require('path');

const masterPath = path.join(__dirname, 'sections', 'recipes', 'all-recipes.json');
const master = JSON.parse(fs.readFileSync(masterPath, 'utf8'));

let removed = 0;
master.recipes.forEach(r => {
  if (r.author) {
    delete r.author;
    removed++;
  }
});

fs.writeFileSync(masterPath, JSON.stringify(master, null, 2), 'utf8');
console.log(`✓ Removed 'author' field from ${removed} recipes in ${masterPath}`);
