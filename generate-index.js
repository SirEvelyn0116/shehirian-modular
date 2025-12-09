const fs = require('fs');
const path = require('path');

const langs = {
  en: { title: "Shehirian Family Kitchen", dir: "ltr" },
  fr: { title: "Cuisine familiale Shehirian", dir: "ltr" },
  ar: { title: "مطبخ عائلة شيهريان", dir: "rtl" }
};

const template = fs.readFileSync('template.html', 'utf8');

// Helper: format ISO 8601 durations (PT#H#M) to human-friendly localized strings
function formatDuration(iso, lang) {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return iso;
  const hrs = parseInt(m[1] || '0', 10);
  const mins = parseInt(m[2] || '0', 10);
  if (lang === 'fr') {
    if (hrs && mins) return `${hrs} h ${mins} min`;
    if (hrs) return `${hrs} h`;
    return `${mins} minutes`;
  }
  if (lang === 'ar') {
    if (hrs && mins) return `${hrs} ساعة ${mins} دقيقة`;
    if (hrs) return `${hrs} ساعة`;
    return `${mins} دقيقة`;
  }
  // default English
  if (hrs && mins) return `${hrs} hr ${mins} min`;
  if (hrs) return `${hrs} hr`;
  return `${mins} minutes`;
}

const localizedLabels = {
  en: { category: 'Category', cuisine: 'Cuisine', prep: 'Prep', cook: 'Cook', yield: 'Yield' },
  fr: { category: 'Catégorie', cuisine: 'Cuisine', prep: 'Préparation', cook: 'Cuisson', yield: 'Portions' },
  ar: { category: 'الفئة', cuisine: 'المطبخ', prep: 'وقت التحضير', cook: 'وقت الطهي', yield: 'الحصة' }
};

// Override author for all recipes at build time (canonicalized across locales)
const AUTHOR_OVERRIDE = {
  en: 'Shehirian family',
  fr: 'Shehirian family',
  ar: 'Shehirian family'
};

// Canonical category definitions — try to load from `sections/categories.json`
const defaultCategoryDefs = {
  soup: { en: 'Soup', fr: 'Soupe', ar: 'شوربة' },
  salad: { en: 'Salad', fr: 'Salade', ar: 'سلطة' },
  main: { en: 'Main Dish', fr: 'Plat Principal', ar: 'طبق رئيسي' },
  starter: { en: 'Starter', fr: 'Entrée', ar: 'مقبلات' },
  dessert: { en: 'Dessert', fr: 'Dessert', ar: 'حلوى' },
  other: { en: 'Other', fr: 'Autre', ar: 'أخرى' }
};

let categoriesLookup = defaultCategoryDefs;
try {
  const categoriesPath = path.join(__dirname, 'sections', 'categories.json');
  if (fs.existsSync(categoriesPath)) {
    const raw = fs.readFileSync(categoriesPath, 'utf8');
    const parsed = JSON.parse(raw);
    // Merge parsed into defaults so missing locales fall back
    categoriesLookup = Object.assign({}, defaultCategoryDefs, parsed);
  }
} catch (e) {
  console.warn('⚠ Failed to load sections/categories.json — using built-in category definitions');
}

