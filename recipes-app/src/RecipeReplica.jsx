import { useEffect, useRef, useState } from 'react';
import { apiGet, apiPost } from './api.js';
import formatDuration from './formatDuration.js';
import EditableField from './EditableField.jsx';
import RecipePagePreview from './RecipePagePreview.jsx';
import { buildEditableFieldPaths, getFieldValue, applyCurrentEdits } from './fieldUtils.js';

// Target languages a reviewer can pick in the editable column. Arabic is
// first/default since that's where the primary work is; Armenian and French
// are both LTR (dir logic below is the only thing that branches on 'ar').
const TARGET_LANGS = [
  { code: 'ar', label: 'Arabic' },
  { code: 'hy', label: 'Armenian' },
  { code: 'fr', label: 'French' },
];
const dirFor = lang => (lang === 'ar' ? 'rtl' : 'ltr');

// Read-only replica column — the EN reference in edit mode. (Preview mode
// no longer reuses this — see RecipePagePreview.jsx, which reproduces the
// real recipe page structure/CSS instead of this stripped-down layout.)
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

      <section className="recipe-replica-section recipe-instructions">
        <h3>Instructions</h3>
        <ol>{instructions.map((step, i) => <li key={i}>{step}</li>)}</ol>
      </section>
    </div>
  );
}

// The editable column — same layout as RecipeColumn, but every translatable
// spot is an EditableField wired to fieldStates instead of plain text. Times
// stay read-only in both columns: they're language-neutral (build spec §1),
// not part of the fieldPath grammar at all.
function EditableRecipeColumn({ recipe, lang, dir, fieldStates, onCommit }) {
  const ingredients = (recipe.ingredients && recipe.ingredients[lang]) || [];
  const instructions = (recipe.instructions && recipe.instructions[lang]) || [];

  function field(fieldPath) {
    const state = fieldStates[fieldPath];
    if (!state) return null;
    return (
      <EditableField
        value={state.value}
        status={state.status}
        dir={dir}
        onCommit={newValue => onCommit(fieldPath, newValue)}
      />
    );
  }

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
        <ul>{ingredients.map((_, i) => <li key={i}>{field(`ingredients[${i}]`)}</li>)}</ul>
      </section>

      <section className="recipe-replica-section recipe-instructions">
        <h3>Instructions</h3>
        <ol>{instructions.map((_, i) => <li key={i}>{field(`instructions[${i}]`)}</li>)}</ol>
      </section>
    </div>
  );
}

export default function RecipeReplica({ slug, onBack }) {
  const [recipe, setRecipe] = useState(null);
  const [myEdits, setMyEdits] = useState([]);
  const [fieldStates, setFieldStates] = useState({});
  const [lang, setLang] = useState('ar');
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('edit'); // 'edit' | 'preview'
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    setRecipe(null);
    setMyEdits([]);
    setFieldStates({});
    setLang('ar');
    setError(null);
    setViewMode('edit');
    setSaveError(null);

    Promise.all([
      apiGet(`/api/recipes/${encodeURIComponent(slug)}`),
      apiGet('/api/edits/mine'),
    ]).then(([fetchedRecipe, edits]) => {
      setRecipe(fetchedRecipe);
      setMyEdits(edits);
    }).catch(err => setError(err.message));
  }, [slug]);

  // myEdits read via ref (not as an effect dependency below) so that
  // syncing it after a save — see handleSave — doesn't itself retrigger the
  // rebuild and clobber any other field still sitting 'dirty' from a failed
  // save in the same batch.
  const myEditsRef = useRef(myEdits);
  useEffect(() => { myEditsRef.current = myEdits; }, [myEdits]);

  // Rebuilds fieldStates for whichever language is currently selected — on
  // the initial recipe load and on every lang switch. Only one language's
  // fieldStates exist in memory at a time by design (see confirmLeaveIfDirty
  // below): switching languages always starts from a clean/pending baseline,
  // never from a previous language's in-progress edits.
  useEffect(() => {
    if (!recipe) return;
    const initial = {};
    buildEditableFieldPaths(recipe, lang).forEach(fieldPath => {
      const existing = myEditsRef.current.find(e => e.recipe_slug === slug && e.lang === lang && e.field_path === fieldPath);
      initial[fieldPath] = existing
        ? { value: existing.new_value, status: 'pending' }
        : { value: getFieldValue(recipe, fieldPath, lang), status: 'clean' };
    });
    setFieldStates(initial);
  }, [recipe, lang, slug]);

  const dir = dirFor(lang);
  const hasDirty = Object.values(fieldStates).some(s => s.status === 'dirty');
  const pendingCount = Object.values(fieldStates).filter(s => s.status === 'pending').length;

  // Shared unsaved-changes guard — same check/prompt used for in-app "Back"
  // and, now, for switching the editable column's language. Only one
  // language's fieldStates ever exist in memory at a time (rebuilt on
  // switch, see above), so a dirty guard here is the only thing standing
  // between an in-progress edit and silently losing it.
  function confirmLeaveIfDirty() {
    return !hasDirty || window.confirm('You have unsaved changes. Leave anyway?');
  }

  function handleLangChange(newLang) {
    if (newLang === lang) return;
    if (!confirmLeaveIfDirty()) return;
    setLang(newLang);
  }

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
    if (!confirmLeaveIfDirty()) return;
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
        lang,
        fieldPath,
        refValue: getFieldValue(recipe, fieldPath, 'en'),
        oldValue: getFieldValue(recipe, fieldPath, lang),
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

    // Keep myEdits in sync so a later switch back to this language rebuilds
    // fieldStates from up-to-date pending values instead of the stale list
    // fetched at recipe-load time.
    const savedEdits = results.filter(r => r.status === 'fulfilled').map(r => r.value.edit);
    if (savedEdits.length > 0) {
      setMyEdits(prev => {
        const next = [...prev];
        savedEdits.forEach(edit => {
          const i = next.findIndex(e => e.recipe_slug === edit.recipe_slug && e.lang === edit.lang && e.field_path === edit.field_path);
          if (i >= 0) next[i] = edit; else next.push(edit);
        });
        return next;
      });
    }

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
              <div className="recipe-replica-column-wrap">
                <div className="view-tabs recipe-replica-lang-tabs">
                  {TARGET_LANGS.map(({ code, label }) => (
                    <button
                      key={code}
                      className={`view-tab ${lang === code ? 'active' : ''}`}
                      onClick={() => handleLangChange(code)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <EditableRecipeColumn recipe={recipe} lang={lang} dir={dir} fieldStates={fieldStates} onCommit={handleFieldCommit} />
              </div>
            </div>
          ) : (
            <div className="recipe-replica-preview">
              <RecipePagePreview recipe={applyCurrentEdits(recipe, fieldStates, lang)} lang={lang} dir={dir} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
