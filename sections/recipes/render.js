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
        const card = document.createElement('a');
        card.href = `recipes/${recipe.id}.${lang}.html`;
        card.className = 'recipe-card';
        
        // Top div: Title and Description (green background)
        const infoDiv = document.createElement('div');
        infoDiv.className = 'recipe-info';
        
        // Recipe title (Elgar font, white)
        const recipeTitle = document.createElement('h3');
        recipeTitle.textContent = recipe.title;
        infoDiv.appendChild(recipeTitle);
        
        // Recipe description (PP Neue Montreal, white)
        const description = document.createElement('p');
        description.textContent = recipe.description;
        infoDiv.appendChild(description);
        
        card.appendChild(infoDiv);
        
        // Bottom div: Meta Information (white background, black text)
        const metaDiv = document.createElement('div');
        metaDiv.className = 'recipe-meta';
        
        const metaItems = [];
        if (recipe.category) metaItems.push(`Category: ${recipe.category}`);
        if (recipe.cuisine) metaItems.push(`Cuisine: ${recipe.cuisine}`);
        if (recipe.prepTime) metaItems.push(`Prep: ${recipe.prepTime}`);
        if (recipe.cookTime) metaItems.push(`Cook: ${recipe.cookTime}`);
        if (recipe.yield) metaItems.push(`Yield: ${recipe.yield}`);
        
        metaDiv.textContent = metaItems.join(' | ');
        card.appendChild(metaDiv);
        
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
