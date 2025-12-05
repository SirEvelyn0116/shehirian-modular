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
  const certificationsDir = path.join(__dirname, 'certifications');
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
  
  // Copy certifications folder
  if (fs.existsSync(certificationsDir)) {
    const distCertifications = path.join(distDir, 'certifications');
    if (!fs.existsSync(distCertifications)) {
      fs.mkdirSync(distCertifications, { recursive: true });
    }
    copyRecursive(certificationsDir, distCertifications);
  }
  
  // Copy product pages
  const productPages = ['shirag-products.html', 'mr-falafel-products.html'];
  productPages.forEach(page => {
    const sourcePath = path.join(__dirname, page);
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, path.join(distDir, page));
    }
  });
  
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
console.log('✓ Copied assets, sections, recipes, certifications, product pages, and preview.js');
console.log('✓ Created .nojekyll file');

// Generate build-time all-recipes pages from sections/recipes/recipes.<lang>.json
function buildRecipeCardHTML(recipe, lang) {
  const href = `${recipe.id}.${lang}.html`;
  const desc = recipe.description ? `<p class="recipe-description">${recipe.description}</p>` : '';
  const meta = [];
  if (recipe.category) meta.push(`<strong>Category:</strong> ${recipe.category}`);
  if (recipe.cuisine) meta.push(`<strong>Cuisine:</strong> ${recipe.cuisine}`);
  if (recipe.prepTime) meta.push(`<strong>Prep:</strong> ${recipe.prepTime}`);
  if (recipe.cookTime) meta.push(`<strong>Cook:</strong> ${recipe.cookTime}`);
  if (recipe.yield) meta.push(`<strong>Yield:</strong> ${recipe.yield}`);

  return `
    <a href="${href}" class="recipe-card">
      <div class="recipe-info">
        <h3>${recipe.title}</h3>
      </div>
      <div class="recipe-meta">
        ${desc}
        <div class="recipe-meta-info">${meta.join(' | ')}</div>
      </div>
    </a>`;
}

function buildAllRecipesHTML(allRecipes, lang) {
  // group by category
  const groups = allRecipes.reduce((acc, r) => {
    const k = r.category || 'Other';
    if (!acc[k]) acc[k] = [];
    acc[k].push(r);
    return acc;
  }, {});

  return Object.entries(groups).map(([category, items]) => {
    const cards = items.map(it => buildRecipeCardHTML(it, lang)).join('\n');
    return `<section class="recipe-category">
      <h2>${category}</h2>
      <div class="all-recipes-grid">
        ${cards}
      </div>
    </section>`;
  }).join('\n');
}

function writeAllRecipesPages() {
  const recipesDir = path.join(__dirname, 'recipes');
  const distRecipesDir = path.join(distDir, 'recipes');
  if (!fs.existsSync(distRecipesDir)) fs.mkdirSync(distRecipesDir, { recursive: true });

  Object.keys(langs).forEach(lang => {
    const srcJson = path.join(__dirname, 'sections', 'recipes', `recipes.${lang}.json`);
    if (!fs.existsSync(srcJson)) {
      console.warn(`⚠ recipes json missing for ${lang}, skipping all-recipes generation`);
      return;
    }

    let data;
    try {
      data = JSON.parse(fs.readFileSync(srcJson, 'utf8'));
    } catch (e) {
      console.error(`✖ Failed to parse ${srcJson}:`, e.message);
      return;
    }

    if (!data.allRecipes || !Array.isArray(data.allRecipes)) {
      console.warn(`⚠ no allRecipes array in ${srcJson}, skipping ${lang}`);
      return;
    }

    const gridHtml = buildAllRecipesHTML(data.allRecipes, lang);

    // Use source page as template if available, otherwise build a minimal page
    const srcPage = path.join(recipesDir, `all-recipes.${lang}.html`);
    let pageHtml = '';
    if (fs.existsSync(srcPage)) {
      pageHtml = fs.readFileSync(srcPage, 'utf8');
    } else {
      pageHtml = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>All Recipes</title><link rel="stylesheet" href="../assets/css/style.css"></head><body><section class="all-recipes-page"><div class="all-recipes-header"><h1>All Recipes</h1></div><div class="all-recipes-grid"></div></section></body></html>`;
    }

    // Replace placeholder container or the first .all-recipes-grid block
    let out = pageHtml;
    const idContainerRegex = /<div[^>]*id="all-recipes-container"[^>]*>[\s\S]*?<\/div>/i;
    const classGridRegex = /<div[^>]*class="all-recipes-grid"[^>]*>[\s\S]*?<\/div>/i;

    if (idContainerRegex.test(pageHtml)) {
      out = pageHtml.replace(idContainerRegex, `<div id="all-recipes-container" class="all-recipes-grid">${gridHtml}</div>`);
    } else if (classGridRegex.test(pageHtml)) {
      out = pageHtml.replace(classGridRegex, `<div class="all-recipes-grid">${gridHtml}</div>`);
    } else {
      // fallback: insert before footer link if present
      const footerRegex = /<div class="all-recipes-footer">/i;
      if (footerRegex.test(pageHtml)) {
        out = pageHtml.replace(footerRegex, `${gridHtml}\n$&`);
      } else {
        // append to body
        out = pageHtml.replace(/<\/body>/i, `${gridHtml}\n</body>`);
      }
    }

    const outPath = path.join(distRecipesDir, `all-recipes.${lang}.html`);
    fs.writeFileSync(outPath, out, 'utf8');
    console.log(`✓ Generated recipes page: recipes/all-recipes.${lang}.html`);
  });
}

writeAllRecipesPages();

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