import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from './api.js';

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hy', label: 'Armenian' },
];

// Section order and English labels for the admin list — menu order, matching
// sections/categories.json's ids. The admin UI is English-only, so no fetch.
// Any categoryId not listed here still gets its own section, after these.
const CATEGORY_ORDER = [
  ['soup', 'Soup'], ['salad', 'Salad'], ['starter', 'Starter'], ['main', 'Main Dish'],
  ['side', 'Side Dish'], ['dessert', 'Dessert'], ['other', 'Other'],
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORY_ORDER);

// Open sections survive leaving for the editor and coming back (the list
// remounts). Per-tab convenience only — wrapped in try/catch, never required.
const OPEN_KEY = 'recipeList.openGroups';
function loadOpen() {
  try { return new Set(JSON.parse(sessionStorage.getItem(OPEN_KEY) || '[]')); } catch { return new Set(); }
}
function saveOpen(set) {
  try { sessionStorage.setItem(OPEN_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}

// Per-recipe, per-language publish status. Read-only pills for everyone;
// approvers (editable) get them as clickable toggles instead — same row,
// same data, the only difference is whether onToggle exists. Each pill
// tracks its own in-flight/error state locally (keyed off the recipe's
// slug+lang) so one language's toggle failing doesn't block or hide the
// others.
//
// Clicking a pill no longer publishes anything (2026-10). It QUEUES a
// publish/unpublish request, which goes live only when it's approved on the
// Review tab, batched with everything else. A queued pill shows the state
// it's heading to, dashed, with an arrow; clicking it again withdraws the
// request.
function PublishStatusRow({ slug, published, pendingPublish, editable, pendingKey, onToggle }) {
  return (
    <div className="recipe-publish-status">
      {LANGS.map(({ code, label }) => {
        const isPublished = !!(published && published[code]);
        const queued = pendingPublish && code in pendingPublish ? pendingPublish[code] : null;
        const shown = queued === null ? isPublished : queued;
        const key = `${slug}:${code}`;
        const busy = pendingKey === key;
        const pillClass = `publish-pill ${shown ? 'publish-pill-on' : 'publish-pill-off'}${queued !== null ? ' publish-pill-queued' : ''}${busy ? ' publish-pill-busy' : ''}`;
        const status = queued === null
          ? (isPublished ? 'published' : 'not published')
          : `${isPublished ? 'published' : 'not published'}, ${queued ? 'publish' : 'unpublish'} queued for approval`;

        if (!editable) {
          return <span key={code} className={pillClass} title={`${label}: ${status}`}>{queued !== null ? '→' : ''}{code}</span>;
        }

        const action = queued !== null
          ? 'withdraw the request'
          : `queue a request to ${isPublished ? 'unpublish' : 'publish'} (approve it on the Review tab)`;
        return (
          <button
            key={code}
            type="button"
            className={pillClass}
            title={`${label}: ${status} — click to ${action}`}
            disabled={busy}
            onClick={(e) => { e.stopPropagation(); onToggle(slug, code, queued !== null ? isPublished : !isPublished); }}
          >
            {queued !== null ? '→' : ''}{code}{busy ? '…' : ''}
          </button>
        );
      })}
    </div>
  );
}

// "en 3/3 · fr 0/3 …" — how much of a set is published in each language.
function LangCounts({ recipes }) {
  return (
    <span className="recipe-lang-counts">
      {LANGS.map(({ code, label }) => {
        const n = recipes.filter(r => r.published && r.published[code]).length;
        const full = n === recipes.length && n > 0;
        return (
          <span key={code} className={`recipe-lang-count${full ? ' recipe-lang-count-full' : ''}`} title={`${label}: ${n} of ${recipes.length} published`}>
            {code} {n}/{recipes.length}
          </span>
        );
      })}
    </span>
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
  const [openGroups, setOpenGroups] = useState(loadOpen);

  useEffect(() => {
    apiGet('/api/recipes').then(setRecipes).catch(err => setError(err.message));
  }, []);

  const groups = useMemo(() => {
    if (!recipes) return [];
    const byCat = new Map();
    for (const r of recipes) {
      const id = r.categoryId || 'other';
      if (!byCat.has(id)) byCat.set(id, []);
      byCat.get(id).push(r);
    }
    const known = CATEGORY_ORDER.map(([id]) => id).filter(id => byCat.has(id));
    const extra = [...byCat.keys()].filter(id => !CATEGORY_LABEL[id]).sort();
    return [...known, ...extra].map(id => ({
      id,
      label: CATEGORY_LABEL[id] || id.charAt(0).toUpperCase() + id.slice(1),
      recipes: byCat.get(id).slice().sort((a, b) => (a.title || a.slug).localeCompare(b.title || b.slug)),
    }));
  }, [recipes]);

  if (error) return <div className="recipes-error">Couldn't load recipes: {error}</div>;
  if (!recipes) return <div className="recipes-loading">Loading recipes…</div>;

  function setGroupOpen(id, isOpen) {
    setOpenGroups(prev => {
      if (prev.has(id) === isOpen) return prev;
      const next = new Set(prev);
      if (isOpen) next.add(id); else next.delete(id);
      saveOpen(next);
      return next;
    });
  }
  const allOpen = groups.length > 0 && groups.every(g => openGroups.has(g.id));
  function toggleAll() {
    const next = allOpen ? new Set() : new Set(groups.map(g => g.id));
    saveOpen(next);
    setOpenGroups(next);
  }

  // A toggle only queues (or withdraws) a request — nothing reaches the
  // live site until it's approved on the Review tab — so no confirm dialog.
  async function handleToggle(slug, lang, nextValue) {
    const key = `${slug}:${lang}`;
    setPendingKey(key);
    setToggleErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
    try {
      const result = await apiPost('/api/recipes/publish', { recipeSlug: slug, lang, published: nextValue });
      setRecipes(prev => prev.map(r => {
        if (r.slug !== slug) return r;
        const pendingPublish = { ...(r.pendingPublish || {}) };
        if (result.pendingPublish === null) delete pendingPublish[lang];
        else pendingPublish[lang] = result.pendingPublish;
        return { ...r, published: { ...r.published, [lang]: result.published }, pendingPublish };
      }));
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

      {showPublishControls && (() => {
        const queued = recipes.reduce((n, r) => n + Object.keys(r.pendingPublish || {}).length, 0);
        return (
          <div className="recipe-publish-hint">
            Clicking a language pill queues a publish or unpublish request. Nothing goes live until you approve it on the Review tab.
            {queued > 0 && <strong> {queued} request{queued === 1 ? '' : 's'} waiting.</strong>}
          </div>
        );
      })()}

      <div className="recipe-list-summary">
        <span className="recipe-list-total">
          <strong>{recipes.length}</strong> recipes · {groups.length} categories
        </span>
        <span className="recipe-list-published">Published: <LangCounts recipes={recipes} /></span>
        <button type="button" className="recipe-list-toggle" onClick={toggleAll}>
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {groups.map(g => {
        const pending = g.recipes.reduce((n, r) => n + (r.pendingCount || 0), 0);
        return (
          <details
            key={g.id}
            className="recipe-group"
            open={openGroups.has(g.id)}
            onToggle={(e) => setGroupOpen(g.id, e.currentTarget.open)}
          >
            <summary className="recipe-group-summary">
              <span className="recipe-group-name">{g.label}</span>
              <span className="recipe-group-count">({g.recipes.length})</span>
              {pending > 0 && <span className="recipe-picker-pending-badge">{pending} pending</span>}
              <LangCounts recipes={g.recipes} />
            </summary>

            <ul className="recipe-picker-list">
              {g.recipes.map(r => (
                <li key={r.slug} className="recipe-picker-row">
                  <div className={`recipe-picker-line${onSelect ? ' recipe-picker-line-clickable' : ''}`}>
                    {onSelect ? (
                      <button className="recipe-picker-item" onClick={() => onSelect(r.slug)}>
                        <span className="recipe-picker-title">{r.title}</span>
                        {r.pendingCount > 0 && (
                          <span className="recipe-picker-pending-badge">{r.pendingCount} pending</span>
                        )}
                        {r.rejectedCount > 0 && (
                          <span className="recipe-picker-rejected-badge">{r.rejectedCount} rejected</span>
                        )}
                      </button>
                    ) : (
                      <div className="recipe-picker-item recipe-picker-item-static">
                        <span className="recipe-picker-title">{r.title}</span>
                      </div>
                    )}
                    <PublishStatusRow
                      slug={r.slug}
                      published={r.published}
                      pendingPublish={r.pendingPublish}
                      editable={!!showPublishControls}
                      pendingKey={pendingKey}
                      onToggle={handleToggle}
                    />
                  </div>
                  {LANGS.map(({ code }) => toggleErrors[`${r.slug}:${code}`] && (
                    <div key={code} className="publish-toggle-error">{code}: {toggleErrors[`${r.slug}:${code}`]}</div>
                  ))}
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </>
  );
}
