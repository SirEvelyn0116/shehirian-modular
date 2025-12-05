function renderRecipes(lang = 'en') {
  return fetch(`sections/recipes/recipes.${lang}.json`)
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
        viewAllLink.href = `recipes/all-recipes.${lang}.html`;
        viewAllLink.textContent = data.viewAllText || 'View All Recipes';
        viewAllLink.className = 'view-all-btn';

        viewAllContainer.appendChild(viewAllLink);
        section.appendChild(viewAllContainer);
      }

      return section;
    });
}

// Helper to build a recipe card anchor element from a recipe summary
function buildRecipeCard(recipe, lang = 'en') {
  const card = document.createElement('a');
  card.href = `recipes/${recipe.id}.${lang}.html`;
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

  const metaItems = [];
  if (recipe.category) metaItems.push(`<strong>Category:</strong> ${recipe.category}`);
  if (recipe.cuisine) metaItems.push(`<strong>Cuisine:</strong> ${recipe.cuisine}`);
  if (recipe.prepTime) metaItems.push(`<strong>Prep:</strong> ${recipe.prepTime}`);
  if (recipe.cookTime) metaItems.push(`<strong>Cook:</strong> ${recipe.cookTime}`);
  if (recipe.yield) metaItems.push(`<strong>Yield:</strong> ${recipe.yield}`);

  const metaInfo = document.createElement('div');
  metaInfo.className = 'recipe-meta-info';
  metaInfo.innerHTML = metaItems.join(' | ');
  metaDiv.appendChild(metaInfo);

  card.appendChild(metaDiv);

  return card;
}

// Render the All Recipes page grouped by category
function renderAllRecipes(lang = 'en') {
  return fetch(`sections/recipes/recipes.${lang}.json`)
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