// Normalize category strings to avoid duplicated sections caused by
// small differences (whitespace, casing, synonyms across languages).
function normalizeCategory(cat, lang) {
  if (!cat) return 'Other';
  const s = String(cat).trim();
  if (!s) return 'Other';
  // language specific normalization with mapping tables
  if (lang === 'ar') {
    // map common Arabic synonyms to canonical forms
    const map = {
      'حساء': 'شوربة',
      'شوربة': 'شوربة',
      'حساءً': 'شوربة',
      'حساء ': 'شوربة'
    };
    const key = s.replace(/\s+/g, '');
    return map[key] || s;
  }

  if (lang === 'fr') {
    const key = s.replace(/\s+/g, ' ').toLowerCase();
    const map = {
      'soupe': 'Soupe',
      'soups': 'Soupe',
      'salade': 'Salade',
      'plat principal': 'Plat Principal',
      'plat': 'Plat Principal',
      'entrée': 'Entrée'
    };
    if (map[key]) return map[key];
    // fallback: normalize spacing and capitalize first letter
    const tidy = key.replace(/\s+/g, ' ').trim();
    return tidy.charAt(0).toUpperCase() + tidy.slice(1);
  }

  // English and default: unify common synonyms and capitalization
  const keyEn = s.replace(/\s+/g, ' ').toLowerCase();
  const mapEn = {
    'soup': 'Soup',
    'soups': 'Soup',
    'salad': 'Salad',
    'main dish': 'Main Dish',
    'main course': 'Main Dish',
    'main': 'Main Dish',
    'entree': 'Main Dish'
  };
  if (mapEn[keyEn]) return mapEn[keyEn];
  return keyEn.charAt(0).toUpperCase() + keyEn.slice(1);
}
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
  const slug = recipe.slug || recipe.id || recipe.name || 'recipe';
  const href = `${slug}.${lang}.html`;
  const desc = recipe.description ? `<p class="recipe-description">${recipe.description}</p>` : '';
  const labels = localizedLabels[lang] || localizedLabels.en;
  const meta = [];
  if (recipe.category) meta.push(`<strong>${labels.category}:</strong> ${recipe.category}`);
  if (recipe.cuisine) meta.push(`<strong>${labels.cuisine}:</strong> ${recipe.cuisine}`);
  if (recipe.prepTime) meta.push(`<strong>${labels.prep}:</strong> ${formatDuration(recipe.prepTime, lang)}`);
  if (recipe.cookTime) meta.push(`<strong>${labels.cook}:</strong> ${formatDuration(recipe.cookTime, lang)}`);
  if (recipe.yield) meta.push(`<strong>${labels.yield}:</strong> ${recipe.yield}`);

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
  // group by canonical categoryId; fall back to normalized category text
  const groups = {};
  allRecipes.forEach(r => {
    const cid = r.categoryId || (r.category && r.category.toString().toLowerCase().replace(/\s+/g,'-')) || 'other';
    if (!groups[cid]) groups[cid] = { id: cid, items: [] };
    groups[cid].items.push(r);
  });

    return Object.values(groups).map(group => {
    const items = group.items;
    const labelObj = categoriesLookup[group.id] || { en: group.id, fr: group.id, ar: group.id };
    const heading = (labelObj && labelObj[lang]) || labelObj.en || group.id;
    const cards = items.map(it => buildRecipeCardHTML(it, lang)).join('\n');
    return `<section class="recipes-category-section">
      <h3 class="recipes-category-heading">${heading}</h3>
      <hr class="category-sep">
      <div class="recipe-grid">
        ${cards}
      </div>
    </section>`;
  }).join('\n');
}

