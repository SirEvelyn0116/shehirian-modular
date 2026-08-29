import { useEffect, useState } from 'react';
import { apiGet, apiPost } from './api.js';

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hy', label: 'Armenian' },
];

// Per-recipe, per-language publish status. Read-only pills for everyone;
// approvers (editable) get them as clickable toggles instead — same row,
// same data, the only difference is whether onToggle exists. Each pill
// tracks its own in-flight/error state locally (keyed off the recipe's
// slug+lang) so one language's toggle failing doesn't block or hide the
// others.
function PublishStatusRow({ slug, published, editable, pendingKey, onToggle }) {
  return (
    <div className="recipe-publish-status">
      {LANGS.map(({ code, label }) => {
        const isPublished = !!(published && published[code]);
        const key = `${slug}:${code}`;
        const busy = pendingKey === key;
        const pillClass = `publish-pill ${isPublished ? 'publish-pill-on' : 'publish-pill-off'}${busy ? ' publish-pill-busy' : ''}`;

        if (!editable) {
          return <span key={code} className={pillClass} title={label}>{code}</span>;
        }

        return (
          <button
            key={code}
            type="button"
            className={pillClass}
            title={`${label}: ${isPublished ? 'published' : 'not published'} — click to ${isPublished ? 'unpublish' : 'publish'}`}
            disabled={busy}
            onClick={(e) => { e.stopPropagation(); onToggle(slug, code, !isPublished, label); }}
          >
            {code}{busy ? '…' : ''}
          </button>
        );
      })}
    </div>
  );
}

export default function RecipeList({ onSelect, showPublishControls }) {
  const [recipes, setRecipes] = useState(null);
  const [error, setError] = useState(null);
  // At most one toggle in flight at a time across the whole list — kept
  // simple deliberately: this is a low-frequency admin action (build spec:
  // "with a single approver this is rare in practice"), not a bulk editor,
  // so there's no need for per-row concurrent-request bookkeeping.
  const [pendingKey, setPendingKey] = useState(null);
  const [toggleErrors, setToggleErrors] = useState({});

  useEffect(() => {
    apiGet('/api/recipes').then(setRecipes).catch(err => setError(err.message));
  }, []);

  if (error) return <div className="recipes-error">Couldn't load recipes: {error}</div>;
  if (!recipes) return <div className="recipes-loading">Loading recipes…</div>;

  // Each toggle commits straight to the repo and redeploys the live site
  // (recipes-publish.js reuses recipes-approve.js's own commit path) — a
  // lightweight confirm here is a cheap safety net against a stray click on
  // a production-writing control, same spirit as EditableField's Escape-to-
  // cancel: not explicitly speced, easy to drop if unwanted.
  async function handleToggle(slug, lang, nextValue, langLabel) {
    if (!window.confirm(`${nextValue ? 'Publish' : 'Unpublish'} the ${langLabel} version of this recipe? This commits to the repo and deploys the live site.`)) {
      return;
    }
    const key = `${slug}:${lang}`;
    setPendingKey(key);
    setToggleErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
    try {
      const result = await apiPost('/api/recipes/publish', { recipeSlug: slug, lang, published: nextValue });
      setRecipes(prev => prev.map(r => r.slug === slug ? { ...r, published: { ...r.published, [lang]: result.published } } : r));
    } catch (err) {
      setToggleErrors(prev => ({ ...prev, [key]: err.message }));
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <>
      {/* Deliberately light — Phase 7's unification folds this and the
          ui-strings workflow-steps into one shared instruction set (§10).
          Edit-flow guidance only makes sense when this list is navigable
          into the replica editor (onSelect present, i.e. isTranslator) —
          an approver-only viewer sees just the list + publish pills below,
          nothing here to tell them to "click a field." */}
      {onSelect && (
        <div className="workflow-steps recipes-workflow-steps">
          <div className="step"><strong>Step 1</strong> Pick a recipe</div>
          <div className="step"><strong>Step 2</strong> Click a field to edit it</div>
          <div className="step"><strong>Step 3</strong> Save to submit for approval</div>
        </div>
      )}

      <ul className="recipe-picker-list">
        {recipes.map(r => (
          <li key={r.slug} className="recipe-picker-row">
            {onSelect ? (
              <button className="recipe-picker-item" onClick={() => onSelect(r.slug)}>
                <span className="recipe-picker-title">{r.title}</span>
                <span className="recipe-picker-meta">
                  {r.pendingCount > 0 && (
                    <span className="recipe-picker-pending-badge">{r.pendingCount} pending</span>
                  )}
                  <span className="recipe-picker-category">{r.categoryId}</span>
                </span>
              </button>
            ) : (
              <div className="recipe-picker-item recipe-picker-item-static">
                <span className="recipe-picker-title">{r.title}</span>
                <span className="recipe-picker-meta">
                  <span className="recipe-picker-category">{r.categoryId}</span>
                </span>
              </div>
            )}
            <PublishStatusRow
              slug={r.slug}
              published={r.published}
              editable={!!showPublishControls}
              pendingKey={pendingKey}
              onToggle={handleToggle}
            />
            {LANGS.map(({ code }) => toggleErrors[`${r.slug}:${code}`] && (
              <div key={code} className="publish-toggle-error">{code}: {toggleErrors[`${r.slug}:${code}`]}</div>
            ))}
          </li>
        ))}
      </ul>
    </>
  );
}
