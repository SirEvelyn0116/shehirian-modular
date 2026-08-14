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
    <>
      {/* Deliberately light — Phase 7's unification folds this and the
          ui-strings workflow-steps into one shared instruction set (§10). */}
      <div className="workflow-steps recipes-workflow-steps">
        <div className="step"><strong>Step 1</strong> Pick a recipe</div>
        <div className="step"><strong>Step 2</strong> Click a field to edit it</div>
        <div className="step"><strong>Step 3</strong> Save to submit for approval</div>
      </div>

      <ul className="recipe-picker-list">
        {recipes.map(r => (
          <li key={r.slug}>
            <button className="recipe-picker-item" onClick={() => onSelect(r.slug)}>
              <span className="recipe-picker-title">{r.title}</span>
              <span className="recipe-picker-meta">
                {r.pendingCount > 0 && (
                  <span className="recipe-picker-pending-badge">{r.pendingCount} pending</span>
                )}
                <span className="recipe-picker-category">{r.categoryId}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
