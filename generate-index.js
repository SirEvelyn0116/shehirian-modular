const fs = require('fs');
const path = require('path');

const langs = {
  en: "Shehirian Family Kitchen",
  fr: "Cuisine familiale Shehirian",
  ar: "مطبخ عائلة شيهريان"
};

const template = fs.readFileSync('template.html', 'utf8');

// Load JSON-LD blocks if available
function loadJSONLD(lang) {
  const sections = ['hero', 'aboutUs', 'certifications', 'recipes'];
  return sections
    .map(section => {
      const file = `sections/${section}/${section}.${lang}.jsonld`;
      return fs.existsSync(file)
        ? `<script type="application/ld+json">${fs.readFileSync(file, 'utf8')}</script>`
        : '';
    })
    .join('\n');
}

// Build each language page
Object.entries(langs).forEach(([lang, title]) => {
  const html = template
    .replace(/{{lang}}/g, lang)
    .replace(/{{title}}/g, title)
    .replace(/{{jsonld}}/g, loadJSONLD(lang));

  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

  fs.writeFileSync(path.join(distDir, `index.${lang}.html`), html);
});