function _sectionsJsonPath(lang) {
  const currentPath = window && window.location && window.location.pathname ? window.location.pathname : '';
  const inLanguageHomeFolder = /(?:^|\/)(en|fr|ar|hy)(?:\/index\.html|\/)?$/.test(currentPath);
  const inLanguageRecipesFolder = /(?:^|\/)(en|fr|ar|hy)\/recipes\//.test(currentPath);
  const prefix = inLanguageRecipesFolder ? '../../' : (inLanguageHomeFolder ? '../' : '');
  return `${prefix}sections/recipes/recipes.${lang}.json`;
}

function renderRecipes(lang = 'en') {
  return fetch(_sectionsJsonPath(lang))
    .then(res => res.ok ? res.json() : {})
    .catch(() => ({}))
    .then(data => {
      const section = document.createElement('section');
      section.id = 'recipes';
      section.className = 'section-recipes section';

      // Section title
      const title = document.createElement('h2');
      title.textContent = data.title || 'Featured Recipes';
      section.appendChild(title);

      // Recipe grid
      const grid = document.createElement('div');
      grid.className = 'recipe-grid';

      const featuredRecipes = data.featured || [];

      featuredRecipes.forEach(recipe => {
        const card = buildRecipeCard(recipe, lang);
        grid.appendChild(card);
      });

      section.appendChild(grid);

      // View All Recipes link
      if (data.viewAllLink) {
        const viewAllContainer = document.createElement('div');
        viewAllContainer.className = 'view-all-recipes';

        const viewAllLink = document.createElement('a');
        viewAllLink.href = data.viewAllLink;
        viewAllLink.textContent = data.viewAllText || 'View All Recipes';
        viewAllLink.className = 'view-all-btn';

        viewAllContainer.appendChild(viewAllLink);
        section.appendChild(viewAllContainer);
      }

      return section;
    });
}

// Helper: format ISO 8601 durations (PT#H#M) to human-friendly localized strings
function formatDuration(iso, lang) {
  if (!iso) return '';
  const m = String(iso).match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
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
  if (lang === 'hy') {
    if (hrs && mins) return `${hrs} ժամ ${mins} րոպե`;
    if (hrs) return `${hrs} ժամ`;
    return `${mins} րոպե`;
  }
  if (hrs && mins) return `${hrs} hr ${mins} min`;
  if (hrs) return `${hrs} hr`;
  return `${mins} minutes`;
}

const localizedLabels = {
  en: { category: 'Category', cuisine: 'Cuisine', prep: 'Prep', cook: 'Cook', yield: 'Yield' },
  fr: { category: 'Catégorie', cuisine: 'Cuisine', prep: 'Préparation', cook: 'Cuisson', yield: 'Portions' },
  ar: { category: 'الفئة', cuisine: 'المطبخ', prep: 'وقت التحضير', cook: 'وقت الطهي', yield: 'الحصة' },
  hy: { category: 'Կատեգորիա', cuisine: 'Խոհանոց', prep: 'Պատրաստում', cook: 'Եփում', yield: 'Պորցիաներ' }
};

// Helper to build a recipe card anchor element from a recipe summary
function buildRecipeCard(recipe, lang = 'en') {
  const card = document.createElement('a');
  const siteBaseUrl = window.__siteBaseUrl || '';
  const slug = recipe.slug || recipe.id || recipe.name || 'recipe';
  card.href = `${siteBaseUrl}/${lang}/recipes/${slug}.html`;
  card.className = 'recipe-card';

  // Top div: Title only (wheat background)
  const infoDiv = document.createElement('div');
  infoDiv.className = 'recipe-info';
  const recipeTitle = document.createElement('h3');
  recipeTitle.textContent = recipe.title;
  infoDiv.appendChild(recipeTitle);
  card.appendChild(infoDiv);

  // Bottom div: Description and Meta Information
  const metaDiv = document.createElement('div');
  metaDiv.className = 'recipe-meta';

  if (recipe.description) {
    const description = document.createElement('p');
    description.className = 'recipe-description';
    description.textContent = recipe.description;
    metaDiv.appendChild(description);
  }

  const labels = localizedLabels[lang] || localizedLabels.en;
  const metaItems = [];
  if (recipe.category) metaItems.push(`<strong>${labels.category}:</strong> ${recipe.category}`);
  if (recipe.cuisine) metaItems.push(`<strong>${labels.cuisine}:</strong> ${recipe.cuisine}`);
  if (recipe.prepTime) metaItems.push(`<strong>${labels.prep}:</strong> ${formatDuration(recipe.prepTime, lang)}`);
  if (recipe.cookTime) metaItems.push(`<strong>${labels.cook}:</strong> ${formatDuration(recipe.cookTime, lang)}`);
  if (recipe.yield) metaItems.push(`<strong>${labels.yield}:</strong> ${recipe.yield}`);

  const metaInfo = document.createElement('div');
  metaInfo.className = 'recipe-meta-info';
  metaInfo.innerHTML = metaItems.join(' | ');
  metaDiv.appendChild(metaInfo);

  card.appendChild(metaDiv);

  return card;
}

// Render the All Recipes page grouped by category
function renderAllRecipes(lang = 'en') {
  // If the build already injected an `.all-recipes-container` with content, don't re-render.
  const existing = document.querySelector('.all-recipes-container');
  if (existing && existing.childElementCount) {
    return Promise.resolve(existing);
  }
  return fetch(_sectionsJsonPath(lang))
    .then(res => res.ok ? res.json() : {})
    .catch(() => ({}))
    .then(data => {
      const container = document.createElement('div');
      container.className = 'all-recipes-container';

      const all = data.allRecipes || [];

      // Group by category (preserve order of appearance)
      const groups = {};
      const order = [];
      all.forEach(item => {
        const cat = item.category || 'Uncategorized';
        if (!groups[cat]) {
          groups[cat] = [];
          order.push(cat);
        }
        groups[cat].push(item);
      });

      order.forEach(cat => {
        const section = document.createElement('section');
        section.className = 'recipes-category-section';

        const heading = document.createElement('h3');
        heading.className = 'recipes-category-heading';
        heading.textContent = cat;
        section.appendChild(heading);

        // Add a horizontal separator similar to the one used above view-all buttons
        const sep = document.createElement('hr');
        sep.className = 'category-sep';
        section.appendChild(sep);

        const grid = document.createElement('div');
        grid.className = 'recipe-grid';

        groups[cat].forEach(recipe => {
          const card = buildRecipeCard(recipe, lang);
          grid.appendChild(card);
        });

        section.appendChild(grid);
        container.appendChild(section);
      });

      return container;
    });
}

// Expose for pages to call
window.renderRecipes = renderRecipes;
window.renderAllRecipes = renderAllRecipes;
window.buildRecipeCard = buildRecipeCard;
