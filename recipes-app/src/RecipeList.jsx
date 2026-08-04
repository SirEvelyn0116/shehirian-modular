import { useEffect, useState } from 'react';
import { apiGet } from './api.js';

export default function RecipeList({ onSelect }) {
  const [recipes, setRecipes] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet('/api/recipes').then(setRecipes).catch(err => setError(err.message));
  }, []);

  if (error) return <div className="recipes-error">Couldn't load recipes: {error}</div>;
  if (!recipes) return <div className="recipes-loading">Loading recipes…</div>;

  return (
    <ul className="recipe-picker-list">
      {recipes.map(r => (
        <li key={r.slug}>
          <button className="recipe-picker-item" onClick={() => onSelect(r.slug)}>
            <span className="recipe-picker-title">{r.title}</span>
            <span className="recipe-picker-category">{r.categoryId}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
