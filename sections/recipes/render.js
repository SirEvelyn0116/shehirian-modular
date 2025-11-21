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
        
        // Recipe title (Elgar font, white)
        const recipeTitle = document.createElement('h3');
        recipeTitle.textContent = recipe.title;
        card.appendChild(recipeTitle);
        
        // Recipe description
        const description = document.createElement('p');
        description.textContent = recipe.description;
        card.appendChild(description);
        
        // Ingredients dropdown (black text on white bg)
        const ingredientsDetails = document.createElement('details');
        const ingredientsSummary = document.createElement('summary');
        ingredientsSummary.textContent = recipe.ingredientsLabel || 'Ingredients';
        ingredientsDetails.appendChild(ingredientsSummary);
        
        const ingredientsList = document.createElement('ul');
        ingredientsList.className = 'ingredients-list';
        recipe.ingredients.forEach(ingredient => {
          const li = document.createElement('li');
          li.textContent = ingredient;
          ingredientsList.appendChild(li);
        });
        ingredientsDetails.appendChild(ingredientsList);
        card.appendChild(ingredientsDetails);
        
        // Steps dropdown (black text on white bg)
        const stepsDetails = document.createElement('details');
        const stepsSummary = document.createElement('summary');
        stepsSummary.textContent = recipe.stepsLabel || 'Steps';
        stepsDetails.appendChild(stepsSummary);
        
        const stepsList = document.createElement('ol');
        stepsList.className = 'steps-list';
        recipe.steps.forEach(step => {
          const li = document.createElement('li');
          li.textContent = step;
          stepsList.appendChild(li);
        });
        stepsDetails.appendChild(stepsList);
        card.appendChild(stepsDetails);
        
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
