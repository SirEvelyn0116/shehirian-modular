const fs = require('fs');
const path = require('path');

// Supported languages and page title per language
const langs = {
  en: "Shehirian Bulgor Inc.",
  fr: "Shehirian Bulgor Inc.",
  ar: "مطبخ عائلة شيهريان"
};

// Load base template
const templatePath = path.join(__dirname, 'template.html');
const baseTemplate = fs.readFileSync(templatePath, 'utf8');

// Load rendered HTML fragments from each section
function loadSectionHTML(section, lang) {
  const htmlPath = path.join(__dirname, `sections/${section}/${section}.${lang}.html`);
  return fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';
}

// Load JSON-LD if available
function loadJSONLD(section, lang) {
  const ldPath = path.join(__dirname, `sections/${section}/${section}.${lang}.jsonld`);
  return fs.existsSync(ldPath) ? `<script type="application/ld+json">${fs.readFileSync(ldPath, 'utf8')}</script>` : '';
}

// Build each language page
Object.keys(langs).forEach(lang => {
  let output = baseTemplate;

  // Replace placeholders
  output = output.replace(/{{lang}}/g, lang);
  output = output.replace(/{{title}}/g, langs[lang]);

  // Inject JSON-LD
  const jsonldBlocks = [
    loadJSONLD('hero', lang),
    loadJSONLD('aboutUs', lang),
    loadJSONLD('certifications', lang),
    loadJSONLD('recipes', lang)
  ].join('\n');
  output = output.replace('</head>', `${jsonldBlocks}\n</head>`);

  // Inject language context script
  output = output.replace('</body>', `<script>localStorage.setItem('lang', '${lang}');</script>\n</body>`);

  // Write to dist
  const distPath = path.join(__dirname, 'dist');
  if (!fs.existsSync(distPath)) fs.mkdirSync(distPath);
  fs.writeFileSync(path.join(distPath, `index.${lang}.html`), output);
});