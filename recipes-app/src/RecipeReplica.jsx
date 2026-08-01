import { useEffect, useState } from 'react';
import { apiGet } from './api.js';
import formatDuration from './formatDuration.js';

function RecipeColumn({ recipe, lang, dir }) {
  const field = (key) => (recipe[key] && recipe[key][lang]) || '';
  const ingredients = (recipe.ingredients && recipe.ingredients[lang]) || [];
  const instructions = (recipe.instructions && recipe.instructions[lang]) || [];

  return (
    <div className="recipe-replica-column" dir={dir}>
      <h2 className="recipe-replica-title">{field('title')}</h2>
      <p className="recipe-replica-description">{field('description')}</p>
      <p className="recipe-replica-meta">
        <strong>Category:</strong> {field('recipeCategory')} &nbsp;|&nbsp;
        <strong>Cuisine:</strong> {field('recipeCuisine')} &nbsp;|&nbsp;
        <strong>Yield:</strong> {field('recipeYield')}
      </p>
      <p className="recipe-replica-meta">
        <strong>Prep:</strong> {formatDuration(recipe.prepTime, lang)} &nbsp;|&nbsp;
        <strong>Cook:</strong> {formatDuration(recipe.cookTime, lang)} &nbsp;|&nbsp;
        <strong>Total:</strong> {formatDuration(recipe.totalTime, lang)}
      </p>

      <section className="recipe-replica-section">
        <h3>Ingredients</h3>
        <ul>{ingredients.map((item, i) => <li key={i}>{item}</li>)}</ul>
      </section>

      <section className="recipe-replica-section">
        <h3>Instructions</h3>
        <ol>{instructions.map((step, i) => <li key={i}>{step}</li>)}</ol>
      </section>
    </div>
  );
}

export default function RecipeReplica({ slug, onBack }) {
  const [recipe, setRecipe] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setRecipe(null);
    setError(null);
    apiGet(`/api/recipes/${encodeURIComponent(slug)}`).then(setRecipe).catch(err => setError(err.message));
  }, [slug]);

  return (
    <div className="recipe-replica">
      <button className="recipe-replica-back" onClick={onBack}>&larr; Back to recipes</button>
      {error && <div className="recipes-error">Couldn't load recipe: {error}</div>}
      {!error && !recipe && <div className="recipes-loading">Loading recipe…</div>}
      {recipe && (
        <div className="recipe-replica-columns">
          <RecipeColumn recipe={recipe} lang="en" dir="ltr" />
          <RecipeColumn recipe={recipe} lang="ar" dir="rtl" />
        </div>
      )}
    </div>
  );
}
