import { useEffect, useState } from 'react';
import { apiGet, apiPost } from './api.js';
import formatDuration from './formatDuration.js';
import EditableField from './EditableField.jsx';
import { buildEditableFieldPaths, getFieldValue, applyPendingEdits } from './fieldUtils.js';

// Read-only replica column — unchanged from Phase 1, reused as-is for the
// EN reference (edit mode) and for the single-column Preview (fed a clone
// with pending edits merged in, via applyPendingEdits).
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

// The editable (AR) column — same layout as RecipeColumn, but every
// translatable spot is an EditableField wired to fieldStates instead of
// plain text. Times stay read-only in both columns: they're language-
// neutral (build spec §1), not part of the fieldPath grammar at all.
function EditableRecipeColumn({ recipe, fieldStates, onCommit }) {
  const ingredients = (recipe.ingredients && recipe.ingredients.ar) || [];
  const instructions = (recipe.instructions && recipe.instructions.ar) || [];

  function field(fieldPath) {
    const state = fieldStates[fieldPath];
    if (!state) return null;
    return (
      <EditableField
        value={state.value}
        status={state.status}
        dir="rtl"
        onCommit={newValue => onCommit(fieldPath, newValue)}
      />
    );
  }

  return (
    <div className="recipe-replica-column" dir="rtl">
      <h2 className="recipe-replica-title">{field('title')}</h2>
      <p className="recipe-replica-description">{field('description')}</p>
      <p className="recipe-replica-meta">
        <strong>Category:</strong> {field('recipeCategory')} &nbsp;|&nbsp;
        <strong>Cuisine:</strong> {field('recipeCuisine')} &nbsp;|&nbsp;
        <strong>Yield:</strong> {field('recipeYield')}
      </p>
      <p className="recipe-replica-meta">
        <strong>Prep:</strong> {formatDuration(recipe.prepTime, 'ar')} &nbsp;|&nbsp;
        <strong>Cook:</strong> {formatDuration(recipe.cookTime, 'ar')} &nbsp;|&nbsp;
        <strong>Total:</strong> {formatDuration(recipe.totalTime, 'ar')}
      </p>

      <section className="recipe-replica-section">
        <h3>Ingredients</h3>
        <ul>{ingredients.map((_, i) => <li key={i}>{field(`ingredients[${i}]`)}</li>)}</ul>
      </section>

      <section className="recipe-replica-section">
        <h3>Instructions</h3>
        <ol>{instructions.map((_, i) => <li key={i}>{field(`instructions[${i}]`)}</li>)}</ol>
      </section>
    </div>
  );
}

export default function RecipeReplica({ slug, onBack }) {
  const [recipe, setRecipe] = useState(null);
  const [fieldStates, setFieldStates] = useState({});
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('edit'); // 'edit' | 'preview'
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    setRecipe(null);
    setFieldStates({});
    setError(null);
    setViewMode('edit');
    setSaveError(null);

    Promise.all([
      apiGet(`/api/recipes/${encodeURIComponent(slug)}`),
      apiGet('/api/edits/mine'),
    ]).then(([fetchedRecipe, myEdits]) => {
      setRecipe(fetchedRecipe);
      const initial = {};
      buildEditableFieldPaths(fetchedRecipe).forEach(fieldPath => {
        const existing = myEdits.find(e => e.recipe_slug === slug && e.lang === 'ar' && e.field_path === fieldPath);
        initial[fieldPath] = existing
          ? { value: existing.new_value, status: 'pending' }
          : { value: getFieldValue(fetchedRecipe, fieldPath, 'ar'), status: 'clean' };
      });
      setFieldStates(initial);
    }).catch(err => setError(err.message));
  }, [slug]);

  const hasDirty = Object.values(fieldStates).some(s => s.status === 'dirty');
  const pendingCount = Object.values(fieldStates).filter(s => s.status === 'pending').length;

  // Browser-level nav/close/reload guard. In-app "Back" is guarded
  // separately in handleBack, since this event doesn't fire for that.
  useEffect(() => {
    function handler(e) {
      if (hasDirty) { e.preventDefault(); e.returnValue = ''; }
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasDirty]);

  function handleFieldCommit(fieldPath, newValue) {
    setFieldStates(prev => {
      const current = prev[fieldPath];
      if (!current || current.value === newValue) return prev; // no-op edit, don't mark dirty
      return { ...prev, [fieldPath]: { ...current, value: newValue, status: 'dirty' } };
    });
  }

  function handleBack() {
    if (hasDirty && !window.confirm('You have unsaved changes. Leave anyway?')) return;
    onBack();
  }

  async function handleSave() {
    const dirtyPaths = Object.entries(fieldStates).filter(([, s]) => s.status === 'dirty').map(([fp]) => fp);
    if (dirtyPaths.length === 0) return;

    setSaving(true);
    setSaveError(null);

    const results = await Promise.allSettled(dirtyPaths.map(fieldPath =>
      apiPost('/api/edits', {
        recipeSlug: slug,
        lang: 'ar',
        fieldPath,
        refValue: getFieldValue(recipe, fieldPath, 'en'),
        oldValue: getFieldValue(recipe, fieldPath, 'ar'),
        newValue: fieldStates[fieldPath].value,
      }).then(edit => ({ fieldPath, edit }))
    ));

    setFieldStates(prev => {
      const next = { ...prev };
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const { fieldPath, edit } = r.value;
          next[fieldPath] = { ...next[fieldPath], status: 'pending', value: edit.new_value };
        }
        // rejected -> leave as 'dirty', nothing lost, retry via Save again
      });
      return next;
    });

    const failCount = results.filter(r => r.status === 'rejected').length;
    setSaveError(failCount > 0 ? `${failCount} field${failCount === 1 ? '' : 's'} failed to save — still marked unsaved, try Save again.` : null);
    setSaving(false);
  }

  return (
    <div className="recipe-replica">
      <button className="recipe-replica-back" onClick={handleBack}>&larr; Back to recipes</button>

      {error && <div className="recipes-error">Couldn't load recipe: {error}</div>}
      {!error && !recipe && <div className="recipes-loading">Loading recipe…</div>}

      {recipe && (
        <>
          <div className="recipe-replica-toolbar">
            <div className="view-tabs recipe-replica-modes">
              <button className={`view-tab ${viewMode === 'edit' ? 'active' : ''}`} onClick={() => setViewMode('edit')}>Edit</button>
              <button className={`view-tab ${viewMode === 'preview' ? 'active' : ''}`} onClick={() => setViewMode('preview')}>Preview</button>
            </div>
            <div className="recipe-replica-status">
              <span className="pending-count-badge">{pendingCount} pending edit{pendingCount === 1 ? '' : 's'}</span>
              {viewMode === 'edit' && (
                <button className="recipe-save-btn" onClick={handleSave} disabled={!hasDirty || saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>
          </div>

          {saveError && <div className="recipes-error recipe-save-error">{saveError}</div>}

          {viewMode === 'edit' ? (
            <div className="recipe-replica-columns">
              <RecipeColumn recipe={recipe} lang="en" dir="ltr" />
              <EditableRecipeColumn recipe={recipe} fieldStates={fieldStates} onCommit={handleFieldCommit} />
            </div>
          ) : (
            <div className="recipe-replica-preview">
              <RecipeColumn recipe={applyPendingEdits(recipe, fieldStates, 'ar')} lang="ar" dir="rtl" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