function writeAllRecipesPages() {
  // Read master all-recipes.json
  const masterPath = path.join(__dirname, 'sections', 'recipes', 'all-recipes.json');
  if (!fs.existsSync(masterPath)) {
    console.warn('⚠ master sections/recipes/all-recipes.json not found, skipping recipe generation');
    return;
  }

  let master;
  try {
    master = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
  } catch (e) {
    console.error('✖ Failed to parse master all-recipes.json:', e.message);
    return;
  }

  // Validate categoryId presence: push missing categoryId to 'other' and warn
  const missingCat = master.recipes.filter(r => !r.categoryId || !String(r.categoryId).trim());
  if (missingCat.length) {
    console.warn(`⚠ ${missingCat.length} recipe(s) missing categoryId — assigning to 'other' temporarily for build:`);
    missingCat.forEach(r => console.warn('  -', r.slug || r.title && r.title.en || '(unknown)'));
    // Assign in-memory so build groups them under 'other'
    missingCat.forEach(r => { r.categoryId = 'other'; });
  }

  // Normalize any categoryId values not present in categoriesLookup to 'other'
  master.recipes.forEach(r => {
    const cid = r.categoryId || '';
    if (!cid || !categoriesLookup[cid]) {
      if (cid && !categoriesLookup[cid]) {
        console.warn(`⚠ Unknown categoryId '${cid}' for recipe '${r.slug || (r.title && r.title.en) || ''}' — defaulting to 'other'`);
      }
      r.categoryId = 'other';
    }
  });

  const recipesDir = path.join(__dirname, 'recipes');
  const distRecipesDir = path.join(distDir, 'recipes');
  if (!fs.existsSync(distRecipesDir)) fs.mkdirSync(distRecipesDir, { recursive: true });

  // Ensure dist sections recipes folder exists so client-side fetches can find recipes.<lang>.json
  const distSectionsRecipes = path.join(distDir, 'sections', 'recipes');
  if (!fs.existsSync(distSectionsRecipes)) fs.mkdirSync(distSectionsRecipes, { recursive: true });

  // Iterate languages and build localized listing JSON + all-recipes pages
  Object.keys(langs).forEach(lang => {
    // Build localized summaries, dedupe by slug and normalize categories
    const seenSlugs = new Set();
    const localizedAll = master.recipes.reduce((acc, r) => {
      const slug = r.slug;
      if (!slug || seenSlugs.has(slug)) return acc; // skip duplicates
      seenSlugs.add(slug);
      const rawCategory = (r.recipeCategory && (r.recipeCategory[lang] || r.recipeCategory.en)) || '';
      const categoryText = normalizeCategory(rawCategory, lang);
      const categoryId = r.categoryId || (categoryText && categoryText.toString().toLowerCase().replace(/\s+/g,'-')) || 'other';
      acc.push({
        slug: slug,
        title: (r.title && r.title[lang]) || (r.title && r.title.en) || slug,
        description: (r.description && r.description[lang]) || '',
        category: categoryText,
        categoryId: categoryId,
        cuisine: (r.recipeCuisine && (r.recipeCuisine[lang] || r.recipeCuisine.en)) || '',
        prepTime: r.prepTime || '',
        cookTime: r.cookTime || '',
        yield: (r.recipeYield && (r.recipeYield[lang] || r.recipeYield.en)) || ''
      });
      return acc;
    }, []);

    // featured: full objects for those flagged
    // featured: keep order, dedupe and normalize category for display
    const seenFeatured = new Set();
    const featured = master.recipes.filter(r => r.featuredRecipe).reduce((acc, r) => {
      if (!r.slug || seenFeatured.has(r.slug)) return acc;
      seenFeatured.add(r.slug);
      const rawCategory = (r.recipeCategory && (r.recipeCategory[lang] || r.recipeCategory.en)) || '';
      acc.push({
        slug: r.slug,
        title: (r.title && r.title[lang]) || (r.title && r.title.en) || r.slug,
        description: (r.description && r.description[lang]) || '',
        ingredients: (r.ingredients && r.ingredients[lang]) || [],
        instructions: (r.instructions && r.instructions[lang]) || [],
        category: normalizeCategory(rawCategory, lang),
        cuisine: (r.recipeCuisine && (r.recipeCuisine[lang] || r.recipeCuisine.en)) || '',
        prepTime: r.prepTime || '',
        cookTime: r.cookTime || '',
        totalTime: r.totalTime || '',
        yield: (r.recipeYield && (r.recipeYield[lang] || r.recipeYield.en)) || ''
      });
      return acc;
    }, []);

    const recipesJson = {
      title: 'Recipes',
      viewAllLink: '/recipes/all-recipes.' + lang + '.html',
      viewAllText: lang === 'fr' ? 'Voir toutes les recettes →' : (lang === 'ar' ? 'عرض جميع الوصفات →' : 'View all recipes →'),
      featured: featured,
      allRecipes: localizedAll
    };

    // write localized recipes json to dist sections so client side can still fetch it
    fs.writeFileSync(path.join(distSectionsRecipes, `recipes.${lang}.json`), JSON.stringify(recipesJson, null, 2), 'utf8');

    // Build all-recipes HTML
    const gridHtml = buildAllRecipesHTML(recipesJson.allRecipes, lang);

    const srcPage = path.join(recipesDir, `all-recipes.${lang}.html`);
    let pageHtml = '';
    if (fs.existsSync(srcPage)) {
      pageHtml = fs.readFileSync(srcPage, 'utf8');
    } else {
      pageHtml = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>All Recipes</title><link rel="stylesheet" href="../assets/css/style.css"></head><body><section class="all-recipes-page"><div class="all-recipes-header"><h1>All Recipes</h1></div><div class="all-recipes-grid"></div></section></body></html>`;
    }

    let out = pageHtml;
    const idContainerRegex = /<div[^>]*id="all-recipes-container"[^>]*>[\s\S]*?<\/div>/i;
    const classGridRegex = /<div[^>]*class="all-recipes-grid"[^>]*>[\s\S]*?<\/div>/i;

    const containerHtml = `<div class="all-recipes-container">${gridHtml}</div>`;
    if (idContainerRegex.test(pageHtml)) {
      // replace the entire placeholder div with the renderer-style container
      out = pageHtml.replace(idContainerRegex, containerHtml);
    } else if (classGridRegex.test(pageHtml)) {
      out = pageHtml.replace(classGridRegex, containerHtml);
    } else {
      const footerRegex = /<div class="all-recipes-footer">/i;
      if (footerRegex.test(pageHtml)) {
        out = pageHtml.replace(footerRegex, `${gridHtml}\n$&`);
      } else {
        out = pageHtml.replace(/<\/body>/i, `${gridHtml}\n</body>`);
      }
    }

    const outPath = path.join(distRecipesDir, `all-recipes.${lang}.html`);
    fs.writeFileSync(outPath, out, 'utf8');
    console.log(`✓ Generated recipes page: recipes/all-recipes.${lang}.html`);
  });

  // Generate individual recipe pages (localized) with JSON-LD

  master.recipes.forEach(recipe => {
    Object.keys(langs).forEach(lang => {
      const title = (recipe.title && recipe.title[lang]) || recipe.title && recipe.title.en || recipe.slug;
      const description = (recipe.description && recipe.description[lang]) || '';
      const ingredients = (recipe.ingredients && recipe.ingredients[lang]) || [];
      const instructions = (recipe.instructions && recipe.instructions[lang]) || [];

      const jsonld = {
        '@context': 'https://schema.org/',
        '@type': 'Recipe',
        name: title,
        // normalize author to canonical build-time name
        author: AUTHOR_OVERRIDE[lang] || 'Shehirian family',
        description: description,
        recipeCategory: (recipe.recipeCategory && recipe.recipeCategory[lang]) || '',
        recipeCuisine: (recipe.recipeCuisine && recipe.recipeCuisine[lang]) || '',
        recipeYield: (recipe.recipeYield && recipe.recipeYield[lang]) || '',
        prepTime: recipe.prepTime || '',
        cookTime: recipe.cookTime || '',
        totalTime: recipe.totalTime || '',
        recipeIngredient: ingredients,
        recipeInstructions: instructions.map(s => ({ '@type': 'HowToStep', text: s }))
      };

      // Write localized JSON-LD into `sections/recipes/` so source JSON-LD files
      // are updated to reflect the canonical author at build-time.
      try {
        const sectionsRecipesDir = path.join(__dirname, 'sections', 'recipes');
        if (!fs.existsSync(sectionsRecipesDir)) fs.mkdirSync(sectionsRecipesDir, { recursive: true });
        const jsonldPath = path.join(sectionsRecipesDir, `${recipe.slug}.${lang}.jsonld`);
        fs.writeFileSync(jsonldPath, JSON.stringify(jsonld, null, 2), 'utf8');
      } catch (e) {
        console.warn('⚠ Failed to write JSON-LD for', recipe.slug, e && e.message);
      }

      // Localized recipe page using the pre-refactor layout (nav + header)
      const page = `<!doctype html>
<html lang="${lang}" dir="${langs[lang].dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="../assets/css/style.css">
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
    <nav class="back-nav">
    <div class="breadcrumb-nav">
      <a href="../index.${lang}.html">${lang === 'fr' ? 'Accueil' : (lang === 'ar' ? 'الرئيسية' : 'Home')}</a>
      <span>›</span>
      <a href="all-recipes.${lang}.html">${lang === 'fr' ? 'Toutes les recettes' : (lang === 'ar' ? 'كل الوصفات' : 'All Recipes')}</a>
      <span>›</span>
      <span>${title}</span>
    </div>
    <div id="language-switcher" class="lang-switcher-nav">
      <a href="${recipe.slug}.en.html" title="English">EN</a>
      <a href="${recipe.slug}.fr.html" title="Français">FR</a>
      <a href="${recipe.slug}.ar.html" title="العربية">AR</a>
    </div>
  </nav>

  <main class="recipe-page">
    <header class="recipe-header">
      <h1>${title}</h1>
      <p class="recipe-description">${description}</p>
      <p>
        <strong>${lang === 'fr' ? 'Catégorie' : (lang === 'ar' ? 'الفئة' : 'Category')}:</strong> ${(recipe.recipeCategory && recipe.recipeCategory[lang]) || ''}
        &nbsp; | &nbsp;
        <strong>${lang === 'fr' ? 'Cuisine' : (lang === 'ar' ? 'المطبخ' : 'Cuisine')}:</strong> ${(recipe.recipeCuisine && recipe.recipeCuisine[lang]) || ''}
      </p>
      <p>
        <strong>${lang === 'fr' ? 'Temps de préparation' : (lang === 'ar' ? 'وقت التحضير' : 'Prep Time')}:</strong> ${formatDuration(recipe.prepTime, lang) || ''}
        &nbsp; | &nbsp;
        <strong>${lang === 'fr' ? 'Temps de cuisson' : (lang === 'ar' ? 'وقت الطهي' : 'Cook Time')}:</strong> ${formatDuration(recipe.cookTime, lang) || ''}
        &nbsp; | &nbsp;
        <strong>${lang === 'fr' ? 'Total' : (lang === 'ar' ? 'الإجمالي' : 'Total')}:</strong> ${formatDuration(recipe.totalTime, lang) || ''}
      </p>
    </header>

    <section class="recipe-section recipe-ingredients">
      <h2>${lang === 'fr' ? 'Ingrédients' : (lang === 'ar' ? 'المكونات' : 'Ingredients')}</h2>
      <ul>
        ${ingredients.map(i => `<li>${i}</li>`).join('\n')}
      </ul>
    </section>

    <section class="recipe-section recipe-steps recipe-instructions">
      <h2>${lang === 'fr' ? 'Instructions' : (lang === 'ar' ? 'التحضير' : 'Instructions')}</h2>
      <ol>
        ${instructions.map(s => `<li>${s}</li>`).join('\n')}
      </ol>
    </section>

    <footer class="recipe-footer">
      <a class="view-all-btn" href="all-recipes.${lang}.html">${lang === 'fr' ? '← Toutes les recettes' : (lang === 'ar' ? '← كل الوصفات' : '← All recipes')}</a>
    </footer>
  </main>
</body>
</html>`;

      const outFile = path.join(distRecipesDir, `${recipe.slug}.${lang}.html`);
      fs.writeFileSync(outFile, page, 'utf8');
    });
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