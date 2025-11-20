function renderRecipes(lang = 'en') {
  return fetch(`sections/recipes/recipes.${lang}.json`)
    .then(res => res.ok ? res.json() : [])
    .catch(() => [])
    .then(recipes => {
      const section = document.createElement('section');
      section.className = 'recipes';
      section.innerHTML = '<h2>Recipes</h2>';

      recipes.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'recipe-card';
        card.innerHTML = `
          <h3>${recipe.title}</h3>
          <p>${recipe.description}</p>
          <details>
            <summary>Ingredients</summary>
            <ul>${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>
          </details>
          <details>
            <summary>Steps</summary>
            <ol>${recipe.steps.map(s => `<li>${s}</li>`).join('')}</ol>
          </details>
        `;

        // Inject JSON-LD for SEO
        const schema = {
          "@context": "https://schema.org",
          "@type": "Recipe",
          "name": recipe.title,
          "author": {
            "@type": "Person",
            "name": "Shehirian Family"
          },
          "recipeCategory": "Soup",
          "recipeCuisine": recipe.id === "armenian-lentil-soup" ? "Armenian" :
                           recipe.id === "royal-soup" ? "Middle Eastern" :
                           recipe.id === "scotch-broth" ? "Scottish" : "International",
          "recipeYield": recipe.id === "armenian-lentil-soup" ? "4 servings" :
                         recipe.id === "royal-soup" ? "6 servings" :
                         recipe.id === "scotch-broth" ? "6 to 8 servings" : "N/A",
          "prepTime": recipe.id === "armenian-lentil-soup" ? "PT15M" :
                      recipe.id === "royal-soup" ? "PT15M" :
                      recipe.id === "scotch-broth" ? "PT20M" : "PT0M",
          "cookTime": recipe.id === "armenian-lentil-soup" ? "PT60M" :
                      recipe.id === "royal-soup" ? "PT30M" :
                      recipe.id === "scotch-broth" ? "PT45M" : "PT0M",
          "totalTime": recipe.id === "armenian-lentil-soup" ? "PT75M" :
                       recipe.id === "royal-soup" ? "PT45M" :
                       recipe.id === "scotch-broth" ? "PT65M" : "PT0M",
          "recipeIngredient": recipe.ingredients,
          "recipeInstructions": recipe.steps.map(step => ({
            "@type": "HowToStep",
            "text": step
          })),
          "keywords": recipe.id === "armenian-lentil-soup" ? "lentil soup, Armenian recipe, mint soup" :
                      recipe.id === "royal-soup" ? "royal soup, lemon meatball soup, bulghur soup" :
                      recipe.id === "scotch-broth" ? "lamb soup, barley broth, Scottish soup" : ""
        };

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(schema);
        card.appendChild(script);

        section.appendChild(card);
      });

      return section;
    });
}