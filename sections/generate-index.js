const fs = require('fs');
const path = require('path');

const sections = ['hero', 'recipes'];
const langs = ['en', 'fr', 'ar'];

langs.forEach(lang => {
  let output = '<!DOCTYPE html><html lang="' + lang + '"><head>';
  output += '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">';
  output += '<link rel="stylesheet" href="assets/css/style.css">';

  // Inject JSON-LD from hero and recipes
  sections.forEach(section => {
    const schemaPath = `sections/${section}/${section}.${lang}.jsonld`;
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      output += `<script type="application/ld+json">${schema}</script>`;
    }
  });

  output += '</head><body><div id="preview"></div>';
  output += `<script>localStorage.setItem('lang', '${lang}');</script>`;
  output += '<script src="preview/preview.js"></script>';
  output += '</body></html>';

  fs.writeFileSync(`dist/index.${lang}.html`, output);
});