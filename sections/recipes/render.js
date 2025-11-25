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
        
        // Top div: Title only (wheat background)
        const infoDiv = document.createElement('div');
        infoDiv.className = 'recipe-info';
        
        // Recipe title (Elgar font)
        const recipeTitle = document.createElement('h3');
        recipeTitle.textContent = recipe.title;
        infoDiv.appendChild(recipeTitle);
        
        card.appendChild(infoDiv);
        
        // Bottom div: Description and Meta Information (white background, black text)
        const metaDiv = document.createElement('div');
        metaDiv.className = 'recipe-meta';
        
        // Recipe description
        const description = document.createElement('p');
        description.className = 'recipe-description';
        description.textContent = recipe.description;
        metaDiv.appendChild(description);
        
        // Meta information with bold keys
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
