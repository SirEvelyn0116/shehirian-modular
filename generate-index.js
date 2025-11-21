const fs = require('fs');
const path = require('path');

const langs = {
  en: { title: "Shehirian Family Kitchen", dir: "ltr" },
  fr: { title: "Cuisine familiale Shehirian", dir: "ltr" },
  ar: { title: "مطبخ عائلة شيهريان", dir: "rtl" }
};

const template = fs.readFileSync('template.html', 'utf8');

// Load JSON-LD blocks if available
function loadJSONLD(lang) {
  const sectionsDir = path.join(__dirname, 'sections');
  const sections = fs.readdirSync(sectionsDir)
    .filter(item => fs.statSync(path.join(sectionsDir, item)).isDirectory());
  
  return sections
    .map(section => {
      const file = path.join(sectionsDir, section, `${section}.${lang}.jsonld`);
      return fs.existsSync(file)
        ? `<script type="application/ld+json">${fs.readFileSync(file, 'utf8')}</script>`
        : '';
    })
    .filter(Boolean)
    .join('\n  ');
}

// Copy assets to dist
function copyAssets() {
  const distDir = path.join(__dirname, 'dist');
  const assetsDir = path.join(__dirname, 'assets');
  const sectionsDir = path.join(__dirname, 'sections');
  const recipesDir = path.join(__dirname, 'recipes');
  const previewJsSource = path.join(__dirname, 'preview.js');
  
  // Copy assets folder
  if (fs.existsSync(assetsDir)) {
    const distAssets = path.join(distDir, 'assets');
    if (!fs.existsSync(distAssets)) {
      fs.mkdirSync(distAssets, { recursive: true });
    }
    copyRecursive(assetsDir, distAssets);
  }
  
  // Copy sections folder
  const distSections = path.join(distDir, 'sections');
  if (!fs.existsSync(distSections)) {
    fs.mkdirSync(distSections, { recursive: true });
  }
  copyRecursive(sectionsDir, distSections);
  
  // Copy recipes folder
  if (fs.existsSync(recipesDir)) {
    const distRecipes = path.join(distDir, 'recipes');
    if (!fs.existsSync(distRecipes)) {
      fs.mkdirSync(distRecipes, { recursive: true });
    }
    copyRecursive(recipesDir, distRecipes);
  }
  
  // Copy preview.js
  fs.copyFileSync(previewJsSource, path.join(distDir, 'preview.js'));
  
  // Create .nojekyll
  fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(child => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Build each language page
console.log('🔨 Building multilingual static site...\n');

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

Object.entries(langs).forEach(([lang, config]) => {
  const html = template
    .replace(/{{lang}}/g, lang)
    .replace(/{{dir}}/g, config.dir)
    .replace(/{{title}}/g, config.title)
    .replace(/{{jsonld}}/g, loadJSONLD(lang));

  const outputFile = path.join(distDir, `index.${lang}.html`);
  fs.writeFileSync(outputFile, html);
  console.log(`✓ Generated ${lang}: index.${lang}.html`);
});

copyAssets();
console.log('✓ Copied assets, sections, recipes, and preview.js');
console.log('✓ Created .nojekyll file');

// Copy redirect.html to dist/index.html (root redirect)
const redirectSource = path.join(__dirname, 'redirect.html');
const redirectTarget = path.join(distDir, 'index.html');
if (fs.existsSync(redirectSource)) {
  fs.copyFileSync(redirectSource, redirectTarget);
  console.log('✓ Copied redirect.html → dist/index.html');
} else {
  console.warn('⚠ Warning: redirect.html not found, skipping root redirect');
}

console.log('\n✅ Build complete! Output in dist/');
console.log(`   Pages: ${Object.keys(langs).map(l => `index.${l}.html`).join(', ')}`);
console.log('   Root:  index.html (redirect)');